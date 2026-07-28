/**
 * Group feed posts.
 *
 * Reading and writing take different paths, and that asymmetry is deliberate —
 * it's how the mobile app works, and both clients must agree:
 *
 *  • **Read**: `USERS_LAMBDA` with type `newGetPostByGroup`. The Lambda returns
 *    posts already enriched with their author, which is why the list doesn't
 *    need a query per post.
 *  • **Write**: straight to GetStream. A post is an activity on the author's
 *    own feed addressed `to: ["user:<groupId>"]`; the group's feed then carries
 *    it. After publishing, an AppSync row is created so other members' realtime
 *    subscriptions fire.
 */

import { API, graphqlOperation } from "aws-amplify";
import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import { getS3ImageUrl, type S3FileRef } from "@/lib/aws/s3Image";
import {
  addReaction,
  deleteReaction,
  fetchEnrichedActivity,
  updateActivity,
  updateReaction,
  type FeedSession,
  type StreamReaction,
} from "@/lib/groups/feedClient";
import type {
  FeedComment,
  FeedPage,
  FeedPost,
  PostAttachment,
  PostAuthor,
} from "@/lib/groups/types";

export const POSTS_PER_PAGE = 30;

function usersLambdaName(): string {
  const v = process.env.NEXT_PUBLIC_USERS_LAMBDA?.trim();
  if (!v) throw new Error("NEXT_PUBLIC_USERS_LAMBDA is not set.");
  return v;
}

/** The Lambda sometimes double-encodes its body; unwrap until it's an object. */
function parseLambdaJson(raw: unknown): Record<string, unknown> | null {
  let value: unknown = raw;
  for (let i = 0; i < 3 && typeof value === "string"; i += 1) {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/* ── Normalising Stream/Lambda shapes ───────────────────────────────────── */

interface RawAuthor {
  id?: string;
  name?: string | null;
  birth?: string | null;
  userType?: string | null;
  ambassador?: boolean | null;
  groupHostId?: string | null;
  profilePic?: { file?: S3FileRef | null } | null;
  Goal?: { image?: { file?: S3FileRef | null } | null } | null;
}

async function toAuthor(
  raw: RawAuthor | null | undefined,
  fallbackId: string,
): Promise<PostAuthor | undefined> {
  if (!raw) return undefined;
  const [profilePicUrl, goalImageUrl] = await Promise.all([
    getS3ImageUrl(raw.profilePic?.file),
    getS3ImageUrl(raw.Goal?.image?.file),
  ]);
  return {
    id: raw.id ?? fallbackId,
    name: raw.name ?? null,
    birth: raw.birth ?? null,
    userType: raw.userType ?? null,
    ambassador: raw.ambassador === true,
    groupHostId: raw.groupHostId ?? null,
    profilePicUrl,
    goalImageUrl,
  };
}

function toAttachments(raw: unknown): PostAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
    .map((a) => ({
      type: typeof a.type === "string" ? a.type : null,
      url: typeof a.url === "string" ? a.url : null,
      mimeType: typeof a.mimeType === "string" ? a.mimeType : null,
      name: typeof a.name === "string" ? a.name : null,
    }))
    .filter((a) => !!a.url);
}

interface RawPost {
  id: string;
  actor?: string | { id?: string };
  object?: string;
  edited_object?: string;
  edited?: boolean;
  time?: string;
  feedId?: string;
  attachments?: unknown;
  comments_count?: number;
  reaction_counts?: Record<string, number>;
  latest_reactions?: Record<string, StreamReaction[] | undefined>;
  own_reactions?: Record<string, StreamReaction[] | undefined>;
  userInfo?: RawAuthor;
}

function actorIdOf(actor: RawPost["actor"]): string {
  if (typeof actor === "string") return actor;
  return actor?.id ?? "";
}

async function toPost(
  raw: RawPost,
  currentUserId: string,
  groupId: string,
): Promise<FeedPost> {
  const actorId = actorIdOf(raw.actor);
  const pinnedReactions = raw.latest_reactions?.pinned ?? [];
  const likeReactions = raw.latest_reactions?.like ?? [];
  const ownLike = (raw.own_reactions?.like ?? []).find((r) => r?.id);

  return {
    id: raw.id,
    feedId: raw.feedId ?? groupId,
    actorId,
    html: raw.edited_object || raw.object || "",
    createdAt: raw.time ?? "",
    edited: raw.edited === true,
    pinned: pinnedReactions.length > 0,
    pinnedReactionId: pinnedReactions[0]?.id,
    likeCount: raw.reaction_counts?.like ?? 0,
    // `own_reactions` is only present on enriched reads; fall back to scanning
    // the recent likes so the heart still renders filled in the list.
    myLikeReactionId:
      ownLike?.id ?? likeReactions.find((r) => r?.user_id === currentUserId)?.id,
    commentCount: raw.comments_count ?? raw.reaction_counts?.comment ?? 0,
    attachments: toAttachments(raw.attachments),
    author: await toAuthor(raw.userInfo, actorId),
  };
}

/* ── Reading ────────────────────────────────────────────────────────────── */

/**
 * One page of a group's feed. Posts come back newest-first with pinned posts
 * hoisted to the top — the same ordering mobile applies client-side.
 */
export async function fetchGroupPosts(params: {
  groupId: string;
  currentUserId: string;
  offset?: number;
}): Promise<FeedPage> {
  const raw = await raiseUserLambda(
    LambdaPayloadType.GET_POSTS_BY_GROUP,
    usersLambdaName(),
    {
      feedId: params.groupId,
      type: LambdaPayloadType.GET_POSTS_BY_GROUP,
      offset: params.offset ?? 0,
    },
  );

  const parsed = parseLambdaJson(raw);
  if (!parsed) throw new Error("The group feed returned an unreadable response.");

  const rawPosts = Array.isArray(parsed)
    ? (parsed as RawPost[])
    : ((parsed.posts as RawPost[] | undefined) ?? []);

  const posts = await Promise.all(
    rawPosts
      .filter((p) => p?.id)
      .map((p) => toPost(p, params.currentUserId, params.groupId)),
  );

  return {
    posts: sortPosts(posts),
    next: typeof parsed.next === "string" ? parsed.next : undefined,
  };
}

/** Pinned first, then newest first. */
export function sortPosts(posts: FeedPost[]): FeedPost[] {
  return [...posts].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/* ── Comments ───────────────────────────────────────────────────────────── */

function reactionToComment(
  reaction: StreamReaction,
  authors: Map<string, PostAuthor>,
): FeedComment {
  const data = reaction.data ?? {};
  const children = reaction.latest_children?.comment ?? [];

  return {
    id: reaction.id,
    userId: reaction.user_id,
    text: typeof data.text === "string" ? data.text : "",
    createdAt: reaction.created_at,
    edited: data.edited === true,
    attachments: toAttachments(data.attachments),
    author: authors.get(reaction.user_id),
    replies: children.map((child) => reactionToComment(child, authors)),
    replyCount: reaction.children_counts?.comment ?? children.length,
  };
}

/**
 * A post's comment thread, with one level of replies (Stream calls them child
 * reactions) already inlined — the same depth the mobile thread view shows.
 */
export async function fetchPostComments(
  session: FeedSession,
  activityId: string,
  loadAuthor: (userId: string) => Promise<PostAuthor | undefined>,
): Promise<{ comments: FeedComment[]; post: FeedPost | null }> {
  const activity = await fetchEnrichedActivity(session, activityId);
  if (!activity) return { comments: [], post: null };

  const commentReactions = activity.latest_reactions?.comment ?? [];

  // Resolve every author that appears in the thread once, in parallel.
  const userIds = new Set<string>();
  const collect = (list: StreamReaction[]) => {
    for (const reaction of list) {
      userIds.add(reaction.user_id);
      collect(reaction.latest_children?.comment ?? []);
    }
  };
  collect(commentReactions);

  const entries = await Promise.all(
    [...userIds].map(async (id) => [id, await loadAuthor(id)] as const),
  );
  const authors = new Map<string, PostAuthor>();
  for (const [id, author] of entries) {
    if (author) authors.set(id, author);
  }

  const post = await toPost(
    activity as unknown as RawPost,
    session.userId,
    activity.feedId ?? "",
  );
  post.author = await loadAuthor(post.actorId);

  return {
    comments: commentReactions.map((r) => reactionToComment(r, authors)),
    post,
  };
}

/* ── Writing ────────────────────────────────────────────────────────────── */

const CREATE_GROUP_POST = /* GraphQL */ `
  mutation CreateGroupPost($input: CreateGroupPostInput!) {
    createGroupPost(input: $input) {
      id
      groupId
      actorId
    }
  }
`;

/**
 * Publishes a post to a group. The AppSync row afterwards is what drives other
 * members' realtime subscriptions; if it fails the post still exists, so the
 * error is swallowed exactly as mobile does.
 */
export async function createPost(params: {
  session: FeedSession;
  groupId: string;
  html: string;
  attachments?: unknown[];
}): Promise<string | undefined> {
  const { session, groupId, html, attachments } = params;

  const activity = await session.userFeed.addActivity({
    actor: session.userId,
    verb: "post",
    object: html,
    to: [`user:${groupId}`],
    foreign_id: `activity${new Date().toISOString()}`,
    time: new Date().toISOString(),
    feedId: groupId,
    ...(attachments?.length ? { attachments } : {}),
  });

  const activityId = (activity as { id?: string })?.id;
  if (activityId) {
    try {
      await API.graphql(
        graphqlOperation(CREATE_GROUP_POST, {
          input: { id: activityId, groupId, actorId: session.userId },
        }),
      );
    } catch {
      /* the post is live regardless — this only powers realtime fan-out */
    }
  }
  return activityId;
}

export async function deletePost(
  session: FeedSession,
  activityId: string,
): Promise<void> {
  await session.userFeed.removeActivity(activityId);
}

/** Edits keep the original `object` and store the new body alongside it. */
export async function editPost(
  session: FeedSession,
  activityId: string,
  html: string,
): Promise<void> {
  await updateActivity(session, {
    id: activityId,
    set: {
      edited_object: html,
      edited: true,
      edited_at: new Date().toISOString(),
    },
  });
}

export async function likePost(
  session: FeedSession,
  activityId: string,
): Promise<string> {
  const reaction = await addReaction(session, {
    user_id: session.userId,
    kind: "like",
    activity_id: activityId,
  });
  return reaction.id;
}

export function unlikePost(
  session: FeedSession,
  reactionId: string,
): Promise<void> {
  return deleteReaction(session, reactionId);
}

export async function addComment(params: {
  session: FeedSession;
  activityId: string;
  text: string;
  attachments?: unknown[];
}): Promise<string> {
  const reaction = await addReaction(params.session, {
    user_id: params.session.userId,
    kind: "comment",
    activity_id: params.activityId,
    data: {
      text: params.text,
      ...(params.attachments?.length ? { attachments: params.attachments } : {}),
    },
  });
  return reaction.id;
}

/**
 * A reply to a comment. Stream drops the parent link when `activity_id` and
 * `parent` are sent together, so replies carry `parent` only — the same
 * workaround the mobile client documents.
 */
export async function addReply(params: {
  session: FeedSession;
  parentReactionId: string;
  text: string;
  attachments?: unknown[];
}): Promise<string> {
  const reaction = await addReaction(params.session, {
    user_id: params.session.userId,
    kind: "comment",
    parent: params.parentReactionId,
    data: {
      text: params.text,
      ...(params.attachments?.length ? { attachments: params.attachments } : {}),
    },
  });
  return reaction.id;
}

export function deleteComment(
  session: FeedSession,
  reactionId: string,
): Promise<void> {
  return deleteReaction(session, reactionId);
}

export async function editComment(
  session: FeedSession,
  reactionId: string,
  text: string,
): Promise<void> {
  await updateReaction(session, reactionId, {
    data: { text, edited: true, edited_at: new Date().toISOString() },
  });
}

/* ── Pinning ────────────────────────────────────────────────────────────── */

const CREATE_PIN_MESSAGE = /* GraphQL */ `
  mutation createPinMessage($idGroup: String!, $idMessage: String!) {
    createPinMessages(input: { idGroup: $idGroup, idMessage: $idMessage }) {
      id
    }
  }
`;

const REMOVE_PIN_MESSAGE = /* GraphQL */ `
  mutation removePinMessage($id: ID!) {
    deletePinMessages(input: { id: $id }) {
      id
    }
  }
`;

const GET_GROUP_PIN = /* GraphQL */ `
  query getPinMessageByIdGroup($idGroup: String!) {
    pinMessageByIdGroup(idGroup: $idGroup) {
      id
      idGroup
      idMessage
    }
  }
`;

/** The pin bookkeeping row: `id` is the AppSync row, `idMessage` the reaction. */
interface PinRecord {
  id: string;
  idGroup: string;
  idMessage: string;
}

/** A group can only have one pinned post, so we look up the current one first. */
export async function fetchGroupPin(groupId: string): Promise<PinRecord | null> {
  try {
    const { data } = await executeAppSyncGraphql<{
      pinMessageByIdGroup: PinRecord | null;
    }>({
      query: GET_GROUP_PIN,
      variables: { idGroup: groupId },
      authWithUserPool: true,
    });
    return data?.pinMessageByIdGroup ?? null;
  } catch {
    return null;
  }
}

async function writePin(
  session: FeedSession,
  post: { id: string; feedId: string },
): Promise<void> {
  const reaction = await addReaction(session, {
    user_id: session.userId,
    kind: "pinned",
    activity_id: post.id,
  });
  try {
    await executeAppSyncGraphql({
      query: CREATE_PIN_MESSAGE,
      variables: { idGroup: post.feedId, idMessage: reaction.id },
      authWithUserPool: true,
    });
  } catch (err) {
    console.error("[groups] pin bookkeeping failed:", err);
  }
}

async function clearPin(session: FeedSession, pin: PinRecord): Promise<void> {
  await deleteReaction(session, pin.idMessage);
  try {
    await executeAppSyncGraphql({
      query: REMOVE_PIN_MESSAGE,
      variables: { id: pin.id },
      authWithUserPool: true,
    });
  } catch (err) {
    console.error("[groups] unpin bookkeeping failed:", err);
  }
}

export type PinOutcome = "pinned" | "unpinned" | "conflict";

/**
 * Toggles the pin on a post.
 *
 * Returns `"conflict"` — without changing anything — when a *different* post is
 * already pinned in the group. The caller then asks the host to confirm
 * replacing it, and calls `replacePin`. This mirrors the mobile pin-conflict
 * modal, and exists because the group's single pin slot is shared between all
 * hosts.
 */
export async function togglePin(
  session: FeedSession,
  post: { id: string; feedId: string; pinned: boolean },
): Promise<PinOutcome> {
  const existing = await fetchGroupPin(post.feedId);

  if (!existing) {
    await writePin(session, post);
    return "pinned";
  }

  if (!post.pinned) return "conflict";

  await clearPin(session, existing);
  return "unpinned";
}

/** Removes the group's current pin and pins this post instead. */
export async function replacePin(
  session: FeedSession,
  post: { id: string; feedId: string },
): Promise<void> {
  const existing = await fetchGroupPin(post.feedId);
  if (existing) await clearPin(session, existing);
  await writePin(session, post);
}
