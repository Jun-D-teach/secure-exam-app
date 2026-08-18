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

export const listUsernames = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const usernames: string[] = [];
    for (const user of users) {
      if (user.username) {
        usernames.push(user.username);
      }
    }
    return usernames;
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

const USERNAME_MAX = 32;

function slugifyName(name: string): string {
  let slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");
  if (slug.length === 0) slug = "user";
  if (slug.length < 3) slug = (slug + "u".repeat(3)).slice(0, 3);
  if (slug.length > USERNAME_MAX) {
    slug = slug.slice(0, USERNAME_MAX).replace(/\.+$/g, "");
  }
  return slug;
}

function pickRandom(chars: string): string {
  return chars[Math.floor(Math.random() * chars.length)];
}

function shuffle(chars: string[]): string[] {
  const arr = [...chars];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Generates an 8-character password: 5 letters + 3 digits, no ambiguous chars. */
function generatePassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const parts = [
    ...Array.from({ length: 5 }, () => pickRandom(letters)),
    ...Array.from({ length: 3 }, () => pickRandom(digits)),
  ];
  return shuffle(parts).join("");
}

/**
 * Admin bulk-imports teacher/student accounts from a list of names.
 * Usernames and initial passwords are generated automatically (or taken from
 * the items when provided). Returns the created credentials exactly once so
 * the admin can share them with each account owner.
 */
export const importUsers = action({
  args: {
    role: v.union(v.literal(ROLES.TEACHER), v.literal(ROLES.STUDENT)),
    items: v.array(
      v.object({
        name: v.string(),
        username: v.optional(v.string()),
        password: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { role, items }) => {
    await requireAdminAction(ctx);
    if (items.length === 0) {
      throw new Error("Tidak ada data untuk diimpor.");
    }
    if (items.length > 200) {
      throw new Error("Maksimal 200 akun per import.");
    }

    const existing = new Set<string>();
    const usernames = await ctx.runQuery(internal.users.listUsernames);
    for (const username of usernames) {
      existing.add(username);
    }

    // Validate & normalize every row up front so a bad row never leaves a
    // partially-imported batch behind.
    const normalized: { name: string; username: string; password: string }[] = [];
    for (const item of items) {
      const name = item.name.trim();
      if (!name) {
        throw new Error("Ada baris dengan nama kosong.");
      }
      let username: string;
      if (item.username && item.username.trim()) {
        username = normalizeUsername(item.username);
        if (existing.has(username) || normalized.some((r) => r.username === username)) {
          throw new Error(`Username \"${username}\" sudah dipakai.`);
        }
      } else {
        const base = slugifyName(name);
        username = base;
        let n = 2;
        while (existing.has(username) || normalized.some((r) => r.username === username)) {
          const suffix = `-${n}`;
          username = base.slice(0, USERNAME_MAX - suffix.length) + suffix;
          n++;
        }
      }
      existing.add(username);
      const password =
        item.password && item.password.trim() ? item.password : generatePassword();
      if (password.length < 8) {
        throw new Error(`Password untuk \"${name}\" minimal 8 karakter.`);
      }
      normalized.push({ name: name || username, username, password });
    }

    const created: { name: string; username: string; password: string }[] = [];
    for (const row of normalized) {
      await createAccount(ctx, {
        provider: "password",
        account: { id: row.username, secret: row.password },
        profile: {
          name: row.name,
          username: row.username,
          email: row.username,
          role,
        },
      });
      created.push(row);
    }
    return created;
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
