"use client";

/**
 * "Reply privately" — a host or SUPPORT account messaging a member about
 * something they posted.
 *
 * It is the only route mobile gives a host for reaching a member one-to-one, and
 * web had none of it: the Groups tab never opened a chat at all. Shared by the
 * post's ⋯ menu and a comment's, because both offer the row and neither should
 * own the ladder.
 *
 * What happens on a tap:
 *
 *   1. find (or create) the pair's 1:1 channel — `lib/chat/directChannel.ts`
 *   2. land on `/chat/<id>` with the ReplyHost context in the query string, so
 *      the composer opens pre-filled and the first message carries the post
 *
 * Mobile attaches a **screenshot** of the post taken with `react-native-view-shot`
 * (`usePostActions.ts:139`). Web attaches the post itself instead: Phase 2's
 * `ContextAttachment` renders it as a card with a jump link, which is the thing
 * the screenshot was standing in for and stays readable when the post is edited.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { t } from "@/lib/i18n";
import {
  askToHostChannelName,
  replyPrivatelyChannelName,
  resolveOrCreateDirectChannel,
  type DirectChatClient,
} from "@/lib/chat/directChannel";
import { acceptConnection, createConnectionRequest } from "@/lib/buddies/connections";
import { useStreamChat } from "@/lib/chat/StreamChatProvider";

export interface ReplyPrivatelyTarget {
  /** The member being messaged — the post's or comment's author. */
  authorId: string;
  authorName?: string | null;
  /** The group the content is in, for the pre-filled sentence. */
  groupName?: string | null;
  /**
   * The **post** to attach. For a comment or a reply this is still the parent
   * post: mobile attaches the reaction itself, whose id resolves to nothing when
   * the recipient taps through, so web quotes the post that actually opens.
   */
  post: { id: string; feedId: string; actorId: string };
}

export interface AskToHostTarget {
  hostId: string;
  groupId: string;
  groupName?: string | null;
}

/** Shared plumbing: resolve the channel, then navigate with context attached. */
function useDirectChannelNavigation() {
  const router = useRouter();
  const { client, userId } = useStreamChat();
  const [busy, setBusy] = useState(false);

  const go = useCallback(
    async (input: {
      them: string;
      channelName: string;
      query: Record<string, string | null | undefined>;
      errorMessage: string;
    }) => {
      if (!client || !userId || busy) return;
      setBusy(true);
      try {
        const channelId = await resolveOrCreateDirectChannel({
          client: client as unknown as DirectChatClient,
          me: userId,
          them: input.them,
          name: input.channelName,
          createConnection: createConnectionRequest,
          acceptConnection,
        });
        if (!channelId) {
          toast.error(input.errorMessage);
          return;
        }

        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(input.query)) {
          if (value) params.set(key, value);
        }
        router.push(`/chat/${channelId}?${params.toString()}`);
      } catch (err) {
        console.error("[groups] direct message failed:", err);
        toast.error(input.errorMessage);
      } finally {
        setBusy(false);
      }
    },
    [client, userId, busy, router],
  );

  return { go, busy, ready: !!client && !!userId };
}

export function useReplyPrivately(): {
  busy: boolean;
  ready: boolean;
  replyPrivately: (target: ReplyPrivatelyTarget) => Promise<void>;
} {
  const { go, busy, ready } = useDirectChannelNavigation();

  const replyPrivately = useCallback(
    (target: ReplyPrivatelyTarget) =>
      go({
        them: target.authorId,
        channelName: replyPrivatelyChannelName(target.authorName),
        query: {
          ctx: "ReplyHost",
          // The prefilled sentence reads "Hi <name>, related to your post on
          // <group>…", so the name is the *recipient's* — mobile passes the post
          // author's here too, under the name `namePrivatly`.
          hostName: target.authorName ?? "",
          groupName: target.groupName ?? "",
          postId: target.post.id,
          feedId: target.post.feedId,
          postActor: target.post.actorId,
        },
        errorMessage: t("app.groups.replyPrivatelyError"),
      }),
    [go],
  );

  return { busy, ready, replyPrivately };
}

/**
 * "Ask the host" from a private group's code gate — the other side of the same
 * primitive, and the only way into a private group for someone who was never
 * given a code.
 */
export function useAskTheHost(myName: string | null | undefined): {
  busy: boolean;
  ready: boolean;
  askTheHost: (target: AskToHostTarget) => Promise<void>;
} {
  const { go, busy, ready } = useDirectChannelNavigation();

  const askTheHost = useCallback(
    (target: AskToHostTarget) =>
      go({
        them: target.hostId,
        channelName: askToHostChannelName(myName),
        query: {
          ctx: "AskToHost",
          groupId: target.groupId,
          groupName: target.groupName ?? "",
        },
        errorMessage: t("app.groups.askTheHostError"),
      }),
    [go, myName],
  );

  return { busy, ready, askTheHost };
}
