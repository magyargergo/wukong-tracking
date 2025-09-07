import { NextResponse } from "next/server";
import { corsHeaders, isValidCsrf } from "@/lib/security";
import { cookies } from "next/headers";
import { deleteUser, getSessionByToken, getUserById, getUserByUsername, listUsers, upsertUser } from "@/lib/db";
import bcrypt from "bcryptjs";

async function ensureAdminBySession(token?: string): Promise<boolean> {
  if (!token) return false;
  const s = await getSessionByToken(token);
  if (!s || !!s.revoked) return false;
  const u = await getUserById(s.user_id);
  return false; // no DB admins for now
}

export async function GET(req: Request) {
  const token = cookies().get("session")?.value;
  // Allow only system admin via env-admin session cookie
  if (!token || !token.startsWith("env-admin:")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const all = await listUsers();
  const sysAdmin = (process.env.AUTH_USER ?? "admin").trim();
  const users = all.filter(u => u.username !== sysAdmin);
  return NextResponse.json({ users }, { headers: { ...corsHeaders(req) } });
}

export async function POST(req: Request) {
  const token = cookies().get("session")?.value;
  const csrf = cookies().get("csrfToken")?.value;
  if (!token || !token.startsWith("env-admin:")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isValidCsrf(req, csrf)) return NextResponse.json({ error: "Bad CSRF" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const username = String(body?.username || "").trim();
  const name = typeof body?.name === "string" ? body.name : undefined;
  const password = typeof body?.password === "string" ? body.password : undefined;
  const is_admin = false;
  if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 });
  const sysAdmin = (process.env.AUTH_USER ?? "admin").trim();
  if (username === sysAdmin) return NextResponse.json({ error: "Cannot create or edit system admin" }, { status: 400 });
  const password_hash = password ? bcrypt.hashSync(password, 10) : null;
  const id = await upsertUser({ username, name, password_hash, is_admin });
  return NextResponse.json({ id }, { headers: { ...corsHeaders(req) } });
}

export async function PUT(req: Request) {
  const token = cookies().get("session")?.value;
  const csrf = cookies().get("csrfToken")?.value;
  if (!token || !token.startsWith("env-admin:")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isValidCsrf(req, csrf)) return NextResponse.json({ error: "Bad CSRF" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id || 0);
  const username = String(body?.username || "").trim();
  const name = typeof body?.name === "string" ? body.name : undefined;
  const password = typeof body?.password === "string" ? body.password : undefined;
  const is_admin = false;
  if (!id || !username) return NextResponse.json({ error: "Missing id/username" }, { status: 400 });
  const sysAdmin = (process.env.AUTH_USER ?? "admin").trim();
  if (username === sysAdmin) return NextResponse.json({ error: "Cannot edit system admin" }, { status: 400 });
  const password_hash = password ? bcrypt.hashSync(password, 10) : undefined;
  await upsertUser({ id, username, name, password_hash, is_admin });
  return NextResponse.json({ ok: true }, { headers: { ...corsHeaders(req) } });
}

export async function DELETE(req: Request) {
  const token = cookies().get("session")?.value;
  const csrf = cookies().get("csrfToken")?.value;
  if (!token || !token.startsWith("env-admin:")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isValidCsrf(req, csrf)) return NextResponse.json({ error: "Bad CSRF" }, { status: 403 });
  let id = 0;
  try { const url = new URL(req.url); id = Number(url.searchParams.get("id") || 0); } catch {}
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const sysAdmin = (process.env.AUTH_USER ?? "admin").trim();
  const target = await getUserById(id);
  if (target && target.username === sysAdmin) return NextResponse.json({ error: "Cannot delete system admin" }, { status: 400 });
  await deleteUser(id);
  return NextResponse.json({ ok: true }, { headers: { ...corsHeaders(req) } });
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { headers: { ...corsHeaders(req) } });
}


