/**
 * The Updates feed — `/notifications`, mobile's Updates tab.
 *
 * Notifications are written server-side (the users Lambda and the SQS
 * pipeline), never by a client. Both apps only read them, and the sentence a
 * user sees is `typeNotification`, generated at write time — so the copy is not
 * ours to compose and must be rendered verbatim.
 *
 * The `type` values below are the ones the live table actually produces,
 * confirmed by sweeping 800 rows of production data. Note that mobile's router
 * has a `case 'COMMENT_REPLY'` which no row ever carries — the real values are
 * `COMMENT` and `REPLY`, and both fall through mobile's `default`. Ours names
 * them explicitly and lands in the same place, so behaviour matches while the
 * intent is legible.
 */

import type { S3FileRef } from "@/lib/aws/s3Image";
import type { UserTypeName } from "@/lib/buddies/types";

/**
 * Every `type` seen in production, most frequent first.
 *
 * `POST`  — someone posted in a group you're in ("Posted in" + group name)
 * `COMMENT` / `REPLY` — activity on a post you wrote or interacted with
 * `LIKE`  — a reaction on a post
 * `MESSAGE` — a direct chat message
 * `FRIEND_REQUEST` — a buddy request arrived
 * `BUDDY` — a buddy request you sent was accepted
 * `NEWUSER` — someone joined a group you host
 */
export type NotificationKind =
  | "POST"
  | "COMMENT"
  | "REPLY"
  | "LIKE"
  | "MESSAGE"
  | "FRIEND_REQUEST"
  | "BUDDY"
  | "NEWUSER";

export interface NotificationSender {
  id: string;
  name: string;
  userType?: UserTypeName | null;
  /** Null for most rows in production — treat only `true` as ambassador. */
  ambassador?: boolean | null;
  profilePicUrl?: string;
  goalImageUrl?: string;
}

export interface AppNotification {
  id: string;
  /** Unknown values are kept as-is rather than dropped — the server may add more. */
  type: NotificationKind | (string & {});
  /** The sentence shown to the user, composed server-side. Render verbatim. */
  typeNotification: string;
  createdAt: string;
  /**
   * Always `false` in production today: the Lambda meant to flip it writes to a
   * key the Notifications table doesn't have, so the update fails silently on
   * every call. See `docs/UPDATES.md`.
   */
  read: boolean;
  /** Group context, when the notification is about group activity. */
  group?: { id: string; name: string } | null;
  /** Who caused it. Rows without one are filtered out — mobile does the same. */
  remitent: NotificationSender;
  /** Post id for feed notifications; channel id for `MESSAGE`. */
  activityId?: string | null;
  feedId?: string | null;
  /** Set when a reply belongs to a comment thread, used to highlight it. */
  parentReactionId?: string | null;
}

/* ── Raw AppSync shapes ─────────────────────────────────────────────────── */

export interface RawNotification {
  id: string;
  type?: string | null;
  typeNotification?: string | null;
  createdAt: string;
  read?: boolean | null;
  activityId?: string | null;
  feedId?: string | null;
  parentReactionId?: string | null;
  group?: { id?: string | null; name?: string | null } | null;
  remitent?: {
    id?: string | null;
    name?: string | null;
    userType?: string | null;
    ambassador?: boolean | null;
    ProfilePic?: { file?: S3FileRef | null } | null;
    Goal?: { image?: { file?: S3FileRef | null } | null; name?: string | null } | null;
  } | null;
}

export interface NotificationPage {
  items: AppNotification[];
  nextToken: string | null;
  /** Server-reported total for the filter — used only for diagnostics. */
  total: number;
}
