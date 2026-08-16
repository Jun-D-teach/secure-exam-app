import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { ROLES } from "./schema";

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

/** Mapel (subjects). Visible to all signed-in users; managed by the admin. */
export const listSubjects = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.db.query("subjects").order("asc").collect();
  },
});

export const createSubject = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { name, description }) => {
    const admin = await requireAdmin(ctx);
    const clean = name.trim();
    if (!clean) {
      throw new Error("Nama mapel wajib diisi.");
    }
    const dup = await ctx.db
      .query("subjects")
      .withIndex("by_name", (q) => q.eq("name", clean))
      .first();
    if (dup !== null) {
      throw new Error("Mapel dengan nama ini sudah ada.");
    }
    return await ctx.db.insert("subjects", {
      name: clean,
      description: description?.trim() || undefined,
      createdBy: admin._id,
      createdAt: Date.now(),
    });
  },
});

export const deleteSubject = mutation({
  args: { subjectId: v.id("subjects") },
  handler: async (ctx, { subjectId }) => {
    await requireAdmin(ctx);
    const subject = await ctx.db.get(subjectId);
    if (subject === null) {
      throw new Error("Mapel tidak ditemukan.");
    }
    // Don't delete subjects that still have exams attached.
    const exam = await ctx.db
      .query("exams")
      .filter((q) => q.eq(q.field("subjectId"), subjectId))
      .first();
    if (exam !== null) {
      throw new Error("Mapel masih dipakai oleh ujian. Hapus ujiannya dulu.");
    }
    await ctx.db.delete(subjectId);
  },
});
