"use client";

import { useEffect, useRef, useState } from "react";

/** Mobile waits this long before believing a reconnection. */
export const ONLINE_STABILITY_MS = 2000;

/**
 * Whether the browser believes it has a connection.
 *
 * Mirrors `cancerbuddyapp/src/hooks/useNetworkStatus.ts`, including two choices
 * that look like bugs and are not:
 *
 * 1. **Asymmetric.** Going offline is reported immediately; coming back online
 *    waits {@link ONLINE_STABILITY_MS}. A flaky connection otherwise flaps the
 *    notice on and off, which is worse than either state.
 * 2. **Starts `true` even when the browser says otherwise.** `navigator.onLine`
 *    is unreliable at load — it reports the interface, not reachability — so
 *    mobile short-circuits its first run rather than opening on a false alarm.
 *    The first real `offline` event corrects it within milliseconds.
 */
export function useNetworkStatus(): { online: boolean } {
  const [online, setOnline] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clear = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };

    const goOffline = () => {
      clear();
      setOnline(false);
    };

    const goOnline = () => {
      clear();
      timerRef.current = setTimeout(() => setOnline(true), ONLINE_STABILITY_MS);
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      clear();
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  return { online };
}
