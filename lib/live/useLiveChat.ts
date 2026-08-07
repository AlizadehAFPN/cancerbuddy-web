"use client";

/**
 * Live chat, and the moderation signals that ride the same channel.
 *
 * The session's Stream channel (`livestream` / `live-<eventId>`) carries two
 * kinds of message. Ordinary ones are chat. Ones with `moderation_action` +
 * `target_user_id` are the host's moderation reaching the target's own client:
 * the Lambda enforces removal server-side, but only the target's browser can
 * drop its own microphone and show the notice. They are never rendered as chat.
 *
 * Three de-duplications, ported from `useTwilioRoom.ts`, exist because Stream
 * re-delivers `message.new` on reconnects and retries:
 *  • a seen-ids set, so one signal acts once;
 *  • a per action+target throttle on the *notice*, so a burst doesn't stack
 *    banners;
 *  • a terminal latch, so "removed" or "blocked" can only fire once.
 * Without them a flaky connection shows the same "you were muted" three times.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Channel, Event, StreamChat } from "stream-chat";
import { t } from "@/lib/i18n";
import type { LiveChatMessage, ModerationAction } from "@/lib/live/types";

const MODERATION_NOTICE_THROTTLE_MS = 8_000;

export interface ModerationNotice {
  action: ModerationAction;
  title: string;
  body: string;
  /** Removal and blocking end the session for this user. */
  terminal: boolean;
}

interface UseLiveChatParams {
  client: StreamChat | null;
  channelId: string;
  userId: string | null;
  userName: string | null;
  /** From the token Lambda — decides which bubbles are badged "Host". */
  hostIds: string[];
  isHost: boolean;
  onModeration: (notice: ModerationNotice) => void;
  /** Another participant was removed or blocked; drop their tile. */
  onParticipantRemoved: (targetUserId: string) => void;
}

export interface LiveChatController {
  messages: LiveChatMessage[];
  ready: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
  retry: (messageId: string) => Promise<void>;
  /** Messages that arrived while the panel was closed. */
  unread: number;
  markRead: () => void;
}

type RawMessage = Record<string, unknown> & {
  id?: string;
  text?: string;
  user?: { id?: string; name?: string };
  created_at?: string | Date;
};

/**
 * Prefer the role stored on the message: it survives a reload and a host
 * stepping down, whereas `hostIds` is only this session's snapshot.
 */
function messageIsHost(message: RawMessage, hostIds: string[]): boolean {
  if (typeof message.isHost === "boolean") return message.isHost;
  if (typeof message.is_host === "boolean") return message.is_host;
  return hostIds.includes(message.user?.id ?? "");
}

function toChatMessage(
  message: RawMessage,
  hostIds: string[],
  currentUserId: string | null,
): LiveChatMessage {
  const authorId = message.user?.id ?? "";
  return {
    id: String(message.id ?? ""),
    sender: message.user?.name || authorId || t("app.live.unknownMember"),
    text: typeof message.text === "string" ? message.text : "",
    timestamp: new Date(message.created_at ?? Date.now()).getTime(),
    isHost: messageIsHost(message, hostIds),
    isMine: Boolean(currentUserId) && authorId === currentUserId,
  };
}

function isModerationSignal(message: RawMessage): boolean {
  return Boolean(message.moderation_action && message.target_user_id);
}

function noticeFor(action: ModerationAction): ModerationNotice | null {
  switch (action) {
    case "mute_audio":
      return {
        action,
        title: t("app.live.mutedTitle"),
        body: t("app.live.mutedBody"),
        terminal: false,
      };
    case "mute_video":
      return {
        action,
        title: t("app.live.cameraOffTitle"),
        body: t("app.live.cameraOffBody"),
        terminal: false,
      };
    case "remove":
      return {
        action,
        title: t("app.live.removedTitle"),
        body: t("app.live.removedBody"),
        terminal: true,
      };
    case "block":
      return {
        action,
        title: t("app.live.blockedTitle"),
        body: t("app.live.blockedBody"),
        terminal: true,
      };
    default:
      return null;
  }
}

export function useLiveChat(params: UseLiveChatParams): LiveChatController {
  const {
    client,
    channelId,
    userId,
    userName,
    hostIds,
    isHost,
    onModeration,
    onParticipantRemoved,
  } = params;

  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  const channelRef = useRef<Channel | null>(null);
  const seenSignalsRef = useRef<Set<string>>(new Set());
  const lastNoticeAtRef = useRef<Map<string, number>>(new Map());
  const terminalHandledRef = useRef(false);

  /* Handlers and role data change on every render; the Stream listener is
     registered once, so it reads them through refs. Updated in an effect
     rather than during render — every reader runs after commit (a websocket
     event or a click), so post-commit is soon enough. */
  const hostIdsRef = useRef(hostIds);
  const isHostRef = useRef(isHost);
  const userIdRef = useRef(userId);
  const onModerationRef = useRef(onModeration);
  const onParticipantRemovedRef = useRef(onParticipantRemoved);

  useEffect(() => {
    hostIdsRef.current = hostIds;
    isHostRef.current = isHost;
    userIdRef.current = userId;
    onModerationRef.current = onModeration;
    onParticipantRemovedRef.current = onParticipantRemoved;
  }, [hostIds, isHost, userId, onModeration, onParticipantRemoved]);

  /**
   * Host roles arrive from the token Lambda *after* history may already have
   * rendered, so re-label the existing bubbles once they land rather than
   * leaving the first screenful mis-attributed.
   */
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || hostIds.length === 0) return;
    setMessages((prev) =>
      prev.map((message) => {
        const raw = channel.state.messages.find(
          (m) => String(m.id) === message.id,
        ) as RawMessage | undefined;
        if (!raw) return message;
        const nextIsHost = messageIsHost(raw, hostIds);
        return nextIsHost === message.isHost
          ? message
          : { ...message, isHost: nextIsHost };
      }),
    );
  }, [hostIds]);

  const handleModerationSignal = useCallback((raw: RawMessage) => {
    const action = String(raw.moderation_action) as ModerationAction;
    const targetId = String(raw.target_user_id);

    /* Everyone drops a removed participant's tile, not just the target. */
    if (action === "remove" || action === "block") {
      onParticipantRemovedRef.current(targetId);
    }

    if (targetId !== userIdRef.current) return;
    if ((action === "remove" || action === "block") && terminalHandledRef.current) {
      return;
    }

    const messageId = typeof raw.id === "string" ? raw.id : "";
    if (messageId) {
      if (seenSignalsRef.current.has(messageId)) return;
      seenSignalsRef.current.add(messageId);
    }

    const notice = noticeFor(action);
    if (!notice) return;

    if (notice.terminal) {
      terminalHandledRef.current = true;
      onModerationRef.current(notice);
      return;
    }

    const key = `${action}:${targetId}`;
    const now = Date.now();
    const last = lastNoticeAtRef.current.get(key) ?? 0;
    if (now - last < MODERATION_NOTICE_THROTTLE_MS) return;
    lastNoticeAtRef.current.set(key, now);
    onModerationRef.current(notice);
  }, []);

  /* ── Channel lifecycle ─────────────────────────────────────────────────── */

  useEffect(() => {
    if (!client || !channelId) return;
    let cancelled = false;

    const channel = client.channel("livestream", channelId);

    const onNewMessage = (event: Event) => {
      const raw = event.message as RawMessage | undefined;
      if (!raw) return;

      if (isModerationSignal(raw)) {
        handleModerationSignal(raw);
        return;
      }

      /* Our own messages are already on screen optimistically. */
      if (raw.user?.id && raw.user.id === userIdRef.current) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === String(raw.id))) return prev;
        return [...prev, toChatMessage(raw, hostIdsRef.current, userIdRef.current)];
      });
      setUnread((n) => n + 1);
    };

    (async () => {
      try {
        await channel.watch();
        if (cancelled) return;
        channelRef.current = channel;

        const history = (channel.state.messages as unknown as RawMessage[])
          .filter((m) => !isModerationSignal(m))
          .map((m) => toChatMessage(m, hostIdsRef.current, userIdRef.current));
        setMessages(history);
        setReady(true);
        setError(null);
      } catch (err) {
        console.error("[live] chat channel watch failed:", err);
        if (!cancelled) setError(t("app.live.chatUnavailable"));
      }
    })();

    channel.on("message.new", onNewMessage);

    return () => {
      cancelled = true;
      channel.off("message.new", onNewMessage);
      channelRef.current = null;
      void channel.stopWatching().catch(() => {});
    };
  }, [client, channelId, handleModerationSignal]);

  /* ── Sending ───────────────────────────────────────────────────────────── */

  const deliver = useCallback(
    async (localId: string, text: string) => {
      const channel = channelRef.current;
      if (!channel) {
        setMessages((prev) =>
          prev.map((m) => (m.id === localId ? { ...m, failed: true } : m)),
        );
        return;
      }
      try {
        await channel.sendMessage({
          text,
          isHost: isHostRef.current,
        } as Parameters<Channel["sendMessage"]>[0]);
        setMessages((prev) =>
          prev.map((m) => (m.id === localId ? { ...m, failed: false } : m)),
        );
      } catch (err) {
        console.error("[live] chat send failed:", err);
        setMessages((prev) =>
          prev.map((m) => (m.id === localId ? { ...m, failed: true } : m)),
        );
      }
    },
    [],
  );

  /**
   * Optimistic, like mobile — the bubble appears before the round trip. Unlike
   * mobile a failure is visible and retryable, rather than a message that looks
   * sent but never arrived.
   */
  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setMessages((prev) => [
        ...prev,
        {
          id: localId,
          sender: userName || t("app.live.you"),
          text: trimmed,
          timestamp: Date.now(),
          isHost: isHostRef.current,
          isMine: true,
        },
      ]);
      await deliver(localId, trimmed);
    },
    [deliver, userName],
  );

  const retry = useCallback(
    async (messageId: string) => {
      const message = messages.find((m) => m.id === messageId);
      if (!message) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, failed: false } : m)),
      );
      await deliver(messageId, message.text);
    },
    [messages, deliver],
  );

  const markRead = useCallback(() => setUnread(0), []);

  return { messages, ready, error, send, retry, unread, markRead };
}
