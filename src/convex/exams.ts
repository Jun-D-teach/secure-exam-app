import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { ROLES } from "./schema";

// Shared helpers -----------------------------------------------------------------

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Kamu belum masuk. Silakan login terlebih dahulu.");
  }
  const user = await ctx.db.get(userId);
  if (user === null) {
    throw new Error("Pengguna tidak ditemukan.");
  }
  return user;
}

// Roles --------------------------------------------------------------------------

/** First-login role selection: a user picks teacher or student once. */
export const setRole = mutation({
  args: {
    role: v.union(v.literal(ROLES.TEACHER), v.literal(ROLES.STUDENT)),
  },
  handler: async (ctx, { role }) => {
    const user = await requireUser(ctx);
    if (user.role === ROLES.TEACHER || user.role === ROLES.STUDENT) {
      return; // role already locked in
    }
    await ctx.db.patch(user._id, { role });
  },
});

// Exams --------------------------------------------------------------------------

/** Exams visible to the current user: teachers see their own, students see all active. */
export const listExams = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (user.role === ROLES.TEACHER) {
      return await ctx.db
        .query("exams")
        .withIndex("by_creator", (q) => q.eq("createdBy", user._id))
        .order("desc")
        .collect();
    }
    return await ctx.db
      .query("exams")
      .filter((q) => q.eq(q.field("isActive"), true))
      .order("desc")
      .collect();
  },
});

export const getExam = query({
  args: { examId: v.id("exams") },
  handler: async (ctx, { examId }) => {
    await requireUser(ctx);
    const exam = await ctx.db.get(examId);
    if (exam === null) {
      throw new Error("Ujian tidak ditemukan.");
    }
    return exam;
  },
});

export const createExam = mutation({
  args: {
    title: v.string(),
    subject: v.optional(v.string()),
    description: v.optional(v.string()),
    googleFormUrl: v.string(),
    durationMinutes: v.number(),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.role !== ROLES.TEACHER) {
      throw new Error("Hanya guru yang bisa membuat ujian.");
    }
    const title = args.title.trim();
    if (!title) {
      throw new Error("Nama ujian wajib diisi.");
    }
    const durationMinutes = Math.round(args.durationMinutes);
    if (durationMinutes < 1 || durationMinutes > 600) {
      throw new Error("Durasi ujian harus antara 1–600 menit.");
    }
    if (
      args.startsAt !== undefined &&
      args.endsAt !== undefined &&
      args.endsAt <= args.startsAt
    ) {
      throw new Error("Waktu tutup harus setelah waktu buka.");
    }
    const googleFormUrl = args.googleFormUrl.trim();
    if (!/^https?:\/\//i.test(googleFormUrl)) {
      throw new Error("Link Google Form harus berupa URL yang valid (mulai dengan https://).");
    }
    return await ctx.db.insert("exams", {
      title,
      subject: args.subject?.trim() || undefined,
      description: args.description?.trim() || undefined,
      googleFormUrl,
      durationMinutes,
      isActive: true,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

// Attempts -----------------------------------------------------------------------

/** The current student's attempt for an exam, or null if not started. */
export const myAttempt = query({
  args: { examId: v.id("exams") },
  handler: async (ctx, { examId }) => {
    const user = await requireUser(ctx);
    if (user.role !== ROLES.STUDENT) {
      return null;
    }
    return await ctx.db
      .query("examAttempts")
      .withIndex("by_exam_student", (q) =>
        q.eq("examId", examId).eq("studentId", user._id),
      )
      .unique();
  },
});

/** All attempts for the current student (used by the student dashboard). */
export const myAttempts = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (user.role !== ROLES.STUDENT) {
      return [];
    }
    return await ctx.db
      .query("examAttempts")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .collect();
  },
});

/** Start (or resume) an exam. Timing is fixed server-side on first start. */
export const startAttempt = mutation({
  args: { examId: v.id("exams") },
  handler: async (ctx, { examId }) => {
    const user = await requireUser(ctx);
    if (user.role !== ROLES.STUDENT) {
      throw new Error("Hanya siswa yang bisa mengerjakan ujian.");
    }
    const exam = await ctx.db.get(examId);
    if (exam === null) {
      throw new Error("Ujian tidak ditemukan.");
    }
    const existing = await ctx.db
      .query("examAttempts")
      .withIndex("by_exam_student", (q) =>
        q.eq("examId", examId).eq("studentId", user._id),
      )
      .unique();
    if (existing !== null) {
      return existing._id; // already started — resume regardless of window
    }
    // Scheduled window: block new attempts outside [startsAt, endsAt).
    // In-progress attempts are unaffected — they run until their own timer.
    const now = Date.now();
    if (exam.startsAt !== undefined && now < exam.startsAt) {
      throw new Error(
        `Ujian belum dibuka. Ujian dibuka pada ${new Date(exam.startsAt).toLocaleString("id-ID", {
          dateStyle: "medium",
          timeStyle: "short",
        })}.`,
      );
    }
    if (exam.endsAt !== undefined && now >= exam.endsAt) {
      throw new Error(
        "Ujian sudah ditutup. Batas waktu mulai sudah lewat.",
      );
    }
    return await ctx.db.insert("examAttempts", {
      examId,
      studentId: user._id,
      status: "in_progress",
      startedAt: now,
      endsAt: now + exam.durationMinutes * 60_000,
      violationCount: 0,
      violations: [],
    });
  },
});

/** Record an anti-cheat event (tab switch, window blur, etc.). */
export const recordViolation = mutation({
  args: {
    attemptId: v.id("examAttempts"),
    type: v.string(),
  },
  handler: async (ctx, { attemptId, type }) => {
    const user = await requireUser(ctx);
    const attempt = await ctx.db.get(attemptId);
    if (attempt === null || attempt.studentId !== user._id) {
      throw new Error("Akses ditolak.");
    }
    if (attempt.status !== "in_progress") {
      return;
    }
    await ctx.db.patch(attemptId, {
      violationCount: attempt.violationCount + 1,
      violations: [...attempt.violations, { type, at: Date.now() }],
    });
  },
});

/** Student submits the exam early. */
export const completeAttempt = mutation({
  args: { attemptId: v.id("examAttempts") },
  handler: async (ctx, { attemptId }) => {
    const user = await requireUser(ctx);
    const attempt = await ctx.db.get(attemptId);
    if (attempt === null || attempt.studentId !== user._id) {
      throw new Error("Akses ditolak.");
    }
    if (attempt.status !== "in_progress") {
      return attempt._id;
    }
    const status = Date.now() > attempt.endsAt ? "expired" : "completed";
    await ctx.db.patch(attemptId, { status, completedAt: Date.now() });
    return attempt._id;
  },
});

/** Server-side expiry: marks the attempt as expired once the time has passed. */
export const expireAttempt = mutation({
  args: { attemptId: v.id("examAttempts") },
  handler: async (ctx, { attemptId }) => {
    const user = await requireUser(ctx);
    const attempt = await ctx.db.get(attemptId);
    if (attempt === null || attempt.studentId !== user._id) {
      throw new Error("Akses ditolak.");
    }
    if (attempt.status !== "in_progress" || Date.now() < attempt.endsAt) {
      return;
    }
    await ctx.db.patch(attemptId, {
      status: "expired",
      completedAt: Date.now(),
    });
  },
});

// Teacher views ------------------------------------------------------------------

/** Per-exam attempt list with student identity, for the teacher. */
export const attemptsForExam = query({
  args: { examId: v.id("exams") },
  handler: async (ctx, { examId }) => {
    const user = await requireUser(ctx);
    if (user.role !== ROLES.TEACHER) {
      throw new Error("Akses ditolak.");
    }
    const exam = await ctx.db.get(examId);
    if (exam === null || exam.createdBy !== user._id) {
      throw new Error("Akses ditolak.");
    }
    const attempts = await ctx.db
      .query("examAttempts")
      .withIndex("by_exam", (q) => q.eq("examId", examId))
      .collect();
    const rows = await Promise.all(
      attempts.map(async (attempt) => {
        const student = await ctx.db.get(attempt.studentId);
        return {
          ...attempt,
          student: student
            ? { name: student.name, email: student.email }
            : null,
        };
      }),
    );
    return rows.sort((a, b) => b.startedAt - a.startedAt);
  },
});

/** Lightweight counts per exam for the teacher dashboard cards. */
export const attemptsSummary = query({
  args: { examId: v.id("exams") },
  handler: async (ctx, { examId }) => {
    const user = await requireUser(ctx);
    if (user.role !== ROLES.TEACHER) {
      throw new Error("Akses ditolak.");
    }
    const exam = await ctx.db.get(examId);
    if (exam === null || exam.createdBy !== user._id) {
      throw new Error("Akses ditolak.");
    }
    const attempts = await ctx.db
      .query("examAttempts")
      .withIndex("by_exam", (q) => q.eq("examId", examId))
      .collect();
    return {
      started: attempts.length,
      inProgress: attempts.filter((a) => a.status === "in_progress").length,
      completed: attempts.filter((a) => a.status === "completed").length,
      expired: attempts.filter((a) => a.status === "expired").length,
      totalViolations: attempts.reduce((sum, a) => sum + a.violationCount, 0),
    };
  },
});
