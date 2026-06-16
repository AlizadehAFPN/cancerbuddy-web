"use client";

import { useCallback, useEffect, useState } from "react";
import type { Channel, ChannelFilters, ChannelSort, Event } from "stream-chat";
import { useStreamChat } from "./StreamChatProvider";

const PAGE = 30;

function lastTs(ch: Channel): number {
  const v = ch.state?.last_message_at;
  if (!v) return 0;
  return v instanceof Date ? v.getTime() : new Date(v as string).getTime();
}

/**
 * Live list of the current user's 1:1 messaging channels, newest first.
 *
 * Channels are watched, so their state stays current automatically; we just
 * re-sort on message events and re-query on structural events (added to /
 * removed from a channel, deletes). Counts (≤30 channels) make per-render
 * sorting cheap.
 */
export function useChannelList() {
  const { client, userId, status } = useStreamChat();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [, forceTick] = useState(0);

  const query = useCallback(async () => {
    if (!client || !userId) return;
    const filter: ChannelFilters = {
      type: "messaging",
      members: { $in: [userId] },
    };
    const sort: ChannelSort = [{ last_message_at: -1 }];
    const result = await client.queryChannels(filter, sort, {
      limit: PAGE,
      watch: true,
      state: true,
      message_limit: 1,
    });
    setChannels(result);
  }, [client, userId]);

  useEffect(() => {
    if (!client || status !== "ready" || !userId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(false);
      try {
        await query();
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const resort = () => forceTick((n) => n + 1);
    const restructure = () => {
      query().catch(() => {});
    };

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
        case "notification.removed_from_channel":
        case "channel.deleted":
        case "channel.hidden":
        case "channel.visible":
          restructure();
          break;
      }
    };

    client.on(handler);
    return () => {
      cancelled = true;
      client.off(handler);
    };
  }, [client, status, userId, query]);

  const sorted = [...channels].sort((a, b) => lastTs(b) - lastTs(a));
  return { channels: sorted, loading, error, refetch: query };
}
