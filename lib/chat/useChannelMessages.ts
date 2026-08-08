"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Channel, Event } from "stream-chat";
import { t } from "@/lib/i18n";
import { trackMilestone, trackTimeToSendMessage } from "@/lib/analytics";
import { useStreamChat } from "./StreamChatProvider";
import { withRetry } from "./retry";
import {
  buildChatAttachment,
  compressChatImage,
  validateChatFile,
} from "./chatMedia";

export type MessageStatus = "sending" | "sent" | "failed";

/**
 * A group or post quoted into a conversation.
 *
 * `AskToHost` is sent when someone asks a private group's host for the code;
 * `ReplyHost` when a host replies privately about a post. Both used to be
 * dropped by `mapAttachments`, so the message arrived as a bare sentence — or,
 * when it had no text at all, was filtered out and shown as nothing.
 */
export interface UIContextAttachment {
  type: "askToHost" | "replyHost";
  group?: { id?: string; name?: string; description?: string };
  post?: { id?: string; feedId?: string; object?: string; time?: string };
}

export interface UIAttachment {
  type: "image" | "video" | "file";
  url: string;
  name?: string;
  mime?: string;
  /** Bytes, for the document card. Stream sends it as `file_size`. */
  size?: number;
  /** Intrinsic dimensions, so the thread can reserve space before load. */
  width?: number;
  height?: number;
}

export interface UIReaction {
  type: string;
  count: number;
  mine: boolean;
}

export interface UIMessage {
  id: string;
  text: string;
  /**
   * Server-authored body, when the message carries one.
   *
   * Support, ambassador and system messages arrive with an empty `text` and the
   * real content in `html`. The empty-body filter below dropped them outright, so
   * a member was shown nothing at all where mobile shows the message.
   */
  html?: string;
  userId: string;
  userName?: string;
  createdAt: string;
  mine: boolean;
  status: MessageStatus;
  attachments: UIAttachment[];
  /** Quoted group / post cards. Kept apart from media so each renders its own way. */
  context: UIContextAttachment[];
  edited: boolean;
  reactions: UIReaction[];
}

const PAGE = 30;

/** Intrinsic size of a picked image, for the attachment metadata. */
async function imageDimensions(
  file: File,
): Promise<{ width?: number; height?: number } | undefined> {
  if (typeof createImageBitmap !== "function") return undefined;
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return size;
  } catch {
    return undefined;
  }
}

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

type RawAttachment = {
  type?: string;
  image_url?: string;
  thumb_url?: string;
  asset_url?: string;
  title?: string;
  fallback?: string;
  mime_type?: string;
  file_size?: number;
  original_width?: number;
  original_height?: number;
  /** AskToHost / ReplyHost payloads. */
  group?: { id?: string; name?: string; description?: string };
  post?: { id?: string; feedId?: string; object?: string; time?: string };
};

type RawReaction = { type?: string };

/** Build reaction pills from Stream's `reaction_counts` + `own_reactions`. */
function mapReactions(
  counts: Record<string, number> | undefined,
  own: RawReaction[] | undefined,
): UIReaction[] {
  if (!counts) return [];
  const ownTypes = new Set((own ?? []).map((r) => r.type));
  return Object.entries(counts)
    .filter(([, c]) => c > 0)
    .map(([type, count]) => ({ type, count, mine: ownTypes.has(type) }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Map Stream attachments to the shapes we render.
 *
 * `video` used to fall through to the generic `asset_url` branch and render as a
 * download link, so a video someone sent could not be watched without leaving
 * the app. `file_size` and the original dimensions were dropped entirely — the
 * first is what a document card shows, the second is what stops the thread
 * jumping as each image loads.
 */
/**
 * The quoted group / post cards, kept separate from media.
 *
 * `value?.post || value?.type === 'ReplyHost'` is mobile's own test
 * (`ChatMessageRenderer.tsx:238`) — some ReplyHost payloads carry the post
 * without the type, so matching on the type alone loses them.
 */
export function mapContextAttachments(
  atts: RawAttachment[] | undefined,
): UIContextAttachment[] {
  if (!atts) return [];
  const out: UIContextAttachment[] = [];
  for (const a of atts) {
    if (a.type === "AskToHost") {
      out.push({ type: "askToHost", group: a.group });
    } else if (a.post || a.type === "ReplyHost") {
      out.push({ type: "replyHost", post: a.post });
    }
  }
  return out;
}

function mapAttachments(atts: RawAttachment[] | undefined): UIAttachment[] {
  if (!atts) return [];
  const out: UIAttachment[] = [];
  for (const a of atts) {
    // Handled by `mapContextAttachments`; they carry no media.
    if (a.type === "AskToHost" || a.type === "ReplyHost" || a.post) continue;

    const img = a.image_url || a.thumb_url;
    const isVideo = a.type === "video" || a.mime_type?.startsWith("video/");

    if (!isVideo && (a.type === "image" || img) && img) {
      out.push({
        type: "image",
        url: img,
        name: a.title || a.fallback,
        width: a.original_width,
        height: a.original_height,
      });
    } else if (a.asset_url) {
      out.push({
        type: isVideo ? "video" : "file",
        url: a.asset_url,
        name: a.title,
        mime: a.mime_type,
        size: a.file_size,
      });
    }
  }
  return out;
}

/**
 * Drives a single conversation: load + watch, merged message list (server +
 * optimistic), typing, read state, optimistic send/retry, attachments, edit,
 * delete, and older-message pagination.
 */
export function useChannelMessages(channelId: string | null) {
  const { client, userId, status } = useStreamChat();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [, forceTick] = useState(0);
  const [pending, setPending] = useState<UIMessage[]>([]);
  // Ids deleted in this session — filtered out immediately so the bubble
  // disappears on the first click, without waiting for the WS event round-trip.
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const [typing, setTyping] = useState<Record<string, string>>({});
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Frozen at open time — see the capture in the watch effect. */
  const [myLastReadAt, setMyLastReadAt] = useState(0);
  /** Bumped by `retryLoad`, which re-runs the watch effect. */
  const [loadAttempt, setLoadAttempt] = useState(0);

  const channelRef = useRef<Channel | null>(null);
  const rerender = useCallback(() => forceTick((n) => n + 1), []);

  useEffect(() => {
    if (!client || status !== "ready" || !channelId || !userId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    setPending([]);
    setDeletedIds(new Set());
    setTyping({});
    setHasMore(true);

    const ch = client.channel("messaging", channelId);
    channelRef.current = ch;

    (async () => {
      try {
        // A dropped connection is ordinary; treating the first failure as
        // terminal left the conversation stuck behind an error with no way back
        // except a full reload.
        await withRetry(() => ch.watch());
        if (cancelled) return;
        setChannel(ch);
        setHasMore((ch.state.messages?.length ?? 0) >= PAGE);

        /*
         * Captured *before* `markRead`, which is the only moment it is still
         * true. A separator computed after would always find nothing unread.
         */
        const mine = userId ? ch.state.read?.[userId] : undefined;
        const lastRead = (mine as { last_read?: Date | string } | undefined)?.last_read;
        setMyLastReadAt(lastRead ? new Date(lastRead as string).getTime() : 0);

        ch.markRead().catch(() => {});
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const onEvent = (event: Event) => {
      switch (event.type) {
        case "message.new":
          rerender();
          if (event.user?.id !== userId) ch.markRead().catch(() => {});
          break;
        case "message.updated":
        case "message.deleted":
        case "message.read":
          rerender();
          break;
        case "typing.start":
          if (event.user && event.user.id !== userId) {
            setTyping((t) => ({ ...t, [event.user!.id]: event.user!.name || "Someone" }));
          }
          break;
        case "typing.stop":
          if (event.user) {
            setTyping((t) => {
              const next = { ...t };
              delete next[event.user!.id];
              return next;
            });
          }
          break;
      }
    };

    ch.on(onEvent);
    return () => {
      cancelled = true;
      ch.off(onEvent);
    };
  }, [client, status, channelId, userId, rerender, loadAttempt]);

  /**
   * `context` attaches the group or post the conversation is about.
   *
   * Passed through to Stream as an attachment rather than folded into the text,
   * because the recipient's client renders it as a card with a jump button —
   * see `components/chat/ContextAttachment.tsx`.
   */
  const send = useCallback(
    async (raw: string, context?: Record<string, unknown>) => {
      const text = raw.trim();
      const ch = channelRef.current;
      if (!text || !ch || !userId) return;

      const id = `local-${crypto.randomUUID()}`;
      setPending((p) => [
        ...p,
        {
          id,
          text,
          userId,
          createdAt: new Date().toISOString(),
          mine: true,
          status: "sending",
          attachments: [],
          context: [],
          edited: false,
          reactions: [],
        },
      ]);
      ch.stopTyping().catch(() => {});

      try {
        await ch.sendMessage({
          id,
          text,
          ...(context ? { attachments: [context] } : {}),
        });
        setPending((p) => p.filter((m) => m.id !== id));

        /**
         * Both events mobile emits on send (`ChatMessagesInput.tsx:134-141`).
         * `chatWithFirstBuddy` is once per account and times the account's age;
         * `timeToSendMessage` fires on every send and carries a wall-clock
         * reading, which is mobile's shape — see `trackTimeToSendMessage`.
         *
         * After the send resolves, not before: mobile emits first and would
         * count a message that failed to leave the device.
         */
        trackMilestone("chatWithFirstBuddy", userId);
        trackTimeToSendMessage(userId);
      } catch {
        setPending((p) => p.map((m) => (m.id === id ? { ...m, status: "failed" } : m)));
      }
    },
    [userId],
  );

  const retry = useCallback(
    async (id: string) => {
      const ch = channelRef.current;
      const msg = pending.find((m) => m.id === id);
      if (!ch || !msg) return;
      setPending((p) => p.map((m) => (m.id === id ? { ...m, status: "sending" } : m)));
      try {
        await ch.sendMessage({ id, text: msg.text });
        setPending((p) => p.filter((m) => m.id !== id));
      } catch {
        setPending((p) => p.map((m) => (m.id === id ? { ...m, status: "failed" } : m)));
      }
    },
    [pending],
  );

  /**
   * Upload attachments and send them, optionally with text.
   *
   * Guarded against a double send: the picker can fire twice on a fast
   * double-click and a duplicate upload is both slow and visible in the thread.
   */
  const sendingFilesRef = useRef(false);
  const sendFiles = useCallback(async (files: File[], text?: string) => {
    const ch = channelRef.current;
    if (!ch || files.length === 0 || sendingFilesRef.current) return;

    for (const f of files) {
      const verdict = validateChatFile(f);
      if (!verdict.ok) {
        toast.error(verdict.message ?? t("app.chat.sendError"));
        return;
      }
    }

    sendingFilesRef.current = true;
    try {
      const attachments = await Promise.all(
        files.map(async (original) => {
          if (original.type.startsWith("image/")) {
            // Shrunk before upload, as mobile does: a 12 MP phone photo is slow
            // on a poor connection for no visible gain in a chat bubble.
            const f = await compressChatImage(original);
            const res = await ch.sendImage(f);
            const size = await imageDimensions(f).catch(() => undefined);
            return buildChatAttachment({ url: res.file, file: f, ...size });
          }
          const res = await ch.sendFile(original);
          return buildChatAttachment({ url: res.file, file: original });
        }),
      );
      await ch.sendMessage({ text: text?.trim() || "", attachments });
    } catch (err) {
      console.error("[chat] attachment send failed:", err);
      toast.error(t("app.chat.sendError"));
    } finally {
      sendingFilesRef.current = false;
    }
  }, []);

  const editMessage = useCallback(
    async (id: string, text: string) => {
      const t = text.trim();
      if (!client || !t) return;
      try {
        await client.updateMessage({ id, text: t });
        rerender();
      } catch {
        /* ignore */
      }
    },
    [client, rerender],
  );

  const deleteMessage = useCallback(
    async (id: string) => {
      if (!client) return;
      try {
        // `hard = true`. A soft delete leaves the row on Stream with a
        // `deleted_at`, which contradicts the confirmation copy both apps show
        // and means a member who "deleted" a message still has it stored.
        // Mobile hard-deletes too (`ChatMessageRenderer.tsx:116`), so a soft
        // delete on web also left the two clients with different server state.
        await client.deleteMessage(id, true);
        // Hide it right away; the WS `message.deleted` event also arrives but
        // may lag, so don't depend on it for the first render.
        setDeletedIds((s) => {
          const n = new Set(s);
          n.add(id);
          return n;
        });
        rerender();
      } catch {
        toast.error(t("app.chat.deleteError"));
      }
    },
    [client, rerender],
  );

  const loadMore = useCallback(async () => {
    const ch = channelRef.current;
    if (!ch || loadingMore || !hasMore) return;
    const oldest = ch.state.messages[0];
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const res = await ch.query({ messages: { limit: PAGE, id_lt: oldest.id } });
      setHasMore((res.messages?.length ?? 0) >= PAGE);
      rerender();
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, rerender]);

  const toggleReaction = useCallback(
    async (messageId: string, type: string) => {
      const ch = channelRef.current;
      if (!ch) return;
      const msg = ch.state.messages.find((m) => m.id === messageId);
      const hasOwn = ((msg?.own_reactions ?? []) as RawReaction[]).some(
        (r) => r.type === type,
      );
      try {
        if (hasOwn) {
          await ch.deleteReaction(messageId, type);
        } else {
          await ch.sendReaction(messageId, { type });
        }
        rerender();
      } catch {
        /* ignore */
      }
    },
    [rerender],
  );

  const onTyping = useCallback(() => {
    channelRef.current?.keystroke().catch(() => {});
  }, []);

  // Merge server + optimistic messages.
  const serverMessages = channel?.state.messages ?? [];
  const serverIds = new Set(serverMessages.map((m) => m.id));
  const ui: UIMessage[] = serverMessages
    .filter((m) => !m.deleted_at && !deletedIds.has(m.id))
    .map((m) => ({
      id: m.id,
      text: m.text ?? "",
      html: typeof (m as { html?: unknown }).html === "string"
        ? ((m as { html: string }).html)
        : undefined,
      userId: m.user?.id ?? "",
      userName: m.user?.name,
      createdAt: iso(m.created_at),
      mine: m.user?.id === userId,
      status: "sent" as MessageStatus,
      attachments: mapAttachments(m.attachments as RawAttachment[] | undefined),
      context: mapContextAttachments(m.attachments as RawAttachment[] | undefined),
      edited: !!(m as { message_text_updated_at?: unknown }).message_text_updated_at,
      reactions: mapReactions(
        m.reaction_counts as Record<string, number> | undefined,
        m.own_reactions as RawReaction[] | undefined,
      ),
    }))
    // A message with only `html` is not empty — see `UIMessage.html`.
    // A message carrying only a quoted group or post is not empty either — that
    // omission is why an "ask to host" with no text rendered as nothing at all.
    .filter(
      (m) =>
        m.text.length > 0 ||
        !!m.html?.trim() ||
        m.attachments.length > 0 ||
        m.context.length > 0,
    );
  for (const p of pending) {
    if (!serverIds.has(p.id)) ui.push(p);
  }
  ui.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let otherLastReadAt = 0;
  if (channel && userId) {
    for (const [uid, read] of Object.entries(channel.state.read ?? {})) {
      if (uid === userId) continue;
      const lr = (read as { last_read?: Date | string }).last_read;
      const t = lr ? new Date(lr as string).getTime() : 0;
      if (t > otherLastReadAt) otherLastReadAt = t;
    }
  }

  return {
    channel,
    messages: ui,
    loading,
    error,
    hasMore,
    loadingMore,
    frozen: channel?.data?.frozen === true,
    send,
    retry,
    sendFiles,
    editMessage,
    deleteMessage,
    toggleReaction,
    loadMore,
    onTyping,
    typingNames: Object.values(typing),
    otherLastReadAt,
    /** For the in-thread unread separator; see `lib/chat/unreadSeparator.ts`. */
    myLastReadAt,
    /** Re-runs the watch after the automatic retries were exhausted. */
    retryLoad: () => setLoadAttempt((n) => n + 1),
  };
}
