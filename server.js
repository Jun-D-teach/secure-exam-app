/**
 * UjianKita - Express.js Server Entry Point
 * Compatible with Hostinger Express preset (runs with `node server.js`)
 *
 * Google Sheets integration uses direct Node.js crypto + HTTPS
 * (bypasses googleapis/gtoken/jwa to avoid OpenSSL 3.x DECODER errors)
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
var crypto = require("crypto");
var https = require("https");
var http = require("http");

console.log("[UjianKita] Dependencies loaded (express, cors, crypto, https)");

var app = express();
var PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ============================================================
//  GOOGLE SHEETS (Direct implementation - no googleapis library)
// ============================================================

var SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "";
var SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";

// --- Normalize private key ---
function normalizePemKey(raw) {
  if (!raw) return "";
  var s = raw;
  // Remove surrounding quotes (single or double)
  if (s.length >= 2) {
    var fc = s.charCodeAt(0);
    var lc = s.charCodeAt(s.length - 1);
    if ((fc === 34 && lc === 34) || (fc === 39 && lc === 39)) {
      s = s.substring(1, s.length - 1);
    }
  }
  // Multi-pass: convert all escaped newlines to real newlines
  for (var pass = 0; pass < 5; pass++) {
    var changed = false;
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c === 13) {
        if (i + 1 < s.length && s.charCodeAt(i + 1) === 10) i++;
        out.push("\n");
        changed = true;
      } else if (c === 92 && i + 1 < s.length) {
        var nc = s.charCodeAt(i + 1);
        if (nc === 110) { out.push("\n"); i++; changed = true; }
        else if (nc === 114) { out.push("\r"); i++; changed = true; }
        else { out.push(s.charAt(i)); }
      } else {
        out.push(s.charAt(i));
      }
    }
    s = out.join("");
    if (!changed) break;
  }
  // Collapse multiple blank lines
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

// Rebuild PEM with proper 64-char base64 line wrapping
function fixPemLineWrapping(pem) {
  var lines = pem.split("\n");
  var header = "";
  var footer = "";
  var b64chars = [];
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i].trim();
    if (l.indexOf("-----BEGIN") === 0) { header = l; continue; }
    if (l.indexOf("-----END") === 0) { footer = l; continue; }
    if (l) {
      // Remove any whitespace from base64 content
      for (var j = 0; j < l.length; j++) {
        var ch = l.charCodeAt(j);
        // Only keep base64 chars: A-Z a-z 0-9 + / =
        if ((ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122) || (ch >= 48 && ch <= 57) || ch === 43 || ch === 47 || ch === 61) {
          b64chars.push(l.charAt(j));
        }
      }
    }
  }
  if (!header || !footer || b64chars.length === 0) return pem;
  // Rebuild with 64-char lines
  var b64 = b64chars.join("");
  var result = [header];
  for (var k = 0; k < b64.length; k += 64) {
    result.push(b64.substring(k, k + 64));
  }
  result.push(footer);
  return result.join("\n");
}

// Safely parse PEM key - tries multiple approaches
function safeParsePemKey(pem) {
  // Approach 1: Direct PEM
  try {
    var key = crypto.createPrivateKey({ key: pem, format: "pem" });
    console.log("[UjianKita] Key parsed directly (type:", key.type, ", bits:", key.asymmetricKeyBits, ")");
    return key;
  } catch (e1) {
    console.log("[UjianKita] Direct parse failed:", e1.message);
  }
  // Approach 2: Fix line wrapping then try again
  try {
    var fixed = fixPemLineWrapping(pem);
    var key2 = crypto.createPrivateKey({ key: fixed, format: "pem" });
    console.log("[UjianKita] Key parsed after line-wrap fix (type:", key2.type, ", bits:", key2.asymmetricKeyBits, ")");
    return key2;
  } catch (e2) {
    console.log("[UjianKita] Line-wrap fix parse failed:", e2.message);
  }
  // Approach 3: Try as PKCS8 explicit
  try {
    var key3 = crypto.createPrivateKey({ key: pem, format: "pem", type: "pkcs8" });
    console.log("[UjianKita] Key parsed as explicit PKCS8 (type:", key3.type, ", bits:", key3.asymmetricKeyBits, ")");
    return key3;
  } catch (e3) {
    console.log("[UjianKita] PKCS8 explicit parse failed:", e3.message);
  }
  // Approach 4: Convert PEM to DER buffer, then parse as DER (bypasses PEM decoder issues)
  try {
    var lines = pem.replace(/-----[^-]+-----/g, '').trim();
    var derBuffer = Buffer.from(lines, 'base64');
    var key4 = crypto.createPrivateKey({ key: derBuffer, format: 'der', type: 'pkcs8' });
    console.log("[UjianKita] Key parsed from DER buffer (type:", key4.type, ", bits:", key4.asymmetricKeyBits, ")");
    return key4;
  } catch (e4) {
    console.log("[UjianKita] DER buffer parse failed:", e4.message);
  }
  // Approach 5: Try as PKCS1 (older RSA format)
  try {
    var key5 = crypto.createPrivateKey({ key: pem, format: 'pem', type: 'pkcs1' });
    console.log("[UjianKita] Key parsed as PKCS1 (type:", key5.type, ", bits:", key5.asymmetricKeyBits, ")");
    return key5;
  } catch (e5) {
    console.log("[UjianKita] PKCS1 parse failed:", e5.message);
  }
  // All approaches failed
  console.error("[UjianKita] ALL key parsing approaches failed!");
  console.error("[UjianKita] Add this env var in Hostinger: NODE_OPTIONS = --openssl-legacy-provider");
  return null;
}

// --- Load private key (multiple sources, most reliable first) ---
var SA_KEY = "";
var SA_KEY_OBJ = null;

// Source 1: GOOGLE_SERVICE_ACCOUNT_JSON (entire JSON key file content)
// Common issue: user pastes JSON WITHOUT outer {} braces
if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  var jsonRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  console.log("[UjianKita] JSON env raw length:", jsonRaw.length, "first 100:", jsonRaw.substring(0, 100));
  var charCodes = [];
  for (var ci = 0; ci < Math.min(30, jsonRaw.length); ci++) {
    charCodes.push(jsonRaw.charCodeAt(ci));
  }
  console.log("[UjianKita] JSON env first 30 charCodes:", charCodes.join(", "));

  // Smart pre-processing: detect and fix common Hostinger issues
  var processed = jsonRaw.trim();

  // Remove surrounding quotes if Hostinger double-quoted the entire value
  // BUT only if the content INSIDE the quotes starts with { (valid JSON object)
  if (processed.length >= 2 && processed.charCodeAt(0) === 34 && processed.charCodeAt(processed.length - 1) === 34) {
    var inner = processed.substring(1, processed.length - 1).trim();
    if (inner.charAt(0) === '{') {
      processed = inner;
      console.log("[UjianKita] Removed surrounding quotes (inner starts with {)");
    }
  }

  // If content doesn't start with {, user pasted JSON without braces — add them
  if (processed.charAt(0) !== '{') {
    processed = '{' + processed + '}';
    console.log("[UjianKita] Added missing outer {} braces");
  }

  // Try parsing with multiple unescape strategies
  var saJson = null;
  var jsonStrategies = [
    // Strategy 1: parse as-is (normal case)
    function (s) { return JSON.parse(s); },
    // Strategy 2: unescape Hostinger double-escaped quotes
    function (s) { return JSON.parse(s.replace(/\\"/g, '"')); },
    // Strategy 3: unescape quotes + newlines
    function (s) {
      s = s.replace(/\\"/g, '"');
      s = s.replace(/\\n/g, '\n');
      s = s.replace(/\\r/g, '\r');
      return JSON.parse(s);
    },
    // Strategy 4: aggressive — unescape everything
    function (s) {
      s = s.replace(/\\"/g, '"');
      s = s.replace(/\\n/g, '\n');
      s = s.replace(/\\r/g, '\r');
      s = s.replace(/\\t/g, '\t');
      s = s.replace(/\\\\/g, '\\');
      return JSON.parse(s);
    },
  ];

  for (var si = 0; si < jsonStrategies.length; si++) {
    try {
      saJson = jsonStrategies[si](processed);
      console.log("[UjianKita] JSON parsed OK with strategy", si + 1, ". Keys:", Object.keys(saJson).join(", "));
      break;
    } catch (je) {
      console.log("[UjianKita] JSON strategy", si + 1, "failed:", je.message);
    }
  }

  if (saJson) {
    var rawKey = saJson.private_key || "";
    SA_KEY = normalizePemKey(rawKey);
    if (!SA_EMAIL && saJson.client_email) SA_EMAIL = saJson.client_email;
    console.log("[UjianKita] Key from JSON (" + SA_KEY.length + " chars)");
  } else {
    // ALL JSON strategies failed — extract private_key via REGEX (bypass JSON entirely)
    console.error("[UjianKita] JSON parse failed. Extracting private_key via regex...");
    // Try specific regex first
    var pemRegex = /"private_key"\s*:\s*"((?:-----BEGIN[^"]*?-----)[\s\S]*?(?:-----END[^"]*?-----)[^"]*?)"/;
    var pemMatch = jsonRaw.match(pemRegex);
    if (pemMatch) {
      SA_KEY = normalizePemKey(pemMatch[1]);
      console.log("[UjianKita] Regex extracted PEM key (" + SA_KEY.length + " chars)");
    } else {
      // Broader regex: find anything between BEGIN and END markers
      var broadRegex = /((?:-----BEGIN[^-]*-----)[\s\S]*?(?:-----END[^-]*-----))/;
      var broadMatch = jsonRaw.match(broadRegex);
      if (broadMatch) {
        SA_KEY = normalizePemKey(broadMatch[1]);
        console.log("[UjianKita] Broad regex extracted PEM key (" + SA_KEY.length + " chars)");
      } else {
        console.error("[UjianKita] Could not extract PEM key from JSON env var");
        console.error("[UjianKita] Raw env first 200 chars:", jsonRaw.substring(0, 200));
      }
    }
    // Also try to extract client_email via regex
    var emailRegex = /"client_email"\s*:\s*"([^"]+)"/;
    var emailMatch = jsonRaw.match(emailRegex);
    if (!SA_EMAIL && emailMatch) {
      SA_EMAIL = emailMatch[1];
      console.log("[UjianKita] Regex extracted client_email:", SA_EMAIL);
    }
  }
}

// Source 2: GOOGLE_PRIVATE_KEY_B64 (base64-encoded PEM)
if (!SA_KEY && process.env.GOOGLE_PRIVATE_KEY_B64) {
  try {
    SA_KEY = Buffer.from(process.env.GOOGLE_PRIVATE_KEY_B64, "base64").toString("utf-8").trim();
    console.log("[UjianKita] Private key loaded from GOOGLE_PRIVATE_KEY_B64 (" + SA_KEY.length + " chars)");
  } catch (e) {
    console.error("[UjianKita] Failed to decode GOOGLE_PRIVATE_KEY_B64:", e.message);
  }
}

// Source 3: GOOGLE_PRIVATE_KEY (raw PEM string in env var)
if (!SA_KEY && process.env.GOOGLE_PRIVATE_KEY) {
  SA_KEY = normalizePemKey(process.env.GOOGLE_PRIVATE_KEY);
  console.log("[UjianKita] Private key loaded from GOOGLE_PRIVATE_KEY (" + SA_KEY.length + " chars)");
}

// Validate and parse the key
if (SA_KEY) {
  var hasBegin = SA_KEY.indexOf("-----BEGIN PRIVATE KEY-----") === 0 || SA_KEY.indexOf("-----BEGIN RSA PRIVATE KEY-----") === 0;
  var hasEnd = SA_KEY.indexOf("-----END PRIVATE KEY-----") > -1 || SA_KEY.indexOf("-----END RSA PRIVATE KEY-----") > -1;
  var lineCount = SA_KEY.split("\n").length;
  console.log("[UjianKita] Key validation:", { hasBegin: hasBegin, hasEnd: hasEnd, lines: lineCount, keyLen: SA_KEY.length });
  if (!hasBegin) console.error("[UjianKita] WARNING: Key missing BEGIN marker. First 80 chars:", SA_KEY.substring(0, 80));
  if (!hasEnd) console.error("[UjianKita] WARNING: Key missing END marker. Last 80 chars:", SA_KEY.substring(SA_KEY.length - 80));

  SA_KEY_OBJ = safeParsePemKey(SA_KEY);
  if (!SA_KEY_OBJ) {
    // Try with fixed line wrapping
    var fixedKey = fixPemLineWrapping(SA_KEY);
    if (fixedKey !== SA_KEY) {
      console.log("[UjianKita] Trying with fixed line wrapping...");
      SA_KEY_OBJ = safeParsePemKey(fixedKey);
      if (SA_KEY_OBJ) SA_KEY = fixedKey;
    }
  }
} else {
  console.error("[UjianKita] No private key found!");
  console.error("[UjianKita] Set one of: GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_PRIVATE_KEY_B64, or GOOGLE_PRIVATE_KEY");
}

// Check NODE_OPTIONS for OpenSSL compatibility
if (!process.env.NODE_OPTIONS || process.env.NODE_OPTIONS.indexOf('openssl-legacy-provider') === -1) {
  console.log("[UjianKita] TIP: Add env var NODE_OPTIONS = --openssl-legacy-provider for OpenSSL 3.x compatibility");
}

console.log("[UjianKita] ENV check:", {
  hasSpreadsheetId: !!SPREADSHEET_ID,
  hasServiceAccountEmail: !!SA_EMAIL,
  hasPrivateKey: !!SA_KEY,
  keyLength: SA_KEY.length,
  nodeEnv: process.env.NODE_ENV || "(not set)",
});

// --- JWT + OAuth2 for Google API access ---
var _accessToken = null;
var _tokenExpiry = 0;

function base64url(str) {
  return Buffer.from(str).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createSignedJwt() {
  if (!SA_KEY_OBJ) throw new Error("Private key not available — check GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_PRIVATE_KEY env vars");
  var now = Math.floor(Date.now() / 1000);
  var header = JSON.stringify({ alg: "RS256", typ: "JWT" });
  var claim = JSON.stringify({
    iss: SA_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  });
  var signInput = base64url(header) + "." + base64url(claim);
  var sign = crypto.createSign("RSA-SHA256");
  sign.update(signInput);
  sign.end();
  var signature = sign.sign(SA_KEY_OBJ, "base64url");
  return signInput + "." + signature;
}

function httpsRequest(url, options, body) {
  return new Promise(function (resolve, reject) {
    var parsed = new (require("url").URL)(url);
    var mod = parsed.protocol === "https:" ? https : http;
    var req = mod.request(url, options, function (res) {
      var chunks = [];
      res.on("data", function (chunk) { chunks.push(chunk); });
      res.on("end", function () {
        var data = Buffer.concat(chunks).toString("utf-8");
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
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
    // Token expired, retry once
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

// --- Sheet helpers ---
async function readSheet(sheetName) {
  var data = await sheetsApi("GET", "/values/" + sheetName + "!A:Z");
  var rows = data.values || [];
  if (rows.length < 2) return [];
  var headers = rows[0];
  return rows.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = (row[i] || "").trim(); });
    return obj;
  });
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
      // Get sheet ID from metadata
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
    // Show raw JSON env var char codes for debugging
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      var rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      var codes = [];
      for (var ci = 0; ci < Math.min(50, rawJson.length); ci++) {
        codes.push(rawJson.charCodeAt(ci));
      }
      keyInfo.jsonEnvRawLength = rawJson.length;
      keyInfo.jsonEnvFirst50CharCodes = codes.join(", ");
      keyInfo.jsonEnvFirst50Chars = rawJson.substring(0, 50);
    }
    result.steps.push({ name: "env_check", ok: true, data: Object.assign({
      hasSpreadsheetId: !!SPREADSHEET_ID, hasServiceAccountEmail: !!SA_EMAIL,
      hasPrivateKey: !!SA_KEY,
    }, keyInfo) });
    // Test key parsing using pre-parsed KeyObject
    if (SA_KEY_OBJ) {
      result.steps.push({ name: "key_parse", ok: true, data: { type: SA_KEY_OBJ.type, bits: SA_KEY_OBJ.asymmetricKeyBits } });
    } else {
      try {
        var testKey = crypto.createPrivateKey({ key: SA_KEY, format: "pem" });
        result.steps.push({ name: "key_parse", ok: true, data: { type: testKey.type, bits: testKey.asymmetricKeyBits } });
      } catch (e) {
        result.steps.push({ name: "key_parse", ok: false, error: e.message });
        return res.json(result);
      }
    }
    // Test JWT signing
    try {
      var jwt = await createSignedJwt();
      result.steps.push({ name: "jwt_sign", ok: true, data: { jwtLength: jwt.length } });
    } catch (e) {
      result.steps.push({ name: "jwt_sign", ok: false, error: e.message });
      return res.json(result);
    }
    // Test access token
    try {
      _accessToken = null;
      var token = await getAccessToken();
      result.steps.push({ name: "access_token", ok: true });
    } catch (e) {
      result.steps.push({ name: "access_token", ok: false, error: e.message });
      return res.json(result);
    }
    // Test spreadsheet access
    try {
      var meta = await sheetsApi("GET", "");
      var sheets = (meta.sheets || []).map(function (s) { return s.properties && s.properties.title; });
      result.steps.push({ name: "spreadsheet_access", ok: true, data: { title: meta.properties && meta.properties.title, sheets: sheets } });
    } catch (e) {
      result.steps.push({ name: "spreadsheet_access", ok: false, error: e.message });
      return res.json(result);
    }
    // Test read Users
    try {
      var vals = await sheetsApi("GET", "/values/Users!A:Z");
      result.steps.push({ name: "read_users", ok: true, data: { rowCount: (vals.values || []).length } });
    } catch (e) {
      result.steps.push({ name: "read_users", ok: false, error: e.message });
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
  } catch (e) { console.error("[UjianKita] Login error:", e.message); res.status(500).json({ error: "Gagal login: " + e.message }); }
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
  } catch (e) { console.error("[UjianKita] Bootstrap error:", e.message); res.status(500).json({ error: "Gagal membuat akun admin: " + e.message }); }
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
  } catch (e) { console.error("[UjianKita] Reset error:", e.message); res.status(500).json({ error: "Gagal mereset admin: " + e.message }); }
});

app.get("/api/auth/has-admin", async function (_req, res) {
  try {
    var users = await readSheet(SHEETS.USERS);
    res.json({ hasAdmin: users.some(function (u) { return u.role === "admin"; }) });
  } catch (e) {
    console.error("[UjianKita] has-admin error:", e.message);
    res.status(500).json({ hasAdmin: null, error: "Gagal terhubung ke Google Sheets: " + e.message });
  }
});

app.get("/api/auth/me", authenticate, async function (req, res) {
  try {
    var user = await findByField(SHEETS.USERS, "id", req.user.userId);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    res.json({ id: user.id, name: user.name, username: user.username, role: user.role });
  } catch (e) { res.status(500).json({ error: "Gagal mengambil data" }); }
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
  } catch (e) { res.status(500).json({ error: "Gagal mengubah profil" }); }
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
  } catch (e) { res.status(500).json({ error: "Gagal mengubah password" }); }
});

// --- USERS ---
app.get("/api/users", authenticate, requireRole(["admin"]), async function (_req, res) {
  try {
    var users = await readSheet(SHEETS.USERS);
    res.json(users.map(function (u) { return { id: u.id, name: u.name, username: u.username, role: u.role, created_at: u.created_at }; }));
  } catch (e) { res.status(500).json({ error: "Gagal mengambil daftar pengguna: " + e.message }); }
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
  } catch (e) { res.status(500).json({ error: "Gagal membuat akun: " + e.message }); }
});

app.delete("/api/users/:id", authenticate, requireRole(["admin"]), async function (req, res) {
  try {
    var user = await findByField(SHEETS.USERS, "id", req.params.id);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    if (user.role === "admin") return res.status(400).json({ error: "Akun admin tidak bisa dihapus" });
    var deleted = await deleteRow(SHEETS.USERS, req.params.id);
    if (!deleted) return res.status(404).json({ error: "Akun tidak ditemukan di spreadsheet" });
    res.json({ message: "Akun berhasil dihapus" });
  } catch (e) { res.status(500).json({ error: "Gagal menghapus akun: " + e.message }); }
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
  } catch (e) { res.status(500).json({ error: "Gagal mengimpor pengguna: " + e.message }); }
});

// --- SUBJECTS ---
app.get("/api/subjects", authenticate, async function (_req, res) {
  try { res.json(await readSheet(SHEETS.SUBJECTS)); } catch (e) { res.status(500).json({ error: "Gagal mengambil daftar mapel: " + e.message }); }
});

app.post("/api/subjects", authenticate, requireRole(["admin"]), async function (req, res) {
  try {
    var name = req.body && req.body.name;
    var description = req.body && req.body.description;
    if (!name || !name.trim()) return res.status(400).json({ error: "Nama mapel wajib diisi" });
    await addRow(SHEETS.SUBJECTS, { id: generateId(), name: name.trim(), description: (description && description.trim()) || "", created_by: req.user.userId, created_at: new Date().toISOString() });
    res.json({ message: "Mapel berhasil ditambahkan" });
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
  } catch (e) { res.status(500).json({ error: "Gagal mengambil daftar ujian: " + e.message }); }
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
  } catch (e) { res.status(500).json({ error: "Gagal mengambil data ujian: " + e.message }); }
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
    if (startsAt && endsAt && endsAt <= startsAt) return res.status(400).json({ error: "Waktu tutup harus setelah waktu buka" });
    await updateRow(SHEETS.EXAMS, req.params.id, { is_active: isActive ? "true" : "false", starts_at: startsAt ? startsAt.toString() : "", ends_at: endsAt ? endsAt.toString() : "" });
    res.json({ message: isActive ? "Ujian dipublikasikan" : "Ujian diarsipkan" });
  } catch (e) { res.status(500).json({ error: "Gagal menyimpan jadwal: " + e.message }); }
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
  } catch (e) { res.status(500).json({ error: "Gagal mengambil ringkasan: " + e.message }); }
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
  } catch (e) { res.status(500).json({ error: "Gagal mengambil data peserta: " + e.message }); }
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
  } catch (e) { res.status(500).json({ error: "Gagal mengambil data percobaan: " + e.message }); }
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
  } catch (e) { res.status(500).json({ error: "Gagal mengambil data percobaan: " + e.message }); }
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
  } catch (e) { res.status(500).json({ error: "Gagal memulai ujian: " + e.message }); }
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
  } catch (e) { res.status(500).json({ error: "Gagal mencatat pelanggaran: " + e.message }); }
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
  } catch (e) { res.status(500).json({ error: "Gagal menyelesaikan ujian: " + e.message }); }
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
  } catch (e) { res.status(500).json({ error: "Gagal mengekspiresi ujian: " + e.message }); }
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
  console.log("[UjianKita] Health: http://localhost:" + PORT + "/api/health");
  console.log("[UjianKita] Debug: http://localhost:" + PORT + "/api/debug/sheets");
});

console.log("[UjianKita] app.listen() called, waiting for callback...");
