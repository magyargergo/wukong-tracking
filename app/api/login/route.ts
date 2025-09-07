import { NextResponse } from "next/server";
import { setAuthCookie, validateCredentials } from "@/lib/auth";
import { corsHeaders } from "@/lib/security";

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { headers: { ...corsHeaders(req) } });
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  let username = "";
  let password = "";

  if (contentType.includes("application/json")) {
    const body = await req.json();
    username = body?.username ?? "";
    password = body?.password ?? "";
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    username = String(form.get("username") || "");
    password = String(form.get("password") || "");
  }

  const user = validateCredentials(username, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for") || undefined;
  const ua = req.headers.get("user-agent") || undefined;
  setAuthCookie(user.username, { userAgent: ua, ip });
  return NextResponse.json({ ok: true }, { headers: { ...corsHeaders(req) } });
}


