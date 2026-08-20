/**
 * UjianKita - Express.js Server Entry Point
 * Compatible with Hostinger Express preset (runs with `node server.js`)
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// --- Google Sheets helper (inline to keep single entry file) ---
const { google } = require("googleapis");

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "";
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
const SA_KEY = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

let _sheets = null;

async function getSheets() {
  if (_sheets) return _sheets;
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: SA_EMAIL, private_key: SA_KEY },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  _sheets = google.sheets({ version: "v4", auth });
  return _sheets;
}

const SHEETS = {
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

async function readSheet(sheetName) {
  const api = await getSheets();
  const res = await api.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A:Z` });
  const rows = res.data.values || [];
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ""; });
    return obj;
  });
}

async function findByField(sheetName, field, value) {
  const rows = await readSheet(sheetName);
  return rows.find(r => r[field] === value) || null;
}

async function addRow(sheetName, data) {
  const api = await getSheets();
  const headers = HEADERS[sheetName];
  if (!headers) throw new Error(`Unknown sheet: ${sheetName}`);
  const row = headers.map(h => data[h] || "");
  await api.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A:Z`,
    valueInputOption: "RAW", requestBody: { values: [row] },
  });
}

async function updateRow(sheetName, id, data) {
  const api = await getSheets();
  const headers = HEADERS[sheetName];
  if (!headers) throw new Error(`Unknown sheet: ${sheetName}`);
  const res = await api.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A:Z` });
  const rows = res.data.values || [];
  const idIdx = headers.indexOf("id");
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === id) {
      const updated = headers.map(h => data[h] !== undefined ? data[h] : (rows[i][headers.indexOf(h)] || ""));
      await api.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A${i + 1}:Z${i + 1}`,
        valueInputOption: "RAW", requestBody: { values: [updated] },
      });
      return true;
    }
  }
  return false;
}

async function deleteRow(sheetName, id) {
  const api = await getSheets();
  const headers = HEADERS[sheetName];
  if (!headers) throw new Error(`Unknown sheet: ${sheetName}`);
  const res = await api.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A:Z` });
  const rows = res.data.values || [];
  const idIdx = headers.indexOf("id");
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === id) {
      const ss = await api.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
      const sheet = ss.data.sheets.find(s => s.properties?.title === sheetName);
      const sheetId = sheet?.properties?.sheetId ?? 0;
      await api.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: i, endIndex: i + 1 } } }] },
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
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "ujiankita-secret-change-in-production";

async function hashPassword(pw) { return bcrypt.hash(pw, 10); }
async function verifyPassword(pw, hash) { return bcrypt.compare(pw, hash); }
function generateToken(payload) { return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" }); }
function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

// --- Auth middleware ---
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Token autentikasi diperlukan" });
  const payload = verifyToken(authHeader.substring(7));
  if (!payload) return res.status(401).json({ error: "Token tidak valid atau sudah kedaluwarsa" });
  req.user = payload;
  next();
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Belum masuk" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Akses ditolak" });
    next();
  };
}

// ============================================================
//  API ROUTES
// ============================================================

// --- AUTH ---
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username dan password diperlukan" });
    const user = await findByField(SHEETS.USERS, "username", username);
    if (!user) return res.status(401).json({ error: "Username atau password salah" });
    if (!(await verifyPassword(password, user.password_hash))) return res.status(401).json({ error: "Username atau password salah" });
    const token = generateToken({ userId: user.id, username: user.username, role: user.role });
    res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
  } catch (e) { console.error("Login error:", e); res.status(500).json({ error: "Gagal login" }); }
});

app.post("/api/auth/bootstrap-admin", async (req, res) => {
  try {
    const users = await readSheet(SHEETS.USERS);
    if (users.find(u => u.role === "admin")) return res.status(400).json({ error: "Akun admin sudah ada" });
    const { name, username, password } = req.body;
    if (!name || !username || !password) return res.status(400).json({ error: "Nama, username, dan password diperlukan" });
    if (password.length < 8) return res.status(400).json({ error: "Password minimal 8 karakter" });
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return res.status(400).json({ error: "Username harus 3-32 karakter (huruf kecil, angka, . _ -)" });
    if (await findByField(SHEETS.USERS, "username", username)) return res.status(400).json({ error: "Username sudah dipakai" });
    await addRow(SHEETS.USERS, { id: generateId(), name: name.trim() || username, username, password_hash: await hashPassword(password), role: "admin", created_at: new Date().toISOString() });
    res.json({ message: "Akun admin berhasil dibuat" });
  } catch (e) { console.error("Bootstrap error:", e); res.status(500).json({ error: "Gagal membuat akun admin: " + (e.message || "Terjadi kesalahan server. Periksa apakah Google Spreadsheet sudah di-share ke service account.") }); }
});

app.post("/api/auth/reset-admin", async (req, res) => {
  try {
    const resetKey = process.env.ADMIN_RESET_KEY;
    if (!resetKey) return res.status(403).json({ error: "Fitur reset admin tidak aktif" });
    const { resetToken, newUsername, newPassword } = req.body;
    if (!resetToken || resetToken !== resetKey) return res.status(401).json({ error: "Reset token salah" });
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: "Password baru minimal 8 karakter" });
    const users = await readSheet(SHEETS.USERS);
    const admin = users.find(u => u.role === "admin");
    if (!admin) {
      const uname = newUsername || "admin";
      if (!/^[a-z0-9_.-]{3,32}$/.test(uname)) return res.status(400).json({ error: "Username harus 3-32 karakter" });
      await addRow(SHEETS.USERS, { id: generateId(), name: "Admin", username: uname, password_hash: await hashPassword(newPassword), role: "admin", created_at: new Date().toISOString() });
      return res.json({ message: "Akun admin berhasil dibuat", username: uname });
    }
    const updates = { password_hash: await hashPassword(newPassword) };
    if (newUsername && newUsername !== admin.username) {
      if (!/^[a-z0-9_.-]{3,32}$/.test(newUsername)) return res.status(400).json({ error: "Username harus 3-32 karakter" });
      if (await findByField(SHEETS.USERS, "username", newUsername)) return res.status(400).json({ error: "Username sudah dipakai" });
      updates.username = newUsername;
    }
    await updateRow(SHEETS.USERS, admin.id, updates);
    res.json({ message: "Admin berhasil direset", username: updates.username || admin.username });
  } catch (e) { console.error("Reset error:", e); res.status(500).json({ error: "Gagal mereset admin" }); }
});

app.get("/api/auth/has-admin", async (_req, res) => {
  try {
    const users = await readSheet(SHEETS.USERS);
    res.json({ hasAdmin: users.some(u => u.role === "admin") });
  } catch (e) { console.error("has-admin error:", e); res.status(500).json({ hasAdmin: null, error: "Gagal terhubung ke Google Sheets: " + (e.message || "Periksa konfigurasi service account dan share spreadsheet.") }); }
});

app.get("/api/auth/me", authenticate, async (req, res) => {
  try {
    const user = await findByField(SHEETS.USERS, "id", req.user.userId);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    res.json({ id: user.id, name: user.name, username: user.username, role: user.role });
  } catch (e) { console.error("me error:", e); res.status(500).json({ error: "Gagal mengambil data" }); }
});

app.put("/api/auth/me", authenticate, async (req, res) => {
  try {
    const { name, username } = req.body;
    if (!name && !username) return res.status(400).json({ error: "Tidak ada data yang diubah" });
    const user = await findByField(SHEETS.USERS, "id", req.user.userId);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    const updates = {};
    if (name !== undefined) updates.name = name.trim() || user.name;
    if (username !== undefined && username !== user.username) {
      if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return res.status(400).json({ error: "Username harus 3-32 karakter" });
      const existing = await findByField(SHEETS.USERS, "username", username);
      if (existing && existing.id !== user.id) return res.status(400).json({ error: "Username sudah dipakai" });
      updates.username = username;
    }
    if (Object.keys(updates).length > 0) await updateRow(SHEETS.USERS, user.id, updates);
    if (updates.username) {
      const newToken = generateToken({ userId: user.id, username: updates.username, role: user.role });
      return res.json({ message: "Profil berhasil diubah", token: newToken });
    }
    res.json({ message: "Profil berhasil diubah" });
  } catch (e) { console.error("update profile error:", e); res.status(500).json({ error: "Gagal mengubah profil" }); }
});

app.post("/api/auth/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Password lama dan baru diperlukan" });
    if (newPassword.length < 8) return res.status(400).json({ error: "Password baru minimal 8 karakter" });
    if (newPassword === currentPassword) return res.status(400).json({ error: "Password baru harus berbeda" });
    const user = await findByField(SHEETS.USERS, "id", req.user.userId);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    if (!(await verifyPassword(currentPassword, user.password_hash))) return res.status(401).json({ error: "Password lama salah" });
    await updateRow(SHEETS.USERS, user.id, { password_hash: await hashPassword(newPassword) });
    res.json({ message: "Password berhasil diubah" });
  } catch (e) { console.error("change-pw error:", e); res.status(500).json({ error: "Gagal mengubah password" }); }
});

// --- USERS ---
app.get("/api/users", authenticate, requireRole(["admin"]), async (_req, res) => {
  try {
    const users = await readSheet(SHEETS.USERS);
    res.json(users.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role, created_at: u.created_at })));
  } catch (e) { res.status(500).json({ error: "Gagal mengambil daftar pengguna" }); }
});

app.post("/api/users", authenticate, requireRole(["admin"]), async (req, res) => {
  try {
    const { name, username, password, role } = req.body;
    if (!name || !username || !password) return res.status(400).json({ error: "Nama, username, dan password diperlukan" });
    if (!["teacher", "student"].includes(role)) return res.status(400).json({ error: "Role harus teacher atau student" });
    if (password.length < 8) return res.status(400).json({ error: "Password minimal 8 karakter" });
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return res.status(400).json({ error: "Username harus 3-32 karakter" });
    if (await findByField(SHEETS.USERS, "username", username)) return res.status(400).json({ error: "Username sudah dipakai" });
    await addRow(SHEETS.USERS, { id: generateId(), name: name.trim() || username, username, password_hash: await hashPassword(password), role, created_at: new Date().toISOString() });
    res.json({ message: "Akun berhasil dibuat" });
  } catch (e) { res.status(500).json({ error: "Gagal membuat akun" }); }
});

app.delete("/api/users/:id", authenticate, requireRole(["admin"]), async (req, res) => {
  try {
    const user = await findByField(SHEETS.USERS, "id", req.params.id);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    if (user.role === "admin") return res.status(400).json({ error: "Akun admin tidak bisa dihapus" });
    await deleteRow(SHEETS.USERS, req.params.id);
    res.json({ message: "Akun berhasil dihapus" });
  } catch (e) { res.status(500).json({ error: "Gagal menghapus akun" }); }
});

app.post("/api/users/import", authenticate, requireRole(["admin"]), async (req, res) => {
  try {
    const { role, items } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: "Tidak ada data untuk diimpor" });
    if (items.length > 200) return res.status(400).json({ error: "Maksimal 200 akun per import" });
    if (!["teacher", "student"].includes(role)) return res.status(400).json({ error: "Role harus teacher atau student" });

    const existingUsers = await readSheet(SHEETS.USERS);
    const existingUsernames = new Set(existingUsers.map(u => u.username));
    const created = [];

    for (const item of items) {
      const name = item.name?.trim();
      if (!name) continue;
      let username = (item.username?.trim() || name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, ""));
      if (username.length < 3) username = (username + "uuu").slice(0, 3);
      if (username.length > 32) username = username.slice(0, 32);
      const base = username;
      let n = 2;
      while (existingUsernames.has(username) || created.some(c => c.username === username)) {
        username = `${base.slice(0, 28)}-${n}`; n++;
      }
      existingUsernames.add(username);
      const password = item.password?.trim() || (Math.random().toString(36).slice(-8));
      await addRow(SHEETS.USERS, { id: generateId(), name: name || username, username, password_hash: await hashPassword(password), role, created_at: new Date().toISOString() });
      created.push({ name: name || username, username, password });
    }
    res.json(created);
  } catch (e) { res.status(500).json({ error: "Gagal mengimpor pengguna" }); }
});

// --- SUBJECTS ---
app.get("/api/subjects", authenticate, async (_req, res) => {
  try { res.json(await readSheet(SHEETS.SUBJECTS)); } catch (e) { res.status(500).json({ error: "Gagal mengambil daftar mapel" }); }
});

app.post("/api/subjects", authenticate, requireRole(["admin"]), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Nama mapel wajib diisi" });
    await addRow(SHEETS.SUBJECTS, { id: generateId(), name: name.trim(), description: description?.trim() || "", created_by: req.user.userId, created_at: new Date().toISOString() });
    res.json({ message: "Mapel berhasil ditambahkan" });
  } catch (e) { res.status(500).json({ error: "Gagal menambahkan mapel" }); }
});

app.delete("/api/subjects/:id", authenticate, requireRole(["admin"]), async (req, res) => {
  try {
    const subjects = await readSheet(SHEETS.SUBJECTS);
    if (!subjects.find(s => s.id === req.params.id)) return res.status(404).json({ error: "Mapel tidak ditemukan" });
    await deleteRow(SHEETS.SUBJECTS, req.params.id);
    res.json({ message: "Mapel berhasil dihapus" });
  } catch (e) { res.status(500).json({ error: "Gagal menghapus mapel" }); }
});

// --- EXAMS ---
app.get("/api/exams", authenticate, async (req, res) => {
  try {
    const exams = await readSheet(SHEETS.EXAMS);
    const subjects = await readSheet(SHEETS.SUBJECTS);
    const users = await readSheet(SHEETS.USERS);
    const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
    const userMap = new Map(users.map(u => [u.id, u.name]));
    let filtered = exams;
    if (req.user.role === "teacher") filtered = exams.filter(e => e.created_by === req.user.userId);
    else if (req.user.role === "student") filtered = exams.filter(e => e.is_active === "true");
    res.json(filtered.map(exam => ({
      ...exam, subjectName: subjectMap.get(exam.subject_id) || null,
      teacherName: userMap.get(exam.created_by) || null,
      durationMinutes: parseInt(exam.duration_minutes), isActive: exam.is_active === "true",
      startsAt: exam.starts_at ? parseInt(exam.starts_at) : undefined,
      endsAt: exam.ends_at ? parseInt(exam.ends_at) : undefined,
    })));
  } catch (e) { res.status(500).json({ error: "Gagal mengambil daftar ujian" }); }
});

app.get("/api/exams/:id", authenticate, async (req, res) => {
  try {
    const exams = await readSheet(SHEETS.EXAMS);
    const subjects = await readSheet(SHEETS.SUBJECTS);
    const exam = exams.find(e => e.id === req.params.id);
    if (!exam) return res.status(404).json({ error: "Ujian tidak ditemukan" });
    const subject = subjects.find(s => s.id === exam.subject_id);
    res.json({ ...exam, subjectName: subject?.name || null, durationMinutes: parseInt(exam.duration_minutes), isActive: exam.is_active === "true", startsAt: exam.starts_at ? parseInt(exam.starts_at) : undefined, endsAt: exam.ends_at ? parseInt(exam.ends_at) : undefined });
  } catch (e) { res.status(500).json({ error: "Gagal mengambil data ujian" }); }
});

app.post("/api/exams", authenticate, requireRole(["teacher"]), async (req, res) => {
  try {
    const { title, subjectId, description, googleFormUrl, durationMinutes } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Nama ujian wajib diisi" });
    if (!subjectId) return res.status(400).json({ error: "Mapel wajib dipilih" });
    if (!googleFormUrl?.trim()) return res.status(400).json({ error: "Link Google Form wajib diisi" });
    if (!/^https?:\/\//i.test(googleFormUrl)) return res.status(400).json({ error: "Link Google Form harus URL valid" });
    const duration = Math.round(Number(durationMinutes) || 60);
    if (duration < 1 || duration > 600) return res.status(400).json({ error: "Durasi ujian harus antara 1-600 menit" });
    if (!(await findByField(SHEETS.SUBJECTS, "id", subjectId))) return res.status(400).json({ error: "Mapel tidak ditemukan" });
    await addRow(SHEETS.EXAMS, { id: generateId(), title: title.trim(), subject_id: subjectId, description: description?.trim() || "", google_form_url: googleFormUrl.trim(), duration_minutes: duration.toString(), is_active: "false", starts_at: "", ends_at: "", created_by: req.user.userId, created_at: new Date().toISOString() });
    res.json({ message: "Ujian berhasil dibuat sebagai draf" });
  } catch (e) { res.status(500).json({ error: "Gagal membuat ujian" }); }
});

app.patch("/api/exams/:id/schedule", authenticate, requireRole(["admin"]), async (req, res) => {
  try {
    const { isActive, startsAt, endsAt } = req.body;
    const exams = await readSheet(SHEETS.EXAMS);
    const exam = exams.find(e => e.id === req.params.id);
    if (!exam) return res.status(404).json({ error: "Ujian tidak ditemukan" });
    if (startsAt && endsAt && endsAt <= startsAt) return res.status(400).json({ error: "Waktu tutup harus setelah waktu buka" });
    await updateRow(SHEETS.EXAMS, req.params.id, { is_active: isActive ? "true" : "false", starts_at: startsAt ? startsAt.toString() : "", ends_at: endsAt ? endsAt.toString() : "" });
    res.json({ message: isActive ? "Ujian dipublikasikan" : "Ujian diarsipkan" });
  } catch (e) { res.status(500).json({ error: "Gagal menyimpan jadwal" }); }
});

app.get("/api/exams/:id/summary", authenticate, requireRole(["teacher"]), async (req, res) => {
  try {
    const exams = await readSheet(SHEETS.EXAMS);
    const exam = exams.find(e => e.id === req.params.id);
    if (!exam || exam.created_by !== req.user.userId) return res.status(403).json({ error: "Akses ditolak" });
    const attempts = await readSheet(SHEETS.ATTEMPTS);
    const ea = attempts.filter(a => a.exam_id === req.params.id);
    res.json({ started: ea.length, inProgress: ea.filter(a => a.status === "in_progress").length, completed: ea.filter(a => a.status === "completed").length, expired: ea.filter(a => a.status === "expired").length, totalViolations: ea.reduce((s, a) => s + parseInt(a.violation_count || "0"), 0) });
  } catch (e) { res.status(500).json({ error: "Gagal mengambil ringkasan" }); }
});

app.get("/api/exams/:id/attempts", authenticate, requireRole(["teacher"]), async (req, res) => {
  try {
    const exams = await readSheet(SHEETS.EXAMS);
    const exam = exams.find(e => e.id === req.params.id);
    if (!exam || exam.created_by !== req.user.userId) return res.status(403).json({ error: "Akses ditolak" });
    const attempts = await readSheet(SHEETS.ATTEMPTS);
    const users = await readSheet(SHEETS.USERS);
    const ea = attempts.filter(a => a.exam_id === req.params.id).map(a => {
      const student = users.find(u => u.id === a.student_id);
      return { ...a, violationCount: parseInt(a.violation_count || "0"), student: student ? { name: student.name, username: student.username } : null };
    }).sort((a, b) => parseInt(b.started_at || "0") - parseInt(a.started_at || "0"));
    res.json(ea);
  } catch (e) { res.status(500).json({ error: "Gagal mengambil data peserta" }); }
});

// --- ATTEMPTS ---
app.get("/api/attempts/my", authenticate, requireRole(["student"]), async (req, res) => {
  try {
    const attempts = await readSheet(SHEETS.ATTEMPTS);
    const myAttempts = attempts.filter(a => a.student_id === req.user.userId).map(a => ({
      ...a, violationCount: parseInt(a.violation_count || "0"), startedAt: parseInt(a.started_at), endsAt: parseInt(a.ends_at), completedAt: a.completed_at ? parseInt(a.completed_at) : undefined,
    }));
    res.json(myAttempts);
  } catch (e) { res.status(500).json({ error: "Gagal mengambil data percobaan" }); }
});

app.get("/api/attempts/my/:examId", authenticate, requireRole(["student"]), async (req, res) => {
  try {
    const attempts = await readSheet(SHEETS.ATTEMPTS);
    const attempt = attempts.find(a => a.exam_id === req.params.examId && a.student_id === req.user.userId);
    if (!attempt) return res.json(null);
    res.json({ ...attempt, violationCount: parseInt(attempt.violation_count || "0"), startedAt: parseInt(attempt.started_at), endsAt: parseInt(attempt.ends_at), completedAt: attempt.completed_at ? parseInt(attempt.completed_at) : undefined });
  } catch (e) { res.status(500).json({ error: "Gagal mengambil data percobaan" }); }
});

app.post("/api/attempts/start", authenticate, requireRole(["student"]), async (req, res) => {
  try {
    const { examId } = req.body;
    if (!examId) return res.status(400).json({ error: "Exam ID diperlukan" });
    const exams = await readSheet(SHEETS.EXAMS);
    const exam = exams.find(e => e.id === examId);
    if (!exam) return res.status(404).json({ error: "Ujian tidak ditemukan" });
    if (exam.is_active !== "true") return res.status(400).json({ error: "Ujian belum dipublikasikan" });
    const attempts = await readSheet(SHEETS.ATTEMPTS);
    const existing = attempts.find(a => a.exam_id === examId && a.student_id === req.user.userId);
    if (existing) return res.json({ id: existing.id });
    const now = Date.now();
    const startsAt = exam.starts_at ? parseInt(exam.starts_at) : undefined;
    const endsAt = exam.ends_at ? parseInt(exam.ends_at) : undefined;
    if (startsAt && now < startsAt) return res.status(400).json({ error: "Ujian belum dibuka" });
    if (endsAt && now >= endsAt) return res.status(400).json({ error: "Ujian sudah ditutup" });
    const attemptId = generateId();
    const durationMinutes = parseInt(exam.duration_minutes);
    await addRow(SHEETS.ATTEMPTS, { id: attemptId, exam_id: examId, student_id: req.user.userId, status: "in_progress", started_at: now.toString(), ends_at: (now + durationMinutes * 60000).toString(), completed_at: "", violation_count: "0", violations: "[]" });
    res.json({ id: attemptId });
  } catch (e) { res.status(500).json({ error: "Gagal memulai ujian" }); }
});

app.post("/api/attempts/violation", authenticate, requireRole(["student"]), async (req, res) => {
  try {
    const { attemptId, type } = req.body;
    if (!attemptId || !type) return res.status(400).json({ error: "Attempt ID dan type diperlukan" });
    const attempts = await readSheet(SHEETS.ATTEMPTS);
    const attempt = attempts.find(a => a.id === attemptId && a.student_id === req.user.userId);
    if (!attempt) return res.status(404).json({ error: "Percobaan tidak ditemukan" });
    if (attempt.status !== "in_progress") return res.json({ message: "Percobaan sudah selesai" });
    const count = parseInt(attempt.violation_count || "0");
    const violations = JSON.parse(attempt.violations || "[]");
    violations.push({ type, at: Date.now() });
    await updateRow(SHEETS.ATTEMPTS, attemptId, { violation_count: (count + 1).toString(), violations: JSON.stringify(violations) });
    res.json({ message: "Pelanggaran tercatat" });
  } catch (e) { res.status(500).json({ error: "Gagal mencatat pelanggaran" }); }
});

app.post("/api/attempts/complete", authenticate, requireRole(["student"]), async (req, res) => {
  try {
    const { attemptId } = req.body;
    if (!attemptId) return res.status(400).json({ error: "Attempt ID diperlukan" });
    const attempts = await readSheet(SHEETS.ATTEMPTS);
    const attempt = attempts.find(a => a.id === attemptId && a.student_id === req.user.userId);
    if (!attempt) return res.status(404).json({ error: "Percobaan tidak ditemukan" });
    if (attempt.status !== "in_progress") return res.json({ id: attemptId });
    const now = Date.now();
    const status = now > parseInt(attempt.ends_at) ? "expired" : "completed";
    await updateRow(SHEETS.ATTEMPTS, attemptId, { status, completed_at: now.toString() });
    res.json({ id: attemptId });
  } catch (e) { res.status(500).json({ error: "Gagal menyelesaikan ujian" }); }
});

app.post("/api/attempts/expire", authenticate, requireRole(["student"]), async (req, res) => {
  try {
    const { attemptId } = req.body;
    if (!attemptId) return res.status(400).json({ error: "Attempt ID diperlukan" });
    const attempts = await readSheet(SHEETS.ATTEMPTS);
    const attempt = attempts.find(a => a.id === attemptId && a.student_id === req.user.userId);
    if (!attempt) return res.status(404).json({ error: "Percobaan tidak ditemukan" });
    const now = Date.now();
    if (attempt.status === "in_progress" && now >= parseInt(attempt.ends_at)) {
      await updateRow(SHEETS.ATTEMPTS, attemptId, { status: "expired", completed_at: now.toString() });
    }
    res.json({ id: attemptId });
  } catch (e) { res.status(500).json({ error: "Gagal mengekspiresi ujian" }); }
});

// --- STATIC FILES & SPA ---
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(process.cwd(), "dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
}

// --- HEALTH CHECK ---
app.get("/api/health", (_req, res) => res.json({ status: "ok", timestamp: Date.now() }));

// --- DEBUG: Google Sheets diagnostic ---
app.get("/api/debug/sheets", async (_req, res) => {
  const result = { steps: [] };
  try {
    // Step 1: Check env vars
    result.steps.push({ name: "env_check", ok: true, data: {
      hasSpreadsheetId: !!SPREADSHEET_ID,
      hasServiceAccountEmail: !!SA_EMAIL,
      hasPrivateKey: !!SA_KEY,
      keyLength: SA_KEY.length,
      keyHasNewlines: SA_KEY.includes("\n"),
      keyFirstChars: SA_KEY.substring(0, 30),
    }});

    // Step 2: Auth
    try {
      const api = await getSheets();
      result.steps.push({ name: "sheets_client", ok: true });

      // Step 3: Try to access spreadsheet
      try {
        const ss = await api.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const sheets = (ss.data.sheets || []).map(s => s.properties?.title);
        result.steps.push({ name: "spreadsheet_access", ok: true, data: { title: ss.data.properties?.title, sheets } });

        // Step 4: Try to read Users sheet
        try {
          const vals = await api.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "Users!A:Z" });
          const rows = (vals.data.values || []).length;
          result.steps.push({ name: "read_users", ok: true, data: { rowCount: rows } });
        } catch (e) {
          result.steps.push({ name: "read_users", ok: false, error: e.message, code: e.code });
        }

        // Step 5: Try to append to Users sheet (dry-run check)
        try {
          await api.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID, range: "Users!A:Z",
            valueInputOption: "RAW",
            requestBody: { values: [["test_id", "test_name", "test_user", "test_hash", "test_role", "test_date"]] },
          });
          result.steps.push({ name: "append_test", ok: true });
          // Delete the test row
          try {
            const ss2 = await api.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
            const sheet = ss2.data.sheets.find(s => s.properties?.title === "Users");
            const sheetId = sheet?.properties?.sheetId ?? 0;
            const vals2 = await api.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "Users!A:Z" });
            const rowCount = (vals2.data.values || []).length;
            await api.spreadsheets.batchUpdate({
              spreadsheetId: SPREADSHEET_ID,
              requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowCount - 1, endIndex: rowCount } } }] },
            });
          } catch (_) { /* ignore cleanup error */ }
        } catch (e) {
          result.steps.push({ name: "append_test", ok: false, error: e.message, code: e.code });
        }
      } catch (e) {
        result.steps.push({ name: "spreadsheet_access", ok: false, error: e.message, code: e.code });
      }
    } catch (e) {
      result.steps.push({ name: "sheets_client", ok: false, error: e.message, code: e.code });
    }
  } catch (e) {
    result.steps.push({ name: "unknown_error", ok: false, error: e.message });
  }

  res.json(result);
});

// --- START ---
async function start() {
  try {
    console.log("Initializing Google Sheets...");
    const api = await getSheets();
    const ss = await api.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existingSheets = (ss.data.sheets || []).map(s => s.properties?.title || "");
    for (const [key, title] of Object.entries(SHEETS)) {
      if (!existingSheets.includes(title)) {
        await api.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title: title } } }] } });
        await api.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `${title}!A1:Z1`, valueInputOption: "RAW", requestBody: { values: [HEADERS[title]] } });
      }
    }
    console.log("Google Sheets initialized successfully");
  } catch (e) {
    console.error("Failed to initialize spreadsheet:", e.message);
    console.warn("Server will start anyway — Google Sheets may not be configured correctly");
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
  });
}

start();
