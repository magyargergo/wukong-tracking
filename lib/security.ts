export const CSRF_COOKIE = "csrfToken";

export function readCookieFromHeader(cookieHeader: string | null | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(/;\s*/);
  for (const p of parts) {
    const [k, ...rest] = p.split("=");
    if (k === name) return rest.join("=");
  }
  return undefined;
}

export function corsHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "Vary": "Origin"
  };
  const origin = req.headers.get("origin");
  try {
    const url = new URL(req.url);
    const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean);
    const isAllowed = origin && (origin === url.origin || allowedOrigins.includes(origin));
    if (isAllowed && origin) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Credentials"] = "true";
      headers["Access-Control-Allow-Headers"] = "content-type, x-csrf-token";
      headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS";
    }
  } catch {}
  return headers;
}

export function addCommonSecurityHeaders(h: Headers) {
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("X-Frame-Options", "DENY");
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  h.set("Cross-Origin-Resource-Policy", "same-origin");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  if (process.env.NODE_ENV === "production") {
    h.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'"
    ].join("; ");
    h.set("Content-Security-Policy", csp);
  }
}

export function isValidCsrf(req: Request, cookieValue?: string | null): boolean {
  const header = req.headers.get("x-csrf-token");
  if (!header || !cookieValue) return false;
  return header === cookieValue;
}

// Accept only predictable ids (letters, numbers, dash) up to 128 chars
export function isValidItemId(id: string): boolean {
  return /^[a-z0-9-]{1,128}$/i.test(id);
}


