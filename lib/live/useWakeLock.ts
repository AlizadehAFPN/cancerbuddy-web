"use client";

/**
 * Keeps the screen awake for the length of a session — the web equivalent of
 * mobile's `useKeepAwake()` in the Twilio room.
 *
 * A viewer who is only listening never touches the keyboard, so without this
 * the display sleeps mid-session. The lock is released by the browser whenever
 * the tab is hidden, so it is re-acquired on `visibilitychange` rather than
 * assumed to hold. Unsupported browsers (Safari < 16.4, Firefox) simply don't
 * get it; there is no fallback worth the hack.
 */

import { useEffect } from "react";

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const acquire = async () => {
      if (released || document.visibilityState !== "visible") return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        /* denied or unsupported — not worth surfacing */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !sentinel?.released) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
}
