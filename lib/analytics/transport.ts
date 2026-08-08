/**
 * Where events actually go.
 *
 * Mobile calls `analytics().logEvent(...)` from `@react-native-firebase/analytics`
 * and lands in the `cancerbuddy-demo` Firebase project's GA4 property. **Web
 * cannot land in the same one**: this app has its own Firebase project, because
 * nobody on the team can open the mobile one (the full ownership hunt is in
 * `docs/PUSH.md`). So "the same funnel" means the same event names and the same
 * parameter shapes, joined at the reporting end — not one property.
 *
 * That makes the transport a seam rather than a hard dependency:
 *
 *  1. `window.__cbAnalytics` when a test or a debugging session installs one.
 *  2. Firebase Analytics when `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` is set.
 *  3. Otherwise a no-op that logs at debug level.
 *
 * Case 3 is the state this ships in, and it is the same posture `lib/push`
 * takes while its env is incomplete: report, do not throw. Nothing a member does
 * should fail because a measurement id is missing, and nothing about the funnel
 * is knowable until someone with console access pastes one in.
 */

export interface AnalyticsTransport {
  track(name: string, params?: Record<string, unknown>): void;
}

declare global {
  interface Window {
    /** Test/debug override. Read every call, never cached. */
    __cbAnalytics?: AnalyticsTransport;
  }
}

let override: AnalyticsTransport | null = null;

/** Install a transport directly. Returns a function that restores the previous. */
export function setAnalyticsTransport(
  transport: AnalyticsTransport | null,
): () => void {
  const previous = override;
  override = transport;
  return () => {
    override = previous;
  };
}

export function measurementId(): string | null {
  return process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim() || null;
}

/** Whether events reach anything at all. Surfaced so the emitter can say so once. */
export function analyticsConfigured(): boolean {
  return Boolean(measurementId());
}

/* ── Firebase, dynamically imported ───────────────────────────────────── */

let firebaseTrack: ((n: string, p?: Record<string, unknown>) => void) | null =
  null;
let firebaseLoading = false;

/**
 * The SDK is loaded on the first event, not at module load: it is ~100 kB and
 * touches `window` on import, the same reasoning `lib/push/pushClient.ts`
 * documents. Events that arrive before it resolves are dropped rather than
 * queued — a queue would hold the earliest, most interesting events hostage to
 * a network fetch, and every one of them is also recorded by the latch.
 */
function loadFirebase(): void {
  if (firebaseLoading || firebaseTrack) return;
  firebaseLoading = true;

  void (async () => {
    try {
      const [{ initializeApp, getApps, getApp }, analyticsMod] =
        await Promise.all([import("firebase/app"), import("firebase/analytics")]);

      if (!(await analyticsMod.isSupported())) {
        console.info("[analytics] not supported in this browser");
        return;
      }

      const app = getApps().length
        ? getApp()
        : initializeApp({
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            messagingSenderId:
              process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
            measurementId: measurementId() ?? undefined,
          });

      const instance = analyticsMod.getAnalytics(app);
      firebaseTrack = (name, params) =>
        analyticsMod.logEvent(
          instance,
          name as never,
          params as never,
        );
    } catch (err) {
      console.error("[analytics] Firebase Analytics failed to load:", err);
    } finally {
      firebaseLoading = false;
    }
  })();
}

/* ── Resolution ───────────────────────────────────────────────────────── */

let warnedUnconfigured = false;

export function getAnalyticsTransport(): AnalyticsTransport {
  if (override) return override;

  const installed =
    typeof window !== "undefined" ? window.__cbAnalytics : undefined;
  if (installed?.track) return installed;

  if (!analyticsConfigured()) {
    if (!warnedUnconfigured) {
      warnedUnconfigured = true;
      console.info(
        "[analytics] NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID is not set — events are logged, not sent.",
      );
    }
    return {
      track(name, params) {
        console.debug("[analytics]", name, params ?? {});
      },
    };
  }

  loadFirebase();
  return {
    track(name, params) {
      if (firebaseTrack) firebaseTrack(name, params);
      else console.debug("[analytics] (sdk loading)", name, params ?? {});
    },
  };
}

/** Test hook — the module-level SDK state must not leak between cases. */
export function resetAnalyticsTransportForTests(): void {
  override = null;
  firebaseTrack = null;
  firebaseLoading = false;
  warnedUnconfigured = false;
}
