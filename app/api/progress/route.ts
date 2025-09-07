import { NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/auth";
import { deleteProgress, getOrCreateUser, getProgressMap, replaceProgress, upsertProgress } from "@/lib/db";
import { corsHeaders, isValidCsrf, isValidItemId } from "@/lib/security";
import { cookies } from "next/headers";

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { headers: { ...corsHeaders(req) } });
}

export async function GET(req: Request) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.isSystemAdmin) return NextResponse.json({ error: "System admin cannot access progress" }, { status: 403 });
  const u = await getOrCreateUser(user.username, user.name);
  const map = await getProgressMap(u.id);
  return NextResponse.json({ collected: map }, { headers: { ...corsHeaders(req) } });
}

export async function POST(req: Request) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.isSystemAdmin) return NextResponse.json({ error: "System admin cannot modify progress" }, { status: 403 });
  const u = await getOrCreateUser(user.username, user.name);
  const csrfCookie = cookies().get("csrfToken")?.value;
  if (!isValidCsrf(req, csrfCookie)) return NextResponse.json({ error: "Bad CSRF" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const itemId = String(body?.itemId || "").trim();
  const done = !!body?.done;
  const note = typeof body?.note === "string" ? body.note : undefined;
  if (!itemId) return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  if (!isValidItemId(itemId)) return NextResponse.json({ error: "Invalid itemId" }, { status: 400 });
  const applied = await upsertProgress(u.id, itemId, done, note, (body?.updatedAt as number|undefined));
  if (!applied) {
    return NextResponse.json({ ok: false, conflict: true, message: "Outdated change. Please refetch." }, { status: 409, headers: { ...corsHeaders(req) } });
  }
  return NextResponse.json({ ok: true }, { headers: { ...corsHeaders(req) } });
}

export async function PUT(req: Request) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.isSystemAdmin) return NextResponse.json({ error: "System admin cannot modify progress" }, { status: 403 });
  const u = await getOrCreateUser(user.username, user.name);
  const csrfCookie = cookies().get("csrfToken")?.value;
  if (!isValidCsrf(req, csrfCookie)) return NextResponse.json({ error: "Bad CSRF" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const collected = body?.collected as Record<string, { done?: boolean; note?: string }> | undefined;
  if (!collected || typeof collected !== "object") return NextResponse.json({ error: "Missing collected" }, { status: 400 });

  // Replace strategy: clear all then insert current state
  // Batch replacement in one transaction to avoid N round-trips
  const filtered: Record<string, { done?: boolean; note?: string; updatedAt?: number }> = {};
  for (const [itemId, entry] of Object.entries(collected)) {
    if (!itemId || !isValidItemId(itemId)) continue;
    filtered[itemId] = { done: !!(entry as any)?.done, note: typeof (entry as any)?.note === "string" ? (entry as any).note : undefined, updatedAt: Date.now()/1000 };
  }
  const result = await replaceProgress(u.id, filtered);
  if (result.applied < result.total) {
    return NextResponse.json({ ok: false, conflict: true, applied: result.applied, total: result.total, message: "Some items were outdated. Please refetch." }, { status: 409, headers: { ...corsHeaders(req) } });
  }
  return NextResponse.json({ ok: true }, { headers: { ...corsHeaders(req) } });
}

export async function DELETE(req: Request) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.isSystemAdmin) return NextResponse.json({ error: "System admin cannot modify progress" }, { status: 403 });
  const u = await getOrCreateUser(user.username, user.name);
  const csrfCookie = cookies().get("csrfToken")?.value;
  if (!isValidCsrf(req, csrfCookie)) return NextResponse.json({ error: "Bad CSRF" }, { status: 403 });
  let itemId: string | undefined;
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("itemId");
    if (id && isValidItemId(id)) itemId = id;
  } catch {}
  await deleteProgress(u.id, itemId);
  return NextResponse.json({ ok: true }, { headers: { ...corsHeaders(req) } });
}


