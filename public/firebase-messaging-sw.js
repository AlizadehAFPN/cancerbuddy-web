/**
 * Web push service worker — displays notifications that arrive while no tab is
 * focused, and routes clicks back into the app.
 *
 * Deliberately self-contained: it does **not** `importScripts()` the Firebase
 * compat SDK from gstatic, which is the shape most FCM tutorials use. Reasons:
 *
 *  • No third-party script executing with service-worker privileges on our
 *    origin — the SDK's only job here is `showNotification`, which is ~30 lines
 *    of standard Push API code. Keeps us inside `docs/SECURITY.md`'s posture and
 *    lets a future CSP stay at `script-src 'self'`.
 *  • No version drift between the npm `firebase` package and a CDN URL pinned
 *    in a file nobody remembers to bump.
 *  • Exactly one notification per push. The Firebase SW auto-displays messages
 *    that carry a `notification` payload *and* invokes `onBackgroundMessage`,
 *    which is the classic source of duplicate notifications.
 *
 * `getToken()` does not need the SDK to be present in here — it subscribes
 * through `registration.pushManager` and we hand it this registration
 * explicitly (see `lib/push/pushClient.ts`). This file only handles display.
 *
 * The `firebase-messaging-sw.js` filename is kept because it is the path the
 * Firebase SDK falls back to if the explicit registration is ever dropped.
 *
 * Served from `public/` at the origin root, so its scope is `/`.
 */

/* Take over from a previous version immediately rather than waiting for every
   tab to close — otherwise a shipped fix to click-routing sits idle for days. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

const DEFAULT_ICON = "/icons/icon-192.png";

/**
 * FCM delivers either a `notification` payload (title/body set by the sender)
 * or a data-only message. Stream sends both halves: `notification` for display
 * and `data` for routing (`type`, `channel_type`, `channel_id`, `cid`, `id`).
 */
function parsePush(event) {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    /* Not JSON — fall back to the raw text as the body. */
    const text = event.data ? event.data.text() : "";
    payload = { notification: { body: text } };
  }

  const n = payload.notification || {};
  const data = payload.data || {};

  const title = n.title || data.title || "CancerBuddy";
  const body = n.body || data.body || "";

  /* Collapse repeated pushes from the same conversation into one notification
     instead of stacking five of them, but re-alert so the user still notices. */
  const tag = data.cid || data.channel_id || data.group_id || "cancerbuddy";

  return {
    title,
    options: {
      body,
      icon: n.icon || DEFAULT_ICON,
      badge: DEFAULT_ICON,
      tag,
      renotify: true,
      data,
    },
  };
}

/**
 * Where a click on this notification should land.
 *
 * Stream channels come in two types across the product: `messaging` (buddy and
 * group conversations, the only type the web app renders) and `livestream` (the
 * chat attached to a live session, mobile-only). A livestream push therefore has
 * no web destination, so it falls back to the app home rather than a route that
 * would render an empty conversation. Once `/notifications` is a real screen
 * instead of a placeholder, that becomes the better catch-all.
 */
function targetPath(data) {
  if (data.channel_type === "messaging" && data.channel_id) {
    return `/chat/${data.channel_id}`;
  }
  return "/groups";
}

/** The message this worker posts to a focused tab; `lib/push/pushClient.ts` listens. */
const FOREGROUND_MESSAGE = "cancerbuddy:push";

self.addEventListener("push", (event) => {
  /* A push that arrives but fails to display and a push that never arrives look
     identical from the page, and the difference decides whether to debug the
     browser or the sender. Visible in the worker's own console: DevTools →
     Console → context dropdown → this worker. */
  console.info(
    "[push-sw] push received:",
    event.data ? event.data.text() : "(no payload)",
  );

  const { title, options } = parsePush(event);

  event.waitUntil(
    (async () => {
      /* An OS banner for a conversation the member is already looking at is
         noise. Hand the payload to the focused tab instead and let the app show
         an in-app toast. Only a *focused* client counts — a background tab
         cannot show anything the member would notice. */
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const focused = clients.find((client) => client.focused);

      if (focused) {
        focused.postMessage({
          type: FOREGROUND_MESSAGE,
          title,
          body: options.body,
          path: targetPath(options.data),
          channelId: options.data.channel_id,
        });
        return;
      }

      try {
        await self.registration.showNotification(title, options);
      } catch (error) {
        console.error("[push-sw] showNotification failed:", error);
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = targetPath(event.notification.data || {});
  const url = new URL(path, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      /* Reuse an open tab — opening a second copy of the app would re-run the
         Cognito session check and the Stream connect for no reason. */
      for (const client of clientList) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        if ("navigate" in client) {
          try {
            await client.navigate(url);
          } catch {
            /* Cross-document navigation can be refused; focus is enough. */
          }
        }
        return;
      }

      await self.clients.openWindow(url);
    })(),
  );
});
