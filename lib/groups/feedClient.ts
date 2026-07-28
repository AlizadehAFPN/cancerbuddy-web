/**
 * GetStream **Feeds** access for the Groups tab.
 *
 * Two different transports, matching what the mobile app does:
 *
 *  • **Feed operations** (publish a post, follow/unfollow a group, follower
 *    counts) go through the official `getstream` SDK — the same package and
 *    version family the mobile app uses, so the wire format is guaranteed to
 *    match rather than hand-rolled.
 *  • **Reaction operations** (like, comment, reply, pin, edit) go straight to
 *    Stream's REST API with `fetch`. Mobile does the same (via axios) because
 *    these need the separate *reactions* token, not the feed token.
 *
 * Reads of the post list don't appear here at all — those come from
 * `USERS_LAMBDA` (see `posts.ts`).
 */

import { connect, type StreamClient, type StreamFeed } from "getstream";
import { fetchStreamCredentials } from "@/lib/chat/streamToken";

const REST_BASE = "https://us-east-api.stream-io-api.com/api/v1.0";

export interface FeedSession {
  client: StreamClient;
  /** The signed-in user's own feed — activities are published *from* here. */
  userFeed: StreamFeed;
  apiKey: string;
  feedToken: string;
  reactionsToken: string;
  userId: string;
}

function getAppId(): string {
  const v = process.env.NEXT_PUBLIC_GETSTREAM_APP_ID?.trim();
  if (!v) {
    throw new Error(
      "NEXT_PUBLIC_GETSTREAM_APP_ID is not set — group posts and reactions need the Stream app id.",
    );
  }
  return v;
}

/**
 * Builds the feed session. Cached per user for the page's lifetime: the tokens
 * are long-lived and minting them costs a Lambda round trip.
 */
let cached: { userId: string; session: FeedSession } | null = null;
let inflight: Promise<FeedSession> | null = null;

export async function getFeedSession(
  userId: string,
  userName: string,
): Promise<FeedSession> {
  if (cached?.userId === userId) return cached.session;
  if (inflight) return inflight;

  inflight = (async () => {
    const credentials = await fetchStreamCredentials(userId, userName);

    if (!credentials.feedToken || !credentials.reactionsToken) {
      throw new Error(
        "GetStream did not return feed credentials for this account, so posting and reactions are unavailable.",
      );
    }

    const client = connect(credentials.apiKey, null, getAppId());
    const userFeed = client.feed("user", userId, credentials.feedToken);

    const session: FeedSession = {
      client,
      userFeed,
      apiKey: credentials.apiKey,
      feedToken: credentials.feedToken,
      reactionsToken: credentials.reactionsToken,
      userId,
    };
    cached = { userId, session };
    return session;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export function clearFeedSession(): void {
  cached = null;
}

/* ── Reaction REST helpers ──────────────────────────────────────────────── */

async function streamRest<T>(options: {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  apiKey: string;
  token: string;
  body?: unknown;
  /** Extra query params appended after `api_key`. */
  query?: Record<string, string>;
}): Promise<T> {
  const params = new URLSearchParams({ api_key: options.apiKey, ...options.query });
  const separator = options.path.includes("?") ? "&" : "?";
  const url = `${REST_BASE}/${options.path}${separator}${params.toString()}`;

  const res = await fetch(url, {
    method: options.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: options.token,
      "stream-auth-type": "jwt",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const parsed = (await res.json()) as { detail?: string; exception?: string };
      detail = parsed.detail ?? parsed.exception ?? detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`Stream ${options.method} ${options.path} failed: ${detail}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface StreamReaction {
  id: string;
  kind: string;
  user_id: string;
  activity_id?: string;
  parent?: string;
  created_at: string;
  updated_at?: string;
  data?: Record<string, unknown>;
  children_counts?: Record<string, number>;
  latest_children?: Record<string, StreamReaction[]>;
}

export function addReaction(
  session: FeedSession,
  body: Record<string, unknown>,
): Promise<StreamReaction> {
  return streamRest<StreamReaction>({
    method: "POST",
    path: "reaction/",
    apiKey: session.apiKey,
    token: session.reactionsToken,
    body,
  });
}

export function deleteReaction(
  session: FeedSession,
  reactionId: string,
): Promise<void> {
  return streamRest<void>({
    method: "DELETE",
    path: `reaction/${encodeURIComponent(reactionId)}/`,
    apiKey: session.apiKey,
    token: session.reactionsToken,
  });
}

export function updateReaction(
  session: FeedSession,
  reactionId: string,
  body: Record<string, unknown>,
): Promise<StreamReaction> {
  return streamRest<StreamReaction>({
    method: "PUT",
    path: `reaction/${encodeURIComponent(reactionId)}/`,
    apiKey: session.apiKey,
    token: session.reactionsToken,
    body,
  });
}

/** Partial update of an activity — used to store edited post bodies. */
export function updateActivity(
  session: FeedSession,
  body: Record<string, unknown>,
): Promise<unknown> {
  return streamRest({
    method: "POST",
    path: "activity/",
    apiKey: session.apiKey,
    token: session.feedToken,
    body,
  });
}

export interface EnrichedActivity {
  id: string;
  actor: string | { id: string };
  object: string;
  edited_object?: string;
  edited?: boolean;
  time: string;
  feedId?: string;
  attachments?: unknown[];
  reaction_counts?: Record<string, number>;
  latest_reactions?: Record<string, StreamReaction[]>;
  own_reactions?: Record<string, StreamReaction[]>;
}

/**
 * Fetches one activity with its reactions — the source for a post's comment
 * thread. `enrich` resolves reaction authors server-side.
 */
export async function fetchEnrichedActivity(
  session: FeedSession,
  activityId: string,
): Promise<EnrichedActivity | null> {
  const result = await streamRest<{ results?: EnrichedActivity[] }>({
    method: "GET",
    path: "enrich/activities/",
    apiKey: session.apiKey,
    token: session.feedToken,
    query: {
      ids: activityId,
      withRecentReactions: "true",
      recentReactionsLimit: "25",
      withReactionCounts: "true",
      withOwnReactions: "true",
    },
  });
  return result?.results?.[0] ?? null;
}

/** Follows the paging URL Stream returns for long comment threads. */
export async function fetchNextReactions(
  session: FeedSession,
  nextUrl: string,
): Promise<{ results?: StreamReaction[]; next?: string }> {
  const separator = nextUrl.includes("?") ? "&" : "?";
  const url = `${REST_BASE}/${nextUrl.replace(/^\//, "")}${separator}api_key=${session.apiKey}`;
  const res = await fetch(url, {
    headers: { Authorization: session.feedToken, "stream-auth-type": "jwt" },
  });
  if (!res.ok) throw new Error(`Stream paging request failed: ${res.statusText}`);
  return (await res.json()) as { results?: StreamReaction[]; next?: string };
}
