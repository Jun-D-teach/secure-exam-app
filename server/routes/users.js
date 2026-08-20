import { Router } from "express";
import { hashPassword } from "../utils/password.js";
import { generateId, readSheet, addRow, deleteRow, SHEETS, findByField } from "../db/sheets.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requireRole(["admin"]));

router.get("/", async (_req, res) => {
  try {
    const users = await readSheet(SHEETS.USERS);
    const sanitized = users.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role, created_at: u.created_at }));
    res.json(sanitized);
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ error: "Gagal mengambil daftar pengguna" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, username, password, role } = req.body;
    if (!name || !username || !password) return res.status(400).json({ error: "Nama, username, dan password diperlukan" });
    if (!["teacher", "student"].includes(role)) return res.status(400).json({ error: "Role harus teacher atau student" });
    if (password.length < 8) return res.status(400).json({ error: "Password minimal 8 karakter" });
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return res.status(400).json({ error: "Username harus 3-32 karakter (huruf kecil, angka, . _ -)" });
    const existing = await findByField(SHEETS.USERS, "username", username);
    if (existing) return res.status(400).json({ error: "Username sudah dipakai" });
    const passwordHash = await hashPassword(password);
    await addRow(SHEETS.USERS, {
      id: generateId(), name: name.trim() || username, username, password_hash: passwordHash, role, created_at: new Date().toISOString(),
    });
    res.json({ message: "Akun berhasil dibuat" });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Gagal membuat akun" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await findByField(SHEETS.USERS, "id", id);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    if (user.role === "admin") return res.status(400).json({ error: "Akun admin tidak bisa dihapus" });
    await deleteRow(SHEETS.USERS, id);
    res.json({ message: "Akun berhasil dihapus" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Gagal menghapus akun" });
  }
});

router.post("/import", async (req, res) => {
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
      let username = item.username?.trim() || generateSlug(name);
      if (!/^[a-z0-9_.-]{3,32}$/.test(username)) username = username.replace(/[^a-z0-9_.-]/g, ".").slice(0, 32);
      let baseUsername = username;
      let n = 2;
      while (existingUsernames.has(username) || created.some(c => c.username === username)) {
        username = `${baseUsername.slice(0, 28)}-${n}`;
        n++;
      }
      existingUsernames.add(username);
      const password = item.password?.trim() || generatePassword();
      const passwordHash = await hashPassword(password);
      await addRow(SHEETS.USERS, {
        id: generateId(), name: name || username, username, password_hash: passwordHash, role, created_at: new Date().toISOString(),
      });
      created.push({ name: name || username, username, password });
    }

    res.json(created);
  } catch (error) {
    console.error("Import users error:", error);
    res.status(500).json({ error: "Gagal mengimpor pengguna" });
  }
});

function generateSlug(name) {
  let slug = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").replace(/\.{2,}/g, ".");
  if (slug.length < 3) slug = (slug + "u".repeat(3)).slice(0, 3);
  if (slug.length > 32) slug = slug.slice(0, 32).replace(/\.+$/g, "");
  return slug;
}

function generatePassword() {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const parts = [
    ...Array.from({ length: 5 }, () => letters[Math.floor(Math.random() * letters.length)]),
    ...Array.from({ length: 3 }, () => digits[Math.floor(Math.random() * digits.length)]),
  ];
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }
  return parts.join("");
}

export default router;
