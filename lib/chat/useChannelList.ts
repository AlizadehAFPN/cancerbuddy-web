"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Channel, ChannelFilters, ChannelSort, Event } from "stream-chat";
import { channelSortTs } from "./helpers";
import { trackConnectWithFirstBuddy } from "@/lib/analytics";
import { useStreamChat } from "./StreamChatProvider";

const PAGE = 30;
// Stream caps offset-based pagination at 1000.
const MAX_OFFSET = 1000;

function eventCid(e: Event): string | undefined {
  return e.cid ?? e.channel?.cid;
}

/**
 * Live list of the current user's 1:1 messaging channels, newest first, loaded
 * lazily: the first page arrives fast, and `loadMore()` pulls subsequent pages
 * on demand (infinite scroll). Channels are watched, so their state stays
 * current; we re-sort on message events, merge new/moved channels from the top,
 * and drop removed ones — without disturbing already-loaded pages.
 */
export function useChannelList() {
  const { client, userId, status } = useStreamChat();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(false);
  const [, forceTick] = useState(0);
  const pagesLoadedRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const fetchPage = useCallback(
    async (offset: number): Promise<Channel[]> => {
      if (!client || !userId) return [];
      const filter: ChannelFilters = {
        type: "messaging",
        members: { $in: [userId] },
      };
      const sort: ChannelSort = [{ last_message_at: -1 }];
      return client.queryChannels(filter, sort, {
        limit: PAGE,
        offset,
        watch: true,
        state: true,
        message_limit: 1,
      });
    },
    [client, userId],
  );

  // Initial load / full refresh — resets to the first page.
  const reload = useCallback(async () => {
    const page = await fetchPage(0);
    const seen = new Set<string>();
    const out: Channel[] = [];
    for (const ch of page) {
      if (ch.cid && !seen.has(ch.cid)) {
        seen.add(ch.cid);
        out.push(ch);
      }
    }
    pagesLoadedRef.current = 1;
    setChannels(out);
    setHasMore(page.length === PAGE);

    /**
     * Mobile's `counterChatChannels` (`StreamProvider.tsx:99-116`) emits here —
     * the first load that returns any channel means this member has connected
     * with somebody. Latched once per account, so the later pages and every
     * subsequent reload cost nothing.
     */
    trackConnectWithFirstBuddy(
      out.map((ch) => ch.data?.created_at as string | undefined),
      userId,
    );
  }, [fetchPage, userId]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;
    const offset = pagesLoadedRef.current * PAGE;
    if (offset >= MAX_OFFSET) {
      setHasMore(false);
      return;
    }
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchPage(offset);
      pagesLoadedRef.current += 1;
      setChannels((prev) => {
        const seen = new Set(prev.map((c) => c.cid));
        const merged = [...prev];
        for (const ch of page) {
          if (ch.cid && !seen.has(ch.cid)) {
            seen.add(ch.cid);
            merged.push(ch);
          }
        }
        return merged;
      });
      setHasMore(page.length === PAGE && offset + PAGE < MAX_OFFSET);
    } catch {
      /* keep what we have; user can scroll again to retry */
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, fetchPage]);

  // Pull the first page and merge any new/moved channels in, leaving the loaded
  // pages intact (render re-sorts, so insertion order doesn't matter).
  const refreshTop = useCallback(async () => {
    try {
      const page = await fetchPage(0);
      setChannels((prev) => {
        const seen = new Set(prev.map((c) => c.cid));
        const fresh = page.filter((ch) => ch.cid && !seen.has(ch.cid));
        return fresh.length ? [...fresh, ...prev] : prev;
      });
    } catch {
      /* ignore */
    }
  }, [fetchPage]);

  useEffect(() => {
    if (!client || status !== "ready" || !userId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(false);
      try {
        await reload();
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const resort = () => forceTick((n) => n + 1);

    const handler = (event: Event) => {
      switch (event.type) {
        case "message.new":
        case "message.updated":
        case "message.deleted":
        case "message.read":
          resort();
          break;
        case "notification.added_to_channel":
        case "notification.message_new":
        case "channel.visible":
          refreshTop();
          break;
        case "notification.removed_from_channel":
        case "channel.deleted":
        case "channel.hidden": {
          const cid = eventCid(event);
          if (cid) setChannels((prev) => prev.filter((c) => c.cid !== cid));
          break;
        }
      }
    };

    client.on(handler);
    return () => {
      cancelled = true;
      client.off(handler);
    };
  }, [client, status, userId, reload, refreshTop]);

  // Newest message first — unread channels stay wherever their last message
  // falls (no unread-first reordering).
  const sorted = [...channels].sort((a, b) => channelSortTs(b) - channelSortTs(a));
  return {
    channels: sorted,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refetch: reload,
  };
}
