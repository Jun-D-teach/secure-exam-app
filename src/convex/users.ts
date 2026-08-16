import {
  createAccount,
  getAuthSessionId,
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  action,
  internalQuery,
  mutation,
  query,
  ActionCtx,
  MutationCtx,
  QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { ROLES } from "./schema";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

// ---------------------------------------------------------------------------
// Internal helpers (actions have no direct ctx.db, so they query via these)
// ---------------------------------------------------------------------------

export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

export const getUserByUsername = internalQuery({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    return await ctx.db
      .query("users")
      .withIndex("username", (q) => q.eq("username", username))
      .first();
  },
});

export const hasAdminRow = internalQuery({
  args: {},
  handler: async (ctx) => {
    const admin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), ROLES.ADMIN))
      .first();
    return admin !== null;
  },
});

async function requireAdmin(ctx: MutationCtx | QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Kamu belum masuk.");
  }
  const user = await ctx.db.get(userId);
  if (user === null || user.role !== ROLES.ADMIN) {
    throw new Error("Akses ditolak. Hanya admin yang bisa melakukan ini.");
  }
  return user;
}

async function requireAdminAction(ctx: ActionCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Kamu belum masuk.");
  }
  const user = await ctx.runQuery(internal.users.getUserById, { userId });
  if (user === null || user.role !== ROLES.ADMIN) {
    throw new Error("Akses ditolak. Hanya admin yang bisa melakukan ini.");
  }
  return user;
}

function normalizeUsername(raw: string): string {
  const username = raw.trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    throw new Error("Username harus 3–32 karakter (huruf kecil, angka, . _ -).");
  }
  return username;
}

/** True until the first admin account has been created (bootstrap gate). */
export const hasAdmin = query({
  args: {},
  handler: async (ctx) => {
    const admin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), ROLES.ADMIN))
      .first();
    return admin !== null;
  },
});

/**
 * Creates the very first admin account. Only works while no admin exists,
 * so it can safely live on the login page for initial setup.
 */
export const bootstrapAdmin = action({
  args: {
    name: v.string(),
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { name, username, password }) => {
    const alreadyHasAdmin = await ctx.runQuery(internal.users.hasAdminRow);
    if (alreadyHasAdmin) {
      throw new Error("Akun admin sudah ada.");
    }
    const uname = normalizeUsername(username);
    if (password.length < 8) {
      throw new Error("Password minimal 8 karakter.");
    }
    const dup = await ctx.runQuery(internal.users.getUserByUsername, {
      username: uname,
    });
    if (dup !== null) {
      throw new Error("Username sudah dipakai.");
    }
    await createAccount(ctx, {
      provider: "password",
      account: { id: uname, secret: password },
      profile: {
        name: name.trim() || uname,
        username: uname,
        email: uname,
        role: ROLES.ADMIN,
      },
    });
  },
});

/** Admin creates a teacher or student account with an initial password. */
export const createUser = action({
  args: {
    name: v.string(),
    username: v.string(),
    password: v.string(),
    role: v.union(v.literal(ROLES.TEACHER), v.literal(ROLES.STUDENT)),
  },
  handler: async (ctx, { name, username, password, role }) => {
    await requireAdminAction(ctx);
    const uname = normalizeUsername(username);
    if (password.length < 8) {
      throw new Error("Password minimal 8 karakter.");
    }
    const dup = await ctx.runQuery(internal.users.getUserByUsername, {
      username: uname,
    });
    if (dup !== null) {
      throw new Error("Username sudah dipakai.");
    }
    await createAccount(ctx, {
      provider: "password",
      account: { id: uname, secret: password },
      profile: {
        name: name.trim() || uname,
        username: uname,
        email: uname,
        role,
      },
    });
  },
});

/**
 * A user (student/teacher/admin) changes their own password.
 * Verifies the current password, stores the new one (hashed by the auth
 * library), and signs out every other session so old logins stop working.
 */
export const changeMyPassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { currentPassword, newPassword }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Kamu belum masuk.");
    }
    const user = await ctx.runQuery(internal.users.getUserById, { userId });
    if (user === null || !user.username) {
      throw new Error("Pengguna tidak ditemukan.");
    }
    if (newPassword.length < 8) {
      throw new Error("Password baru minimal 8 karakter.");
    }
    if (newPassword === currentPassword) {
      throw new Error("Password baru harus berbeda dari password lama.");
    }
    // Verifikasi password lama — melempar error bila tidak cocok.
    try {
      await retrieveAccount(ctx, {
        provider: "password",
        account: { id: user.username, secret: currentPassword },
      });
    } catch {
      throw new Error("Password lama salah. Coba lagi.");
    }
    // Simpan password baru (di-hash oleh library auth).
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: user.username, secret: newPassword },
    });
    // Keluarkan sesi lain agar akun lama tidak bisa dipakai di perangkat lain.
    const sessionId = await getAuthSessionId(ctx);
    await invalidateSessions(ctx, {
      userId,
      except: sessionId !== null ? [sessionId] : undefined,
    });
  },
});

/** All users, for the admin's account table. */
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("users").order("desc").collect();
  },
});

/** Admin deletes an account (never an admin) and its linked login. */
export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get(userId);
    if (user === null) {
      throw new Error("Pengguna tidak ditemukan.");
    }
    if (user.role === ROLES.ADMIN) {
      throw new Error("Akun admin tidak bisa dihapus.");
    }
    if (user.username) {
      // Remove the linked login account so the user can no longer sign in.
      const accounts = await ctx.db
        .query("authAccounts")
        .filter((q) => q.eq(q.field("providerAccountId"), user.username))
        .collect();
      for (const account of accounts) {
        await ctx.db.delete(account._id);
      }
    }
    await ctx.db.delete(userId);
  },
});
