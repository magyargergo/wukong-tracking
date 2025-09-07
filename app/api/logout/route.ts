import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";
import { corsHeaders } from "@/lib/security";

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { headers: { ...corsHeaders(req) } });
}

export async function POST(req: Request) {
  await clearAuthCookie();
  return NextResponse.json({ ok: true }, { headers: { ...corsHeaders(req) } });
}


