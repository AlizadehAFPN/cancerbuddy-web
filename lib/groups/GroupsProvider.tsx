"use client";

/**
 * Session state for everything under /groups.
 *
 * Holds the three things every screen in the tab reads: the user's joined
 * groups (with mute state and the membership row id needed to leave), which
 * groups are live right now, and the lazily-created GetStream feed session.
 *
 * The feed session is deliberately lazy — browsing and reading posts don't need
 * it, so a user who never posts never pays for the token round trip, and a
 * missing-credentials failure can't blank the whole tab.
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
import { API, graphqlOperation } from "aws-amplify";
import { getSignedInUserId } from "@/lib/buddies/currentUser";
import { fetchSignedInFirstName } from "@/lib/aws/sessionAttributes";
import {
  clearFeedSession,
  getFeedSession,
  type FeedSession,
} from "@/lib/groups/feedClient";
import { fetchJoinedGroups, fetchLiveGroups } from "@/lib/groups/groupQueries";
import type { Group, LiveGroup } from "@/lib/groups/types";

const ON_LIVE_GROUPS = /* GraphQL */ `
  subscription LiveGroups {
    onCreateLiveStreamingGroupCustom {
      id
      groupId
      inLive
    }
  }
`;

export type GroupsStatus = "loading" | "ready" | "error";

interface GroupsContextValue {
  status: GroupsStatus;
  userId: string | null;
  joinedGroups: Group[];
  /** Fast membership test without scanning the array. */
  isMember: (groupId: string) => boolean;
  liveGroupIds: Set<string>;
  /**
   * The live session id for a group that is broadcasting, or null. That id is
   * what `/live/[eventId]` needs — the same `liveEvent.id` mobile passes to its
   * Twilio room.
   */
  liveEventIdFor: (groupId: string) => string | null;
  /** Resolves (and caches) the Stream feed session; throws if unavailable. */
  requireFeedSession: () => Promise<FeedSession>;
  refreshGroups: () => Promise<void>;
  /** Local membership updates so the UI reacts before a refetch lands. */
  addJoinedGroup: (group: Group) => void;
  removeJoinedGroup: (groupId: string) => void;
  setGroupMutedLocal: (groupId: string, muted: boolean) => void;
  retry: () => void;
}

const GroupsContext = createContext<GroupsContextValue>({
  status: "loading",
  userId: null,
  joinedGroups: [],
  isMember: () => false,
  liveGroupIds: new Set(),
  liveEventIdFor: () => null,
  requireFeedSession: () => Promise.reject(new Error("Groups are not ready.")),
  refreshGroups: async () => {},
  addJoinedGroup: () => {},
  removeJoinedGroup: () => {},
  setGroupMutedLocal: () => {},
  retry: () => {},
});

export function useGroups(): GroupsContextValue {
  return useContext(GroupsContext);
}

export default function GroupsProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GroupsStatus>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [joinedGroups, setJoinedGroups] = useState<Group[]>([]);
  const [liveGroups, setLiveGroups] = useState<LiveGroup[]>([]);
  const [attempt, setAttempt] = useState(0);

  const mountedRef = useRef(true);
  const userNameRef = useRef<string>("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const id = await getSignedInUserId();
    if (!mountedRef.current) return;
    setUserId(id);
    userNameRef.current = (await fetchSignedInFirstName()) ?? "";

    const [groups, live] = await Promise.all([
      fetchJoinedGroups(id),
      fetchLiveGroups(),
    ]);
    if (!mountedRef.current) return;

    setJoinedGroups(groups);
    setLiveGroups(live);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    (async () => {
      try {
        await load();
        if (!cancelled && mountedRef.current) setStatus("ready");
      } catch (err) {
        console.error("[groups] failed to load:", err);
        if (!cancelled && mountedRef.current) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [load, attempt]);

  // Live sessions start and stop while the tab is open, so the badges follow a
  // subscription rather than a poll.
  useEffect(() => {
    if (status !== "ready") return;

    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const observable = API.graphql(graphqlOperation(ON_LIVE_GROUPS)) as {
        subscribe: (handlers: {
          next: () => void;
          error: (e: unknown) => void;
        }) => { unsubscribe: () => void };
      };
      subscription = observable.subscribe({
        next: () => {
          fetchLiveGroups()
            .then((live) => {
              if (mountedRef.current) setLiveGroups(live);
            })
            .catch(() => {});
        },
        error: () => {
          /* the badges just stop updating until the next load */
        },
      });
    } catch (err) {
      console.error("[groups] live subscription failed:", err);
    }

    return () => subscription?.unsubscribe();
  }, [status]);

  const refreshGroups = useCallback(async () => {
    try {
      if (!userId) return;
      const groups = await fetchJoinedGroups(userId);
      if (mountedRef.current) setJoinedGroups(groups);
    } catch (err) {
      console.error("[groups] refresh failed:", err);
    }
  }, [userId]);

  const requireFeedSession = useCallback(async () => {
    if (!userId) throw new Error("You need to be signed in.");
    return getFeedSession(userId, userNameRef.current);
  }, [userId]);

  const addJoinedGroup = useCallback((group: Group) => {
    setJoinedGroups((prev) =>
      prev.some((g) => g.id === group.id) ? prev : [...prev, group],
    );
  }, []);

  const removeJoinedGroup = useCallback((groupId: string) => {
    setJoinedGroups((prev) => prev.filter((g) => g.id !== groupId));
  }, []);

  const setGroupMutedLocal = useCallback((groupId: string, muted: boolean) => {
    setJoinedGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, muted } : g)),
    );
  }, []);

  const retry = useCallback(() => {
    clearFeedSession();
    setAttempt((n) => n + 1);
  }, []);

  const memberIds = useMemo(
    () => new Set(joinedGroups.map((g) => g.id)),
    [joinedGroups],
  );

  const liveGroupIds = useMemo(
    () => new Set(liveGroups.filter((g) => g.groupId).map((g) => g.groupId)),
    [liveGroups],
  );

  const liveEventByGroup = useMemo(() => {
    const map = new Map<string, string>();
    for (const live of liveGroups) {
      if (live.groupId && live.id && !map.has(live.groupId)) {
        map.set(live.groupId, live.id);
      }
    }
    return map;
  }, [liveGroups]);

  const isMember = useCallback(
    (groupId: string) => memberIds.has(groupId),
    [memberIds],
  );

  const liveEventIdFor = useCallback(
    (groupId: string) => liveEventByGroup.get(groupId) ?? null,
    [liveEventByGroup],
  );

  const value = useMemo<GroupsContextValue>(
    () => ({
      status,
      userId,
      joinedGroups,
      isMember,
      liveGroupIds,
      liveEventIdFor,
      requireFeedSession,
      refreshGroups,
      addJoinedGroup,
      removeJoinedGroup,
      setGroupMutedLocal,
      retry,
    }),
    [
      status,
      userId,
      joinedGroups,
      isMember,
      liveGroupIds,
      liveEventIdFor,
      requireFeedSession,
      refreshGroups,
      addJoinedGroup,
      removeJoinedGroup,
      setGroupMutedLocal,
      retry,
    ],
  );

  return <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>;
}
