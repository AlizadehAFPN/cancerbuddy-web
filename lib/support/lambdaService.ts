import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import { getSignedInUserId } from "@/lib/buddies/currentUser";
import { CATEGORY_WIRE_SUBJECT, type SupportTicketInput } from "./types";
import type { SupportService } from "./service";

function usersLambdaName(): string {
  const v = process.env.NEXT_PUBLIC_USERS_LAMBDA?.trim();
  if (!v) throw new Error("NEXT_PUBLIC_USERS_LAMBDA is not set.");
  return v;
}

/**
 * The Lambda takes `{subject, text, userId}` and nothing else
 * (`cancerbuddyapp/src/screens/drawer/comments/Comments.tsx:38-47`).
 *
 * Web's form collects two things it has no slot for — the user's own subject
 * line and a reply-to address — so they go into `text` rather than being
 * dropped. Whoever reads the email sees everything the sender typed.
 */
function composeText(input: SupportTicketInput, userId: string | null): string {
  const parts = [input.message.trim()];

  const subjectLine = input.subject.trim();
  if (subjectLine) parts.unshift(`Subject: ${subjectLine}`);

  const email = input.email.trim();
  if (email) parts.push(`Reply to: ${email}`);
  if (!userId) parts.push("Sent from the web app while signed out.");

  return parts.join("\n\n");
}

/**
 * Submits a support message through `USERS_LAMBDA`, the way mobile does.
 *
 * `/support` is reachable signed out, and that works: the Cognito identity pool
 * hands out unauthenticated credentials that already carry invoke rights on this
 * Lambda — the same path the in-registration help dialog uses. `userId` is
 * therefore best-effort, and its absence is recorded in the body rather than
 * blocking the send.
 */
export const lambdaSupportService: SupportService = {
  async submitTicket(input) {
    const userId = await getSignedInUserId().catch(() => null);

    await raiseUserLambda(LambdaPayloadType.COMMENTS, usersLambdaName(), {
      subject: CATEGORY_WIRE_SUBJECT[input.category],
      text: composeText(input, userId),
      userId: userId ?? "",
    });

    return { receivedAt: new Date().toISOString() };
  },
};

export const __testing = { composeText };
