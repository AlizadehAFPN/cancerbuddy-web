"use client";

import { useSyncExternalStore } from "react";

import { hasUnread, subscribeToUnreadGroups } from "@/lib/groups/unreadPosts";

/**
 * Whether this group has posts the member has not opened — the `NEW` badge.
 *
 * Per-group rather than a whole-set snapshot: the sidebar renders one row per
 * group, and a set identity that changes on every push would re-render all of
 * them. The server snapshot is always `false`, so SSR and the first client paint
 * agree and no badge flashes in before the store is read.
 */
export function useGroupHasUnread(groupId: string): boolean {
  return useSyncExternalStore(
    subscribeToUnreadGroups,
    () => hasUnread(groupId),
    () => false,
  );
}
