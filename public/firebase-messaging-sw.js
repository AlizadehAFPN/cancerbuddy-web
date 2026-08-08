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
     instead of stacking five of them, but re-alert so the user still notices.

     Shared with `lib/push/targetPath.ts`: the backend sends a conversation under
     three different payload shapes, and computing the tag from only some of them
     meant one thread could raise three separate banners. */
  const tag = notificationTag(data);

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

/* ── ROUTING START ── */
function chatIdFrom(data) {
  if (data.type === "CHAT_MESSAGE" && data.channelId) return data.channelId;
  if (data.channelId) return data.channelId;
  if (data.channel_type === "messaging" && data.channel_id) return data.channel_id;
  if (data.channel) {
    try {
      const parsed = JSON.parse(data.channel);
      if (parsed && parsed.id) return parsed.id;
    } catch {
      return "";
    }
  }
  return "";
}

function targetPath(data) {
  if (!data) return "/groups";

  const chatId = chatIdFrom(data);
  if (chatId) return "/chat/" + chatId;

  // Before the activityId branch: these carry a Connection id in activityId and
  // feedId, so the post-detail branch would open a post that does not exist.
  if (data.type === "FRIEND_REQUEST") return "/notifications?tab=requests";
  if (data.type === "BUDDY") {
    return data.userId ? "/buddies/" + data.userId : "/notifications";
  }

  if (data.type === "LIVE_NOTIFY") {
    return data.eventId ? "/live/" + data.eventId : "/groups";
  }

  if (data.activityId && data.feedId) {
    const params = new URLSearchParams({ post: data.activityId, feed: data.feedId });
    if (data.parentReactionId) params.set("reaction", data.parentReactionId);
    const group = data.groupId || data.feedId;
    return "/groups/" + group + "?" + params.toString();
  }

  if (data.type === "POST") {
    return data.groupId ? "/groups/" + data.groupId : "/groups";
  }

  if (data.activityId) return "/notifications";

  return "/groups";
}

/**
 * Notifications that collapse into one banner.
 *
 * All three chat payload shapes name the same conversation, so without a shared
 * tag a member gets three separate banners for one thread.
 */
function notificationTag(data) {
  if (!data) return "cancerbuddy";
  const chatId = chatIdFrom(data);
  if (chatId) return "chat:" + chatId;
  if (data.eventId) return "live:" + data.eventId;
  if (data.activityId) return "post:" + data.activityId;
  return "cancerbuddy:" + (data.type || "general");
}
/* ── ROUTING END ── */

/** The message this worker posts to a focused tab; `lib/push/pushClient.ts` listens. */
const FOREGROUND_MESSAGE = "cancerbuddy:push";

/**
 * Posted to **every** open tab, focused or not, carrying the raw payload.
 *
 * The toast above is for the tab the member is looking at; this one is for state
 * that every tab holds — today the per-group `NEW` marker, which a background
 * tab must also update or its sidebar disagrees with the one in front.
 */
const PUSH_DATA_MESSAGE = "cancerbuddy:push-data";

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

      /* Every tab hears the payload, whether or not it is the one being looked
         at — the `NEW` badge is per-tab state and must not depend on focus. */
      for (const client of clients) {
        client.postMessage({ type: PUSH_DATA_MESSAGE, data: options.data });
      }

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
