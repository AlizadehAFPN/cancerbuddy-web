import type { FeedMediaAttachment } from "@/lib/groups/feedMedia";

/**
 * Types for the Groups tab.
 *
 * Field names mirror the AppSync schema and the GetStream activity shape the
 * mobile app consumes (`cancerbuddyapp/src/types/groups/groups.ts` and the
 * `newGetPostByGroup` Lambda response) — they are a contract with those two
 * services, not a local view model.
 */

/* ── Groups ─────────────────────────────────────────────────────────────── */

export interface GroupHost {
  id: string;
  name: string;
  occupation?: string | null;
  bio?: string | null;
  ambassador?: boolean | null;
  hostOrder?: number | null;
  pronoun?: string | null;
  /** The group this person hosts — used to badge their posts with "Host". */
  groupHostId?: string | null;
  profilePicUrl?: string;
}

export interface GroupSponsor {
  name?: string | null;
  description?: string | null;
  logoUrl?: string;
}

/** An embedded third-party page some groups show alongside their feed. */
export interface GroupWidget {
  tab1?: string | null;
  tab2?: string | null;
  url?: string | null;
}

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  about?: string | null;
  verified: boolean;
  disabled: boolean;
  /**
   * `true` = anyone may join. `false` = joining needs the group's code (the
   * mobile "private group" flow). Note the schema's name is the inverse of how
   * it reads: the *code* gate applies when this is false.
   */
  isPublic: boolean;
  /** Audience gate: `TEENS` | `ADULTS` | `ALL_AGES`. */
  groupPublic?: string | null;
  /** Join code for non-public groups; never shown, only compared. */
  code?: string | null;
  profilePicUrl?: string;
  sponsor?: GroupSponsor | null;
  hosts: GroupHost[];
  widgetAvailable: boolean;
  widget?: GroupWidget | null;
  /** Only set for groups the user has joined. */
  muted?: boolean;
  /** Membership row id — needed to leave or mute. */
  userGroupId?: string;
}

/** A group currently broadcasting live. */
export interface LiveGroup {
  id: string;
  groupId: string;
  inLive: boolean;
}

export interface LiveCalendarEvent {
  id: string;
  groupId: string;
  title: string;
  description?: string | null;
  /** ISO timestamp. */
  scheduledAt: string;
  groupName?: string | null;
  /** Minutes; defaults to 60 when absent, matching mobile. */
  duration?: number | null;
  status?: string | null;
  chatChannelId?: string | null;
  inLive?: boolean | null;
  /**
   * `false` once the host hides the session. Mobile drops those rows before
   * rendering, so declaring the field is what stops it being discarded at the
   * type boundary — see `isCalendarEventVisible`.
   */
  active?: boolean | null;
  archived?: boolean | null;
}

/* ── Feed activities ────────────────────────────────────────────────────── */

export interface PostAuthor {
  id: string;
  name?: string | null;
  birth?: string | null;
  userType?: string | null;
  ambassador?: boolean | null;
  profilePicUrl?: string;
  goalImageUrl?: string;
  /** Set when this person hosts the group the post is in. */
  groupHostId?: string | null;
  /**
   * A snoozed member is not accepting new connections. Read when the author's
   * name is tapped, so their profile does not offer a Connect they have opted
   * out of — mobile checks the same flag at `usePostActions.ts:74`.
   */
  isSnooze?: boolean | null;
}

/**
 * Media on a post or comment.
 *
 * Re-exported from `lib/groups/feedMedia.ts`, which owns the shape because it is
 * a wire format the mobile app writes: an S3 object reference, not a URL.
 */
export type PostAttachment = FeedMediaAttachment;

export interface FeedComment {
  id: string;
  /** Reaction author's user id. */
  userId: string;
  text: string;
  createdAt: string;
  edited: boolean;
  attachments: PostAttachment[];
  author?: PostAuthor;
  /** Replies to this comment (Stream calls them child reactions). */
  replies: FeedComment[];
  replyCount: number;
}

export interface FeedPost {
  id: string;
  /** The group's feed id — equals the group id. */
  feedId: string;
  actorId: string;
  /** Post body as HTML, as authored in the rich-text composer. */
  html: string;
  createdAt: string;
  edited: boolean;
  pinned: boolean;
  /** Reaction id of the pin, needed to unpin. */
  pinnedReactionId?: string;
  likeCount: number;
  /** This user's like reaction id, when they've liked it. */
  myLikeReactionId?: string;
  commentCount: number;
  attachments: PostAttachment[];
  author?: PostAuthor;
}

export interface FeedPage {
  posts: FeedPost[];
  /** Opaque marker from the Lambda; absent when there are no more pages. */
  next?: string;
}

/* ── Membership ─────────────────────────────────────────────────────────── */

export type JoinResult = "joined" | "code-required" | "wrong-code" | "failed";

/**
 * Report reasons live in `lib/groups/reporting.ts`, beside the submit gate and
 * the payload they belong with — the list on its own was half a feature, and the
 * missing half (the "Other" free text, the reported user, the content and the
 * post/comment type) is exactly what moderators were not receiving.
 */
