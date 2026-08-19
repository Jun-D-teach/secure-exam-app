import { Router } from "express";
import { hashPassword, verifyPassword } from "../utils/password";
import { generateToken } from "../utils/jwt";
import { findByField, addRow, SHEETS, readSheet, updateRow } from "../db/sheets";
import { authenticate } from "../middleware/auth";

const router = Router();

interface UserRow {
  id: string;
  name: string;
  username: string;
  password_hash: string;
  role: string;
  created_at: string;
}

// Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username dan password diperlukan" });
    }
    
    const user = await findByField<UserRow>(SHEETS.USERS, "username", username);
    
    if (!user) {
      return res.status(401).json({ error: "Username atau password salah" });
    }
    
    const isValid = await verifyPassword(password, user.password_hash);
    
    if (!isValid) {
      return res.status(401).json({ error: "Username atau password salah" });
    }
    
    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });
    
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Gagal login" });
  }
});

// Bootstrap first admin (only works if no admin exists)
router.post("/bootstrap-admin", async (req, res) => {
  try {
    const users = await readSheet(SHEETS.USERS);
    const existingAdmin = users.find(u => u.role === "admin");
    
    if (existingAdmin) {
      return res.status(400).json({ error: "Akun admin sudah ada" });
    }
    
    const { name, username, password } = req.body;
    
    if (!name || !username || !password) {
      return res.status(400).json({ error: "Nama, username, dan password diperlukan" });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: "Password minimal 8 karakter" });
    }
    
    // Validate username format
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
      return res.status(400).json({ error: "Username harus 3-32 karakter (huruf kecil, angka, . _ -)" });
    }
    
    // Check if username exists
    const existingUser = await findByField<UserRow>(SHEETS.USERS, "username", username);
    if (existingUser) {
      return res.status(400).json({ error: "Username sudah dipakai" });
    }
    
    const passwordHash = await hashPassword(password);
    
    await addRow(SHEETS.USERS, {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      name: name.trim() || username,
      username,
      password_hash: passwordHash,
      role: "admin",
      created_at: new Date().toISOString(),
    });
    
    res.json({ message: "Akun admin berhasil dibuat" });
  } catch (error) {
    console.error("Bootstrap admin error:", error);
    res.status(500).json({ error: "Gagal membuat akun admin" });
  }
});

// Check if admin exists
router.get("/has-admin", async (req, res) => {
  try {
    const users = await readSheet(SHEETS.USERS);
    const hasAdmin = users.some(u => u.role === "admin");
    res.json({ hasAdmin });
  } catch (error) {
    console.error("Check admin error:", error);
    res.status(500).json({ error: "Gagal memeriksa admin" });
  }
});

// Get current user
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await findByField<UserRow>(SHEETS.USERS, "id", req.user!.userId);
    
    if (!user) {
      return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    }
    
    res.json({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Gagal mengambil data pengguna" });
  }
});

// Update profile (name, username)
router.put("/me", authenticate, async (req, res) => {
  try {
    const { name, username } = req.body;
    
    if (!name && !username) {
      return res.status(400).json({ error: "Tidak ada data yang diubah" });
    }
    
    const user = await findByField<UserRow>(SHEETS.USERS, "id", req.user!.userId);
    
    if (!user) {
      return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    }
    
    const updates: Partial<UserRow> = {};
    
    if (name !== undefined) {
      updates.name = name.trim() || user.name;
    }
    
    if (username !== undefined && username !== user.username) {
      // Validate username format
      if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
        return res.status(400).json({ error: "Username harus 3-32 karakter (huruf kecil, angka, . _ -)" });
      }
      // Check if username already exists
      const existing = await findByField<UserRow>(SHEETS.USERS, "username", username);
      if (existing && existing.id !== user.id) {
        return res.status(400).json({ error: "Username sudah dipakai" });
      }
      updates.username = username;
    }
    
    if (Object.keys(updates).length > 0) {
      await updateRow(SHEETS.USERS, user.id, updates);
    }
    
    // If username changed, generate new token
    if (updates.username) {
      const newToken = generateToken({
        userId: user.id,
        username: updates.username,
        role: user.role,
      });
      return res.json({ message: "Profil berhasil diubah", token: newToken });
    }
    
    res.json({ message: "Profil berhasil diubah" });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Gagal mengubah profil" });
  }
});

// Change password
router.post("/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Password lama dan baru diperlukan" });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password baru minimal 8 karakter" });
    }
    
    if (newPassword === currentPassword) {
      return res.status(400).json({ error: "Password baru harus berbeda dari password lama" });
    }
    
    const user = await findByField<UserRow>(SHEETS.USERS, "id", req.user!.userId);
    
    if (!user) {
      return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    }
    
    const isValid = await verifyPassword(currentPassword, user.password_hash);
    
    if (!isValid) {
      return res.status(401).json({ error: "Password lama salah" });
    }
    
    const newHash = await hashPassword(newPassword);
    await updateRow(SHEETS.USERS, user.id, { password_hash: newHash });
    
    res.json({ message: "Password berhasil diubah" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Gagal mengubah password" });
  }
});

export default router;
