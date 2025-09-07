import { neon } from "@neondatabase/serverless";

type UserRow = { id: number; username: string; name?: string | null; password_hash?: string | null; is_admin: boolean };
type ProgressRow = { user_id: number; item_id: string; done: boolean; note?: string | null };
type SessionRow = { id: number; token: string; user_id: number; created_at: number; expires_at: number; last_used_at: number; user_agent?: string | null; ip?: string | null; revoked: boolean };

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for Neon Postgres");
  return neon(url);
}

async function ensureSchema() {
  const q = sql();
  await q`create table if not exists users (
    id serial primary key,
    username text not null unique,
    name text,
    password_hash text,
    is_admin boolean not null default false
  )`;

  await q`create table if not exists progress (
    user_id integer not null references users(id) on delete cascade,
    item_id text not null,
    done boolean not null default false,
    note text,
    primary key(user_id, item_id)
  )`;

  await q`create table if not exists sessions (
    id serial primary key,
    token text not null unique,
    user_id integer not null references users(id) on delete cascade,
    created_at integer not null,
    expires_at integer not null,
    last_used_at integer not null,
    user_agent text,
    ip text,
    revoked boolean not null default false
  )`;
}

export async function getOrCreateUser(username: string, name?: string): Promise<UserRow> {
  await ensureSchema();
  const q = sql();
  const existing = await q`select id, username, name, password_hash, is_admin from users where username = ${username} limit 1` as any[];
  if (existing.length > 0) return normalizeUser(existing[0]);
  const rows = await q`insert into users (username, name) values (${username}, ${name ?? null}) returning id, username, name, password_hash, is_admin` as any[];
  return normalizeUser(rows[0]);
}

export async function getUserByUsername(username: string): Promise<UserRow | undefined> {
  await ensureSchema();
  const q = sql();
  const rows = await q`select id, username, name, password_hash, is_admin from users where username = ${username} limit 1` as any[];
  return rows[0] ? normalizeUser(rows[0]) : undefined;
}

export async function getUserById(id: number): Promise<UserRow | undefined> {
  await ensureSchema();
  const q = sql();
  const rows = await q`select id, username, name, password_hash, is_admin from users where id = ${id} limit 1` as any[];
  return rows[0] ? normalizeUser(rows[0]) : undefined;
}

export async function getProgressMap(userId: number): Promise<Record<string, { done: boolean; note?: string }>> {
  await ensureSchema();
  const q = sql();
  const rows = await q`select user_id, item_id, done, note from progress where user_id = ${userId}` as any[];
  const map: Record<string, { done: boolean; note?: string }> = {};
  for (const r of rows) map[String(r.item_id)] = { done: !!r.done, note: r.note ?? undefined };
  return map;
}

export async function upsertProgress(userId: number, itemId: string, done: boolean, note?: string) {
  await ensureSchema();
  const q = sql();
  await q`insert into progress (user_id, item_id, done, note) values (${userId}, ${itemId}, ${done}, ${note ?? null}) on conflict (user_id, item_id) do update set done = excluded.done, note = excluded.note`;
}

export async function deleteProgress(userId: number, itemId?: string) {
  await ensureSchema();
  const q = sql();
  if (itemId) await q`delete from progress where user_id = ${userId} and item_id = ${itemId}`;
  else await q`delete from progress where user_id = ${userId}`;
}

export async function upsertUser(user: { id?: number; username: string; name?: string; password_hash?: string | null; is_admin?: boolean }) {
  await ensureSchema();
  const q = sql();
  if (user.id) {
    await q`update users set username = ${user.username}, name = ${user.name ?? null}, password_hash = coalesce(${user.password_hash ?? null}, password_hash), is_admin = ${!!user.is_admin} where id = ${user.id}`;
    return user.id;
  }
  const rows = await q`insert into users (username, name, password_hash, is_admin) values (${user.username}, ${user.name ?? null}, ${user.password_hash ?? null}, ${!!user.is_admin}) returning id, username, name, password_hash, is_admin` as any[];
  return Number(rows[0].id);
}

export async function listUsers(): Promise<Array<{ id: number; username: string; name?: string; is_admin: boolean }>>{
  await ensureSchema();
  const q = sql();
  const rows = await q`select id, username, name, is_admin from users order by username asc` as any[];
  return rows.map(r => ({ id: Number(r.id), username: String(r.username), name: r.name ?? undefined, is_admin: !!r.is_admin }));
}

export async function deleteUser(id: number) {
  await ensureSchema();
  const q = sql();
  await q`delete from users where id = ${id}`;
}

export async function createSession(params: { token: string; userId: number; ttlSeconds: number; userAgent?: string; ip?: string }) {
  await ensureSchema();
  const q = sql();
  const now = Math.floor(Date.now() / 1000);
  const expires = now + Math.max(60, params.ttlSeconds);
  await q`insert into sessions (token, user_id, created_at, expires_at, last_used_at, user_agent, ip) values (${params.token}, ${params.userId}, ${now}, ${expires}, ${now}, ${params.userAgent ?? null}, ${params.ip ?? null})`;
}

export async function getSessionByToken(token: string): Promise<SessionRow | undefined> {
  await ensureSchema();
  const q = sql();
  const rows = await q`select id, token, user_id, created_at, expires_at, last_used_at, user_agent, ip, revoked from sessions where token = ${token} limit 1` as any[];
  return rows[0] ? normalizeSession(rows[0]) : undefined;
}

export async function touchSession(token: string) {
  await ensureSchema();
  const q = sql();
  const now = Math.floor(Date.now() / 1000);
  await q`update sessions set last_used_at = ${now} where token = ${token}`;
}

export async function revokeSession(token: string) {
  await ensureSchema();
  const q = sql();
  await q`update sessions set revoked = true where token = ${token}`;
}

export async function deleteExpiredSessions() {
  await ensureSchema();
  const q = sql();
  const now = Math.floor(Date.now() / 1000);
  await q`delete from sessions where expires_at < ${now} or revoked = true`;
}

function normalizeUser(row: any): UserRow {
  return {
    id: Number(row.id),
    username: String(row.username),
    name: row.name ?? null,
    password_hash: row.password_hash ?? null,
    is_admin: !!row.is_admin
  };
}

function normalizeSession(row: any): SessionRow {
  return {
    id: Number(row.id),
    token: String(row.token),
    user_id: Number(row.user_id),
    created_at: Number(row.created_at),
    expires_at: Number(row.expires_at),
    last_used_at: Number(row.last_used_at),
    user_agent: row.user_agent ?? null,
    ip: row.ip ?? null,
    revoked: !!row.revoked
  };
}


