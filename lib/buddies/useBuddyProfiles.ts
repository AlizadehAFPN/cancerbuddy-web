"use client";

/**
 * Loads the profiles for whichever ids are currently on screen.
 *
 * The discovery list can be thousands of ids long; this hook is what makes that
 * cheap — the grid tells it which slice is visible (plus a look-ahead margin)
 * and only those get fetched, in batches, once each. Everything is read through
 * the module-level cache in `profiles.ts`, so scrolling back up is free and two
 * components asking for the same person share one request.
 */

import { useEffect, useRef, useState } from "react";
import {
  getCachedProfile,
  isKnownMissingProfile,
  loadProfiles,
} from "@/lib/buddies/profiles";
import type { BuddyProfile } from "@/lib/buddies/types";

export interface BuddyProfilesResult {
  get: (id: string) => BuddyProfile | undefined;
  /** True once we know the id has no row — the card should disappear. */
  isMissing: (id: string) => boolean;
  loading: boolean;
}

export function useBuddyProfiles(ids: string[]): BuddyProfilesResult {
  const [, bump] = useState(0);
  const [loading, setLoading] = useState(false);
  const requestedRef = useRef(new Set<string>());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const key = ids.join(",");

  useEffect(() => {
    const pending = ids.filter(
      (id) =>
        id &&
        !requestedRef.current.has(id) &&
        !getCachedProfile(id) &&
        !isKnownMissingProfile(id),
    );
    if (pending.length === 0) return;

    for (const id of pending) requestedRef.current.add(id);
    setLoading(true);

    loadProfiles(pending)
      .catch(() => {
        // A failed batch shouldn't be remembered as "already requested",
        // otherwise those cards stay skeletons forever.
        for (const id of pending) requestedRef.current.delete(id);
      })
      .finally(() => {
        if (!mountedRef.current) return;
        setLoading(false);
        bump((n) => n + 1);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    get: getCachedProfile,
    isMissing: isKnownMissingProfile,
    loading,
  };
}
