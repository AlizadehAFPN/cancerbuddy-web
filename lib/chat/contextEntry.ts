import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";

/**
 * Starting a conversation *about* something — a private group, or a post.
 *
 * Three entry points produce these: asking a private group's host for the access
 * code, replying privately to a host about a post, and the ambassador intro.
 * Web had none of them, so a member could not reach a host at all: the Groups
 * tab never touched Chat.
 *
 * The prefilled sentences are mobile's literals verbatim
 * (`ChatMessagesInput.tsx:70-78`). They are what the recipient expects to see,
 * and rewording them would make the same request read differently depending on
 * which app the sender happened to use.
 */

export type ContextKind = "ReplyHost" | "AskToHost";

export interface PrefillInput {
  type: ContextKind;
  /** The group the message is about. */
  groupName?: string | null;
  /** The host's name — only used by `ReplyHost`. */
  hostName?: string | null;
}

export function chatPrefill(input: PrefillInput): string {
  if (input.type === "ReplyHost") {
    return `Hi ${input.hostName ?? ""}, related to your post on "${input.groupName ?? ""}", take a look at the responses.`;
  }
  return `Could you provide me with the access code to join the ${input.groupName ?? ""} private group?`;
}

/**
 * The opening line of an empty thread.
 *
 * A ReplyHost conversation drops the medical-advice caution: the host is
 * replying about their own post, and the longer sentence reads as a warning
 * aimed at them.
 */
export function emptyThreadCopy(type: ContextKind | null | undefined): string {
  return type === "ReplyHost"
    ? "This is the beginning of your conversation."
    : "This is the beginning of your conversation. For everyone's well-being, remember to leave medical advice to the experts.";
}

export interface ReplyHostPost {
  id?: string;
  feedId?: string;
  actor?: string;
  object?: string;
  time?: string;
}

/** The Stream attachment a ReplyHost message carries. */
export function buildReplyHostAttachment(post: ReplyHostPost): Record<string, unknown> {
  return { type: "ReplyHost", image_url: "", post: post ?? null };
}

/** The Stream attachment an AskToHost message carries. */
export function buildAskToHostAttachment(
  group: { id?: string; name?: string; description?: string } | null,
): Record<string, unknown> {
  return { type: "AskToHost", group: group ?? null };
}

function usersLambdaName(): string {
  const v = process.env.NEXT_PUBLIC_USERS_LAMBDA?.trim();
  if (!v) throw new Error("NEXT_PUBLIC_USERS_LAMBDA is not set.");
  return v;
}

/**
 * Tells the backend a host has been replied to, so the post's author is
 * notified. Fires only for `ReplyHost` — mobile does not send it for AskToHost.
 *
 * Best-effort: the message is already sent by the time this runs, so a failure
 * here must not surface as a send failure.
 */
export async function notifyReplyHost(params: {
  post: ReplyHostPost;
  channelId: string;
  senderId: string;
}): Promise<void> {
  try {
    await raiseUserLambda(LambdaPayloadType.REPLY_MESSAGE, usersLambdaName(), {
      type: LambdaPayloadType.REPLY_MESSAGE,
      groupId: params.post.feedId,
      feedId: params.post.feedId,
      activityId: params.channelId,
      remitentId: params.senderId,
      userId: params.post.actor,
    });
  } catch (err) {
    console.error("[chat] replyMessage notification failed:", err);
  }
}
