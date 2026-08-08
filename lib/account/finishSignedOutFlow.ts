"use client";

/**
 * The end of an account-altering flow: sign out and return to the door.
 *
 * Three flows finish this way — delete account, change status Path A and Path B
 * — and all three have the same failure mode if they merely `router.push("/")`:
 * the Cognito tokens are still in localStorage, so the app shell keeps
 * rendering, `AuthGuard` lets `/groups` through, and the member is left in a
 * half-authenticated state built on a row that has changed underneath them (or
 * no longer exists).
 *
 * The order matters and is the same order the account sheet's logout uses:
 *
 *  1. detach this browser from Stream push, while the client is still connected
 *  2. disconnect the Stream client
 *  3. drop the Cognito session
 *  4. hard-navigate to `/`
 *
 * Step 4 is `window.location.replace`, not `router.replace`: after a delete,
 * every provider still mounted holds state for an account that no longer exists,
 * and the only reliable way to discard all of it is a fresh document. `replace`
 * rather than `assign` so Back cannot return to the deleted account's shell.
 */

import { signOut } from "@/lib/auth-client";
import { disconnectStream } from "@/lib/chat/streamClient";
import { unregisterPushDevice } from "@/lib/push/pushClient";

export async function finishSignedOutFlow(): Promise<void> {
  try {
    await unregisterPushDevice();
  } catch (err) {
    console.error("[account] could not unregister the push device:", err);
  }

  try {
    await disconnectStream();
  } catch (err) {
    console.error("[account] could not disconnect Stream:", err);
  }

  // Never skipped: leaving the tokens behind is the whole failure being fixed.
  await signOut();

  if (typeof window !== "undefined") {
    window.location.replace("/");
  }
}
