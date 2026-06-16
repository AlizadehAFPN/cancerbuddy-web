"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Channel, Event } from "stream-chat";
import { useStreamChat } from "./StreamChatProvider";

export type MessageStatus = "sending" | "sent" | "failed";

export interface UIAttachment {
  type: "image" | "file";
  url: string;
  name?: string;
  mime?: string;
}

export interface UIReaction {
  type: string;
  count: number;
  mine: boolean;
}

export interface UIMessage {
  id: string;
  text: string;
  userId: string;
  userName?: string;
  createdAt: string;
  mine: boolean;
  status: MessageStatus;
  attachments: UIAttachment[];
  edited: boolean;
  reactions: UIReaction[];
}

const PAGE = 30;

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

/** Map Stream attachments to the image/file shapes we render (ignore app-specific ones). */
function mapAttachments(atts: RawAttachment[] | undefined): UIAttachment[] {
  if (!atts) return [];
  const out: UIAttachment[] = [];
  for (const a of atts) {
    const img = a.image_url || a.thumb_url;
    if ((a.type === "image" || img) && img) {
      out.push({ type: "image", url: img, name: a.title || a.fallback });
    } else if (a.asset_url) {
      out.push({ type: "file", url: a.asset_url, name: a.title, mime: a.mime_type });
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
  const [typing, setTyping] = useState<Record<string, string>>({});
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const channelRef = useRef<Channel | null>(null);
  const rerender = useCallback(() => forceTick((n) => n + 1), []);

  useEffect(() => {
    if (!client || status !== "ready" || !channelId || !userId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    setPending([]);
    setTyping({});
    setHasMore(true);

    const ch = client.channel("messaging", channelId);
    channelRef.current = ch;

    (async () => {
      try {
        await ch.watch();
        if (cancelled) return;
        setChannel(ch);
        setHasMore((ch.state.messages?.length ?? 0) >= PAGE);
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
  }, [client, status, channelId, userId, rerender]);

  const send = useCallback(
    async (raw: string) => {
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
          edited: false,
          reactions: [],
        },
      ]);
      ch.stopTyping().catch(() => {});

      try {
        await ch.sendMessage({ id, text });
        setPending((p) => p.filter((m) => m.id !== id));
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

  /** Upload image/file attachments and send them (optionally with text). */
  const sendFiles = useCallback(async (files: File[], text?: string) => {
    const ch = channelRef.current;
    if (!ch || files.length === 0) return;
    const attachments = await Promise.all(
      files.map(async (f) => {
        if (f.type.startsWith("image/")) {
          const res = await ch.sendImage(f);
          return { type: "image", image_url: res.file, fallback: f.name };
        }
        const res = await ch.sendFile(f);
        return { type: "file", asset_url: res.file, title: f.name, mime_type: f.type };
      }),
    );
    await ch.sendMessage({ text: text?.trim() || "", attachments });
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
        await client.deleteMessage(id);
        rerender();
      } catch {
        /* ignore */
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
    .filter((m) => !m.deleted_at)
    .map((m) => ({
      id: m.id,
      text: m.text ?? "",
      userId: m.user?.id ?? "",
      userName: m.user?.name,
      createdAt: iso(m.created_at),
      mine: m.user?.id === userId,
      status: "sent" as MessageStatus,
      attachments: mapAttachments(m.attachments as RawAttachment[] | undefined),
      edited: !!(m as { message_text_updated_at?: unknown }).message_text_updated_at,
      reactions: mapReactions(
        m.reaction_counts as Record<string, number> | undefined,
        m.own_reactions as RawReaction[] | undefined,
      ),
    }))
    .filter((m) => m.text.length > 0 || m.attachments.length > 0);
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
  };
}
