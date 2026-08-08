/**
 * Where a push notification's click should land.
 *
 * The service worker routed exactly one shape — `channel_type === "messaging"` —
 * and dumped everything else on `/groups`. So a buddy request, a comment on your
 * post, a new group member and a live session starting all landed on the same
 * page with no indication of what had happened.
 *
 * This is mobile's `handleActions` ladder
 * (`cancerbuddyapp/src/context/push-notification/push-notification.provider.tsx:376-407`)
 * with its branch **order preserved**, because the order is load-bearing:
 * `FRIEND_REQUEST` / `BUDDY` carry a Connection id in `activityId` *and*
 * `feedId`, so matching the post-detail branch first opens a post that does not
 * exist. Mobile documents that trap; this keeps it.
 *
 * Pure, and duplicated into `public/firebase-messaging-sw.js` — a service worker
 * cannot import from the app bundle. A test asserts the two copies stay in step,
 * comparing them with type annotations stripped: the logic must match exactly,
 * and only the annotations may differ.
 */

export interface PushData {
  type?: string;
  channelId?: string;
  /** Legacy: a JSON-encoded `{ id }` blob rather than a plain id. */
  channel?: string;
  channel_type?: string;
  channel_id?: string;
  activityId?: string;
  feedId?: string;
  parentReactionId?: string;
  eventId?: string;
  userId?: string;
  groupId?: string;
}

/* ── ROUTING START ── */
function chatIdFrom(data: PushData): string {
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

function targetPath(data: PushData | null | undefined): string {
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
function notificationTag(data: PushData | null | undefined): string {
  if (!data) return "cancerbuddy";
  const chatId = chatIdFrom(data);
  if (chatId) return "chat:" + chatId;
  if (data.eventId) return "live:" + data.eventId;
  if (data.activityId) return "post:" + data.activityId;
  return "cancerbuddy:" + (data.type || "general");
}
/* ── ROUTING END ── */

export { chatIdFrom, notificationTag, targetPath };
