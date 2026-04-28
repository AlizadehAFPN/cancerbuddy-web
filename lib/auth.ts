/**
 * Auth utilities — skeleton ready for backend integration.
 *
 * Replace the stub implementations below with your chosen auth provider
 * (AWS Cognito, Supabase, NextAuth.js, etc.) as the project progresses.
 */

/* ── Types ── */

export type AuthUser = {
  id: string;
  email: string;
  displayName?: string;
};

export type SessionPayload = {
  userId: string;
  email: string;
  expiresAt: Date;
};

export type AuthResult =
  | { success: true; user: AuthUser }
  | { success: false; error: string };

/* ── Session helpers ── */

/**
 * Read the current session from the request cookies.
 * Returns null when no valid session is found.
 */
export async function getSession(): Promise<SessionPayload | null> {
  // TODO: Decode and verify the session JWT from cookies.
  // Example with jose:
  //   const cookieStore = await cookies();
  //   const token = cookieStore.get('session')?.value;
  //   if (!token) return null;
  //   const { payload } = await jwtVerify(token, SECRET);
  //   return payload as SessionPayload;
  return null;
}

/**
 * Verify the session and return the auth status.
 * Use this in Server Components, Server Actions, and the proxy.
 */
export async function verifySession(): Promise<{
  isAuthenticated: boolean;
  userId?: string;
}> {
  const session = await getSession();
  if (!session) return { isAuthenticated: false };
  if (session.expiresAt < new Date()) return { isAuthenticated: false };
  return { isAuthenticated: true, userId: session.userId };
}

/**
 * Create a new session after successful authentication.
 */
export async function createSession(_userId: string): Promise<void> {
  // TODO: Generate a signed JWT and set it in an HttpOnly cookie.
  // Example:
  //   const token = await new SignJWT({ userId })
  //     .setProtectedHeader({ alg: 'HS256' })
  //     .setExpirationTime('7d')
  //     .sign(SECRET);
  //   const cookieStore = await cookies();
  //   cookieStore.set('session', token, { httpOnly: true, secure: true, sameSite: 'lax' });
}

/**
 * Destroy the current session (sign out).
 */
export async function deleteSession(): Promise<void> {
  // TODO: Clear the session cookie.
  // const cookieStore = await cookies();
  // cookieStore.delete('session');
}
