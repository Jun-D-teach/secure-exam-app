// ============================================================
//  UjianKita — Express.js backend (Google Sheets API)
// ============================================================

var express = require("express");
var cors = require("cors");
var path = require("path");
var fs = require("fs");
var https = require("https");

var app = express();
var PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// --- Startup logging ---
console.log("[UjianKita] server.js loaded at", new Date().toISOString());
console.log("[UjianKita] Node.js", process.version, "| PID", process.pid);

// --- Global error handlers ---
process.on("uncaughtException", function (err) {
  console.error("[UjianKita] UNCAUGHT EXCEPTION:", err);
});
process.on("unhandledRejection", function (reason) {
  console.error("[UjianKita] UNHANDLED REJECTION:", reason);
});

// ============================================================
//  Google Sheets API (direct crypto, no googleapis)
// ============================================================

var normalizePemKey = (function () {
  function fixPemLineWrapping(pem) {
    var lines = pem.split("\n");
    var result = [];
    var currentLine = "";
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line === "") continue;
      if (line.indexOf("-----") === 0) {
        if (currentLine) { result.push(currentLine); currentLine = ""; }
        result.push(line);
      } else {
        currentLine += line;
        if (currentLine.length >= 64) {
          result.push(currentLine.substring(0, 64));
          currentLine = currentLine.substring(64);
        }
      }
    }
    if (currentLine) result.push(currentLine);
    return result.join("\n");
  }

  function normalizePemKey(raw) {
    if (!raw || typeof raw !== "string") return "";
    var s = raw;
    // Remove surrounding quotes
    if ((s.charCodeAt(0) === 34 && s.charCodeAt(s.length - 1) === 34) ||
        (s.charCodeAt(0) === 39 && s.charCodeAt(s.length - 1) === 39)) {
      s = s.substring(1, s.length - 1);
    }
    // Multi-pass newline conversion
    for (var pass = 0; pass < 5; pass++) {
      var before = s.length;
      s = s.replace(/\\r\\n/g, "\n");
      s = s.replace(/\\r/g, "\n");
      s = s.replace(/\\n/g, "\n");
      s = s.replace(/\\\\/g, "\\");
      if (s.length === before) break;
    }
    // Fix line wrapping
    s = fixPemLineWrapping(s);
    // Collapse blank lines
    s = s.replace(/\n{3,}/g, "\n\n");
    return s.trim();
  }
  return normalizePemKey;
})();

var SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "";
var SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
var SA_KEY = "";
var SA_KEY_OBJ = null;

console.log("[UjianKita] Loading Google credentials...");

// Source 1: GOOGLE_SERVICE_ACCOUNT_JSON (entire JSON key file content)
if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  var jsonRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  console.log("[UjianKita] JSON env raw length:", jsonRaw.length, "first 100:", jsonRaw.substring(0, 100));

  // Try multiple JSON parse strategies
  var saJson = null;
  var strategies = [
    function (s) { return JSON.parse(s); },
    function (s) { var u = s.replace(/\\"/g, '"'); return JSON.parse(u); },
    function (s) { var u = s.replace(/\\n/g, "\n"); return JSON.parse(u); },
    function (s) { var u = s.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\t/g, "    "); return JSON.parse(u); },
  ];

  for (var si = 0; si < strategies.length; si++) {
    try {
      saJson = strategies[si](jsonRaw);
      console.log("[UjianKita] JSON strategy", si + 1, "OK. Keys:", Object.keys(saJson).join(", "));
      break;
    } catch (e) {
      console.log("[UjianKita] JSON strategy", si + 1, "failed:", e.message);
    }
  }

  // Fallback: try wrapping without braces
  if (!saJson) {
    try {
      var wrapped = jsonRaw;
      if (wrapped.charCodeAt(0) !== 123) wrapped = "{" + wrapped + "}";
      saJson = JSON.parse(wrapped);
      console.log("[UjianKita] JSON wrapped strategy OK. Keys:", Object.keys(saJson).join(", "));
    } catch (e) {
      console.log("[UjianKita] JSON wrapped strategy failed:", e.message);
    }
  }

  // Fallback: regex extraction from raw string
  if (!saJson) {
    try {
      var keyMatch = jsonRaw.match(/-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----/);
      var emailMatch = jsonRaw.match(/"client_email"\s*:\s*"([^"]+)"/);
      if (keyMatch) {
        SA_KEY = normalizePemKey(keyMatch[0]);
        if (emailMatch && !SA_EMAIL) SA_EMAIL = emailMatch[1];
        console.log("[UjianKita] Regex extraction OK:", SA_KEY.length, "chars");
      }
    } catch (e) {
      console.log("[UjianKita] Regex extraction failed:", e.message);
    }
  }

  if (saJson) {
    var rawKey = saJson.private_key || "";
    SA_KEY = normalizePemKey(rawKey);
    if (!SA_EMAIL && saJson.client_email) SA_EMAIL = saJson.client_email;
    console.log("[UjianKita] Private key loaded from JSON:", SA_KEY.length, "chars");
  }
}

// Source 2: GOOGLE_PRIVATE_KEY_B64
if (!SA_KEY && process.env.GOOGLE_PRIVATE_KEY_B64) {
  try {
    SA_KEY = normalizePemKey(Buffer.from(process.env.GOOGLE_PRIVATE_KEY_B64, "base64").toString("utf8"));
    console.log("[UjianKita] Private key loaded from B64:", SA_KEY.length, "chars");
  } catch (e) {
    console.error("[UjianKita] Failed to decode B64 key:", e.message);
  }
}

// Source 3: GOOGLE_PRIVATE_KEY (raw PEM)
if (!SA_KEY && process.env.GOOGLE_PRIVATE_KEY) {
  SA_KEY = normalizePemKey(process.env.GOOGLE_PRIVATE_KEY);
  console.log("[UjianKita] Private key loaded from RAW:", SA_KEY.length, "chars");
}

// Validate key format
if (SA_KEY && SA_KEY.indexOf("-----BEGIN") === -1) {
  console.warn("[UjianKita] WARNING: Key does not start with '-----BEGIN'. First 30 chars:", SA_KEY.substring(0, 30));
}

// Pre-parse key object for crypto operations
function safeParsePemKey(pem) {
  var crypto = require("crypto");
  if (!pem || typeof pem !== "string") return null;

  var approaches = [
    function () { return crypto.createPrivateKey(pem); },
    function () { return crypto.createPrivateKey({ key: fixPemWrapping(pem), format: "pem", type: "pkcs8" }); },
    function () { return crypto.createPrivateKey({ key: pem, format: "pem", type: "pkcs1" }); },
  ];

  for (var ai = 0; ai < approaches.length; ai++) {
    try {
      return approaches[ai]();
    } catch (e) {
      console.log("[UjianKita] Key approach", ai + 1, "failed:", e.message);
    }
  }
  return null;

  function fixPemWrapping(p) {
    var lines = p.split("\n");
    var result = [];
    var buf = "";
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].trim();
      if (l === "") continue;
      if (l.indexOf("-----") === 0) {
        if (buf) { result.push(buf); buf = ""; }
        result.push(l);
      } else {
        buf += l;
        if (buf.length >= 64) {
          result.push(buf.substring(0, 64));
          buf = buf.substring(64);
        }
      }
    }
    if (buf) result.push(buf);
    return result.join("\n");
  }
}

if (SA_KEY) {
  SA_KEY_OBJ = safeParsePemKey(SA_KEY);
  if (SA_KEY_OBJ) {
    console.log("[UjianKita] Key crypto validation: OK");
  } else {
    console.error("[UjianKita] Key crypto validation: FAILED — add NODE_OPTIONS=--openssl-legacy-provider");
  }
}

// --- HTTPS request helper ---
function httpsRequest(url, opts, body) {
  return new Promise(function (resolve, reject) {
    var urlObj = new (require("url").URL)(url);
    var options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: opts.method || "GET",
      headers: opts.headers || {},
    };
    var req = https.request(options, function (res) {
      var chunks = [];
      res.on("data", function (chunk) { chunks.push(chunk); });
      res.on("end", function () {
        var raw = Buffer.concat(chunks).toString("utf8");
        var data;
        try { data = JSON.parse(raw); } catch (_e) { data = { raw: raw }; }
        resolve({ status: res.statusCode, data: data });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// --- OAuth2 token ---
var _accessToken = null;
var _tokenExpiry = 0;

function createSignedJwt() {
  var crypto = require("crypto");
  var now = Math.floor(Date.now() / 1000);
  var header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  var payload = Buffer.from(JSON.stringify({
    iss: SA_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).toString("base64url");

  var dataToSign = header + "." + payload;
  var sign = crypto.createSign("RSA-SHA256");
  sign.update(dataToSign);
  var signature = sign.sign(SA_KEY_OBJ, "base64url");
  return dataToSign + "." + signature;
}

async function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;
  console.log("[UjianKita] Requesting new access token...");
  var jwt = await createSignedJwt();
  var body = "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + encodeURIComponent(jwt);
  var res = await httpsRequest("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) },
  }, body);
  if (res.status !== 200 || !res.data.access_token) {
    throw new Error("Failed to get access token (HTTP " + res.status + "): " + JSON.stringify(res.data));
  }
  _accessToken = res.data.access_token;
  _tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000;
  console.log("[UjianKita] Access token obtained, expires in", res.data.expires_in, "seconds");
  return _accessToken;
}

async function sheetsApi(method, path, body) {
  var token = await getAccessToken();
  var url = "https://sheets.googleapis.com/v4/spreadsheets/" + SPREADSHEET_ID + path;
  var bodyStr = body ? JSON.stringify(body) : null;
  var opts = {
    method: method,
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json",
    },
  };
  if (bodyStr) opts.headers["Content-Length"] = Buffer.byteLength(bodyStr);
  var res = await httpsRequest(url, opts, bodyStr);
  if (res.status === 401) {
    _accessToken = null;
    _tokenExpiry = 0;
    token = await getAccessToken();
    opts.headers["Authorization"] = "Bearer " + token;
    res = await httpsRequest(url, opts, bodyStr);
  }
  if (res.status < 200 || res.status >= 300) {
    throw new Error("Sheets API error (HTTP " + res.status + "): " + JSON.stringify(res.data));
  }
  return res.data;
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

// --- Retry helper for transient Google Sheets errors ---
async function withRetry(fn, maxRetries, delay) {
  maxRetries = maxRetries || 2;
  delay = delay || 500;
  for (var attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      var status = err && err.status;
      var isTransient = !status || status === 429 || (status >= 500 && status < 600);
      if (!isTransient) throw err;
      console.warn("[UjianKita] Retry " + (attempt + 1) + "/" + maxRetries + " after error:", (err && err.message) || err);
      await new Promise(function (resolve) { setTimeout(resolve, delay * Math.pow(2, attempt)); });
    }
  }
}

// --- Sheet helpers ---
async function readSheet(sheetName) {
  return withRetry(async function () {
    var data = await sheetsApi("GET", "/values/" + sheetName + "!A:Z");
    var rows = data.values || [];
    if (rows.length < 2) return [];
    var headers = rows[0];
    return rows.slice(1).map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = (row[i] || "").trim(); });
      return obj;
    });
  }, 2, 500);
}

async function findByField(sheetName, field, value) {
  var rows = await readSheet(sheetName);
  return rows.find(function (r) { return r[field] === value; }) || null;
}

async function addRow(sheetName, data) {
  var headers = HEADERS[sheetName];
  if (!headers) throw new Error("Unknown sheet: " + sheetName);
  var row = headers.map(function (h) { return data[h] || ""; });
  await sheetsApi("POST", "/values/" + sheetName + "!A:Z:append?valueInputOption=RAW", {
    values: [row],
  });
}

async function updateRow(sheetName, id, data) {
  var headers = HEADERS[sheetName];
  if (!headers) throw new Error("Unknown sheet: " + sheetName);
  var data2 = await sheetsApi("GET", "/values/" + sheetName + "!A:Z");
  var rows = data2.values || [];
  var idIdx = headers.indexOf("id");
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === id) {
      var updated = headers.map(function (h) { return data[h] !== undefined ? data[h] : (rows[i][headers.indexOf(h)] || ""); });
      await sheetsApi("PUT", "/values/" + sheetName + "!A" + (i + 1) + ":Z" + (i + 1) + "?valueInputOption=RAW", {
        values: [updated],
      });
      return true;
    }
  }
  return false;
}

async function deleteRow(sheetName, id) {
  var headers = HEADERS[sheetName];
  if (!headers) throw new Error("Unknown sheet: " + sheetName);
  var data = await sheetsApi("GET", "/values/" + sheetName + "!A:Z");
  var rows = data.values || [];
  var idIdx = headers.indexOf("id");
  var trimmedId = (id || "").trim();
  for (var i = 1; i < rows.length; i++) {
    var rowId = (rows[i][idIdx] || "").trim();
    if (rowId === trimmedId) {
      var meta = await sheetsApi("GET", "");
      var sheet = (meta.sheets || []).find(function (s) { return s.properties && s.properties.title === sheetName; });
      var sheetId = (sheet && sheet.properties && sheet.properties.sheetId) || 0;
      await sheetsApi("POST", ":batchUpdate", {
        requests: [{ deleteDimension: { range: { sheetId: sheetId, dimension: "ROWS", startIndex: i, endIndex: i + 1 } } }],
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
  res.json({ status: "ok", timestamp: Date.now(), port: PORT, node: process.version });
});

// --- DEBUG: Google Sheets diagnostic ---
app.get("/api/debug/sheets", async function (_req, res) {
  var result = { steps: [], node: process.version, ts: new Date().toISOString() };
  try {
    var keyInfo = {};
    if (SA_KEY) {
      keyInfo = {
        keyLength: SA_KEY.length,
        keyFormat: SA_KEY.indexOf("-----BEGIN PRIVATE KEY-----") === 0 ? "PKCS8" : SA_KEY.indexOf("-----BEGIN RSA PRIVATE KEY-----") === 0 ? "PKCS1" : "UNKNOWN",
        keySource: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? "JSON" : process.env.GOOGLE_PRIVATE_KEY_B64 ? "B64" : process.env.GOOGLE_PRIVATE_KEY ? "RAW" : "NONE",
        hasKeyObject: !!SA_KEY_OBJ,
        firstChars: SA_KEY.substring(0, 30),
        lastChars: SA_KEY.substring(SA_KEY.length - 30),
        lineCount: SA_KEY.split("\n").length,
      };
    } else {
      keyInfo = { keyLength: 0, keyFormat: "NONE", keySource: "NONE", hasKeyObject: false };
    }

    // Step 1: Env check
    result.steps.push({ name: "env_check", ok: true, data: Object.assign({
      hasSpreadsheetId: !!SPREADSHEET_ID,
      hasServiceAccountEmail: !!SA_EMAIL,
    }, keyInfo) });

    // Step 2: Key parse
    try {
      if (!SA_KEY_OBJ) throw new Error("No key object available");
      result.steps.push({ name: "key_parse", ok: true, data: { type: SA_KEY_OBJ.type, bits: SA_KEY_OBJ.asymmetricKeySize } });
    } catch (e) {
      result.steps.push({ name: "key_parse", ok: false, error: e.message });
    }

    // Step 3: JWT sign
    try {
      var testJwt = await createSignedJwt();
      result.steps.push({ name: "jwt_sign", ok: true, data: { jwtLength: testJwt.length } });
    } catch (e) {
      result.steps.push({ name: "jwt_sign", ok: false, error: e.message });
    }

    // Step 4: Access token
    try {
      var at = await getAccessToken();
      result.steps.push({ name: "access_token", ok: true, data: { tokenLength: at.length } });
    } catch (e) {
      result.steps.push({ name: "access_token", ok: false, error: e.message });
    }

    // Step 5: Spreadsheet access
    try {
      var meta = await sheetsApi("GET", "");
      var titles = (meta.sheets || []).map(function (s) { return s.properties && s.properties.title; });
      result.steps.push({ name: "spreadsheet_access", ok: true, data: { title: meta.properties && meta.properties.title, sheets: titles } });
    } catch (e) {
      result.steps.push({ name: "spreadsheet_access", ok: false, error: e.message });
    }

    // Step 6: Read Users
    try {
      var users = await readSheet(SHEETS.USERS);
      result.steps.push({ name: "read_users", ok: true, data: { count: users.length, roles: users.map(function (u) { return u.role; }) } });
    } catch (e) {
      result.steps.push({ name: "read_users", ok: false, error: e.message });
    }

  } catch (e) {
    result.error = e.message;
  }
  res.json(result);
});

// --- AUTH: Bootstrap admin (first-run) ---
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
  } catch (e) { console.error("[UjianKita] Bootstrap error:", e.message); res.status(500).json({ error: "Gagal membuat akun admin: " + e.message }); }
});

// --- AUTH: Reset admin ---
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
  } catch (e) { console.error("[UjianKita] Reset error:", e.message); res.status(500).json({ error: "Gagal mereset admin: " + e.message }); }
});

// --- AUTH: Has admin ---
app.get("/api/auth/has-admin", async function (_req, res) {
  try {
    var users = await readSheet(SHEETS.USERS);
    res.json({ hasAdmin: users.some(function (u) { return u.role === "admin"; }) });
  } catch (e) {
    console.error("[UjianKita] has-admin error:", e.message);
    res.status(500).json({ hasAdmin: null, error: "Gagal terhubung ke Google Sheets: " + e.message });
  }
});

// --- AUTH: Current user ---
app.get("/api/auth/me", authenticate, async function (req, res) {
  try {
    var user = await findByField(SHEETS.USERS, "id", req.user.userId);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    res.json({ id: user.id, name: user.name, username: user.username, role: user.role });
  } catch (e) { res.status(500).json({ error: "Gagal mengambil data" }); }
});

// --- AUTH: Update profile ---
app.put("/api/auth/me", authenticate, async function (req, res) {
  try {
    var name = req.body && req.body.name;
    var username = req.body && req.body.username;
    if (!name && !username) return res.status(400).json({ error: "Tidak ada data yang diubah" });
    var user = await findByField(SHEETS.USERS, "id", req.user.userId);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    var updates = {};
    if (name) updates.name = name;
    if (username && username !== user.username) {
      if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return res.status(400).json({ error: "Username harus 3-32 karakter" });
      if (await findByField(SHEETS.USERS, "username", username)) return res.status(400).json({ error: "Username sudah dipakai" });
      updates.username = username;
    }
    await updateRow(SHEETS.USERS, user.id, updates);
    // If username changed, issue new token
    if (updates.username) {
      var newToken = generateToken({ userId: user.id, username: updates.username, role: user.role });
      return res.json({ message: "Profil diperbarui", token: newToken });
    }
    res.json({ message: "Profil diperbarui" });
  } catch (e) { res.status(500).json({ error: "Gagal memperbarui profil" }); }
});

// --- AUTH: Login ---
app.post("/api/auth/login", async function (req, res) {
  try {
    var username = req.body && req.body.username;
    var password = req.body && req.body.password;
    if (!username || !password) return res.status(400).json({ error: "Username dan password diperlukan" });
    var user = await findByField(SHEETS.USERS, "username", username);
    if (!user) return res.status(401).json({ error: "Username atau password salah" });
    var ok = await verifyPassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Username atau password salah" });
    var token = generateToken({ userId: user.id, username: user.username, role: user.role });
    res.json({ token: token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
  } catch (e) { res.status(500).json({ error: "Gagal melakukan login" }); }
});

// --- AUTH: Change password ---
app.post("/api/auth/change-password", authenticate, async function (req, res) {
  try {
    var currentPassword = req.body && req.body.currentPassword;
    var newPassword = req.body && req.body.newPassword;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Password lama dan baru diperlukan" });
    if (newPassword.length < 8) return res.status(400).json({ error: "Password baru minimal 8 karakter" });
    var user = await findByField(SHEETS.USERS, "id", req.user.userId);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    var ok = await verifyPassword(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Password lama salah" });
    await updateRow(SHEETS.USERS, user.id, { password_hash: await hashPassword(newPassword) });
    res.json({ message: "Password berhasil diubah" });
  } catch (e) { res.status(500).json({ error: "Gagal mengubah password" }); }
});

// ============================================================
//  USERS (admin)
// ============================================================

app.get("/api/users", authenticate, requireRole(["admin"]), async function (_req, res) {
  try {
    var users = await readSheet(SHEETS.USERS);
    res.json(users.map(function (u) {
      return { id: u.id, name: u.name, username: u.username, role: u.role, created_at: u.created_at };
    }));
  } catch (e) { res.status(500).json({ error: "Gagal mengambil daftar pengguna" }); }
});

app.post("/api/users", authenticate, requireRole(["admin"]), async function (req, res) {
  try {
    var name = req.body && req.body.name;
    var username = req.body && req.body.username;
    var password = req.body && req.body.password;
    var role = req.body && req.body.role;
    if (!name || !username || !password || !role) return res.status(400).json({ error: "Nama, username, password, dan role diperlukan" });
    if (password.length < 8) return res.status(400).json({ error: "Password minimal 8 karakter" });
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return res.status(400).json({ error: "Username harus 3-32 karakter (huruf kecil, angka, . _ -)" });
    if (role !== "student" && role !== "teacher") return res.status(400).json({ error: "Role harus 'student' atau 'teacher'" });
    if (await findByField(SHEETS.USERS, "username", username)) return res.status(400).json({ error: "Username sudah dipakai" });
    await addRow(SHEETS.USERS, { id: generateId(), name: name.trim() || username, username: username, password_hash: await hashPassword(password), role: role, created_at: new Date().toISOString() });
    res.json({ message: "Akun berhasil dibuat" });
  } catch (e) { res.status(500).json({ error: "Gagal membuat akun: " + e.message }); }
});

app.delete("/api/users/:id", authenticate, requireRole(["admin"]), async function (req, res) {
  try {
    var user = await findByField(SHEETS.USERS, "id", req.params.id);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    if (user.role === "admin") return res.status(403).json({ error: "Tidak dapat menghapus akun admin" });
    var deleted = await deleteRow(SHEETS.USERS, req.params.id);
    if (!deleted) return res.status(404).json({ error: "Pengguna tidak ditemukan di spreadsheet" });
    res.json({ message: "Akun berhasil dihapus" });
  } catch (e) { res.status(500).json({ error: "Gagal menghapus akun: " + e.message }); }
});

app.post("/api/users/import", authenticate, requireRole(["admin"]), async function (req, res) {
  try {
    var role = req.body && req.body.role;
    var items = req.body && req.body.items;
    if (!role || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Role dan items diperlukan" });
    if (role !== "student" && role !== "teacher") return res.status(400).json({ error: "Role harus 'student' atau 'teacher'" });
    var created = [];
    for (var ci = 0; ci < items.length; ci++) {
      var item = items[ci];
      var uname = (item.username || "").trim() || (item.name || "").toLowerCase().replace(/[^a-z0-9_.-]/g, ".").replace(/\.+/g, ".").replace(/^\.|\.$/g, "") + "." + Date.now().toString(36).slice(-4);
      var pw = (item.password || "").trim() || "password123";
      if (pw.length < 8) pw = pw + "12345678".slice(0, 8 - pw.length);
      if (await findByField(SHEETS.USERS, "username", uname)) continue;
      var row = { id: generateId(), name: (item.name || uname).trim(), username: uname, password_hash: await hashPassword(pw), role: role, created_at: new Date().toISOString() };
      await addRow(SHEETS.USERS, row);
      created.push({ name: row.name, username: uname, password: pw });
    }
    res.json(created);
  } catch (e) { res.status(500).json({ error: "Gagal mengimpor pengguna: " + e.message }); }
});

// ============================================================
//  SUBJECTS
// ============================================================

app.get("/api/subjects", authenticate, async function (_req, res) {
  try {
    var subjects = await readSheet(SHEETS.SUBJECTS);
    res.json(subjects.map(function (s) {
      return { id: s.id, name: s.name, description: s.description || "" };
    }));
  } catch (e) { res.status(500).json({ error: "Gagal mengambil daftar mapel" }); }
});

app.post("/api/subjects", authenticate, requireRole(["admin"]), async function (req, res) {
  try {
    var name = req.body && req.body.name;
    if (!name || !name.trim()) return res.status(400).json({ error: "Nama mapel diperlukan" });
    var existing = await readSheet(SHEETS.SUBJECTS);
    if (existing.find(function (s) { return s.name.toLowerCase() === name.trim().toLowerCase(); })) {
      return res.status(400).json({ error: "Mapel sudah ada" });
    }
    var id = generateId();
    await addRow(SHEETS.SUBJECTS, { id: id, name: name.trim(), description: (req.body && req.body.description) || "", created_by: req.user.userId, created_at: new Date().toISOString() });
    res.json({ message: "Mapel berhasil ditambahkan", id: id });
  } catch (e) { res.status(500).json({ error: "Gagal menambahkan mapel: " + e.message }); }
});

app.delete("/api/subjects/:id", authenticate, requireRole(["admin"]), async function (req, res) {
  try {
    var subjects = await readSheet(SHEETS.SUBJECTS);
    if (!subjects.find(function (s) { return s.id === req.params.id; })) return res.status(404).json({ error: "Mapel tidak ditemukan" });
    var deleted = await deleteRow(SHEETS.SUBJECTS, req.params.id);
    if (!deleted) return res.status(404).json({ error: "Mapel tidak ditemukan di spreadsheet" });
    res.json({ message: "Mapel berhasil dihapus" });
  } catch (e) { res.status(500).json({ error: "Gagal menghapus mapel: " + e.message }); }
});

// ============================================================
//  EXAMS
// ============================================================

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
  } catch (e) { res.status(500).json({ error: "Gagal mengambil daftar ujian: " + e.message }); }
});

app.get("/api/exams/:id", authenticate, async function (req, res) {
  try {
    var exams = await readSheet(SHEETS.EXAMS);
    var subjects = await readSheet(SHEETS.SUBJECTS);
    var users = await readSheet(SHEETS.USERS);
    var subjectMap = new Map(subjects.map(function (s) { return [s.id, s.name]; }));
    var userMap = new Map(users.map(function (u) { return [u.id, u.name]; }));
    var exam = exams.find(function (e) { return e.id === req.params.id; });
    if (!exam) return res.status(404).json({ error: "Ujian tidak ditemukan" });
    res.json(Object.assign({}, exam, {
      subjectName: subjectMap.get(exam.subject_id) || null,
      teacherName: userMap.get(exam.created_by) || null,
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
    var description = req.body && req.body.description || "";
    var googleFormUrl = req.body && req.body.googleFormUrl || "";
    var durationMinutes = req.body && parseInt(req.body.durationMinutes) || 60;
    if (!title || !subjectId) return res.status(400).json({ error: "Judul dan mapel diperlukan" });
    var id = generateId();
    await addRow(SHEETS.EXAMS, {
      id: id, title: title, subject_id: subjectId, description: description,
      google_form_url: googleFormUrl, duration_minutes: String(durationMinutes),
      is_active: "false", starts_at: "", ends_at: "",
      created_by: req.user.userId, created_at: new Date().toISOString(),
    });
    res.json({ message: "Ujian berhasil dibuat", id: id });
  } catch (e) { res.status(500).json({ error: "Gagal membuat ujian: " + e.message }); }
});

app.patch("/api/exams/:id/schedule", authenticate, requireRole(["admin"]), async function (req, res) {
  try {
    var isActive = req.body && req.body.isActive;
    var startsAt = req.body && req.body.startsAt;
    var endsAt = req.body && req.body.endsAt;
    var exams = await readSheet(SHEETS.EXAMS);
    var exam = exams.find(function (e) { return e.id === req.params.id; });
    if (!exam) return res.status(404).json({ error: "Ujian tidak ditemukan" });
    var updates = {};
    updates.is_active = isActive ? "true" : "false";
    updates.starts_at = startsAt ? String(startsAt) : "";
    updates.ends_at = endsAt ? String(endsAt) : "";
    await updateRow(SHEETS.EXAMS, req.params.id, updates);
    res.json({ message: "Jadwal ujian diperbarui" });
  } catch (e) { res.status(500).json({ error: "Gagal memperbarui jadwal: " + e.message }); }
});

app.get("/api/exams/:id/summary", authenticate, requireRole(["admin", "teacher"]), async function (req, res) {
  try {
    var attempts = await readSheet(SHEETS.ATTEMPTS);
    var examAttempts = attempts.filter(function (a) { return a.exam_id === req.params.id; });
    res.json({
      started: examAttempts.length,
      inProgress: examAttempts.filter(function (a) { return a.status === "in_progress"; }).length,
      completed: examAttempts.filter(function (a) { return a.status === "completed"; }).length,
      expired: examAttempts.filter(function (a) { return a.status === "expired"; }).length,
      totalViolations: examAttempts.reduce(function (sum, a) { return sum + parseInt(a.violation_count || "0"); }, 0),
    });
  } catch (e) { res.status(500).json({ error: "Gagal mengambil ringkasan" }); }
});

app.get("/api/exams/:id/attempts", authenticate, requireRole(["admin", "teacher"]), async function (req, res) {
  try {
    var attempts = await readSheet(SHEETS.ATTEMPTS);
    var users = await readSheet(SHEETS.USERS);
    var userMap = new Map(users.map(function (u) { return [u.id, { name: u.name, username: u.username }]; }));
    var examAttempts = attempts.filter(function (a) { return a.exam_id === req.params.id; });
    res.json(examAttempts.map(function (a) {
      return Object.assign({}, a, {
        violationCount: parseInt(a.violation_count || "0"),
        student: userMap.get(a.student_id) || null,
      });
    }));
  } catch (e) { res.status(500).json({ error: "Gagal mengambil data percobaan" }); }
});

// ============================================================
//  ATTEMPTS
// ============================================================

app.get("/api/attempts/my/:examId", authenticate, async function (req, res) {
  try {
    var attempts = await readSheet(SHEETS.ATTEMPTS);
    var myAttempt = attempts.find(function (a) { return a.exam_id === req.params.examId && a.student_id === req.user.userId && a.status === "in_progress"; });
    if (!myAttempt) return res.json(null);
    res.json(Object.assign({}, myAttempt, {
      startedAt: parseInt(myAttempt.started_at),
      endsAt: parseInt(myAttempt.ends_at),
      violationCount: parseInt(myAttempt.violation_count || "0"),
    }));
  } catch (e) { res.status(500).json({ error: "Gagal mengambil data percobaan" }); }
});

app.get("/api/attempts/my", authenticate, async function (req, res) {
  try {
    var attempts = await readSheet(SHEETS.ATTEMPTS);
    var myAttempts = attempts.filter(function (a) { return a.student_id === req.user.userId; });
    res.json(myAttempts.map(function (a) {
      return Object.assign({}, a, {
        startedAt: parseInt(a.started_at),
        endsAt: parseInt(a.ends_at),
        completedAt: a.completed_at ? parseInt(a.completed_at) : undefined,
        violationCount: parseInt(a.violation_count || "0"),
      });
    }));
  } catch (e) { res.status(500).json({ error: "Gagal mengambil data percobaan" }); }
});

app.post("/api/attempts/start", authenticate, requireRole(["student"]), async function (req, res) {
  try {
    var examId = req.body && req.body.examId;
    if (!examId) return res.status(400).json({ error: "examId diperlukan" });
    var exams = await readSheet(SHEETS.EXAMS);
    var exam = exams.find(function (e) { return e.id === examId; });
    if (!exam) return res.status(404).json({ error: "Ujian tidak ditemukan" });
    if (exam.is_active !== "true") return res.status(403).json({ error: "Ujian belum aktif" });
    var now = Date.now();
    if (exam.starts_at && parseInt(exam.starts_at) > now) return res.status(403).json({ error: "Ujian belum dibuka" });
    if (exam.ends_at && parseInt(exam.ends_at) < now) return res.status(403).json({ error: "Ujian sudah ditutup" });
    var attempts = await readSheet(SHEETS.ATTEMPTS);
    var existing = attempts.find(function (a) { return a.exam_id === examId && a.student_id === req.user.userId && a.status === "in_progress"; });
    if (existing) return res.json({ id: existing.id });
    var durationMs = parseInt(exam.duration_minutes) * 60 * 1000;
    var id = generateId();
    await addRow(SHEETS.ATTEMPTS, {
      id: id, exam_id: examId, student_id: req.user.userId,
      status: "in_progress", started_at: String(now), ends_at: String(now + durationMs),
      completed_at: "", violation_count: "0", violations: "",
    });
    res.json({ id: id });
  } catch (e) { res.status(500).json({ error: "Gagal memulai percobaan: " + e.message }); }
});

app.post("/api/attempts/violation", authenticate, async function (req, res) {
  try {
    var attemptId = req.body && req.body.attemptId;
    var type = req.body && req.body.type;
    if (!attemptId) return res.status(400).json({ error: "attemptId diperlukan" });
    var attempts = await readSheet(SHEETS.ATTEMPTS);
    var attempt = attempts.find(function (a) { return a.id === attemptId; });
    if (!attempt) return res.status(404).json({ error: "Percobaan tidak ditemukan" });
    var count = parseInt(attempt.violation_count || "0") + 1;
    var violations = (attempt.violations || "") + (attempt.violations ? ";" : "") + (type || "unknown") + ":" + Date.now();
    await updateRow(SHEETS.ATTEMPTS, attemptId, { violation_count: String(count), violations: violations });
    res.json({ violationCount: count });
  } catch (e) { res.status(500).json({ error: "Gagal mencatat pelanggaran" }); }
});

app.post("/api/attempts/complete", authenticate, async function (req, res) {
  try {
    var attemptId = req.body && req.body.attemptId;
    if (!attemptId) return res.status(400).json({ error: "attemptId diperlukan" });
    await updateRow(SHEETS.ATTEMPTS, attemptId, { status: "completed", completed_at: String(Date.now()) });
    res.json({ message: "Percobaan selesai" });
  } catch (e) { res.status(500).json({ error: "Gagal menyelesaikan percobaan" }); }
});

app.post("/api/attempts/expire", authenticate, async function (req, res) {
  try {
    var attemptId = req.body && req.body.attemptId;
    if (!attemptId) return res.status(400).json({ error: "attemptId diperlukan" });
    await updateRow(SHEETS.ATTEMPTS, attemptId, { status: "expired", completed_at: String(Date.now()) });
    res.json({ message: "Percobaan kedaluwarsa" });
  } catch (e) { res.status(500).json({ error: "Gagal mengarsipkan percobaan" }); }
});

// ============================================================
//  Static files + SPA fallback
// ============================================================

var distPath = path.join(process.cwd(), "dist");
if (fs.existsSync(distPath)) {
  console.log("[UjianKita] Serving static files from", distPath);
  app.use(express.static(distPath));
  app.get("*", function (req, res) {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  console.warn("[UjianKita] dist/ folder not found — frontend not built yet");
  app.get("*", function (req, res) {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
    res.status(200).send("Backend is running. Frontend not built yet.");
  });
}

// Error handler
app.use(function (err, _req, res, _next) {
  console.error("[UjianKita] Express error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ============================================================
//  Start server
// ============================================================

// Initialize Google Sheets (non-blocking — server starts anyway)
(async function () {
  console.log("[UjianKita] Initializing Google Sheets...");
  try {
    if (!SPREADSHEET_ID) throw new Error("GOOGLE_SHEET_ID not set");
    if (!SA_EMAIL) throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL not set");
    if (!SA_KEY) throw new Error("No private key available");
    if (!SA_KEY_OBJ) throw new Error("Private key not available (OpenSSL error — add NODE_OPTIONS=--openssl-legacy-provider)");

    // Verify access
    await getAccessToken();
    var meta = await sheetsApi("GET", "");
    console.log("[UjianKita] Spreadsheet:", meta.properties && meta.properties.title, "| Sheets:", (meta.sheets || []).map(function (s) { return s.properties && s.properties.title; }).join(", "));
  } catch (e) {
    console.error("[UjianKita] Failed to initialize spreadsheet:", e.message);
    console.error("[UjianKita] Server will start anyway — Google Sheets may not be configured correctly");
  }
})();

// Listen on 0.0.0.0 (all interfaces)
app.listen(PORT, "0.0.0.0", function () {
  console.log("[UjianKita] ✅ Server running on port " + PORT);
  console.log("[UjianKita] API available at http://localhost:" + PORT + "/api");
});
