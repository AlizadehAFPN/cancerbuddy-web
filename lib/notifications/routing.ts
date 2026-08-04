/**
 * Where a notification goes when you click it.
 *
 * Ported from mobile's `handleDetail` switch in `HomeNotifications.tsx`, with
 * each destination mapped to the web surface that shows the same thing:
 *
 *   mobile                                      web
 *   ─────────────────────────────────────────   ──────────────────────────────
 *   ActivitiesFeed(dataGroup)                   /groups/{id}
 *   ChatScreen(channelId)                       /chat/{channelId}
 *   ActiveUsersListGroups(idGroup)              /groups/{id}/members
 *   UserInfo(userId)                            /buddies/{userId}
 *   PostDetail(post, highlightParentReactionId) /groups/{id}?post=…&reaction=…
 *   setActiveTab('Tab2')                        the requests tab, in place
 *
 * The post case deserves a note. Mobile routes through `ActivitiesFeed`, which
 * immediately forwards to `PostDetail` — a screen showing one post and its
 * comment thread. The web already renders exactly that as `PostThread`, a sheet
 * over the feed, so the query parameters open the sheet rather than a new page.
 * Same destination, no new route.
 *
 * Two mobile branches are dead and are not reproduced:
 *  • `case 'COMMENT_REPLY'` — no row carries that value. The real ones are
 *    `COMMENT` and `REPLY`, which mobile handles through `default`; they are
 *    named explicitly here and land in the same place.
 *  • the `default` branch's group-less fallback — every `POST`/`COMMENT`/
 *    `LIKE`/`REPLY` row in production has a group.
 */

import type { AppNotification } from "@/lib/notifications/types";

export type NotificationTarget =
  /** Navigate. */
  | { kind: "href"; href: string }
  /** Mobile's `setActiveTab('Tab2')` — no navigation, switch tabs in place. */
  | { kind: "requests" }
  /** Nothing to open; the row renders as plain text rather than a dead link. */
  | { kind: "none"; reason: string };

export function notificationTarget(n: AppNotification): NotificationTarget {
  const groupId = n.group?.id;

  switch (n.type) {
    case "MESSAGE":
      // A group message opens the group; a direct one opens the channel, whose
      // id mobile reads out of `activityId`.
      if (groupId) return { kind: "href", href: `/groups/${groupId}` };
      return n.activityId
        ? { kind: "href", href: `/chat/${n.activityId}` }
        : { kind: "none", reason: "message without a channel id" };

    case "NEWUSER":
      return groupId
        ? { kind: "href", href: `/groups/${groupId}/members` }
        : { kind: "none", reason: "new member without a group" };

    // "<name> sent you a friend request". `activityId`/`feedId` hold the
    // Connection id here, not a post id — following them would open an empty
    // post. The request itself is one tab away, where it can be answered.
    case "FRIEND_REQUEST":
      return { kind: "requests" };

    // "<name> accepted your friend request" — open the new buddy.
    case "BUDDY":
      return n.remitent.id
        ? { kind: "href", href: `/buddies/${n.remitent.id}` }
        : { kind: "none", reason: "buddy notification without a sender" };

    case "POST":
    case "COMMENT":
    case "REPLY":
    case "LIKE":
    default: {
      if (!groupId) return { kind: "none", reason: "post activity without a group" };
      if (!n.activityId) return { kind: "href", href: `/groups/${groupId}` };

      const params = new URLSearchParams({ post: n.activityId });
      if (n.feedId) params.set("feed", n.feedId);
      // Set when the notification is about a reply inside a comment thread, so
      // the sheet can open that thread rather than the top of the list.
      if (n.parentReactionId) params.set("reaction", n.parentReactionId);

      return { kind: "href", href: `/groups/${groupId}?${params.toString()}` };
    }
  }
}
