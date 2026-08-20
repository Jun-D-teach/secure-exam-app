import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SPREADSHEET_ID || "";
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
const GOOGLE_PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

let sheets = null;

async function getSheets() {
  if (sheets) return sheets;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

export const SHEETS = {
  USERS: "Users",
  SUBJECTS: "Subjects",
  EXAMS: "Exams",
  ATTEMPTS: "Attempts",
};

const HEADERS = {
  [SHEETS.USERS]: ["id", "name", "username", "password_hash", "role", "created_at"],
  [SHEETS.SUBJECTS]: ["id", "name", "description", "created_by", "created_at"],
  [SHEETS.EXAMS]: ["id", "title", "subject_id", "description", "google_form_url", "duration_minutes", "is_active", "starts_at", "ends_at", "created_by", "created_at"],
  [SHEETS.ATTEMPTS]: ["id", "exam_id", "student_id", "status", "started_at", "ends_at", "completed_at", "violation_count", "violations"],
};

export async function initializeSpreadsheet() {
  const sheetsApi = await getSheets();

  try {
    const spreadsheet = await sheetsApi.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existingSheets = (spreadsheet.data.sheets || []).map(s => s.properties?.title || "");

    for (const [key, title] of Object.entries(SHEETS)) {
      if (!existingSheets.includes(title)) {
        await sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: { requests: [{ addSheet: { properties: { title } } }] },
        });

        const headers = HEADERS[title];
        await sheetsApi.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${title}!A1:Z1`,
          valueInputOption: "RAW",
          requestBody: { values: [headers] },
        });
      }
    }

    console.log("Spreadsheet initialized successfully");
  } catch (error) {
    console.error("Failed to initialize spreadsheet:", error);
    throw error;
  }
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export async function readSheet(sheetName) {
  const sheetsApi = await getSheets();

  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });

  const rows = response.data.values || [];
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || "";
    });
    return obj;
  });
}

export async function findByField(sheetName, fieldName, fieldValue) {
  const rows = await readSheet(sheetName);
  return rows.find(row => row[fieldName] === fieldValue) || null;
}

export async function addRow(sheetName, data) {
  const sheetsApi = await getSheets();
  const headers = HEADERS[sheetName];

  if (!headers) throw new Error(`Unknown sheet: ${sheetName}`);

  const row = headers.map(header => data[header] || "");

  await sheetsApi.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
}

export async function updateRow(sheetName, id, data) {
  const sheetsApi = await getSheets();
  const headers = HEADERS[sheetName];

  if (!headers) throw new Error(`Unknown sheet: ${sheetName}`);

  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });

  const rows = response.data.values || [];
  const idIndex = headers.indexOf("id");

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIndex] === id) {
      const updatedRow = headers.map(header =>
        data[header] !== undefined ? data[header] : (rows[i][headers.indexOf(header)] || "")
      );

      await sheetsApi.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A${i + 1}:Z${i + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: [updatedRow] },
      });

      return true;
    }
  }

  return false;
}

export async function deleteRow(sheetName, id) {
  const sheetsApi = await getSheets();
  const headers = HEADERS[sheetName];

  if (!headers) throw new Error(`Unknown sheet: ${sheetName}`);

  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });

  const rows = response.data.values || [];
  const idIndex = headers.indexOf("id");

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIndex] === id) {
      // Get the sheetId from properties
      const spreadsheet = await sheetsApi.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
      const sheet = spreadsheet.data.sheets.find(s => s.properties?.title === sheetName);
      const sheetId = sheet?.properties?.sheetId ?? 0;

      await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: { sheetId, dimension: "ROWS", startIndex: i, endIndex: i + 1 },
            },
          }],
        },
      });

      return true;
    }
  }

  return false;
}
