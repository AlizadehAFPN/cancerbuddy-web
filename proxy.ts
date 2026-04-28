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

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isAuthenticated = getSessionFromCookie(request);

  if (isAuthenticated && isAuthRoute(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isAuthenticated && isProtectedRoute(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
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
