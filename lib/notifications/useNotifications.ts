"use client";

/**
 * Loading state for the Updates feed: first page, more pages, refresh.
 *
 * Mobile keeps this inline in `HomeNotifications` with five `useEffect`s that
 * feed each other; pulling it out here keeps the screen to rendering. The
 * behaviour is the same — a page of 20, more on scroll, pull-to-refresh — with
 * one thing deliberately not carried over: mobile fires the `readNotifications`
 * Lambda on every render where `notifications` changes. That Lambda writes to a
 * key the Notifications table doesn't have, so every call fails silently; the
 * web doesn't call it rather than pretending to. See `docs/UPDATES.md`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchNotifications,
  mergeNotifications,
  NOTIFICATIONS_PAGE_SIZE,
} from "@/lib/notifications/fetch";
import type { AppNotification } from "@/lib/notifications/types";

export interface NotificationsResult {
  items: AppNotification[];
  /** First load only — paging and refreshing have their own flags. */
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: string | null;
  hasMore: boolean;
  /**
   * When the rows on screen were read. Relative ages are measured against this
   * rather than the clock, so every row in a render agrees and a re-render for
   * an unrelated reason can't shift them.
   */
  fetchedAt: number;
  loadMore: () => void;
  refresh: () => Promise<void>;
  retry: () => void;
}

export function useNotifications(userId: string | null): NotificationsResult {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  /**
   * Mirrors `nextTokenRef` for rendering. The ref is what the fetches read —
   * it has to be current the instant a page lands — but a ref read during
   * render wouldn't re-render the "load more" sentinel when it changes, so the
   * rendered copy is state.
   */
  const [hasMore, setHasMore] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());

  const nextTokenRef = useRef<string | null>(null);

  const setNextToken = useCallback((token: string | null) => {
    nextTokenRef.current = token;
    setHasMore(token !== null);
  }, []);
  const mountedRef = useRef(true);
  /** Guards against a second page being requested while one is in flight. */
  const inflightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    // Going back to a loading state when the account or the retry counter
    // changes is the point of this effect; there is nothing to derive it from
    // during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setNextToken(null);

    fetchNotifications(userId, { limit: NOTIFICATIONS_PAGE_SIZE })
      .then((page) => {
        if (cancelled || !mountedRef.current) return;
        setItems(page.items);
        setNextToken(page.nextToken);
        setFetchedAt(Date.now());
      })
      .catch((err) => {
        console.error("[updates] failed to load notifications:", err);
        if (!cancelled && mountedRef.current) setError("load");
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, attempt, setNextToken]);

  const loadMore = useCallback(() => {
    if (!userId || inflightRef.current || !nextTokenRef.current) return;

    inflightRef.current = true;
    setLoadingMore(true);

    fetchNotifications(userId, {
      limit: NOTIFICATIONS_PAGE_SIZE,
      nextToken: nextTokenRef.current,
    })
      .then((page) => {
        if (!mountedRef.current) return;
        // Merged rather than appended: the index is live, so a notification
        // arriving between two pages shifts the window and can repeat a row.
        setItems((prev) => mergeNotifications(prev, page.items));
        setNextToken(page.nextToken);
        setFetchedAt(Date.now());
      })
      .catch((err) => {
        // A failed page is not a failed screen — what's loaded stays on
        // screen, and scrolling again retries.
        console.error("[updates] failed to load more notifications:", err);
      })
      .finally(() => {
        inflightRef.current = false;
        if (mountedRef.current) setLoadingMore(false);
      });
  }, [userId, setNextToken]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const page = await fetchNotifications(userId, {
        limit: NOTIFICATIONS_PAGE_SIZE,
      });
      if (!mountedRef.current) return;
      // Replaces rather than merges: a refresh is the user asking for the top
      // of the list, and keeping older pages under a fresh first page would
      // leave a gap wherever the feed moved on.
      setItems(page.items);
      setNextToken(page.nextToken);
      setFetchedAt(Date.now());
      setError(null);
    } catch (err) {
      console.error("[updates] refresh failed:", err);
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, [userId, setNextToken]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return {
    items,
    loading,
    loadingMore,
    refreshing,
    error,
    hasMore,
    fetchedAt,
    loadMore,
    refresh,
    retry,
  };
}
