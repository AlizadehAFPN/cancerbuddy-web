"use client";

/**
 * Runs the discovery pipeline for a given filter state and exposes the result
 * as two ordered id lists.
 *
 * Only ids come back here — profiles are loaded per visible page by
 * `useBuddyProfiles`, which is what keeps a 5,000-person result set usable.
 * A run token guards against out-of-order responses: filters change faster
 * than these scans complete, and a stale run must never overwrite a newer one.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { getAudienceBase, invalidateAudienceBase } from "@/lib/buddies/audience";
import { fetchFilterFacets } from "@/lib/buddies/filterConditions";
import {
  resolveFilteredAudience,
  resolveUnfilteredAudience,
} from "@/lib/buddies/intersect";
import {
  hasAnyFilter,
  type ConnectionMap,
  type CurrentUserData,
  type DiscoverySections,
  type FilterValues,
} from "@/lib/buddies/types";

export interface DiscoveryResult {
  sections: DiscoverySections;
  total: number;
  loading: boolean;
  /** True while re-running with results already on screen (filter change). */
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
}

const EMPTY: DiscoverySections = { recommended: [], more: [] };

/**
 * The last completed run, at module scope so coming back from a profile page
 * lands on the list it was opened from rather than a page of skeletons. The
 * pipeline still re-runs on mount — this only fills the gap while it does, and
 * is keyed on the viewer plus the filters so it is never shown for a different
 * search.
 */
let lastRun: { key: string; sections: DiscoverySections } | null = null;

export function useDiscovery(params: {
  currentUser: CurrentUserData | null;
  connectionMap: ConnectionMap;
  connectionsLoaded: boolean;
  connectionsRevision: number;
  blockedUserIds: string[];
  filters: FilterValues;
}): DiscoveryResult {
  const {
    currentUser,
    connectionMap,
    connectionsLoaded,
    connectionsRevision,
    blockedUserIds,
    filters,
  } = params;

  // The pipeline depends on the *values* here, so serialise them to avoid
  // re-running on every parent render that hands us new object identities.
  const filtersKey = JSON.stringify(filters);
  const userKey = currentUser
    ? `${currentUser.id}|${currentUser.birth}|${currentUser.userType}|${[...currentUser.diagnosis].sort().join(",")}`
    : "";
  const runKey = `${userKey}|${filtersKey}`;

  // Only consulted on the first render — a later run for these same filters is
  // the pipeline itself, which writes straight to state.
  const seed = lastRun && lastRun.key === runKey ? lastRun.sections : null;

  const [sections, setSections] = useState<DiscoverySections>(seed ?? EMPTY);
  const [loading, setLoading] = useState(seed === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const runIdRef = useRef(0);
  const hasResultsRef = useRef(seed !== null);

  /**
   * Exclusions are read through a ref rather than the dependency list: the
   * connection map changes optimistically on every Connect click, and re-running
   * a full table scan each time would be both slow and visually jarring (the
   * card would vanish mid-interaction). The pipeline instead re-runs when the
   * map is genuinely re-read from the server — see `connectionsRevision`.
   */
  const exclusionsRef = useRef({ connectionMap, blockedUserIds });

  // Declared before the pipeline effect so the ref is current by the time it
  // runs in the same commit.
  useEffect(() => {
    exclusionsRef.current = { connectionMap, blockedUserIds };
  }, [connectionMap, blockedUserIds]);

  useEffect(() => {
    // Wait for both the profile and the connection map: running early would
    // briefly show people the user is already connected to.
    if (!currentUser || !connectionsLoaded) return;

    const runId = ++runIdRef.current;
    const isRefresh = hasResultsRef.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    (async () => {
      try {
        const parsedFilters: FilterValues = JSON.parse(filtersKey);
        const base = await getAudienceBase(currentUser);
        if (runId !== runIdRef.current) return;

        const exclusions = exclusionsRef.current;
        const context = {
          ageGuardedIds: base.ageGuardedIds,
          diagnosisPeerIds: base.diagnosisPeerIds,
          connectedUserIds: Object.keys(exclusions.connectionMap),
          blockedUserIds: exclusions.blockedUserIds,
          currentUserId: currentUser.id,
        };

        let next: DiscoverySections;
        if (hasAnyFilter(parsedFilters)) {
          const facets = await fetchFilterFacets(
            parsedFilters,
            currentUser.id,
            currentUser,
          );
          if (runId !== runIdRef.current) return;
          next = resolveFilteredAudience(facets, context);
        } else {
          next = resolveUnfilteredAudience(context);
        }

        if (runId !== runIdRef.current) return;
        setSections(next);
        lastRun = { key: runKey, sections: next };
        hasResultsRef.current = true;
      } catch (err) {
        console.error("[buddies] discovery failed:", err);
        if (runId !== runIdRef.current) return;
        setSections(EMPTY);
        setError(t("app.buddies.discoveryError"));
      } finally {
        if (runId === runIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey, filtersKey, connectionsLoaded, connectionsRevision, reloadToken]);

  const refresh = useCallback(() => {
    invalidateAudienceBase();
    lastRun = null;
    hasResultsRef.current = false;
    setReloadToken((n) => n + 1);
  }, []);

  return {
    sections,
    total: sections.recommended.length + sections.more.length,
    loading,
    refreshing,
    error,
    refresh,
  };
}
