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
  normaliseAttachments,
  type FeedMediaAttachment,
} from "@/lib/groups/feedMedia";
import {
  addReaction,
  deleteReaction,
  fetchEnrichedActivity,
  fetchNextReactions,
  updateActivity,
  updateReaction,
  type FeedSession,
  type StreamReaction,
} from "@/lib/groups/feedClient";
import type {
  FeedComment,
  FeedPage,
  FeedPost,
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
  isSnooze?: boolean | null;
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
    isSnooze: raw.isSnooze === true,
    profilePicUrl,
    goalImageUrl,
  };
}

/**
 * Mobile writes S3 object references with no `url` field, and this used to
 * require one — so **every** mobile-authored attachment was filtered out before
 * it reached the screen. `normaliseAttachments` requires `bucket` + `key`
 * instead, which is what can actually be signed.
 */
const toAttachments = normaliseAttachments;

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

/**
 * The Lambda answers an empty page for a group that has posts, intermittently —
 * a known backend hiccup both clients work around rather than showing "no posts
 * yet" to a member looking at a busy group. Mobile retries up to three times,
 * 1500 ms apart, and keeps its spinner up throughout
 * (`screens/feeds/activities-feed.tsx:34,171-194`).
 */
export const EMPTY_FEED_RETRIES = 3;
export const EMPTY_FEED_RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The first page, retried while it comes back empty.
 *
 * Only page 0: an empty *later* page is how paging ends, and retrying it would
 * turn the end of a feed into three pointless round trips. Errors are not
 * retried here either — they surface as the feed's error state, which offers a
 * Retry button.
 *
 * The caller stays in its loading state for the whole run, so the empty state
 * never flashes in between attempts.
 */
export async function fetchGroupPostsWithEmptyRetry(
  params: { groupId: string; currentUserId: string },
  options?: { retries?: number; delayMs?: number; wait?: (ms: number) => Promise<void> },
): Promise<FeedPage> {
  const retries = options?.retries ?? EMPTY_FEED_RETRIES;
  const delayMs = options?.delayMs ?? EMPTY_FEED_RETRY_DELAY_MS;
  const wait = options?.wait ?? sleep;

  let page = await fetchGroupPosts({ ...params, offset: 0 });
  for (let attempt = 0; attempt < retries && page.posts.length === 0; attempt += 1) {
    await wait(delayMs);
    page = await fetchGroupPosts({ ...params, offset: 0 });
  }
  return page;
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

/** Resolves every author appearing in a set of reactions, once each. */
async function resolveThreadAuthors(
  reactions: StreamReaction[],
  loadAuthor: (userId: string) => Promise<PostAuthor | undefined>,
): Promise<Map<string, PostAuthor>> {
  const userIds = new Set<string>();
  const collect = (list: StreamReaction[]) => {
    for (const reaction of list) {
      userIds.add(reaction.user_id);
      collect(reaction.latest_children?.comment ?? []);
    }
  };
  collect(reactions);

  const entries = await Promise.all(
    [...userIds].map(async (id) => [id, await loadAuthor(id)] as const),
  );
  const authors = new Map<string, PostAuthor>();
  for (const [id, author] of entries) {
    if (author) authors.set(id, author);
  }
  return authors;
}

export interface PostThreadPage {
  comments: FeedComment[];
  post: FeedPost | null;
  /**
   * Stream's cursor for the comments beyond the first page, or undefined when
   * the thread ended. Opaque — pass it straight back to
   * {@link fetchMoreComments}.
   */
  next?: string;
}

/**
 * A post's comment thread, with one level of replies (Stream calls them child
 * reactions) already inlined — the same depth the mobile thread view shows.
 */
export async function fetchPostComments(
  session: FeedSession,
  activityId: string,
  loadAuthor: (userId: string) => Promise<PostAuthor | undefined>,
): Promise<PostThreadPage> {
  const activity = await fetchEnrichedActivity(session, activityId);
  if (!activity) return { comments: [], post: null };

  const commentReactions = activity.latest_reactions?.comment ?? [];
  const authors = await resolveThreadAuthors(commentReactions, loadAuthor);

  const post = await toPost(
    activity as unknown as RawPost,
    session.userId,
    activity.feedId ?? "",
  );
  post.author = await loadAuthor(post.actorId);

  return {
    comments: commentReactions.map((r) => reactionToComment(r, authors)),
    post,
    next: activity.latest_reactions_extra?.comment?.next || undefined,
  };
}

/**
 * The next page of comments.
 *
 * Replies come back on each comment exactly as they do on the first page, so a
 * paged-in comment is fully formed and needs no second request.
 */
export async function fetchMoreComments(
  session: FeedSession,
  nextUrl: string,
  loadAuthor: (userId: string) => Promise<PostAuthor | undefined>,
): Promise<{ comments: FeedComment[]; next?: string }> {
  const page = await fetchNextReactions(session, nextUrl);
  const reactions = page?.results ?? [];
  const authors = await resolveThreadAuthors(reactions, loadAuthor);
  return {
    comments: reactions.map((r) => reactionToComment(r, authors)),
    next: page?.next || undefined,
  };
}

/**
 * Mobile waits 1.2 s before believing an empty thread response
 * (`screens/feeds/PostDetails.tsx:112-125`), because the Lambda answers the same
 * empty body for a deleted post and for its own transient failures against
 * Stream. Web asks Stream directly, which fails in the same two ways.
 */
export const THREAD_RETRY_DELAY_MS = 1200;

/**
 * The thread, fetched twice before concluding the post is gone.
 *
 * Returns `post: null` only when **both** attempts came back with nothing. A
 * rejection counts as nothing, which is one step past mobile — mobile's own
 * `try` wraps both attempts, so a thrown first attempt skips its retry. On the
 * web a single failed request is the commonest case of all, and retrying it is
 * the whole point of the delay.
 */
export async function fetchPostCommentsWithRetry(
  session: FeedSession,
  activityId: string,
  loadAuthor: (userId: string) => Promise<PostAuthor | undefined>,
  options?: { delayMs?: number; wait?: (ms: number) => Promise<void> },
): Promise<PostThreadPage> {
  const wait = options?.wait ?? sleep;

  try {
    const first = await fetchPostComments(session, activityId, loadAuthor);
    if (first.post) return first;
  } catch (err) {
    console.error("[groups] thread load failed, retrying:", err);
  }

  await wait(options?.delayMs ?? THREAD_RETRY_DELAY_MS);

  try {
    return await fetchPostComments(session, activityId, loadAuthor);
  } catch (err) {
    console.error("[groups] thread load failed on retry:", err);
    return { comments: [], post: null };
  }
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
/**
 * `attachments` is **required**, not optional.
 *
 * It used to be `attachments?: unknown[]` and nothing ever passed it, so the
 * composer could not attach media and nobody noticed. Making it required and
 * typed means a new call site has to decide, and an empty array is an explicit
 * "no media" rather than an oversight.
 */
export async function createPost(params: {
  session: FeedSession;
  groupId: string;
  html: string;
  attachments: FeedMediaAttachment[];
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

/**
 * The `deleteMessage` payload, shaped exactly as mobile sends it in
 * `cancerbuddyapp/src/components/layouts/Groups/post-fragment/modals/ConfirmPost.modal.tsx:38-47`.
 *
 * `type` is repeated inside the body as well as being the envelope's verb — that
 * is what the Lambda reads, so both are required.
 *
 * For a post, `postId` and `commentId` are both the activity id. For a comment or
 * reply, `postId` is the *parent post* and `commentId` is the reaction being
 * removed. `isPost` tells the Lambda which of the two to act on.
 */
export interface DeleteMessagePayload {
  type: string;
  feedId: string;
  postId: string;
  commentId: string;
  isPost: boolean;
}

export function buildDeletePayload(
  target:
    | { kind: "post"; post: Pick<FeedPost, "id" | "feedId"> }
    | { kind: "comment"; post: Pick<FeedPost, "id" | "feedId">; commentId: string },
): DeleteMessagePayload {
  const isPost = target.kind === "post";
  return {
    type: LambdaPayloadType.DELETE_MESSAGE,
    feedId: target.post.feedId,
    postId: target.post.id,
    commentId: isPost ? target.post.id : target.commentId,
    isPost,
  };
}

/**
 * The Lambda answers with a JSON string carrying `success`. Mobile reads the same
 * field (`ConfirmPost.modal.tsx:49-52`) and only then updates its list — an
 * unparseable or falsy response means nothing was deleted.
 */
function assertLambdaSucceeded(raw: unknown, what: string): void {
  if (parseLambdaJson(raw)?.success !== true) {
    throw new Error(`Could not delete the ${what}.`);
  }
}

/**
 * Deletes a post through the `deleteMessage` Lambda.
 *
 * Not `feed.removeActivity`: that addresses the *caller's own* feed, so a host
 * removing another member's post got a success response and no deletion. The
 * Lambda is the only path with the authority to remove someone else's activity,
 * and it is what mobile uses for every delete including the author's own.
 */
export async function deletePost(
  post: Pick<FeedPost, "id" | "feedId">,
): Promise<void> {
  const raw = await raiseUserLambda(
    LambdaPayloadType.DELETE_MESSAGE,
    usersLambdaName(),
    { ...buildDeletePayload({ kind: "post", post }) },
  );
  assertLambdaSucceeded(raw, "post");
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
  attachments: FeedMediaAttachment[];
}): Promise<string> {
  const reaction = await addReaction(params.session, {
    user_id: params.session.userId,
    kind: "comment",
    activity_id: params.activityId,
    data: {
      text: params.text,
      ...(params.attachments.length ? { attachments: params.attachments } : {}),
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
  attachments: FeedMediaAttachment[];
}): Promise<string> {
  const reaction = await addReaction(params.session, {
    user_id: params.session.userId,
    kind: "comment",
    parent: params.parentReactionId,
    data: {
      text: params.text,
      ...(params.attachments.length ? { attachments: params.attachments } : {}),
    },
  });
  return reaction.id;
}

/**
 * Deletes a comment or reply through the same `deleteMessage` Lambda, for the same
 * reason {@link deletePost} does: `deleteReaction` only carries the authority to
 * remove the caller's own reaction, so moderation silently failed.
 *
 * `post` is the parent post the comment hangs off — mobile passes it as `postId`
 * and the reaction id as `commentId`.
 */
export async function deleteComment(
  post: Pick<FeedPost, "id" | "feedId">,
  commentId: string,
): Promise<void> {
  const raw = await raiseUserLambda(
    LambdaPayloadType.DELETE_MESSAGE,
    usersLambdaName(),
    { ...buildDeletePayload({ kind: "comment", post, commentId }) },
  );
  assertLambdaSucceeded(raw, "comment");
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
