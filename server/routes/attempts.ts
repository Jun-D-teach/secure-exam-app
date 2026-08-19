import { Router } from "express";
import { generateId, readSheet, addRow, updateRow, SHEETS, findByField } from "../db/sheets";
import { authenticate, requireRole } from "../middleware/auth";

const router = Router();

interface AttemptRow {
  id: string;
  exam_id: string;
  student_id: string;
  status: string;
  started_at: string;
  ends_at: string;
  completed_at: string;
  violation_count: string;
  violations: string;
}

interface ExamRow {
  id: string;
  title: string;
  subject_id: string;
  duration_minutes: string;
  is_active: string;
  starts_at: string;
  ends_at: string;
}

// All routes require student authentication
router.use(authenticate, requireRole(["student"]));

// Get my attempts for a specific exam
router.get("/my/:examId", async (req, res) => {
  try {
    const { examId } = req.params;
    
    const attempts = await readSheet(SHEETS.ATTEMPTS);
    const attempt = attempts.find(
      a => a.exam_id === examId && a.student_id === req.user!.userId
    );
    
    if (!attempt) {
      return res.json(null);
    }
    
    res.json({
      ...attempt,
      violationCount: parseInt(attempt.violation_count || "0"),
      startedAt: parseInt(attempt.started_at),
      endsAt: parseInt(attempt.ends_at),
      completedAt: attempt.completed_at ? parseInt(attempt.completed_at) : undefined,
    });
  } catch (error) {
    console.error("Get my attempt error:", error);
    res.status(500).json({ error: "Gagal mengambil data percobaan" });
  }
});

// Get all my attempts
router.get("/my", async (req, res) => {
  try {
    const attempts = await readSheet(SHEETS.ATTEMPTS);
    const myAttempts = attempts
      .filter(a => a.student_id === req.user!.userId)
      .map(a => ({
        ...a,
        violationCount: parseInt(a.violation_count || "0"),
        startedAt: parseInt(a.started_at),
        endsAt: parseInt(a.ends_at),
        completedAt: a.completed_at ? parseInt(a.completed_at) : undefined,
      }));
    
    res.json(myAttempts);
  } catch (error) {
    console.error("Get my attempts error:", error);
    res.status(500).json({ error: "Gagal mengambil data percobaan" });
  }
});

// Start an attempt
router.post("/start", async (req, res) => {
  try {
    const { examId } = req.body;
    
    if (!examId) {
      return res.status(400).json({ error: "Exam ID diperlukan" });
    }
    
    const exams = await readSheet(SHEETS.EXAMS);
    const exam = exams.find(e => e.id === examId);
    
    if (!exam) {
      return res.status(404).json({ error: "Ujian tidak ditemukan" });
    }
    
    if (exam.is_active !== "true") {
      return res.status(400).json({ error: "Ujian belum dipublikasikan" });
    }
    
    // Check existing attempt
    const attempts = await readSheet(SHEETS.ATTEMPTS);
    const existing = attempts.find(
      a => a.exam_id === examId && a.student_id === req.user!.userId
    );
    
    if (existing) {
      // Resume existing attempt
      return res.json({ id: existing.id });
    }
    
    // Check scheduled window
    const now = Date.now();
    const startsAt = exam.starts_at ? parseInt(exam.starts_at) : undefined;
    const endsAt = exam.ends_at ? parseInt(exam.ends_at) : undefined;
    
    if (startsAt && now < startsAt) {
      return res.status(400).json({ error: "Ujian belum dibuka" });
    }
    
    if (endsAt && now >= endsAt) {
      return res.status(400).json({ error: "Ujian sudah ditutup" });
    }
    
    const durationMinutes = parseInt(exam.duration_minutes);
    const attemptId = generateId();
    
    await addRow(SHEETS.ATTEMPTS, {
      id: attemptId,
      exam_id: examId,
      student_id: req.user!.userId,
      status: "in_progress",
      started_at: now.toString(),
      ends_at: (now + durationMinutes * 60000).toString(),
      completed_at: "",
      violation_count: "0",
      violations: "[]",
    });
    
    res.json({ id: attemptId });
  } catch (error) {
    console.error("Start attempt error:", error);
    res.status(500).json({ error: "Gagal memulai ujian" });
  }
});

// Record a violation
router.post("/violation", async (req, res) => {
  try {
    const { attemptId, type } = req.body;
    
    if (!attemptId || !type) {
      return res.status(400).json({ error: "Attempt ID dan type diperlukan" });
    }
    
    const attempts = await readSheet(SHEETS.ATTEMPTS);
    const attempt = attempts.find(
      a => a.id === attemptId && a.student_id === req.user!.userId
    );
    
    if (!attempt) {
      return res.status(404).json({ error: "Percobaan tidak ditemukan" });
    }
    
    if (attempt.status !== "in_progress") {
      return res.json({ message: "Percobaan sudah selesai" });
    }
    
    const currentCount = parseInt(attempt.violation_count || "0");
    const violations = JSON.parse(attempt.violations || "[]");
    violations.push({ type, at: Date.now() });
    
    await updateRow(SHEETS.ATTEMPTS, attemptId, {
      violation_count: (currentCount + 1).toString(),
      violations: JSON.stringify(violations),
    });
    
    res.json({ message: "Pelanggaran tercatat" });
  } catch (error) {
    console.error("Record violation error:", error);
    res.status(500).json({ error: "Gagal mencatat pelanggaran" });
  }
});

// Complete an attempt
router.post("/complete", async (req, res) => {
  try {
    const { attemptId } = req.body;
    
    if (!attemptId) {
      return res.status(400).json({ error: "Attempt ID diperlukan" });
    }
    
    const attempts = await readSheet(SHEETS.ATTEMPTS);
    const attempt = attempts.find(
      a => a.id === attemptId && a.student_id === req.user!.userId
    );
    
    if (!attempt) {
      return res.status(404).json({ error: "Percobaan tidak ditemukan" });
    }
    
    if (attempt.status !== "in_progress") {
      return res.json({ id: attemptId });
    }
    
    const now = Date.now();
    const endsAt = parseInt(attempt.ends_at);
    const status = now > endsAt ? "expired" : "completed";
    
    await updateRow(SHEETS.ATTEMPTS, attemptId, {
      status,
      completed_at: now.toString(),
    });
    
    res.json({ id: attemptId });
  } catch (error) {
    console.error("Complete attempt error:", error);
    res.status(500).json({ error: "Gagal menyelesaikan ujian" });
  }
});

// Expire an attempt (server-side expiry check)
router.post("/expire", async (req, res) => {
  try {
    const { attemptId } = req.body;
    
    if (!attemptId) {
      return res.status(400).json({ error: "Attempt ID diperlukan" });
    }
    
    const attempts = await readSheet(SHEETS.ATTEMPTS);
    const attempt = attempts.find(
      a => a.id === attemptId && a.student_id === req.user!.userId
    );
    
    if (!attempt) {
      return res.status(404).json({ error: "Percobaan tidak ditemukan" });
    }
    
    const now = Date.now();
    const endsAt = parseInt(attempt.ends_at);
    
    if (attempt.status === "in_progress" && now >= endsAt) {
      await updateRow(SHEETS.ATTEMPTS, attemptId, {
        status: "expired",
        completed_at: now.toString(),
      });
    }
    
    res.json({ id: attemptId });
  } catch (error) {
    console.error("Expire attempt error:", error);
    res.status(500).json({ error: "Gagal mengekspiresi ujian" });
  }
});

export default router;
