"use client";

import { useEffect, useRef } from "react";

/**
 * Runs a callback when the user comes back to the tab.
 *
 * This is the web equivalent of mobile's `useAppStateEvents`
 * (`cancerbuddyapp/src/hooks/useAppState.ts`), which fires on
 * background/inactive → active. Web had no equivalent anywhere outside
 * `lib/live/useWakeLock.ts`, so every screen showed whatever it had loaded until
 * a hard refresh — a buddy request accepted on someone's phone stayed "Pending"
 * on their laptop indefinitely.
 *
 * Three things it does that a bare `visibilitychange` listener does not:
 *
 * 1. **Never fires on mount.** Only a transition *into* visible counts. The
 *    screen has just loaded its data; re-fetching immediately is pure waste.
 * 2. **Coalesces.** Returning to a tab commonly fires `visibilitychange` *and*
 *    `focus`, and switching windows can fire several in a burst. Without this
 *    every return would issue duplicate requests.
 * 3. **Always calls the latest callback.** Mobile's version captures the
 *    callback at mount and a stale closure is a known problem there — see the
 *    comment at `ConnectionMapProvider.tsx:137`. The ref makes that impossible.
 */

/** Two events for one user action arrive within a few ms of each other. */
const COALESCE_MS = 300;

export function useVisibilityResync(
  onForeground: () => void,
  options?: { enabled?: boolean },
): void {
  const enabled = options?.enabled ?? true;

  // Kept current in an effect rather than assigned during render: writing to a
  // ref while rendering is not safe under concurrent rendering. Effects run
  // before any user interaction can fire the listener, so this is never stale
  // by the time it matters.
  const callbackRef = useRef(onForeground);
  useEffect(() => {
    callbackRef.current = onForeground;
  }, [onForeground]);

  const lastRunRef = useRef(0);
  // Seeded from the current state so a tab that mounts while visible — the
  // normal case — does not count as a transition.
  const wasVisibleRef = useRef(true);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    wasVisibleRef.current = document.visibilityState === "visible";

    const run = () => {
      const now = Date.now();
      if (now - lastRunRef.current < COALESCE_MS) return;
      lastRunRef.current = now;
      callbackRef.current();
    };

    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      const wasVisible = wasVisibleRef.current;
      wasVisibleRef.current = visible;
      if (visible && !wasVisible) run();
    };

    /**
     * Returning from another window fires `focus` without the tab ever having
     * been hidden — mobile treats that the same way, since iOS reports
     * `inactive` for a visible-but-unfocused app.
     *
     * Deliberately unconditional: guarding it on the visibility transition would
     * skip exactly the case this listener exists for. When it *does* follow a
     * `visibilitychange`, the coalescing window collapses the pair into one run.
     */
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      wasVisibleRef.current = true;
      run();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled]);
}
