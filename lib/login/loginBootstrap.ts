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
 *  - **The real FCM token is sent when this browser has one, and the call is
 *    skipped when it does not.** This is not cosmetic. The Lambda's `login` verb
 *    does two things (source read from the deployed `users-demo` package):
 *
 *      1. `setNewIdBuddyId(userId)` — `SHA256(userId)` sliced to `BI-xxxx-yyyy`.
 *         Deterministic, so it writes the same value every time. Registration
 *         already ran it (`userEnrollmentFinalize`), and re-running it at
 *         sign-in achieves nothing.
 *      2. For every group the member belongs to, it enqueues
 *         `{type:'subscribeToTopic', tokens:[token], topic}`.
 *
 *    Step 2 is why `undefined` is not harmless here. The message becomes
 *    `tokens:[null]`, whose length is 1, so the consumer's
 *    `if (!tokens.length || !topic) return` guard does **not** catch it and
 *    `subscribeToTopic([null], …)` throws. Nobody is affected — the handler
 *    catches per message, so there is no retry and no dead-letter — but it is a
 *    guaranteed failure logged on every web sign-in by a member who is in a
 *    group, and it is ours to stop making.
 *
 *    Registration keeps calling with `undefined` on purpose: a brand-new member
 *    is in no groups, so the Lambda returns before the queue, and the buddyId
 *    write is the whole point of the call there.
 *  - **A failure does not fail the sign-in.** Mobile's catch-all leaves
 *    `LoginInLambdaUtil` returning `undefined`, which aborts `logIn` and drops
 *    the member back to the form. On web the Cognito session already exists at
 *    this point, so aborting would strand a signed-in member on a login screen.
 *    It is logged and the sign-in continues.
 */

import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import { currentPushToken } from "@/lib/push/pushClient";

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

  /**
   * No token, nothing to subscribe, and the buddyId write is a no-op — so the
   * only thing this call could still do is enqueue a message guaranteed to
   * fail. Skip it. See the note above for what the verb actually does.
   */
  const token = currentPushToken();
  if (!token) return false;

  try {
    await raiseUserLambda(LambdaPayloadType.LOGIN, usersLambdaName(), {
      userId,
      token,
    });
    return true;
  } catch (err) {
    console.error("[login] users login bootstrap failed:", err);
    return false;
  }
}
