"use client";

/**
 * The buddy-request count for the navigation badge.
 *
 * Mobile puts this in the tab bar, live on the same subscription the Updates
 * screen uses, so a request that arrives while the app is open shows up on the
 * tab without a visit. Same here.
 *
 * Independent of `BuddiesProvider` on purpose. The badge renders on every
 * authenticated page, and the provider pages through the full connection map —
 * far more work than a number is worth. This asks for ids and counts them.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { API, graphqlOperation } from "aws-amplify";
import { fetchPendingRequestCount } from "@/lib/buddies/connections";

const ON_CREATE_CONNECTION = /* GraphQL */ `
  subscription GetPendingConnections($userId: ID!) {
    onCreateConnectionByRecipientId(connectionRecipientId: $userId) {
      id
      connectionRecipientId
    }
  }
`;

export function usePendingRequestCount(userId: string | null): number {
  const [count, setCount] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const next = await fetchPendingRequestCount(userId);
      if (mountedRef.current) setCount(next);
    } catch (err) {
      // A badge is not worth an error state — it simply doesn't update.
      console.error("[buddies] request count failed:", err);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    // `load` only writes state after awaiting the query, so this is a later
    // tick rather than the synchronous cascade the rule is looking for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [userId, load]);

  useEffect(() => {
    if (!userId) return;

    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const observable = API.graphql(
        graphqlOperation(ON_CREATE_CONNECTION, { userId }),
      ) as {
        subscribe: (handlers: { next: () => void; error: () => void }) => {
          unsubscribe: () => void;
        };
      };
      subscription = observable.subscribe({
        next: () => void load(),
        error: () => {},
      });
    } catch (err) {
      console.error("[buddies] request count subscription failed:", err);
    }

    return () => subscription?.unsubscribe();
  }, [userId, load]);

  // Gated on `userId` rather than cleared in an effect: signing out should hide
  // the badge on the same render, not one render later.
  return userId ? count : 0;
}
