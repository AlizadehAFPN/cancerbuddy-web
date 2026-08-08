/**
 * Web push registration, decoupled from React.
 *
 * Mirrors the mobile lifecycle so both clients behave the same way:
 *   login / app load  → `getToken()` → `client.addDevice(token, 'firebase', id)`
 *                       (`cancerbuddyapp` StreamProvider.tsx:122-131)
 *   logout            → `client.removeDevice(token, id)`
 *                       (`cancerbuddyapp` useAuth.ts:196,277)
 *
 * Stream is the only sender of push in this product, so registering the device
 * is the whole integration — there is no server-side counterpart to write.
 *
 * Two deliberate divergences from mobile, both worth knowing about:
 *
 *  1. Mobile also hands the FCM token to `USERS_LAMBDA` on login/logout
 *     (`signup.ts:12-27`, `lambda.ts:234`). The web signup flow already passes
 *     `token: undefined` in that payload
 *     (`lib/user-signup/userEnrollmentFinalize.ts`). We leave it undefined: a
 *     brand-new member has not granted notification permission yet, so there is
 *     never a token to send at that point in the flow. Registration happens
 *     later, from the app shell, once permission exists.
 *
 *  2. Permission is never requested automatically. Chrome penalises origins that
 *     prompt on load, and a cancer-support app asking for notification access
 *     before the member has seen anything is worse UX than an explicit toggle in
 *     Settings. `syncPushDevice()` only re-registers a token the member already
 *     granted.
 *
 * Browser-only module: every export returns a safe value during SSR.
 */

import type { StreamChat } from "stream-chat";
import { getActiveStreamClient } from "@/lib/chat/streamClient";
import { registerDeviceToken, unregisterDeviceToken } from "./deviceToken";
import {
  getPushConfig,
  getStreamPushProviderName,
  missingPushEnv,
  type PushConfig,
} from "./config";

export type PushState =
  /** No Notification/ServiceWorker/PushManager, or Safari without PWA install. */
  | "unsupported"
  /** Firebase env vars not set — see `docs/PUSH.md`. */
  | "unconfigured"
  /** Member (or their admin) blocked notifications in the browser. */
  | "denied"
  /** Never asked yet. */
  | "prompt"
  /** Permission granted, but the member turned push off in Settings. */
  | "off"
  /** Granted and registered. */
  | "enabled";

export interface ForegroundPush {
  title: string;
  body: string;
  /** In-app path this notification refers to, for the toast's tap target. */
  path: string;
  /** Stream channel id, when the push is about a conversation. */
  channelId?: string;
}

const SW_URL = "/firebase-messaging-sw.js";

/**
 * Records that the member switched push off. The browser has no API to revoke
 * its own permission grant, so without this flag a disabled toggle would flip
 * back to "enabled" on the next load.
 */
const OPT_OUT_KEY = "cb.push.optOut";

/** Token from this session, so logout can remove the device without re-minting. */
let currentToken: string | null = null;

/* ── Environment probes ───────────────────────────────────────────────── */

/**
 * The two messages `public/firebase-messaging-sw.js` posts to the page. The
 * worker is a plain script outside the module graph, so it carries its own
 * copies at `:145` and `:154` — change these together.
 */
const FOREGROUND_MESSAGE = "cancerbuddy:push";
const DATA_MESSAGE = "cancerbuddy:push-data";

function browserCapable(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function optedOut(): boolean {
  try {
    return window.localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    /* Private mode / storage blocked — treat as opted in. */
    return false;
  }
}

function setOptedOut(value: boolean): void {
  try {
    if (value) window.localStorage.setItem(OPT_OUT_KEY, "1");
    else window.localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    /* Non-fatal: the toggle still works for this session. */
  }
}

/* ── Firebase plumbing (dynamically imported) ─────────────────────────── */

/**
 * The `firebase` SDK is ~100 kB gzipped and touches `window` on import, so it
 * is pulled in lazily — members who never enable push never download it, and
 * nothing runs during SSR.
 */
async function getMessagingInstance(cfg: PushConfig) {
  const [{ initializeApp, getApps, getApp }, messagingMod] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);

  if (!(await messagingMod.isSupported())) return null;

  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: cfg.apiKey,
        projectId: cfg.projectId,
        messagingSenderId: cfg.messagingSenderId,
        appId: cfg.appId,
      });

  return { messaging: messagingMod.getMessaging(app), mod: messagingMod };
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  /* `register` is idempotent for the same script URL + scope, so this is safe
     to call on every app load. `updateViaCache: "none"` makes the browser
     revalidate the worker script instead of serving a cached copy. */
  const registration = await navigator.serviceWorker.register(SW_URL, {
    scope: "/",
    updateViaCache: "none",
  });
  console.info("[push] service worker registered");
  await navigator.serviceWorker.ready;
  console.info("[push] service worker active");
  return registration;
}

/**
 * Every step below can stall on a network round-trip (FCM registration, Stream
 * API) rather than fail, and a stalled promise leaves the Settings toggle
 * spinning forever with nothing in the console. Bound each one.
 */
function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

function connectedClient(): { client: StreamChat; userId: string } | null {
  const client = getActiveStreamClient();
  if (!client?.userID) return null;
  return { client, userId: client.userID };
}

/* ── State subscription ───────────────────────────────────────────────── */

/**
 * Notification permission lives outside React — it changes from the browser's
 * own site-settings UI as well as from our toggle — so the settings card reads
 * it through `useSyncExternalStore` rather than mirroring it into state.
 */
const listeners = new Set<() => void>();

function emitPushStateChange(): void {
  listeners.forEach((listener) => listener());
}

/** `useSyncExternalStore` subscribe. Also follows browser-side permission flips. */
export function subscribePushState(listener: () => void): () => void {
  listeners.add(listener);

  /* `PermissionStatus.change` fires when the member allows or blocks
     notifications from the browser's own UI, e.g. the padlock menu. Not
     available everywhere (Safari lacks the notifications descriptor), in which
     case the card simply updates on the next mount. */
  let status: PermissionStatus | null = null;
  let cancelled = false;

  if (typeof navigator !== "undefined" && navigator.permissions?.query) {
    navigator.permissions
      .query({ name: "notifications" as PermissionName })
      .then((result) => {
        if (cancelled) return;
        status = result;
        result.addEventListener("change", emitPushStateChange);
      })
      .catch(() => {
        /* Descriptor unsupported — nothing to observe. */
      });
  }

  return () => {
    cancelled = true;
    listeners.delete(listener);
    status?.removeEventListener("change", emitPushStateChange);
  };
}

/**
 * `useSyncExternalStore` server snapshot. Null means "not known yet", so the
 * card can render no affordance during SSR and hydration instead of flashing
 * the wrong one.
 */
export function serverPushState(): PushState | null {
  return null;
}

/* ── Public API ───────────────────────────────────────────────────────── */

/** Current state, cheap enough to call on every render. */
export function readPushState(): PushState {
  if (!browserCapable()) return "unsupported";
  if (!getPushConfig()) return "unconfigured";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "default") return "prompt";
  return optedOut() ? "off" : "enabled";
}

/**
 * Ask for permission (if needed), mint an FCM token, and register it with
 * Stream. Returns the resulting state; `error` carries a reason for the caller
 * to surface when registration failed despite permission being granted.
 */
export async function enablePush(): Promise<{
  state: PushState;
  error?: unknown;
}> {
  if (!browserCapable()) return { state: "unsupported" };

  const cfg = getPushConfig();
  if (!cfg) {
    console.warn(
      "[push] not configured — missing env:",
      missingPushEnv().join(", "),
    );
    return { state: "unconfigured" };
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (permission !== "granted") {
    emitPushStateChange();
    return { state: permission === "denied" ? "denied" : "prompt" };
  }

  setOptedOut(false);

  try {
    await registerPushDevice(cfg);
    return { state: "enabled" };
  } catch (error) {
    console.error("[push] enable failed:", error);
    /* Permission is granted but we have no usable token; keep the member opted
       in so the next load retries rather than showing them an off switch. */
    return { state: "enabled", error };
  } finally {
    emitPushStateChange();
  }
}

/**
 * Member-initiated opt-out: drop the device from Stream and destroy the token,
 * so this browser stops receiving push even though the permission grant remains.
 */
export async function disablePush(): Promise<void> {
  setOptedOut(true);
  emitPushStateChange();

  const cfg = getPushConfig();
  if (!cfg || !browserCapable()) return;

  try {
    const instance = await getMessagingInstance(cfg);
    if (!instance) return;

    const token =
      currentToken ??
      (await instance.mod.getToken(instance.messaging, {
        vapidKey: cfg.vapidKey,
        serviceWorkerRegistration: await registerServiceWorker(),
      }));

    const active = connectedClient();
    if (active && token) {
      await active.client.removeDevice(token, active.userId);
    }
    await instance.mod.deleteToken(instance.messaging);
    currentToken = null;
  } catch (error) {
    /* The local opt-out flag already took effect; a stale device on Stream is
       harmless because the token is gone. */
    console.warn("[push] disable cleanup failed:", error);
  }
}

/**
 * Re-register the token for a member who already granted permission. Called on
 * every authenticated load: FCM tokens rotate (browser data cleared, SW
 * unregistered, long-idle installs) and Stream needs the current one.
 * Silent and non-throwing — a failure here must never block the app shell.
 */
export async function syncPushDevice(): Promise<void> {
  if (readPushState() !== "enabled") return;
  const cfg = getPushConfig();
  if (!cfg) return;

  try {
    await registerPushDevice(cfg);
    /* The backend half. Inert until `NEXT_PUBLIC_PUSH_TOKEN_REGISTRATION` is
       set — read `lib/push/deviceToken.ts` before setting it. */
    const active = connectedClient();
    if (currentToken && active) {
      await registerDeviceToken({ token: currentToken, userID: active.userId });
    }
  } catch (error) {
    console.warn("[push] token sync failed:", error);
  }
}

/**
 * Logout counterpart: unregister this browser from the member's Stream devices
 * but keep the token and the permission grant, so the next member to log in on
 * this machine does not inherit the previous member's notifications and the
 * toggle stays on for the returning member.
 */
export async function unregisterPushDevice(): Promise<void> {
  if (!currentToken) return;
  const active = connectedClient();
  if (!active) return;

  try {
    await active.client.removeDevice(currentToken, active.userId);
  } catch (error) {
    console.warn("[push] removeDevice on logout failed:", error);
  }

  /* Same switch, same reasoning — and it runs *after* Stream, so a failure
     here cannot leave the member still registered with the sender that
     actually delivers today. */
  await unregisterDeviceToken({ token: currentToken, userID: active.userId });
}

/**
 * Pushes that arrive while a tab is focused, so the app can show an in-app
 * toast instead of an OS banner for a conversation already on screen.
 *
 * The obvious implementation — `onMessage()` from `firebase/messaging` — does
 * **not** work here and silently never fires: that API is fed by the Firebase
 * SDK's own service worker posting to the page, and ours is hand-written (see
 * the header of `public/firebase-messaging-sw.js` for why). So the worker posts
 * its own message and this listens for that instead. No FCM SDK involved.
 *
 * Returns an unsubscribe function.
 */
export function subscribeForegroundPush(
  onPush: (push: ForegroundPush) => void,
): () => void {
  if (!browserCapable()) return () => {};

  const handler = (event: MessageEvent) => {
    const data = event.data;
    if (!data || data.type !== FOREGROUND_MESSAGE) return;
    onPush({
      title: data.title ?? "CancerBuddy",
      body: data.body ?? "",
      path: data.path ?? "/groups",
      channelId: data.channelId,
    });
  };

  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}

/**
 * The raw payload of every push this browser receives, in every open tab.
 *
 * Separate from {@link subscribeForegroundPush}, which is about *showing* one
 * notification in the tab the member is looking at. This is about state the app
 * keeps: a push about a group post marks that group unread, and a tab that
 * happened not to be focused must still learn about it.
 */
export function subscribePushData(
  onData: (data: Record<string, string | undefined>) => void,
): () => void {
  if (!browserCapable()) return () => {};

  const handler = (event: MessageEvent) => {
    const message = event.data;
    if (!message || message.type !== DATA_MESSAGE) return;
    onData(message.data ?? {});
  };

  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}

/* ── Badge and tray ───────────────────────────────────────────────────── */

/**
 * Ask the worker to tidy the app-icon badge and the OS notification tray.
 *
 * Both live on the worker — it owns the count, and only it can enumerate the
 * tray — so the page asks rather than does. The two callers mirror mobile:
 *
 *  - `"badge"` when the app comes to the foreground
 *    (`push-notification.provider.tsx:93-95`)
 *  - `"tray"` when the member opens Updates, which clears the banners *and* the
 *    badge (`HomeNotifications.tsx:110-115`, `notifee.cancelAllNotifications`)
 *
 * A no-op wherever service workers are absent, which includes SSR.
 */
export async function clearPushNotices(scope: "badge" | "tray"): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({
      type: scope === "tray" ? "cancerbuddy:clear-tray" : "cancerbuddy:clear-badge",
    });
  } catch (err) {
    /* No worker registered yet — nothing has been shown, nothing to clear. */
    console.debug("[push] clearPushNotices skipped:", err);
  }
}

/**
 * *That* a push arrived, without caring what it said.
 *
 * Both worker messages count, because a screen refreshing itself wants to know
 * about the push, not to be told twice about the same one: the focused tab
 * receives `cancerbuddy:push` **and** `cancerbuddy:push-data` for a single push,
 * a background tab only the latter. Callers coalesce — see
 * `lib/hooks/useLiveResync.ts`.
 *
 * Guarded on `serviceWorker` alone rather than {@link browserCapable}, which
 * additionally requires `Notification` and `PushManager`. Those two decide
 * whether this browser can be *sent* a push; neither is needed to hear a message
 * the worker posts, and requiring them would silently disable this listener in
 * environments that can receive worker messages perfectly well.
 */
export function subscribePushSignal(onSignal: () => void): () => void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return () => {};
  }

  const handler = (event: MessageEvent) => {
    const type = event.data?.type;
    if (type !== FOREGROUND_MESSAGE && type !== DATA_MESSAGE) return;
    onSignal();
  };

  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}

/* ── Internals ────────────────────────────────────────────────────────── */

async function registerPushDevice(cfg: PushConfig): Promise<void> {
  const instance = await getMessagingInstance(cfg);
  if (!instance) return;

  const registration = await registerServiceWorker();

  /* Generous: FCM registration is two round-trips (Firebase Installations, then
     FCM) and a cold dev server also compiles the messaging chunk first. */
  const token = await withTimeout(
    instance.mod.getToken(instance.messaging, {
      vapidKey: cfg.vapidKey,
      serviceWorkerRegistration: registration,
    }),
    30_000,
    "FCM getToken",
  );
  if (!token) throw new Error("FCM returned an empty token");
  console.info("[push] FCM token minted");

  /* Dev only. The token is what Stream's dashboard → Push Notifications → "Test
     Configurations" needs to send a probe straight through one configuration,
     which is the only way to see FCM's own response to this browser. Not a
     secret, but there is no reason to print it in production. */
  if (process.env.NODE_ENV !== "production") {
    console.info("[push] token (dev, for Stream → Test Configurations):", token);
  }

  currentToken = token;

  const active = connectedClient();
  if (!active) {
    /* Chat is still connecting. The token is cached above; `syncPushDevice()`
       runs again once Stream is ready. */
    return;
  }

  /* The 4th argument names which of the app's Firebase configurations may send
     to this token. Mobile omits it; web must pass it, because web tokens come
     from a different Firebase project (see `getStreamPushProviderName`). */
  const providerName = getStreamPushProviderName();
  await withTimeout(
    active.client.addDevice(token, "firebase", active.userId, providerName),
    15_000,
    "Stream addDevice",
  );
  console.info(
    "[push] device registered for",
    active.userId,
    providerName ? `via provider "${providerName}"` : "(default provider)",
  );

  /* Dev only. `addDevice` returning 200 does not prove Stream kept the device
     under the provider we asked for — and a device Stream does not have is
     indistinguishable, from the browser, from one it has but never sends to.
     Read the list back so the difference is visible. */
  if (process.env.NODE_ENV !== "production") {
    try {
      const { devices = [] } = await active.client.getDevices();
      console.info(
        "[push] Stream now lists these devices for this user:",
        devices.map((d) => ({
          provider: d.push_provider,
          name: d.push_provider_name ?? null,
          disabled: d.disabled ?? false,
          created_at: d.created_at,
          isThisBrowser: d.id === token,
        })),
      );
    } catch (error) {
      console.warn("[push] could not read back the device list:", error);
    }
  }
}
