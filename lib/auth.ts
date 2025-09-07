import { cookies } from "next/headers";
import crypto from "node:crypto";
import { CSRF_COOKIE } from "@/lib/security";
import { getOrCreateUser, getSessionByToken, getUserById, getUserByUsername, createSession, revokeSession, touchSession, deleteExpiredSessions } from "@/lib/db";
import bcrypt from "bcryptjs";

export type AuthUser = {
  username: string;
  name?: string;
};

const SESSION_COOKIE = "session";

// Predefined users. For production, consider moving these to environment variables.
// You can extend this list as needed.
const PREDEFINED_USERS: Array<{ username: string; password: string; name?: string }>= [
  { username: process.env.AUTH_USER ?? "admin", password: process.env.AUTH_PASS ?? "secret", name: "Admin" }
];

export function validateCredentials(username: string, password: string): AuthUser | null {
  // First try DB users
  const dbUser = getUserByUsername(username);
  if (dbUser?.password_hash) {
    try {
      if (bcrypt.compareSync(password, dbUser.password_hash)) {
        return { username: dbUser.username, name: dbUser.name };
      }
    } catch {}
  }
  // Fallback to predefined env user
  const match = PREDEFINED_USERS.find((u) => u.username === username && u.password === password);
  return match ? { username: match.username, name: match.name } : null;
}

export function setAuthCookie(username: string, meta?: { userAgent?: string; ip?: string }) {
  const cookieStore = cookies();
  // Ensure user exists in DB for session binding (important for env-based users)
  const dbUser = getUserByUsername(username) || getOrCreateUser(username);

  // Create session
  const token = crypto.randomBytes(32).toString("hex");
  const ttlSeconds = 60 * 60 * 24 * 7; // 7 days
  try {
    createSession({ token, userId: dbUser.id, ttlSeconds, userAgent: meta?.userAgent, ip: meta?.ip });
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

export function clearAuthCookie() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    try { revokeSession(token); } catch {}
  }
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(CSRF_COOKIE);
}

export function getUserFromCookies(): AuthUser | null {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try { deleteExpiredSessions(); } catch {}
  const session = token ? getSessionByToken(token) : undefined;
  const now = Math.floor(Date.now() / 1000);
  if (!session || session.revoked === 1 || session.expires_at < now) return null;
  try { touchSession(token); } catch {}
  const user = getUserById(session.user_id);
  if (!user) return null;
  return { username: user.username, name: user.name };
}

export function isAuthenticated(): boolean {
  return getUserFromCookies() !== null;
}

export { SESSION_COOKIE };


