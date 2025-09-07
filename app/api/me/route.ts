import { NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/auth";
import { corsHeaders } from "@/lib/security";

export async function GET(req: Request) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ user: null }, { headers: { ...corsHeaders(req) } });
  return NextResponse.json({
    user: user.isSystemAdmin ? { username: user.username, name: user.name, isSystemAdmin: true } : { username: user.username, name: user.name, isSystemAdmin: false }
  }, { headers: { ...corsHeaders(req) } });
}


