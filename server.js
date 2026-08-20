/**
 * UjianKita - Express.js Server Entry Point
 * Compatible with Hostinger Express preset (runs with `node server.js`)
 */

// IMMEDIATE startup log
console.log("[UjianKita] server.js loaded at", new Date().toISOString());
console.log("[UjianKita] Node.js", process.version, "| PID", process.pid);
console.log("[UjianKita] CWD:", process.cwd());

// Global error handlers
process.on("uncaughtException", function (err) {
  console.error("[UjianKita] UNCAUGHT EXCEPTION:", err.message);
  console.error(err.stack);
});
process.on("unhandledRejection", function (reason) {
  console.error("[UjianKita] UNHANDLED REJECTION:", reason);
});

var express = require("express");
var cors = require("cors");
var path = require("path");
var fs = require("fs");

console.log("[UjianKita] Dependencies loaded");

var app = express();
var PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Google Sheets ---
var googleapis;
try {
  googleapis = require("googleapis");
  console.log("[UjianKita] googleapis loaded");
} catch (e) {
  console.error("[UjianKita] FAILED to load googleapis:", e.message);
}

var SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "";
var SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";

// --- Normalize Google private key using charCodeAt (avoids all regex escaping issues) ---
function normalizePemKey(raw) {
  if (!raw) return "";
  var s = raw;
  // Remove surrounding quotes
  if (s.length >= 2) {
    var fc = s.charCodeAt(0);
    var lc = s.charCodeAt(s.length - 1);
    if ((fc === 34 && lc === 34) || (fc === 39 && lc === 39)) {
      s = s.substring(1, s.length - 1);
    }
  }
  // Multi-pass: convert all escaped newlines to real newlines
  // Pass 1-5 handles up to 5 levels of escaping
  for (var pass = 0; pass < 5; pass++) {
    var changed = false;
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c === 13) {
        // CR: skip if followed by LF (handle CRLF)
        if (i + 1 < s.length && s.charCodeAt(i + 1) === 10) i++;
        out.push("\n");
        changed = true;
      } else if (c === 92 && i + 1 < s.length) {
        // Backslash: check next char
        var nc = s.charCodeAt(i + 1);
        if (nc === 110) {
          // \n -> newline
          out.push("\n");
          i++;
          changed = true;
        } else if (nc === 114) {
          // \r -> CR (will become newline on next pass if CRLF)
          out.push("\r");
          i++;
          changed = true;
        } else {
          out.push(s.charAt(i));
        }
      } else {
        out.push(s.charAt(i));
      }
    }
    s = out.join("");
    if (!changed) break;
  }
  // Collapse multiple blank lines
  var final = [];
  var blankCount = 0;
  for (var i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 10) {
      blankCount++;
      if (blankCount <= 2) final.push("\n");
    } else {
      blankCount = 0;
      final.push(s.charAt(i));
    }
  }
  return final.join("").trim();
}

var SA_KEY = normalizePemKey(process.env.GOOGLE_PRIVATE_KEY || "");

// Diagnostic logging
console.log("[UjianKita] ENV check:", {
  hasSpreadsheetId: !!SPREADSHEET_ID,
  hasServiceAccountEmail: !!SA_EMAIL,
  hasPrivateKey: !!SA_KEY,
  keyLength: SA_KEY.length,
  hasBeginMarker: SA_KEY.indexOf("-----BEGIN PRIVATE KEY-----") === 0 || SA_KEY.indexOf("-----BEGIN RSA PRIVATE KEY-----") === 0,
  hasEndMarker: SA_KEY.indexOf("-----END PRIVATE KEY-----") > -1,
  lineCount: SA_KEY.split("\n").length,
  nodeEnv: process.env.NODE_ENV || "(not set)",
});

// Validate PEM format
if (SA_KEY && SA_KEY.indexOf("-----BEGIN") !== 0) {
  console.error("[UjianKita] WARNING: Private key does not start with -----BEGIN. First 50 chars:", SA_KEY.substring(0, 50));
}
if (SA_KEY && SA_KEY.indexOf("-----END") === -1) {
  console.error("[UjianKita] WARNING: Private key does not contain -----END marker");
}

var _sheets = null;

async function getSheets() {
  if (_sheets) return _sheets;
  var auth = new googleapis.google.auth.GoogleAuth({
    credentials: { client_email: SA_EMAIL, private_key: SA_KEY },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  _sheets = googleapis.google.sheets({ version: "v4", auth });
  return _sheets;
}

// --- Sheet config ---
var SHEETS = {
  USERS: "Users",
  SUBJECTS: "Subjects",
  EXAMS: "Exams",
  ATTEMPTS: "Attempts",
};

var HEADERS = {};
HEADERS[SHEETS.USERS] = ["id", "name", "username", "password_hash", "role", "created_at"];
HEADERS[SHEETS.SUBJECTS] = ["id", "name", "description", "created_by", "created_at"];
HEADERS[SHEETS.EXAMS] = ["id", "title", "subject_id", "description", "google_form_url", "duration_minutes", "is_active", "starts_at", "ends_at", "created_by", "created_at"];
HEADERS[SHEETS.ATTEMPTS] = ["id", "exam_id", "student_id", "status", "started_at", "ends_at", "completed_at", "violation_count", "violations"];

// --- Sheet helpers ---
async function readSheet(sheetName) {
  var api = await getSheets();
  var res = await api.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: sheetName + "!A:Z" });
  var rows = res.data.values || [];
  if (rows.length < 2) return [];
  var headers = rows[0];
  return rows.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i] || ""; });
    return obj;
  });
}

async function findByField(sheetName, field, value) {
  var rows = await readSheet(sheetName);
  return rows.find(function (r) { return r[field] === value; }) || null;
}

async function addRow(sheetName, data) {
  var api = await getSheets();
  var headers = HEADERS[sheetName];
  if (!headers) throw new Error("Unknown sheet: " + sheetName);
  var row = headers.map(function (h) { return data[h] || ""; });
  await api.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID, range: sheetName + "!A:Z",
    valueInputOption: "RAW", requestBody: { values: [row] },
  });
}

async function updateRow(sheetName, id, data) {
  var api = await getSheets();
  var headers = HEADERS[sheetName];
  if (!headers) throw new Error("Unknown sheet: " + sheetName);
  var res = await api.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: sheetName + "!A:Z" });
  var rows = res.data.values || [];
  var idIdx = headers.indexOf("id");
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === id) {
      var updated = headers.map(function (h) { return data[h] !== undefined ? data[h] : (rows[i][headers.indexOf(h)] || ""); });
      await api.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: sheetName + "!A" + (i + 1) + ":Z" + (i + 1),
        valueInputOption: "RAW", requestBody: { values: [updated] },
      });
      return true;
    }
  }
  return false;
}

async function deleteRow(sheetName, id) {
  var api = await getSheets();
  var headers = HEADERS[sheetName];
  if (!headers) throw new Error("Unknown sheet: " + sheetName);
  var res = await api.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: sheetName + "!A:Z" });
  var rows = res.data.values || [];
  var idIdx = headers.indexOf("id");
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === id) {
      var ss = await api.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
      var sheet = ss.data.sheets.find(function (s) { return s.properties && s.properties.title === sheetName; });
      var sheetId = (sheet && sheet.properties && sheet.properties.sheetId) || 0;
      await api.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ deleteDimension: { range: { sheetId: sheetId, dimension: "ROWS", startIndex: i, endIndex: i + 1 } } }] },
      });
      return true;
    }
  }
  return false;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// --- Auth helpers ---
var bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");
var JWT_SECRET = process.env.JWT_SECRET || "ujiankita-secret-change-in-production";

async function hashPassword(pw) { return bcrypt.hash(pw, 10); }
async function verifyPassword(pw, hash) { return bcrypt.compare(pw, hash); }
function generateToken(payload) { return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" }); }
function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch (_e) { return null; }
}

// --- Auth middleware ---
function authenticate(req, res, next) {
  var authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Token autentikasi diperlukan" });
  var payload = verifyToken(authHeader.substring(7));
  if (!payload) return res.status(401).json({ error: "Token tidak valid atau sudah kedaluwarsa" });
  req.user = payload;
  next();
}

function requireRole(roles) {
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: "Belum masuk" });
    if (roles.indexOf(req.user.role) === -1) return res.status(403).json({ error: "Akses ditolak" });
    next();
  };
}

// ============================================================
//  API ROUTES
// ============================================================

// --- HEALTH CHECK ---
app.get("/api/health", function (_req, res) {
  res.json({ status: "ok", timestamp: Date.now(), port: PORT });
});

// --- DEBUG: Google Sheets diagnostic ---
app.get("/api/debug/sheets", async function (_req, res) {
  var result = { steps: [] };
  try {
    result.steps.push({ name: "env_check", ok: true, data: {
      hasSpreadsheetId: !!SPREADSHEET_ID, hasServiceAccountEmail: !!SA_EMAIL,
      hasPrivateKey: !!SA_KEY, keyLength: SA_KEY.length,
    }});
    try {
      var api = await getSheets();
      result.steps.push({ name: "sheets_client", ok: true });
      try {
        var ss = await api.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        var sheets = (ss.data.sheets || []).map(function (s) { return s.properties && s.properties.title; });
        result.steps.push({ name: "spreadsheet_access", ok: true, data: { title: ss.data.properties && ss.data.properties.title, sheets: sheets } });
        try {
          var vals = await api.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "Users!A:Z" });
          result.steps.push({ name: "read_users", ok: true, data: { rowCount: (vals.data.values || []).length } });
        } catch (e) {
          result.steps.push({ name: "read_users", ok: false, error: e.message });
        }
      } catch (e) {
        result.steps.push({ name: "spreadsheet_access", ok: false, error: e.message });
      }
    } catch (e) {
      result.steps.push({ name: "sheets_client", ok: false, error: e.message });
    }
  } catch (e) {
    result.steps.push({ name: "unknown_error", ok: false, error: e.message });
  }
  res.json(result);
});

// --- AUTH ---
app.post("/api/auth/login", async function (req, res) {
  try {
    var username = req.body && req.body.username;
    var password = req.body && req.body.password;
    if (!username || !password) return res.status(400).json({ error: "Username dan password diperlukan" });
    var user = await findByField(SHEETS.USERS, "username", username);
    if (!user) return res.status(401).json({ error: "Username atau password salah" });
    if (!(await verifyPassword(password, user.password_hash))) return res.status(401).json({ error: "Username atau password salah" });
    var token = generateToken({ userId: user.id, username: user.username, role: user.role });
    res.json({ token: token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
  } catch (e) { console.error("[UjianKita] Login error:", e); res.status(500).json({ error: "Gagal login" }); }
});

app.post("/api/auth/bootstrap-admin", async function (req, res) {
  try {
    var users = await readSheet(SHEETS.USERS);
    if (users.find(function (u) { return u.role === "admin"; })) return res.status(400).json({ error: "Akun admin sudah ada" });
    var name = req.body && req.body.name;
    var username = req.body && req.body.username;
    var password = req.body && req.body.password;
    if (!name || !username || !password) return res.status(400).json({ error: "Nama, username, dan password diperlukan" });
    if (password.length < 8) return res.status(400).json({ error: "Password minimal 8 karakter" });
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return res.status(400).json({ error: "Username harus 3-32 karakter (huruf kecil, angka, . _ -)" });
    if (await findByField(SHEETS.USERS, "username", username)) return res.status(400).json({ error: "Username sudah dipakai" });
    await addRow(SHEETS.USERS, { id: generateId(), name: name.trim() || username, username: username, password_hash: await hashPassword(password), role: "admin", created_at: new Date().toISOString() });
    res.json({ message: "Akun admin berhasil dibuat" });
  } catch (e) { console.error("[UjianKita] Bootstrap error:", e); res.status(500).json({ error: "Gagal membuat akun admin: " + (e.message || "Periksa Google Sheets.") }); }
});

app.post("/api/auth/reset-admin", async function (req, res) {
  try {
    var resetKey = process.env.ADMIN_RESET_KEY;
    if (!resetKey) return res.status(403).json({ error: "Fitur reset admin tidak aktif" });
    var resetToken = req.body && req.body.resetToken;
    var newPassword = req.body && req.body.newPassword;
    var newUsername = req.body && req.body.newUsername;
    if (!resetToken || resetToken !== resetKey) return res.status(401).json({ error: "Reset token salah" });
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: "Password baru minimal 8 karakter" });
    var users = await readSheet(SHEETS.USERS);
    var admin = users.find(function (u) { return u.role === "admin"; });
    if (!admin) {
      var uname = newUsername || "admin";
      if (!/^[a-z0-9_.-]{3,32}$/.test(uname)) return res.status(400).json({ error: "Username harus 3-32 karakter" });
      await addRow(SHEETS.USERS, { id: generateId(), name: "Admin", username: uname, password_hash: await hashPassword(newPassword), role: "admin", created_at: new Date().toISOString() });
      return res.json({ message: "Akun admin berhasil dibuat", username: uname });
    }
    var updates = { password_hash: await hashPassword(newPassword) };
    if (newUsername && newUsername !== admin.username) {
      if (!/^[a-z0-9_.-]{3,32}$/.test(newUsername)) return res.status(400).json({ error: "Username harus 3-32 karakter" });
      if (await findByField(SHEETS.USERS, "username", newUsername)) return res.status(400).json({ error: "Username sudah dipakai" });
      updates.username = newUsername;
    }
    await updateRow(SHEETS.USERS, admin.id, updates);
    res.json({ message: "Admin berhasil direset", username: updates.username || admin.username });
  } catch (e) { console.error("[UjianKita] Reset error:", e); res.status(500).json({ error: "Gagal mereset admin" }); }
});

app.get("/api/auth/has-admin", async function (_req, res) {
  try {
    var users = await readSheet(SHEETS.USERS);
    res.json({ hasAdmin: users.some(function (u) { return u.role === "admin"; }) });
  } catch (e) {
    console.error("[UjianKita] has-admin error:", e.message);
    res.status(500).json({ hasAdmin: null, error: "Gagal terhubung ke Google Sheets: " + (e.message || "Periksa konfigurasi.") });
  }
});

app.get("/api/auth/me", authenticate, async function (req, res) {
  try {
    var user = await findByField(SHEETS.USERS, "id", req.user.userId);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    res.json({ id: user.id, name: user.name, username: user.username, role: user.role });
  } catch (e) { console.error("[UjianKita] me error:", e); res.status(500).json({ error: "Gagal mengambil data" }); }
});

app.put("/api/auth/me", authenticate, async function (req, res) {
  try {
    var name = req.body && req.body.name;
    var username = req.body && req.body.username;
    if (!name && !username) return res.status(400).json({ error: "Tidak ada data yang diubah" });
    var user = await findByField(SHEETS.USERS, "id", req.user.userId);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    var updates = {};
    if (name !== undefined) updates.name = name.trim() || user.name;
    if (username !== undefined && username !== user.username) {
      if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return res.status(400).json({ error: "Username harus 3-32 karakter" });
      var existing = await findByField(SHEETS.USERS, "username", username);
      if (existing && existing.id !== user.id) return res.status(400).json({ error: "Username sudah dipakai" });
      updates.username = username;
    }
    if (Object.keys(updates).length > 0) await updateRow(SHEETS.USERS, user.id, updates);
    if (updates.username) {
      var newToken = generateToken({ userId: user.id, username: updates.username, role: user.role });
      return res.json({ message: "Profil berhasil diubah", token: newToken });
    }
    res.json({ message: "Profil berhasil diubah" });
  } catch (e) { console.error("[UjianKita] update profile error:", e); res.status(500).json({ error: "Gagal mengubah profil" }); }
});

app.post("/api/auth/change-password", authenticate, async function (req, res) {
  try {
    var currentPassword = req.body && req.body.currentPassword;
    var newPassword = req.body && req.body.newPassword;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Password lama dan baru diperlukan" });
    if (newPassword.length < 8) return res.status(400).json({ error: "Password baru minimal 8 karakter" });
    if (newPassword === currentPassword) return res.status(400).json({ error: "Password baru harus berbeda" });
    var user = await findByField(SHEETS.USERS, "id", req.user.userId);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    if (!(await verifyPassword(currentPassword, user.password_hash))) return res.status(401).json({ error: "Password lama salah" });
    await updateRow(SHEETS.USERS, user.id, { password_hash: await hashPassword(newPassword) });
    res.json({ message: "Password berhasil diubah" });
  } catch (e) { console.error("[UjianKita] change-pw error:", e); res.status(500).json({ error: "Gagal mengubah password" }); }
});

// --- USERS ---
app.get("/api/users", authenticate, requireRole(["admin"]), async function (_req, res) {
  try {
    var users = await readSheet(SHEETS.USERS);
    res.json(users.map(function (u) { return { id: u.id, name: u.name, username: u.username, role: u.role, created_at: u.created_at }; }));
  } catch (e) { res.status(500).json({ error: "Gagal mengambil daftar pengguna" }); }
});

app.post("/api/users", authenticate, requireRole(["admin"]), async function (req, res) {
  try {
    var name = req.body && req.body.name;
    var username = req.body && req.body.username;
    var password = req.body && req.body.password;
    var role = req.body && req.body.role;
    if (!name || !username || !password) return res.status(400).json({ error: "Nama, username, dan password diperlukan" });
    if (["teacher", "student"].indexOf(role) === -1) return res.status(400).json({ error: "Role harus teacher atau student" });
    if (password.length < 8) return res.status(400).json({ error: "Password minimal 8 karakter" });
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return res.status(400).json({ error: "Username harus 3-32 karakter" });
    if (await findByField(SHEETS.USERS, "username", username)) return res.status(400).json({ error: "Username sudah dipakai" });
    await addRow(SHEETS.USERS, { id: generateId(), name: name.trim() || username, username: username, password_hash: await hashPassword(password), role: role, created_at: new Date().toISOString() });
    res.json({ message: "Akun berhasil dibuat" });
  } catch (e) { res.status(500).json({ error: "Gagal membuat akun" }); }
});

app.delete("/api/users/:id", authenticate, requireRole(["admin"]), async function (req, res) {
  try {
    var user = await findByField(SHEETS.USERS, "id", req.params.id);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    if (user.role === "admin") return res.status(400).json({ error: "Akun admin tidak bisa dihapus" });
    await deleteRow(SHEETS.USERS, req.params.id);
    res.json({ message: "Akun berhasil dihapus" });
  } catch (e) { res.status(500).json({ error: "Gagal menghapus akun" }); }
});

app.post("/api/users/import", authenticate, requireRole(["admin"]), async function (req, res) {
  try {
    var role = req.body && req.body.role;
    var items = req.body && req.body.items;
    if (!items || items.length === 0) return res.status(400).json({ error: "Tidak ada data untuk diimpor" });
    if (items.length > 200) return res.status(400).json({ error: "Maksimal 200 akun per import" });
    if (["teacher", "student"].indexOf(role) === -1) return res.status(400).json({ error: "Role harus teacher atau student" });
    var existingUsers = await readSheet(SHEETS.USERS);
    var existingUsernames = new Set(existingUsers.map(function (u) { return u.username; }));
    var created = [];
    for (var idx = 0; idx < items.length; idx++) {
      var item = items[idx];
      var itemName = item.name && item.name.trim();
      if (!itemName) continue;
      var uname = (item.username && item.username.trim()) || itemName.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
      if (uname.length < 3) uname = (uname + "uuu").slice(0, 3);
      if (uname.length > 32) uname = uname.slice(0, 32);
      var base = uname;
      var n = 2;
      while (existingUsernames.has(uname) || created.some(function (c) { return c.username === uname; })) {
        uname = base.slice(0, 28) + "-" + n; n++;
      }
      existingUsernames.add(uname);
      var pw = (item.password && item.password.trim()) || (Math.random().toString(36).slice(-8));
      await addRow(SHEETS.USERS, { id: generateId(), name: itemName || uname, username: uname, password_hash: await hashPassword(pw), role: role, created_at: new Date().toISOString() });
      created.push({ name: itemName || uname, username: uname, password: pw });
    }
    res.json(created);
  } catch (e) { res.status(500).json({ error: "Gagal mengimpor pengguna" }); }
});

// --- SUBJECTS ---
app.get("/api/subjects", authenticate, async function (_req, res) {
  try { res.json(await readSheet(SHEETS.SUBJECTS)); } catch (e) { res.status(500).json({ error: "Gagal mengambil daftar mapel" }); }
});

app.post("/api/subjects", authenticate, requireRole(["admin"]), async function (req, res) {
  try {
    var name = req.body && req.body.name;
    var description = req.body && req.body.description;
    if (!name || !name.trim()) return res.status(400).json({ error: "Nama mapel wajib diisi" });
    await addRow(SHEETS.SUBJECTS, { id: generateId(), name: name.trim(), description: (description && description.trim()) || "", created_by: req.user.userId, created_at: new Date().toISOString() });
    res.json({ message: "Mapel berhasil ditambahkan" });
  } catch (e) { res.status(500).json({ error: "Gagal menambahkan mapel" }); }
});

app.delete("/api/subjects/:id", authenticate, requireRole(["admin"]), async function (req, res) {
  try {
    var subjects = await readSheet(SHEETS.SUBJECTS);
    if (!subjects.find(function (s) { return s.id === req.params.id; })) return res.status(404).json({ error: "Mapel tidak ditemukan" });
    await deleteRow(SHEETS.SUBJECTS, req.params.id);
    res.json({ message: "Mapel berhasil dihapus" });
  } catch (e) { res.status(500).json({ error: "Gagal menghapus mapel" }); }
});

// --- EXAMS ---
app.get("/api/exams", authenticate, async function (req, res) {
  try {
    var exams = await readSheet(SHEETS.EXAMS);
    var subjects = await readSheet(SHEETS.SUBJECTS);
    var users = await readSheet(SHEETS.USERS);
    var subjectMap = new Map(subjects.map(function (s) { return [s.id, s.name]; }));
    var userMap = new Map(users.map(function (u) { return [u.id, u.name]; }));
    var filtered = exams;
    if (req.user.role === "teacher") filtered = exams.filter(function (e) { return e.created_by === req.user.userId; });
    else if (req.user.role === "student") filtered = exams.filter(function (e) { return e.is_active === "true"; });
    res.json(filtered.map(function (exam) {
      return Object.assign({}, exam, {
        subjectName: subjectMap.get(exam.subject_id) || null,
        teacherName: userMap.get(exam.created_by) || null,
        durationMinutes: parseInt(exam.duration_minutes),
        isActive: exam.is_active === "true",
        startsAt: exam.starts_at ? parseInt(exam.starts_at) : undefined,
        endsAt: exam.ends_at ? parseInt(exam.ends_at) : undefined,
      });
    }));
  } catch (e) { res.status(500).json({ error: "Gagal mengambil daftar ujian" }); }
});

app.get("/api/exams/:id", authenticate, async function (req, res) {
  try {
    var exams = await readSheet(SHEETS.EXAMS);
    var subjects = await readSheet(SHEETS.SUBJECTS);
    var exam = exams.find(function (e) { return e.id === req.params.id; });
    if (!exam) return res.status(404).json({ error: "Ujian tidak ditemukan" });
    var subject = subjects.find(function (s) { return s.id === exam.subject_id; });
    res.json(Object.assign({}, exam, {
      subjectName: subject ? subject.name : null,
      durationMinutes: parseInt(exam.duration_minutes),
      isActive: exam.is_active === "true",
      startsAt: exam.starts_at ? parseInt(exam.starts_at) : undefined,
      endsAt: exam.ends_at ? parseInt(exam.ends_at) : undefined,
    }));
  } catch (e) { res.status(500).json({ error: "Gagal mengambil data ujian" }); }
});

app.post("/api/exams", authenticate, requireRole(["teacher"]), async function (req, res) {
  try {
    var title = req.body && req.body.title;
    var subjectId = req.body && req.body.subjectId;
    var description = req.body && req.body.description;
    var googleFormUrl = req.body && req.body.googleFormUrl;
    var durationMinutes = req.body && req.body.durationMinutes;
    if (!title || !title.trim()) return res.status(400).json({ error: "Nama ujian wajib diisi" });
    if (!subjectId) return res.status(400).json({ error: "Mapel wajib dipilih" });
    if (!googleFormUrl || !googleFormUrl.trim()) return res.status(400).json({ error: "Link Google Form wajib diisi" });
    if (!/^https?:\/\//i.test(googleFormUrl)) return res.status(400).json({ error: "Link Google Form harus URL valid" });
    var duration = Math.round(Number(durationMinutes) || 60);
    if (duration < 1 || duration > 600) return res.status(400).json({ error: "Durasi ujian harus antara 1-600 menit" });
    if (!(await findByField(SHEETS.SUBJECTS, "id", subjectId))) return res.status(400).json({ error: "Mapel tidak ditemukan" });
    await addRow(SHEETS.EXAMS, { id: generateId(), title: title.trim(), subject_id: subjectId, description: (description && description.trim()) || "", google_form_url: googleFormUrl.trim(), duration_minutes: duration.toString(), is_active: "false", starts_at: "", ends_at: "", created_by: req.user.userId, created_at: new Date().toISOString() });
    res.json({ message: "Ujian berhasil dibuat sebagai draf" });
  } catch (e) { res.status(500).json({ error: "Gagal membuat ujian" }); }
});

app.patch("/api/exams/:id/schedule", authenticate, requireRole(["admin"]), async function (req, res) {
  try {
    var isActive = req.body && req.body.isActive;
    var startsAt = req.body && req.body.startsAt;
    var endsAt = req.body && req.body.endsAt;
    var exams = await readSheet(SHEETS.EXAMS);
    var exam = exams.find(function (e) { return e.id === req.params.id; });
    if (!exam) return res.status(404).json({ error: "Ujian tidak ditemukan" });
    if (startsAt && endsAt && endsAt <= startsAt) return res.status(400).json({ error: "Waktu tutup harus setelah waktu buka" });
    await updateRow(SHEETS.EXAMS, req.params.id, { is_active: isActive ? "true" : "false", starts_at: startsAt ? startsAt.toString() : "", ends_at: endsAt ? endsAt.toString() : "" });
    res.json({ message: isActive ? "Ujian dipublikasikan" : "Ujian diarsipkan" });
  } catch (e) { res.status(500).json({ error: "Gagal menyimpan jadwal" }); }
});

app.get("/api/exams/:id/summary", authenticate, requireRole(["teacher"]), async function (req, res) {
  try {
    var exams = await readSheet(SHEETS.EXAMS);
    var exam = exams.find(function (e) { return e.id === req.params.id; });
    if (!exam || exam.created_by !== req.user.userId) return res.status(403).json({ error: "Akses ditolak" });
    var attempts = await readSheet(SHEETS.ATTEMPTS);
    var ea = attempts.filter(function (a) { return a.exam_id === req.params.id; });
    res.json({
      started: ea.length,
      inProgress: ea.filter(function (a) { return a.status === "in_progress"; }).length,
      completed: ea.filter(function (a) { return a.status === "completed"; }).length,
      expired: ea.filter(function (a) { return a.status === "expired"; }).length,
      totalViolations: ea.reduce(function (s, a) { return s + parseInt(a.violation_count || "0"); }, 0),
    });
  } catch (e) { res.status(500).json({ error: "Gagal mengambil ringkasan" }); }
});

app.get("/api/exams/:id/attempts", authenticate, requireRole(["teacher"]), async function (req, res) {
  try {
    var exams = await readSheet(SHEETS.EXAMS);
    var exam = exams.find(function (e) { return e.id === req.params.id; });
    if (!exam || exam.created_by !== req.user.userId) return res.status(403).json({ error: "Akses ditolak" });
    var attempts = await readSheet(SHEETS.ATTEMPTS);
    var users = await readSheet(SHEETS.USERS);
    var ea = attempts.filter(function (a) { return a.exam_id === req.params.id; }).map(function (a) {
      var student = users.find(function (u) { return u.id === a.student_id; });
      return Object.assign({}, a, {
        violationCount: parseInt(a.violation_count || "0"),
        student: student ? { name: student.name, username: student.username } : null,
      });
    }).sort(function (a, b) { return parseInt(b.started_at || "0") - parseInt(a.started_at || "0"); });
    res.json(ea);
  } catch (e) { res.status(500).json({ error: "Gagal mengambil data peserta" }); }
});

// --- ATTEMPTS ---
app.get("/api/attempts/my", authenticate, requireRole(["student"]), async function (req, res) {
  try {
    var attempts = await readSheet(SHEETS.ATTEMPTS);
    var myAttempts = attempts.filter(function (a) { return a.student_id === req.user.userId; }).map(function (a) {
      return Object.assign({}, a, {
        violationCount: parseInt(a.violation_count || "0"),
        startedAt: parseInt(a.started_at),
        endsAt: parseInt(a.ends_at),
        completedAt: a.completed_at ? parseInt(a.completed_at) : undefined,
      });
    });
    res.json(myAttempts);
  } catch (e) { res.status(500).json({ error: "Gagal mengambil data percobaan" }); }
});

app.get("/api/attempts/my/:examId", authenticate, requireRole(["student"]), async function (req, res) {
  try {
    var attempts = await readSheet(SHEETS.ATTEMPTS);
    var attempt = attempts.find(function (a) { return a.exam_id === req.params.examId && a.student_id === req.user.userId; });
    if (!attempt) return res.json(null);
    res.json(Object.assign({}, attempt, {
      violationCount: parseInt(attempt.violation_count || "0"),
      startedAt: parseInt(attempt.started_at),
      endsAt: parseInt(attempt.ends_at),
      completedAt: attempt.completed_at ? parseInt(attempt.completed_at) : undefined,
    }));
  } catch (e) { res.status(500).json({ error: "Gagal mengambil data percobaan" }); }
});

app.post("/api/attempts/start", authenticate, requireRole(["student"]), async function (req, res) {
  try {
    var examId = req.body && req.body.examId;
    if (!examId) return res.status(400).json({ error: "Exam ID diperlukan" });
    var exams = await readSheet(SHEETS.EXAMS);
    var exam = exams.find(function (e) { return e.id === examId; });
    if (!exam) return res.status(404).json({ error: "Ujian tidak ditemukan" });
    if (exam.is_active !== "true") return res.status(400).json({ error: "Ujian belum dipublikasikan" });
    var attempts = await readSheet(SHEETS.ATTEMPTS);
    var existing = attempts.find(function (a) { return a.exam_id === examId && a.student_id === req.user.userId; });
    if (existing) return res.json({ id: existing.id });
    var now = Date.now();
    var startsAt = exam.starts_at ? parseInt(exam.starts_at) : undefined;
    var endsAt = exam.ends_at ? parseInt(exam.ends_at) : undefined;
    if (startsAt && now < startsAt) return res.status(400).json({ error: "Ujian belum dibuka" });
    if (endsAt && now >= endsAt) return res.status(400).json({ error: "Ujian sudah ditutup" });
    var attemptId = generateId();
    var durationMinutes = parseInt(exam.duration_minutes);
    await addRow(SHEETS.ATTEMPTS, { id: attemptId, exam_id: examId, student_id: req.user.userId, status: "in_progress", started_at: now.toString(), ends_at: (now + durationMinutes * 60000).toString(), completed_at: "", violation_count: "0", violations: "[]" });
    res.json({ id: attemptId });
  } catch (e) { res.status(500).json({ error: "Gagal memulai ujian" }); }
});

app.post("/api/attempts/violation", authenticate, requireRole(["student"]), async function (req, res) {
  try {
    var attemptId = req.body && req.body.attemptId;
    var type = req.body && req.body.type;
    if (!attemptId || !type) return res.status(400).json({ error: "Attempt ID dan type diperlukan" });
    var attempts = await readSheet(SHEETS.ATTEMPTS);
    var attempt = attempts.find(function (a) { return a.id === attemptId && a.student_id === req.user.userId; });
    if (!attempt) return res.status(404).json({ error: "Percobaan tidak ditemukan" });
    if (attempt.status !== "in_progress") return res.json({ message: "Percobaan sudah selesai" });
    var count = parseInt(attempt.violation_count || "0");
    var violations = JSON.parse(attempt.violations || "[]");
    violations.push({ type: type, at: Date.now() });
    await updateRow(SHEETS.ATTEMPTS, attemptId, { violation_count: (count + 1).toString(), violations: JSON.stringify(violations) });
    res.json({ message: "Pelanggaran tercatat" });
  } catch (e) { res.status(500).json({ error: "Gagal mencatat pelanggaran" }); }
});

app.post("/api/attempts/complete", authenticate, requireRole(["student"]), async function (req, res) {
  try {
    var attemptId = req.body && req.body.attemptId;
    if (!attemptId) return res.status(400).json({ error: "Attempt ID diperlukan" });
    var attempts = await readSheet(SHEETS.ATTEMPTS);
    var attempt = attempts.find(function (a) { return a.id === attemptId && a.student_id === req.user.userId; });
    if (!attempt) return res.status(404).json({ error: "Percobaan tidak ditemukan" });
    if (attempt.status !== "in_progress") return res.json({ id: attemptId });
    var now = Date.now();
    var status = now > parseInt(attempt.ends_at) ? "expired" : "completed";
    await updateRow(SHEETS.ATTEMPTS, attemptId, { status: status, completed_at: now.toString() });
    res.json({ id: attemptId });
  } catch (e) { res.status(500).json({ error: "Gagal menyelesaikan ujian" }); }
});

app.post("/api/attempts/expire", authenticate, requireRole(["student"]), async function (req, res) {
  try {
    var attemptId = req.body && req.body.attemptId;
    if (!attemptId) return res.status(400).json({ error: "Attempt ID diperlukan" });
    var attempts = await readSheet(SHEETS.ATTEMPTS);
    var attempt = attempts.find(function (a) { return a.id === attemptId && a.student_id === req.user.userId; });
    if (!attempt) return res.status(404).json({ error: "Percobaan tidak ditemukan" });
    var now = Date.now();
    if (attempt.status === "in_progress" && now >= parseInt(attempt.ends_at)) {
      await updateRow(SHEETS.ATTEMPTS, attemptId, { status: "expired", completed_at: now.toString() });
    }
    res.json({ id: attemptId });
  } catch (e) { res.status(500).json({ error: "Gagal mengekspiresi ujian" }); }
});

// --- STATIC FILES & SPA ---
var distPath = path.join(process.cwd(), "dist");
console.log("[UjianKita] Looking for dist at:", distPath, "| exists:", fs.existsSync(distPath));

if (process.env.NODE_ENV === "production" && fs.existsSync(distPath)) {
  console.log("[UjianKita] Serving static files from dist/");
  app.use(express.static(distPath));
  app.get("/*", function (_req, res) {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  console.log("[UjianKita] NOT serving static files (NODE_ENV=" + (process.env.NODE_ENV || "not set") + ")");
}

// --- START SERVER ---
console.log("[UjianKita] Starting server on port " + PORT + "...");

app.listen(PORT, "0.0.0.0", function () {
  console.log("[UjianKita] Server running on port " + PORT);
  console.log("[UjianKita] API: http://localhost:" + PORT + "/api");
});

console.log("[UjianKita] app.listen() called, waiting for callback...");
