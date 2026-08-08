"use client";

import { useCallback, useEffect, useRef } from "react";
import { subscribePushSignal } from "@/lib/push/pushClient";
import { useVisibilityResync } from "@/lib/hooks/useVisibilityResync";

/**
 * Re-runs a load when something suggests the server has moved on: the member
 * came back to the tab, or a push arrived.
 *
 * Mobile keeps the Updates screen current through push alone — its
 * `usePushNotification` handler re-reads the list — and never has the case this
 * also covers, a tab left open for hours behind a websocket the browser
 * suspended. Both sources answer the same question, so they share one callback
 * and one coalescing gate rather than two hooks racing each other.
 *
 * ## Why the gate is here and not in each source
 *
 * `useVisibilityResync` already collapses the `visibilitychange` + `focus` pair
 * it fires for one user action. It cannot see the push listener, though, and the
 * overlap is the *common* case, not a corner: a push lands, the member taps the
 * OS banner, and the tab both receives the worker message and becomes visible
 * within the same moment. Without a shared gate that is two loads every time.
 *
 * The window is deliberately short. A push that arrives while the tab is hidden
 * *should* load, and returning to that tab ten minutes later *should* load
 * again — more may have happened since. Only near-simultaneous pairs collapse.
 *
 * ## What it does not do
 *
 * No filtering by push type. A screen that keeps a list of "things that happened
 * to you" cannot know which payloads belong in it without reimplementing the
 * server's own routing, and re-reading one page is cheap next to getting it
 * wrong. Callers that need the payload have `subscribePushData`.
 */

/** Long enough to cover a banner tap; far shorter than any real gap. */
const COALESCE_MS = 1000;

export function useLiveResync(
  onResync: () => void,
  options?: { enabled?: boolean },
): void {
  const enabled = options?.enabled ?? true;

  /* Assigned in an effect, not during render: writing a ref while rendering is
     unsafe under concurrent rendering, and effects run long before any of these
     listeners can fire. Same reasoning as `useVisibilityResync`. */
  const callbackRef = useRef(onResync);
  useEffect(() => {
    callbackRef.current = onResync;
  }, [onResync]);

  const lastRunRef = useRef(0);

  const gated = useCallback(() => {
    const now = Date.now();
    if (now - lastRunRef.current < COALESCE_MS) return;
    lastRunRef.current = now;
    callbackRef.current();
  }, []);

  useVisibilityResync(gated, { enabled });

  useEffect(() => {
    if (!enabled) return;
    return subscribePushSignal(gated);
  }, [enabled, gated]);
}
