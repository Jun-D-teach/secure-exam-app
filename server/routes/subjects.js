import { Router } from "express";
import { generateId, readSheet, addRow, deleteRow, SHEETS } from "../db/sheets.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticate, async (_req, res) => {
  try {
    const subjects = await readSheet(SHEETS.SUBJECTS);
    res.json(subjects);
  } catch (error) {
    console.error("List subjects error:", error);
    res.status(500).json({ error: "Gagal mengambil daftar mapel" });
  }
});

router.post("/", authenticate, requireRole(["admin"]), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Nama mapel wajib diisi" });
    await addRow(SHEETS.SUBJECTS, {
      id: generateId(), name: name.trim(), description: description?.trim() || "", created_by: req.user.userId, created_at: new Date().toISOString(),
    });
    res.json({ message: "Mapel berhasil ditambahkan" });
  } catch (error) {
    console.error("Create subject error:", error);
    res.status(500).json({ error: "Gagal menambahkan mapel" });
  }
});

router.delete("/:id", authenticate, requireRole(["admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const subjects = await readSheet(SHEETS.SUBJECTS);
    const found = subjects.find(s => s.id === id);
    if (!found) return res.status(404).json({ error: "Mapel tidak ditemukan" });
    await deleteRow(SHEETS.SUBJECTS, id);
    res.json({ message: "Mapel berhasil dihapus" });
  } catch (error) {
    console.error("Delete subject error:", error);
    res.status(500).json({ error: "Gagal menghapus mapel" });
  }
});

export default router;
