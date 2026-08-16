import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await requireUser(ctx);
  if (user.role !== ROLES.ADMIN) {
    throw new Error("Akses ditolak. Hanya admin yang bisa melakukan ini.");
  }
  return user;
}

/** Resolve a subject's name for display (null if it was deleted). */
async function subjectName(
  ctx: QueryCtx | MutationCtx,
  subjectId: Id<"subjects">,
) {
  const subject = await ctx.db.get(subjectId);
  return subject ? subject.name : null;
}

// Roles --------------------------------------------------------------------------

/** First-login role selection (only for legacy accounts without a role). */
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

/**
 * Exams visible to the current user:
 * - admin: every exam (drafts + published), with subject & teacher names
 * - teacher: their own exams, with subject name
 * - student: only published (isActive) exams, with subject name
 */
export const listExams = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const all = await ctx.db
      .query("exams")
      .order("desc")
      .collect();

    let rows = all;
    if (user.role === ROLES.TEACHER) {
      rows = all.filter((exam) => exam.createdBy === user._id);
    } else if (user.role === ROLES.STUDENT) {
      rows = all.filter((exam) => exam.isActive);
    }
    // Admin sees everything.

    return await Promise.all(
      rows.map(async (exam) => {
        const teacher = await ctx.db.get(exam.createdBy);
        return {
          ...exam,
          subjectName: await subjectName(ctx, exam.subjectId),
          teacherName: teacher ? (teacher.name ?? null) : null,
        };
      }),
    );
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
    return {
      ...exam,
      subjectName: await subjectName(ctx, exam.subjectId),
    };
  },
});

/** Teacher creates an exam as a draft; the admin schedules & publishes it. */
export const createExam = mutation({
  args: {
    title: v.string(),
    subjectId: v.id("subjects"),
    description: v.optional(v.string()),
    googleFormUrl: v.string(),
    durationMinutes: v.number(),
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
    const googleFormUrl = args.googleFormUrl.trim();
    if (!/^https?:\/\//i.test(googleFormUrl)) {
      throw new Error("Link Google Form harus berupa URL yang valid (mulai dengan https://).");
    }
    const subject = await ctx.db.get(args.subjectId);
    if (subject === null) {
      throw new Error("Mapel tidak ditemukan. Pilih mapel yang tersedia.");
    }
    return await ctx.db.insert("exams", {
      title,
      subjectId: args.subjectId,
      description: args.description?.trim() || undefined,
      googleFormUrl,
      durationMinutes,
      isActive: false, // draft until the admin schedules & publishes it
      startsAt: undefined,
      endsAt: undefined,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

/** Admin schedules (open/close window) and publishes/unpublishes an exam. */
export const setExamSchedule = mutation({
  args: {
    examId: v.id("exams"),
    isActive: v.boolean(),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
  },
  handler: async (ctx, { examId, isActive, startsAt, endsAt }) => {
    await requireAdmin(ctx);
    const exam = await ctx.db.get(examId);
    if (exam === null) {
      throw new Error("Ujian tidak ditemukan.");
    }
    if (
      startsAt !== undefined &&
      endsAt !== undefined &&
      endsAt <= startsAt
    ) {
      throw new Error("Waktu tutup harus setelah waktu buka.");
    }
    await ctx.db.patch(examId, {
      isActive,
      startsAt,
      endsAt,
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
    if (!exam.isActive) {
      throw new Error("Ujian belum dipublikasikan.");
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
            ? { name: student.name, username: student.username }
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
