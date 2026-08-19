import { google } from "googleapis";

// Google Sheets configuration
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || "";
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n") || "";

let sheets: ReturnType<typeof google.sheets> | null = null;

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

// Sheet names (tabs)
const SHEETS = {
  USERS: "Users",
  SUBJECTS: "Subjects",
  EXAMS: "Exams",
  ATTEMPTS: "Attempts",
} as const;

// Header rows for each sheet
const HEADERS = {
  [SHEETS.USERS]: ["id", "name", "username", "password_hash", "role", "created_at"],
  [SHEETS.SUBJECTS]: ["id", "name", "description", "created_by", "created_at"],
  [SHEETS.EXAMS]: ["id", "title", "subject_id", "description", "google_form_url", "duration_minutes", "is_active", "starts_at", "ends_at", "created_by", "created_at"],
  [SHEETS.ATTEMPTS]: ["id", "exam_id", "student_id", "status", "started_at", "ends_at", "completed_at", "violation_count", "violations"],
} as const;

// Initialize spreadsheet with sheet tabs and headers
export async function initializeSpreadsheet() {
  const sheetsApi = await getSheets();
  
  try {
    // Get existing sheets
    const spreadsheet = await sheetsApi.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    
    const existingSheets = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];
    
    // Create missing sheets
    for (const [key, title] of Object.entries(SHEETS)) {
      if (!existingSheets.includes(title)) {
        await sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [{
              addSheet: {
                properties: { title }
              }
            }]
          }
        });
        
        // Add headers
        const headers = HEADERS[title as keyof typeof HEADERS];
        await sheetsApi.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${title}!A1:Z1`,
          valueInputOption: "RAW",
          requestBody: { values: [headers] }
        });
      }
    }
    
    console.log("Spreadsheet initialized successfully");
  } catch (error) {
    console.error("Failed to initialize spreadsheet:", error);
    throw error;
  }
}

// Generate a simple unique ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Read all rows from a sheet
export async function readSheet(sheetName: string): Promise<Record<string, any>[]> {
  const sheetsApi = await getSheets();
  
  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  
  const rows = response.data.values || [];
  if (rows.length < 2) return [];
  
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj: Record<string, any> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || "";
    });
    return obj;
  });
}

// Find a row by a specific column value
export async function findByField<T extends Record<string, any>>(
  sheetName: string,
  fieldName: string,
  fieldValue: string,
): Promise<T | null> {
  const rows = await readSheet(sheetName);
  return (rows.find(row => row[fieldName] === fieldValue) as T) || null;
}

// Find all rows matching a field value
export async function findAllByField<T extends Record<string, any>>(
  sheetName: string,
  fieldName: string,
  fieldValue: string,
): Promise<T[]> {
  const rows = await readSheet(sheetName);
  return rows.filter(row => row[fieldName] === fieldValue) as T[];
}

// Add a new row
export async function addRow(
  sheetName: string,
  data: Record<string, any>,
): Promise<void> {
  const sheetsApi = await getSheets();
  const headers = HEADERS[sheetName as keyof typeof HEADERS];
  
  if (!headers) {
    throw new Error(`Unknown sheet: ${sheetName}`);
  }
  
  const row = headers.map(header => data[header] || "");
  
  await sheetsApi.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
    valueInputOption: "RAW",
    requestBody: { values: [row] }
  });
}

// Update a row by ID
export async function updateRow(
  sheetName: string,
  id: string,
  data: Record<string, any>,
): Promise<boolean> {
  const sheetsApi = await getSheets();
  const headers = HEADERS[sheetName as keyof typeof HEADERS];
  
  if (!headers) {
    throw new Error(`Unknown sheet: ${sheetName}`);
  }
  
  // Find the row number
  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  
  const rows = response.data.values || [];
  const idIndex = headers.indexOf("id");
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIndex] === id) {
      // Update the row
      const updatedRow = headers.map(header => 
        data[header] !== undefined ? data[header] : (rows[i][headers.indexOf(header)] || "")
      );
      
      await sheetsApi.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A${i + 1}:Z${i + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: [updatedRow] }
      });
      
      return true;
    }
  }
  
  return false;
}

// Delete a row by ID
export async function deleteRow(sheetName: string, id: string): Promise<boolean> {
  const sheetsApi = await getSheets();
  const headers = HEADERS[sheetName as keyof typeof HEADERS];
  
  if (!headers) {
    throw new Error(`Unknown sheet: ${sheetName}`);
  }
  
  // Find the row number
  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  
  const rows = response.data.values || [];
  const idIndex = headers.indexOf("id");
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIndex] === id) {
      // Delete by clearing the row (Google Sheets doesn't have row delete API)
      // We'll mark it as deleted or use batchUpdate to delete the row
      await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: 0, // This needs to be the actual sheet ID
                dimension: "ROWS",
                startIndex: i,
                endIndex: i + 1,
              }
            }
          }]
        }
      });
      
      return true;
    }
  }
  
  return false;
}

// Export sheet names
export { SHEETS };
