import { Router } from "express";
import { generateId, readSheet, addRow, updateRow, SHEETS, findByField } from "../db/sheets.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", async (req, res) => {
  try {
    const exams = await readSheet(SHEETS.EXAMS);
    const subjects = await readSheet(SHEETS.SUBJECTS);
    const users = await readSheet(SHEETS.USERS);

    const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
    const userMap = new Map(users.map(u => [u.id, u.name]));

    let filteredExams = exams;
    if (req.user.role === "teacher") filteredExams = exams.filter(e => e.created_by === req.user.userId);
    else if (req.user.role === "student") filteredExams = exams.filter(e => e.is_active === "true");

    const enriched = filteredExams.map(exam => ({
      ...exam,
      subjectName: subjectMap.get(exam.subject_id) || null,
      teacherName: userMap.get(exam.created_by) || null,
      durationMinutes: parseInt(exam.duration_minutes),
      isActive: exam.is_active === "true",
      startsAt: exam.starts_at ? parseInt(exam.starts_at) : undefined,
      endsAt: exam.ends_at ? parseInt(exam.ends_at) : undefined,
    }));

    res.json(enriched);
  } catch (error) {
    console.error("List exams error:", error);
    res.status(500).json({ error: "Gagal mengambil daftar ujian" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const exams = await readSheet(SHEETS.EXAMS);
    const subjects = await readSheet(SHEETS.SUBJECTS);
    const exam = exams.find(e => e.id === id);
    if (!exam) return res.status(404).json({ error: "Ujian tidak ditemukan" });
    const subject = subjects.find(s => s.id === exam.subject_id);
    res.json({
      ...exam,
      subjectName: subject?.name || null,
      durationMinutes: parseInt(exam.duration_minutes),
      isActive: exam.is_active === "true",
      startsAt: exam.starts_at ? parseInt(exam.starts_at) : undefined,
      endsAt: exam.ends_at ? parseInt(exam.ends_at) : undefined,
    });
  } catch (error) {
    console.error("Get exam error:", error);
    res.status(500).json({ error: "Gagal mengambil data ujian" });
  }
});

router.post("/", requireRole(["teacher"]), async (req, res) => {
  try {
    const { title, subjectId, description, googleFormUrl, durationMinutes } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Nama ujian wajib diisi" });
    if (!subjectId) return res.status(400).json({ error: "Mapel wajib dipilih" });
    if (!googleFormUrl?.trim()) return res.status(400).json({ error: "Link Google Form wajib diisi" });
    if (!/^https?:\/\//i.test(googleFormUrl)) return res.status(400).json({ error: "Link Google Form harus berupa URL yang valid" });
    const duration = Math.round(Number(durationMinutes) || 60);
    if (duration < 1 || duration > 600) return res.status(400).json({ error: "Durasi ujian harus antara 1-600 menit" });

    const subject = await findByField(SHEETS.SUBJECTS, "id", subjectId);
    if (!subject) return res.status(400).json({ error: "Mapel tidak ditemukan" });

    await addRow(SHEETS.EXAMS, {
      id: generateId(), title: title.trim(), subject_id: subjectId, description: description?.trim() || "",
      google_form_url: googleFormUrl.trim(), duration_minutes: duration.toString(),
      is_active: "false", starts_at: "", ends_at: "", created_by: req.user.userId, created_at: new Date().toISOString(),
    });
    res.json({ message: "Ujian berhasil dibuat sebagai draf" });
  } catch (error) {
    console.error("Create exam error:", error);
    res.status(500).json({ error: "Gagal membuat ujian" });
  }
});

router.patch("/:id/schedule", requireRole(["admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, startsAt, endsAt } = req.body;
    const exams = await readSheet(SHEETS.EXAMS);
    const exam = exams.find(e => e.id === id);
    if (!exam) return res.status(404).json({ error: "Ujian tidak ditemukan" });
    if (startsAt && endsAt && endsAt <= startsAt) return res.status(400).json({ error: "Waktu tutup harus setelah waktu buka" });

    await updateRow(SHEETS.EXAMS, id, {
      is_active: isActive ? "true" : "false",
      starts_at: startsAt ? startsAt.toString() : "",
      ends_at: endsAt ? endsAt.toString() : "",
    });
    res.json({ message: isActive ? "Ujian dipublikasikan" : "Ujian diarsipkan" });
  } catch (error) {
    console.error("Schedule exam error:", error);
    res.status(500).json({ error: "Gagal menyimpan jadwal" });
  }
});

router.get("/:id/summary", requireRole(["teacher"]), async (req, res) => {
  try {
    const { id } = req.params;
    const exams = await readSheet(SHEETS.EXAMS);
    const exam = exams.find(e => e.id === id);
    if (!exam || exam.created_by !== req.user.userId) return res.status(403).json({ error: "Akses ditolak" });

    const attempts = await readSheet(SHEETS.ATTEMPTS);
    const examAttempts = attempts.filter(a => a.exam_id === id);
    res.json({
      started: examAttempts.length,
      inProgress: examAttempts.filter(a => a.status === "in_progress").length,
      completed: examAttempts.filter(a => a.status === "completed").length,
      expired: examAttempts.filter(a => a.status === "expired").length,
      totalViolations: examAttempts.reduce((sum, a) => sum + parseInt(a.violation_count || "0"), 0),
    });
  } catch (error) {
    console.error("Summary error:", error);
    res.status(500).json({ error: "Gagal mengambil ringkasan" });
  }
});

router.get("/:id/attempts", requireRole(["teacher"]), async (req, res) => {
  try {
    const { id } = req.params;
    const exams = await readSheet(SHEETS.EXAMS);
    const exam = exams.find(e => e.id === id);
    if (!exam || exam.created_by !== req.user.userId) return res.status(403).json({ error: "Akses ditolak" });

    const attempts = await readSheet(SHEETS.ATTEMPTS);
    const users = await readSheet(SHEETS.USERS);
    const examAttempts = attempts
      .filter(a => a.exam_id === id)
      .map(a => {
        const student = users.find(u => u.id === a.student_id);
        return {
          ...a,
          violationCount: parseInt(a.violation_count || "0"),
          student: student ? { name: student.name, username: student.username } : null,
        };
      })
      .sort((a, b) => parseInt(b.started_at || "0") - parseInt(a.started_at || "0"));
    res.json(examAttempts);
  } catch (error) {
    console.error("Get attempts error:", error);
    res.status(500).json({ error: "Gagal mengambil data peserta" });
  }
});

export default router;
