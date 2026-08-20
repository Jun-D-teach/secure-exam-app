import { Router } from "express";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { generateToken } from "../utils/jwt.js";
import { findByField, addRow, SHEETS, readSheet, updateRow } from "../db/sheets.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username dan password diperlukan" });
    }
    const user = await findByField(SHEETS.USERS, "username", username);
    if (!user) return res.status(401).json({ error: "Username atau password salah" });
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: "Username atau password salah" });
    const token = generateToken({ userId: user.id, username: user.username, role: user.role });
    res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Gagal login" });
  }
});

router.post("/bootstrap-admin", async (req, res) => {
  try {
    const users = await readSheet(SHEETS.USERS);
    const existingAdmin = users.find(u => u.role === "admin");
    if (existingAdmin) return res.status(400).json({ error: "Akun admin sudah ada" });
    const { name, username, password } = req.body;
    if (!name || !username || !password) return res.status(400).json({ error: "Nama, username, dan password diperlukan" });
    if (password.length < 8) return res.status(400).json({ error: "Password minimal 8 karakter" });
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return res.status(400).json({ error: "Username harus 3-32 karakter (huruf kecil, angka, . _ -)" });
    const existingUser = await findByField(SHEETS.USERS, "username", username);
    if (existingUser) return res.status(400).json({ error: "Username sudah dipakai" });
    const passwordHash = await hashPassword(password);
    await addRow(SHEETS.USERS, {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      name: name.trim() || username, username, password_hash: passwordHash, role: "admin", created_at: new Date().toISOString(),
    });
    res.json({ message: "Akun admin berhasil dibuat" });
  } catch (error) {
    console.error("Bootstrap admin error:", error);
    res.status(500).json({ error: "Gagal membuat akun admin" });
  }
});

router.post("/reset-admin", async (req, res) => {
  try {
    const resetKey = process.env.ADMIN_RESET_KEY;
    if (!resetKey) return res.status(403).json({ error: "Fitur reset admin tidak aktif. Atur ADMIN_RESET_KEY di environment." });
    const { resetToken, newUsername, newPassword } = req.body;
    if (!resetToken || resetToken !== resetKey) return res.status(401).json({ error: "Reset token salah" });
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: "Password baru minimal 8 karakter" });
    const users = await readSheet(SHEETS.USERS);
    const admin = users.find(u => u.role === "admin");
    if (!admin) {
      const username = newUsername || "admin";
      if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return res.status(400).json({ error: "Username harus 3-32 karakter" });
      const passwordHash = await hashPassword(newPassword);
      await addRow(SHEETS.USERS, {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
        name: "Admin", username, password_hash: passwordHash, role: "admin", created_at: new Date().toISOString(),
      });
      return res.json({ message: "Akun admin berhasil dibuat", username });
    }
    const passwordHash = await hashPassword(newPassword);
    const updates = { password_hash: passwordHash };
    if (newUsername && newUsername !== admin.username) {
      if (!/^[a-z0-9_.-]{3,32}$/.test(newUsername)) return res.status(400).json({ error: "Username harus 3-32 karakter" });
      const existing = await findByField(SHEETS.USERS, "username", newUsername);
      if (existing) return res.status(400).json({ error: "Username sudah dipakai" });
      updates.username = newUsername;
    }
    await updateRow(SHEETS.USERS, admin.id, updates);
    res.json({ message: "Admin berhasil direset", username: updates.username || admin.username });
  } catch (error) {
    console.error("Reset admin error:", error);
    res.status(500).json({ error: "Gagal mereset admin" });
  }
});

router.get("/has-admin", async (_req, res) => {
  try {
    const users = await readSheet(SHEETS.USERS);
    const hasAdmin = users.some(u => u.role === "admin");
    res.json({ hasAdmin });
  } catch (error) {
    console.error("Check admin error:", error);
    res.json({ hasAdmin: false });
  }
});

router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await findByField(SHEETS.USERS, "id", req.user.userId);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    res.json({ id: user.id, name: user.name, username: user.username, role: user.role });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Gagal mengambil data pengguna" });
  }
});

router.put("/me", authenticate, async (req, res) => {
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
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Gagal mengubah profil" });
  }
});

router.post("/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Password lama dan baru diperlukan" });
    if (newPassword.length < 8) return res.status(400).json({ error: "Password baru minimal 8 karakter" });
    if (newPassword === currentPassword) return res.status(400).json({ error: "Password baru harus berbeda dari password lama" });
    const user = await findByField(SHEETS.USERS, "id", req.user.userId);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    const isValid = await verifyPassword(currentPassword, user.password_hash);
    if (!isValid) return res.status(401).json({ error: "Password lama salah" });
    const newHash = await hashPassword(newPassword);
    await updateRow(SHEETS.USERS, user.id, { password_hash: newHash });
    res.json({ message: "Password berhasil diubah" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Gagal mengubah password" });
  }
});

export default router;
