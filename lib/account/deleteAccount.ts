/**
 * Deleting an account.
 *
 * The most destructive thing either client can do, and the mechanism the
 * published privacy and child-safety policies promise ("You may manually delete
 * any information in your account at anytime"), which web had no button for.
 *
 * Four steps, in this order (`cancerbuddyapp/src/utils/lambda.ts:95-135`):
 *
 *  1. **record the reason** — AppSync `createDeleteReason`
 *  2. delete every Stream `messaging` channel the member belongs to
 *  3. `delete` → **`GETSTREAM_LAMBDA`** with `{cognitoId, name}` — the Stream user
 *  4. `deleteAccount` → **`USERS_LAMBDA`** with `{userId}` — the account row
 *
 * Two deliberate departures from mobile, both recorded in the worklist's triage
 * notes as bugs to fix rather than copy:
 *
 *  • Mobile records the reason **after** clearing the session
 *    (`DeleteAccount.tsx:73-80`), by which point the AppSync call is
 *    unauthenticated and the reason is silently lost. It goes first here.
 *  • Mobile shows its success screen even when the Lambda returned nothing. Here
 *    a failed delete throws, and the caller keeps the member signed in with an
 *    error rather than telling them their account is gone when it is not.
 *
 * Step 3 must not be skipped when step 2 fails: a member whose Stream client is
 * unreachable still gets their account deleted. Mobile swallows that error for
 * the same reason.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";

/** Mobile's `USER_DELETION_REASONS` (`res/strings/en/profile.tsx:133`), verbatim. */
export const DELETION_REASONS = [
  "I am (or my patient is) in remission",
  "I found support elsewhere",
  "This app isn't what I expected",
  "I didn't find the support I need here",
  "Other",
] as const;

export const OTHER_DELETION_REASON = "Other";
export const OTHER_DELETION_MAX_CHARS = 1000;

/** Submit stays disabled until there is something to record. */
export function deleteSubmitDisabled(input: {
  reason: string;
  detail?: string;
}): boolean {
  if (!input.reason) return true;
  if (input.reason === OTHER_DELETION_REASON) {
    return (input.detail ?? "").trim().length === 0;
  }
  return false;
}

/** "Other" stores the free text, as mobile does (`DeleteAccount.tsx:72`). */
export function deletionReasonValue(input: {
  reason: string;
  detail?: string;
}): string {
  return input.reason === OTHER_DELETION_REASON
    ? (input.detail ?? "").trim()
    : input.reason;
}

const CREATE_DELETE_REASON = /* GraphQL */ `
  mutation createDeleteReason($input: CreateDeleteReasonInput!) {
    createDeleteReason(input: $input) {
      id
    }
  }
`;

function lambdaName(variable: string): string {
  const value = process.env[variable]?.trim();
  if (!value) throw new Error(`${variable} is not set.`);
  return value;
}

export interface DeletableChannel {
  id?: string;
  delete: () => Promise<unknown>;
}

export interface DeleteChatClient {
  queryChannels: (
    filter: Record<string, unknown>,
    sort?: unknown,
    options?: Record<string, unknown>,
  ) => Promise<DeletableChannel[]>;
}

export interface DeleteAccountInput {
  userId: string;
  /** The member's display name — the Stream lambda takes it alongside the id. */
  name: string;
  reason: string;
  /** Stream client, when one is connected. Absent simply skips step 2. */
  client?: DeleteChatClient | null;
}

/**
 * Runs the deletion. Throws if either Lambda fails, so the caller can leave the
 * member signed in and say so.
 */
export async function deleteAccount(input: DeleteAccountInput): Promise<void> {
  /* 1. The reason, while the session is still valid. */
  try {
    await executeAppSyncGraphql({
      query: CREATE_DELETE_REASON,
      variables: { input: { reason: input.reason } },
      authWithUserPool: true,
    });
  } catch (err) {
    // Feedback is not worth blocking a deletion the member has asked for twice.
    console.error("[account] could not record the deletion reason:", err);
  }

  /* 2. The member's conversations. Best-effort. */
  if (input.client) {
    try {
      const channels = await input.client.queryChannels({
        type: "messaging",
        members: { $in: [input.userId] },
      });
      await Promise.all(channels.map((channel) => channel.delete()));
    } catch (err) {
      console.error("[account] Stream channel cleanup failed:", err);
    }
  }

  /* 3. The Stream user — a different Lambda from every other verb. */
  await raiseUserLambda(
    LambdaPayloadType.DELETE_STREAM_USER,
    lambdaName("NEXT_PUBLIC_GETSTREAM_LAMBDA"),
    { cognitoId: input.userId, name: input.name },
  );

  /* 4. The account row. Without this the user still exists everywhere else. */
  await raiseUserLambda(
    LambdaPayloadType.DELETE_ACCOUNT,
    lambdaName("NEXT_PUBLIC_USERS_LAMBDA"),
    { userId: input.userId },
  );
}
