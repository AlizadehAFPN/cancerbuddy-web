/**
 * proxy.ts — Next.js 16 auth routing (replaces middleware.ts).
 *
 * Responsibilities:
 *  1. Redirect authenticated users away from auth pages (/, /login, /signup…)
 *  2. Redirect unauthenticated users away from protected app pages (/dashboard…)
 *
 * Current state: the session check is a TODO stub — auth pages are freely
 * accessible. Wire up `getSessionFromCookie` once the auth provider is chosen.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/* ── Route classification ── */

/** Pages that logged-in users should be redirected away from. */
const AUTH_ROUTES = ["/", "/login", "/signup", "/forgot-password"];

/** Path prefixes that require an active session. */
const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/groups", "/feed"];

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.includes(pathname);
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/* ── Session helper ── */

/**
 * Read the session from the request cookies.
 *
 * TODO: Replace the stub with real verification.
 * Example (stateless JWT with jose):
 *   const token = request.cookies.get('session')?.value;
 *   if (!token) return null;
 *   try {
 *     const { payload } = await jwtVerify(token, SECRET);
 *     return payload;
 *   } catch { return null; }
 */
function getSessionFromCookie(_request: NextRequest): boolean {
  return false; // stub — treat every request as unauthenticated for now
}

/* ── Proxy handler ── */

/** Hard cap so an attacker can't pad the URL with a huge return path. */
const MAX_RETURN_PATH_LEN = 512;

/**
 * Normalise an arbitrary string into a safe **same-origin path** suitable
 * for the post-login `?from=` query, or fall back to `"/"`.
 *
 * Implementation: resolve the candidate against the current request URL
 * using the WHATWG `URL` parser, then reject anything whose origin differs
 * from the request's. This catches every common open-redirect vector in
 * one place — no manual blocklist to keep in sync:
 *
 *   - Absolute URLs (`https://evil.com/x`) — different origin → rejected.
 *   - Scheme-relative (`//evil.com`) — the parser resolves it to
 *     `https://evil.com` → different origin → rejected.
 *   - Backslash bypass (`/\\evil.com`, `\/evil.com`) — the parser
 *     canonicalises and reveals the cross-origin target → rejected.
 *   - Percent-encoded variants (`%2F%2Fevil.com`) — the parser decodes
 *     before origin comparison → rejected.
 *   - Control characters / newlines — the parser strips or fails on them,
 *     and an extra explicit guard rejects them upfront.
 *
 * Returns the canonical `pathname + search + hash` of the resolved URL on
 * success, or `"/"` on any failure.
 */
function safeReturnPath(candidate: string, requestUrl: string): string {
  if (typeof candidate !== "string") return "/";
  if (candidate.length === 0 || candidate.length > MAX_RETURN_PATH_LEN) return "/";
  if (/[\x00-\x1f\x7f]/.test(candidate)) return "/";

  try {
    const requestOrigin = new URL(requestUrl).origin;
    const resolved = new URL(candidate, requestUrl);
    if (resolved.origin !== requestOrigin) return "/";
    /* Require an absolute path (`/foo`) — never a relative one that the
       login page might resolve against its own URL. */
    if (!resolved.pathname.startsWith("/")) return "/";
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return "/";
  }
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isAuthenticated = getSessionFromCookie(request);

  if (isAuthenticated && isAuthRoute(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isAuthenticated && isProtectedRoute(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", safeReturnPath(pathname, request.url));
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

/* ── Matcher — skip static assets and Next.js internals ── */

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|images/|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|ttf|woff2?)).*)",
  ],
};
