"use client";

import { useCallback, useEffect, useState } from "react";
import type { Channel, ChannelFilters, ChannelSort, Event } from "stream-chat";
import { useStreamChat } from "./StreamChatProvider";

const PAGE = 30;
const MAX_OFFSET = 1000;

/**
 * All of the current user's UNREAD 1:1 conversations, loaded only while the
 * "unread" filter is enabled. Walks every channel page and keeps the ones with
 * an unread count — server-side unread sorting isn't reliable, so we scan the
 * full list and filter client-side. Re-runs on read/new-message events so the
 * list stays accurate.
 */
export function useUnreadChannels(enabled: boolean) {
  const { client, userId, status } = useStreamChat();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!client || !userId) return;
    const filter: ChannelFilters = {
      type: "messaging",
      members: { $in: [userId] },
    };
    const sort: ChannelSort = [{ last_message_at: -1 }];

    const out: Channel[] = [];
    const seen = new Set<string>();
    let offset = 0;
    while (offset < MAX_OFFSET) {
      const page = await client.queryChannels(filter, sort, {
        limit: PAGE,
        offset,
        // No watch: we scan every channel here, so watching them all could hit
        // Stream's watch limits. `state: true` still loads read state, so
        // countUnread() is accurate; live changes come via the event reload.
        watch: false,
        state: true,
        message_limit: 1,
      });
      for (const ch of page) {
        if (ch.countUnread() > 0 && ch.cid && !seen.has(ch.cid)) {
          seen.add(ch.cid);
          out.push(ch);
        }
      }
      if (page.length < PAGE) break;
      offset += PAGE;
    }
    setChannels(out);
  }, [client, userId]);

  useEffect(() => {
    if (!enabled || !client || status !== "ready" || !userId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(false);
      try {
        await load();
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => load().catch(() => {}), 400);
    };

    const handler = (event: Event) => {
      switch (event.type) {
        case "message.new":
        case "message.read":
        case "notification.message_new":
        case "notification.mark_read":
          debouncedReload();
          break;
      }
    };

    client.on(handler);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      client.off(handler);
    };
  }, [enabled, client, status, userId, load]);

  return { channels, loading, error };
}
