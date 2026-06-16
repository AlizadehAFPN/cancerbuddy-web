/**
 * Client-side session check.
 *
 * Cognito tokens live in Amplify's default browser storage (localStorage) — see
 * the note in `lib/aws/amplifyConfigure.ts` for why we don't use cookieStorage.
 * Because of that, the server/proxy cannot see the session, so route gating is
 * done in the browser via <AuthGuard>, which calls this helper.
 */

import { Auth } from "aws-amplify";
import { ensureAmplifyConfigured } from "@/lib/aws/amplifyConfigure";

/**
 * Returns true when a valid (or silently-refreshable) Cognito session exists.
 *
 * `Auth.currentSession()` refreshes expired access/id tokens using the refresh
 * token when possible, and throws when there is no usable session at all — so a
 * thrown error (or an invalid session) means "not signed in".
 */
export async function hasValidSession(): Promise<boolean> {
  ensureAmplifyConfigured();
  try {
    const session = await Auth.currentSession();
    return session.isValid();
  } catch {
    return false;
  }
}

/**
 * Sign the user out of Cognito and clear the local token cache. Safe to call
 * even when no one is signed in (errors are swallowed). Callers handle the
 * post-sign-out redirect (e.g. back to "/").
 */
export async function signOut(): Promise<void> {
  ensureAmplifyConfigured();
  try {
    await Auth.signOut();
  } catch {
    /* already signed out / network — nothing to do */
  }
}
