import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

type UserRow = { id: number; username: string; name?: string; password_hash?: string | null; is_admin?: number };
type ProgressRow = { user_id: number; item_id: string; done: number; note?: string };
type SessionRow = { id: number; token: string; user_id: number; created_at: number; expires_at: number; last_used_at: number; user_agent?: string | null; ip?: string | null; revoked?: number };

let dbInstance: Database.Database | null = null;

function getDatabaseFilePath() {
  const configured = process.env.SQLITE_FILE?.trim();
  const file = configured && configured.length > 0 ? configured : path.join(process.cwd(), ".data", "app.db");
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return file;
}

export function getDb() {
  if (dbInstance) return dbInstance;
  const file = getDatabaseFilePath();
  dbInstance = new Database(file);
  dbInstance.pragma("journal_mode = WAL");
  init(dbInstance);
  return dbInstance;
}

function init(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      name TEXT,
      password_hash TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS progress (
      user_id INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      PRIMARY KEY(user_id, item_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL,
      user_agent TEXT,
      ip TEXT,
      revoked INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

export function getOrCreateUser(username: string, name?: string): UserRow {
  const db = getDb();
  const existing = db.prepare("SELECT id, username, name FROM users WHERE username = ?").get(username) as UserRow | undefined;
  if (existing) return existing;
  const info = db.prepare("INSERT INTO users (username, name) VALUES (?, ?)").run(username, name ?? null);
  return { id: Number(info.lastInsertRowid), username, name };
}

export function getUserByUsername(username: string): UserRow | undefined {
  const db = getDb();
  return db.prepare("SELECT id, username, name, password_hash, is_admin FROM users WHERE username = ?").get(username) as UserRow | undefined;
}

export function getUserById(id: number): UserRow | undefined {
  const db = getDb();
  return db.prepare("SELECT id, username, name, password_hash, is_admin FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function getProgressMap(userId: number): Record<string, { done: boolean; note?: string }> {
  const db = getDb();
  const rows = db.prepare("SELECT user_id, item_id, done, note FROM progress WHERE user_id = ?").all(userId) as ProgressRow[];
  const map: Record<string, { done: boolean; note?: string }> = {};
  for (const r of rows) map[r.item_id] = { done: r.done === 1, note: r.note ?? undefined };
  return map;
}

export function upsertProgress(userId: number, itemId: string, done: boolean, note?: string) {
  const db = getDb();
  db.prepare("INSERT INTO progress (user_id, item_id, done, note) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, item_id) DO UPDATE SET done=excluded.done, note=excluded.note").run(userId, itemId, done ? 1 : 0, note ?? null);
}

export function deleteProgress(userId: number, itemId?: string) {
  const db = getDb();
  if (itemId) db.prepare("DELETE FROM progress WHERE user_id = ? AND item_id = ?").run(userId, itemId);
  else db.prepare("DELETE FROM progress WHERE user_id = ?").run(userId);
}

export function upsertUser(user: { id?: number; username: string; name?: string; password_hash?: string | null; is_admin?: boolean }) {
  const db = getDb();
  if (user.id) {
    db.prepare("UPDATE users SET username = ?, name = ?, password_hash = COALESCE(?, password_hash), is_admin = ? WHERE id = ?")
      .run(user.username, user.name ?? null, user.password_hash ?? null, user.is_admin ? 1 : 0, user.id);
    return user.id;
  }
  const info = db.prepare("INSERT INTO users (username, name, password_hash, is_admin) VALUES (?, ?, ?, ?)")
    .run(user.username, user.name ?? null, user.password_hash ?? null, user.is_admin ? 1 : 0);
  return Number(info.lastInsertRowid);
}

export function listUsers(): Array<{ id: number; username: string; name?: string; is_admin: boolean }>{
  const db = getDb();
  const rows = db.prepare("SELECT id, username, name, is_admin FROM users ORDER BY username ASC").all() as Array<UserRow>;
  return rows.map(r => ({ id: r.id, username: r.username, name: r.name ?? undefined, is_admin: (r.is_admin ?? 0) === 1 }));
}

export function deleteUser(id: number) {
  const db = getDb();
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function createSession(params: { token: string; userId: number; ttlSeconds: number; userAgent?: string; ip?: string }) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const expires = now + Math.max(60, params.ttlSeconds);
  db.prepare("INSERT INTO sessions (token, user_id, created_at, expires_at, last_used_at, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(params.token, params.userId, now, expires, now, params.userAgent ?? null, params.ip ?? null);
}

export function getSessionByToken(token: string): SessionRow | undefined {
  const db = getDb();
  return db.prepare("SELECT id, token, user_id, created_at, expires_at, last_used_at, user_agent, ip, revoked FROM sessions WHERE token = ?")
    .get(token) as SessionRow | undefined;
}

export function touchSession(token: string) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare("UPDATE sessions SET last_used_at = ? WHERE token = ?").run(now, token);
}

export function revokeSession(token: string) {
  const db = getDb();
  db.prepare("UPDATE sessions SET revoked = 1 WHERE token = ?").run(token);
}

export function deleteExpiredSessions() {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare("DELETE FROM sessions WHERE expires_at < ? OR revoked = 1").run(now);
}


