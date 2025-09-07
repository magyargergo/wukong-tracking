import { NextResponse, type NextRequest } from "next/server";
import { addCommonSecurityHeaders } from "@/lib/security";

// We cannot import server-only modules that use next/headers here reliably.
// So we manually read the cookie from the request.
const AUTH_COOKIE = "session";

const PUBLIC_PATHS = [
  "/login",
  "/_next",
  "/favicon.ico",
  "/icons",
  "/manifest.json",
  "/robots.txt",
  "/api"
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const res = NextResponse.next();
  // Security headers
  addCommonSecurityHeaders(res.headers);
  if (isPublic) return res;

  const authCookie = req.cookies.get(AUTH_COOKIE)?.value;
  const isAuthed = !!authCookie;
  if (isAuthed) return res;

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/(.*)"]
};


