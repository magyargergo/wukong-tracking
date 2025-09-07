import { neon } from "@neondatabase/serverless";

type UserRow = { id: number; username: string; name?: string | null; password_hash?: string | null; is_admin: boolean };
type SessionRow = { id: number; token: string; user_id: number; created_at: number; expires_at: number; last_used_at: number; user_agent?: string | null; ip?: string | null; revoked: boolean };

let __sharedSql: ReturnType<typeof neon> | undefined;
function sql() {
  if (__sharedSql) return __sharedSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for Neon Postgres");
  __sharedSql = neon(url);
  return __sharedSql;
}

async function ensureSchema() {
  // Skip runtime DDL in production unless explicitly enabled
  const allowRuntimeMigrations = process.env.ENABLE_RUNTIME_SCHEMA === "1" || process.env.NODE_ENV !== "production";
  if (!allowRuntimeMigrations) return;
  if ((globalThis as any).__wukong_schema_initialized__) return;
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
    updated_at integer not null default 0,
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
  (globalThis as any).__wukong_schema_initialized__ = true;
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

export async function getProgressMap(userId: number): Promise<Record<string, { done: boolean; note?: string; updatedAt: number }>> {
  await ensureSchema();
  const q = sql();
  const rows = await q`select user_id, item_id, done, note, updated_at from progress where user_id = ${userId}` as any[];
  const map: Record<string, { done: boolean; note?: string; updatedAt: number }> = {};
  for (const r of rows) map[String(r.item_id)] = { done: !!r.done, note: r.note ?? undefined, updatedAt: Number(r.updated_at) };
  return map;
}

// Single round-trip: ensure user exists and fetch progress map by username
export async function getProgressMapByUsername(username: string, name?: string): Promise<Record<string, { done: boolean; note?: string; updatedAt: number }>> {
  await ensureSchema();
  const q = sql();
  const rows = await q`
    with upsert_user as (
      insert into users (username, name)
      values (${username}, ${name ?? null})
      on conflict (username)
      do update set name = coalesce(users.name, excluded.name)
      returning id
    )
    select p.item_id, p.done, p.note, p.updated_at
    from progress p
    where p.user_id = (select id from upsert_user)
  ` as any[];
  const map: Record<string, { done: boolean; note?: string; updatedAt: number }> = {};
  for (const r of rows) map[String(r.item_id)] = { done: !!r.done, note: r.note ?? undefined, updatedAt: Number(r.updated_at) };
  return map;
}

export async function upsertProgress(userId: number, itemId: string, done: boolean, note?: string, updatedAt?: number): Promise<boolean> {
  await ensureSchema();
  const q = sql();
  const ts = typeof updatedAt === 'number' ? Math.floor(updatedAt) : Math.floor(Date.now() / 1000);
  const rows = await q`insert into progress (user_id, item_id, done, note, updated_at)
           values (${userId}, ${itemId}, ${done}, ${note ?? null}, ${ts})
           on conflict (user_id, item_id) do update
             set done = excluded.done, note = excluded.note, updated_at = excluded.updated_at
             where excluded.updated_at > progress.updated_at
           returning item_id` as any[];
  return rows.length > 0;
}

// Single round-trip upsert for progress by username
export async function upsertProgressByUsername(params: { username: string; name?: string; itemId: string; done: boolean; note?: string; updatedAt?: number }): Promise<boolean> {
  await ensureSchema();
  const q = sql();
  const ts = typeof params.updatedAt === 'number' ? Math.floor(params.updatedAt) : Math.floor(Date.now() / 1000);
  const rows = await q`
    with upsert_user as (
      insert into users (username, name)
      values (${params.username}, ${params.name ?? null})
      on conflict (username)
      do update set name = coalesce(users.name, excluded.name)
      returning id
    ), applied as (
      insert into progress (user_id, item_id, done, note, updated_at)
      select id, ${params.itemId}, ${params.done}, ${params.note ?? null}, ${ts}
      from upsert_user
      on conflict (user_id, item_id) do update
        set done = excluded.done, note = excluded.note, updated_at = excluded.updated_at
        where excluded.updated_at > progress.updated_at
      returning 1
    )
    select count(*)::int as count from applied
  ` as any[];
  return Number(rows?.[0]?.count ?? 0) > 0;
}

// Single round-trip: create user if needed and return id
export async function getOrCreateUserId(username: string, name?: string): Promise<number> {
  await ensureSchema();
  const q = sql();
  const rows = await q`
    with upsert_user as (
      insert into users (username, name)
      values (${username}, ${name ?? null})
      on conflict (username)
      do update set name = coalesce(users.name, excluded.name)
      returning id
    )
    select id from upsert_user
  ` as any[];
  return Number(rows[0].id);
}

export async function deleteProgress(userId: number, itemId?: string) {
  await ensureSchema();
  const q = sql();
  if (itemId) await q`delete from progress where user_id = ${userId} and item_id = ${itemId}`;
  else await q`delete from progress where user_id = ${userId}`;
}

// Single round-trip delete by username (does not create user if missing)
export async function deleteProgressByUsername(username: string, itemId?: string) {
  await ensureSchema();
  const q = sql();
  if (itemId) {
    await q`
      with u as (
        select id from users where username = ${username} limit 1
      )
      delete from progress p using u where p.user_id = u.id and p.item_id = ${itemId}
    `;
  } else {
    await q`
      with u as (
        select id from users where username = ${username} limit 1
      )
      delete from progress p using u where p.user_id = u.id
    `;
  }
}

export async function replaceProgress(userId: number, entries: Record<string, { done?: boolean; note?: string; updatedAt?: number }>): Promise<{ applied: number; total: number; }>{
  await ensureSchema();
  const q = sql();
  const items: string[] = [];
  const dones: boolean[] = [];
  const notes: (string|null)[] = [];
  const times: number[] = [];
  for (const [itemId, v] of Object.entries(entries)) {
    items.push(itemId);
    dones.push(!!(v as any)?.done);
    const noteVal = typeof (v as any)?.note === "string" ? (v as any).note as string : null;
    notes.push(noteVal);
    const t = typeof (v as any)?.updatedAt === 'number' ? Math.floor((v as any).updatedAt) : Math.floor(Date.now() / 1000);
    times.push(t);
  }
  if (items.length === 0) return { applied: 0, total: 0 };
  const rows = await q`insert into progress (user_id, item_id, done, note, updated_at)
           select ${userId}, x.item_id, x.done, x.note, x.updated_at
           from unnest(${items}::text[], ${dones}::boolean[], ${notes}::text[], ${times}::int[]) as x(item_id, done, note, updated_at)
           on conflict (user_id, item_id) do update
             set done = excluded.done, note = excluded.note, updated_at = excluded.updated_at
             where excluded.updated_at > progress.updated_at
           returning item_id` as any[];
  return { applied: rows.length, total: items.length };
}

// Single round-trip batch replace by username
export async function replaceProgressByUsername(username: string, name: string | undefined, entries: Record<string, { done?: boolean; note?: string; updatedAt?: number }>): Promise<{ applied: number; total: number; }>{
  await ensureSchema();
  const q = sql();
  const items: string[] = [];
  const dones: boolean[] = [];
  const notes: (string|null)[] = [];
  const times: number[] = [];
  for (const [itemId, v] of Object.entries(entries)) {
    items.push(itemId);
    dones.push(!!(v as any)?.done);
    const noteVal = typeof (v as any)?.note === "string" ? (v as any).note as string : null;
    notes.push(noteVal);
    const t = typeof (v as any)?.updatedAt === 'number' ? Math.floor((v as any).updatedAt) : Math.floor(Date.now() / 1000);
    times.push(t);
  }
  if (items.length === 0) return { applied: 0, total: 0 };
  const rows = await q`
    with upsert_user as (
      insert into users (username, name)
      values (${username}, ${name ?? null})
      on conflict (username)
      do update set name = coalesce(users.name, excluded.name)
      returning id
    )
    insert into progress (user_id, item_id, done, note, updated_at)
    select u.id, x.item_id, x.done, x.note, x.updated_at
    from upsert_user u
    join unnest(${items}::text[], ${dones}::boolean[], ${notes}::text[], ${times}::int[]) as x(item_id, done, note, updated_at) on true
    on conflict (user_id, item_id) do update
      set done = excluded.done, note = excluded.note, updated_at = excluded.updated_at
      where excluded.updated_at > progress.updated_at
    returning item_id
  ` as any[];
  return { applied: rows.length, total: items.length };
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


