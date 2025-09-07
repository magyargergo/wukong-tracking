import { cookies } from "next/headers";
import crypto from "node:crypto";
import { CSRF_COOKIE } from "@/lib/security";
import { getOrCreateUser, getSessionByToken, getUserById, getUserByUsername, createSession, revokeSession, touchSession, deleteExpiredSessions } from "@/lib/db";
import bcrypt from "bcryptjs";

export type AuthUser = {
  username: string;
  name?: string;
  isSystemAdmin?: boolean;
};

const SESSION_COOKIE = "session";
const ENV_ADMIN_PREFIX = "env-admin:";

// Predefined users. For production, consider moving these to environment variables.
// You can extend this list as needed.
const PREDEFINED_USERS: Array<{ username: string; password: string; name?: string }>= [
  { username: process.env.AUTH_USER ?? "admin", password: process.env.AUTH_PASS ?? "secret", name: "Admin" }
];

export async function validateCredentials(username: string, password: string): Promise<AuthUser | null> {
  // First try DB users
  const dbUser = await getUserByUsername(username);
  if (dbUser?.password_hash) {
    try {
      if (bcrypt.compareSync(password, dbUser.password_hash)) {
        return { username: dbUser.username, name: dbUser.name ?? undefined, isSystemAdmin: false };
      }
    } catch {}
  }
  // Fallback to predefined env user
  const match = PREDEFINED_USERS.find((u) => u.username === username && u.password === password);
  return match ? { username: match.username, name: match.name, isSystemAdmin: true } : null;
}

export async function setAuthCookie(username: string, meta?: { userAgent?: string; ip?: string }) {
  const cookieStore = cookies();
  // Special handling: env admin should NOT create a DB user or DB-backed session
  const envAdminUsername = process.env.AUTH_USER ?? "admin";
  if (username === envAdminUsername) {
    const ttlSeconds = 60 * 60 * 24 * 7; // 7 days
    const token = ENV_ADMIN_PREFIX + crypto.randomBytes(24).toString("hex");
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ttlSeconds,
      secure: process.env.NODE_ENV === "production",
    });
    const csrfToken = crypto.randomBytes(16).toString("hex");
    cookieStore.set(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: ttlSeconds,
      secure: process.env.NODE_ENV === "production",
    });
    return;
  }

  // Ensure user exists in DB for session binding
  const existing = await getUserByUsername(username);
  const dbUser = existing || await getOrCreateUser(username);

  // Create session
  const token = crypto.randomBytes(32).toString("hex");
  const ttlSeconds = 60 * 60 * 24 * 7; // 7 days
  try {
    await createSession({ token, userId: dbUser.id, ttlSeconds, userAgent: meta?.userAgent, ip: meta?.ip });
  } catch {}

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ttlSeconds,
    secure: process.env.NODE_ENV === "production",
  });
  // Set CSRF token cookie (non-HttpOnly for double-submit token pattern)
  const csrfToken = crypto.randomBytes(16).toString("hex");
  cookieStore.set(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: ttlSeconds,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAuthCookie() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    if (!token.startsWith(ENV_ADMIN_PREFIX)) {
      try { await revokeSession(token); } catch {}
    }
  }
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(CSRF_COOKIE);
}

export async function getUserFromCookies(): Promise<AuthUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  if (token.startsWith(ENV_ADMIN_PREFIX)) {
    const envUser = PREDEFINED_USERS[0];
    return { username: envUser.username, name: envUser.name ?? undefined, isSystemAdmin: true };
  }
  try { await deleteExpiredSessions(); } catch {}
  const session = token ? await getSessionByToken(token) : undefined;
  const now = Math.floor(Date.now() / 1000);
  if (!session || !!session.revoked || session.expires_at < now) return null;
  try { await touchSession(token); } catch {}
  const user = await getUserById(session.user_id);
  if (!user) return null;
  return { username: user.username, name: user.name ?? undefined, isSystemAdmin: false };
}

export function isAuthenticated(): boolean {
  // Not used in async flows; kept for compatibility where sync check is acceptable (may be stale)
  return cookies().get(SESSION_COOKIE) != null;
}

export { SESSION_COOKIE };


