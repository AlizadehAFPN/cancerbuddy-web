/**
 * The server-side bootstrap that mobile runs on every sign-in.
 *
 * `LoginInLambdaUtil` (`cancerbuddyapp/src/utils/enrollment/signup.ts:8-38`) is
 * called from `useAuth.logIn` at :225 — on *every* login, not once at
 * enrollment. Web only ever ran it from `userEnrollmentFinalize`, so a member
 * who registered on the phone and then signed in on the web never re-ran it.
 *
 * What the verb does server-side is the users table's business; the client's
 * job is to say "this person just signed in".
 *
 * Two deliberate differences from mobile, both already established elsewhere in
 * this codebase:
 *
 *  - **`token` stays undefined.** Mobile hands the FCM token over here; web
 *    registers its device directly with Stream instead, and the reasoning is
 *    written up in `lib/push/pushClient.ts:13-27`. `userEnrollmentFinalize`
 *    passes `undefined` for the same reason.
 *  - **A failure does not fail the sign-in.** Mobile's catch-all leaves
 *    `LoginInLambdaUtil` returning `undefined`, which aborts `logIn` and drops
 *    the member back to the form. On web the Cognito session already exists at
 *    this point, so aborting would strand a signed-in member on a login screen.
 *    It is logged and the sign-in continues.
 */

import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";

function usersLambdaName(): string {
  const name = process.env.NEXT_PUBLIC_USERS_LAMBDA?.trim();
  if (!name) throw new Error("NEXT_PUBLIC_USERS_LAMBDA is not configured.");
  return name;
}

/**
 * @returns whether the verb was delivered. Callers use it for logging only —
 * nothing about signing in depends on the answer.
 */
export async function runLoginBootstrap(cognitoUserId: string): Promise<boolean> {
  const userId = cognitoUserId.trim();
  if (!userId) return false;

  try {
    await raiseUserLambda(LambdaPayloadType.LOGIN, usersLambdaName(), {
      userId,
      token: undefined,
    });
    return true;
  } catch (err) {
    console.error("[login] users login bootstrap failed:", err);
    return false;
  }
}
