"use client";

/**
 * Session-wide state for everything under /buddies.
 *
 * Three things are shared here because several screens read *and* write them:
 * the viewer's own profile (drives the age guard and match labels), the
 * connection map (decides Connect vs Pending vs Connected everywhere a person
 * appears), and the blocked list. Keeping them in one place is what lets an
 * action taken on the profile page show up immediately in the list behind it,
 * without a refetch.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  fetchBlockedUserIds,
  fetchConnectionMap,
} from "@/lib/buddies/connections";
import {
  fetchCurrentUserData,
  getSignedInUserId,
} from "@/lib/buddies/currentUser";
import { invalidateAudienceBase } from "@/lib/buddies/audience";
import {
  reduceConnectionEvent,
  subscribeToConnectionLiveness,
} from "@/lib/buddies/connectionLiveness";
import { useVisibilityResync } from "@/lib/hooks/useVisibilityResync";
import type {
  ConnectionEntry,
  ConnectionMap,
  CurrentUserData,
} from "@/lib/buddies/types";

export type BuddiesStatus = "loading" | "ready" | "error";

interface BuddiesContextValue {
  status: BuddiesStatus;
  userId: string | null;
  currentUser: CurrentUserData | null;
  connectionMap: ConnectionMap;
  /** False until the map has loaded — distinct from "no connections". */
  connectionsLoaded: boolean;
  /**
   * Bumped only when the map is re-read from the server, never by the
   * optimistic setters. Discovery keys off this so a single Connect click
   * doesn't trigger a full re-scan of the user table.
   */
  connectionsRevision: number;
  blockedUserIds: string[];
  /** Optimistic local updates so the UI reacts before the round trip lands. */
  setConnection: (userId: string, entry: ConnectionEntry) => void;
  clearConnection: (userId: string) => void;
  addBlockedUser: (userId: string) => void;
  refresh: () => Promise<void>;
  retry: () => void;
}

const BuddiesContext = createContext<BuddiesContextValue>({
  status: "loading",
  userId: null,
  currentUser: null,
  connectionMap: {},
  connectionsLoaded: false,
  connectionsRevision: 0,
  blockedUserIds: [],
  setConnection: () => {},
  clearConnection: () => {},
  addBlockedUser: () => {},
  refresh: async () => {},
  retry: () => {},
});

export function useBuddies(): BuddiesContextValue {
  return useContext(BuddiesContext);
}

export default function BuddiesProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<BuddiesStatus>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUserData | null>(null);
  const [connectionMap, setConnectionMap] = useState<ConnectionMap>({});
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);
  const [connectionsRevision, setConnectionsRevision] = useState(0);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadAll = useCallback(async () => {
    const id = await getSignedInUserId();
    if (!mounted.current) return;
    setUserId(id);

    const [user, map, blocked] = await Promise.all([
      fetchCurrentUserData(id),
      fetchConnectionMap(id),
      fetchBlockedUserIds(id),
    ]);
    if (!mounted.current) return;

    setCurrentUser(user);
    setConnectionMap(map);
    setBlockedUserIds(blocked);
    setConnectionsLoaded(true);
    setConnectionsRevision((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    (async () => {
      try {
        await loadAll();
        if (!cancelled && mounted.current) setStatus("ready");
      } catch (err) {
        console.error("[buddies] failed to load session data:", err);
        if (!cancelled && mounted.current) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadAll, attempt]);

  const refresh = useCallback(async () => {
    try {
      invalidateAudienceBase();
      await loadAll();
    } catch (err) {
      console.error("[buddies] refresh failed:", err);
    }
  }, [loadAll]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  /**
   * Live connection state. Web only subscribed to *new incoming* requests, so an
   * accept or a withdrawal by the other side never reached the screen — a
   * request they had already accepted still read "Pending" until a hard reload.
   *
   * Mounted here rather than per-screen because several surfaces read the same
   * map, and each opening its own pair of subscriptions would mean duplicate
   * websockets for one user.
   */
  useEffect(() => {
    if (!userId || status !== "ready") return;

    return subscribeToConnectionLiveness(userId, (event) => {
      if (!mounted.current) return;
      const next = reduceConnectionEvent(event);

      setConnectionMap((prev) => {
        if (next.status === null) {
          if (!(next.userId in prev)) return prev;
          const copy = { ...prev };
          delete copy[next.userId];
          return copy;
        }
        const existing = prev[next.userId];
        if (existing?.status === next.status) return prev;
        return {
          ...prev,
          [next.userId]: {
            status: next.status,
            connectionId: event.frame.id,
          },
        };
      });
      setConnectionsRevision((n) => n + 1);
    });
  }, [userId, status]);

  /**
   * Coming back to the tab re-reads the map. The subscriptions above cover the
   * time the tab was open; this covers the frames that were missed while it was
   * hidden, which is when a websocket is most likely to have been dropped.
   */
  useVisibilityResync(
    useCallback(() => {
      void refresh();
    }, [refresh]),
    { enabled: status === "ready" && !!userId },
  );

  const setConnection = useCallback((id: string, entry: ConnectionEntry) => {
    setConnectionMap((prev) => ({ ...prev, [id]: entry }));
  }, []);

  const clearConnection = useCallback((id: string) => {
    setConnectionMap((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const addBlockedUser = useCallback((id: string) => {
    setBlockedUserIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const value = useMemo<BuddiesContextValue>(
    () => ({
      status,
      userId,
      currentUser,
      connectionMap,
      connectionsLoaded,
      connectionsRevision,
      blockedUserIds,
      setConnection,
      clearConnection,
      addBlockedUser,
      refresh,
      retry,
    }),
    [
      status,
      userId,
      currentUser,
      connectionMap,
      connectionsLoaded,
      connectionsRevision,
      blockedUserIds,
      setConnection,
      clearConnection,
      addBlockedUser,
      refresh,
      retry,
    ],
  );

  return (
    <BuddiesContext.Provider value={value}>{children}</BuddiesContext.Provider>
  );
}
