import { NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/auth";
import { getUserByUsername } from "@/lib/db";
import { corsHeaders } from "@/lib/security";

export async function GET(req: Request) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ user: null }, { headers: { ...corsHeaders(req) } });
  const dbUser = await getUserByUsername(user.username);
  return NextResponse.json({
    user: user.isSystemAdmin ? { username: user.username, name: user.name, isSystemAdmin: true } : { username: user.username, name: user.name, isSystemAdmin: false }
  }, { headers: { ...corsHeaders(req) } });
}


