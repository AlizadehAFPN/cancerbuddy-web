/**
 * Joining, leaving and muting groups.
 *
 * Membership lives in two places at once and both must be kept in step:
 * AppSync owns the `UserGroup` row (via `USERS_LAMBDA`), and GetStream owns the
 * feed follow that actually delivers posts. Mobile follows the feed *first*,
 * then writes the row; leaving reverses it. Doing only one leaves a member who
 * sees no posts, or a follower with no membership.
 */

import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import type { FeedSession } from "@/lib/groups/feedClient";

function usersLambdaName(): string {
  const v = process.env.NEXT_PUBLIC_USERS_LAMBDA?.trim();
  if (!v) throw new Error("NEXT_PUBLIC_USERS_LAMBDA is not set.");
  return v;
}

export async function joinGroup(params: {
  session: FeedSession;
  groupId: string;
}): Promise<void> {
  await params.session.userFeed.follow("user", params.groupId);
  await raiseUserLambda(LambdaPayloadType.JOIN_GROUP, usersLambdaName(), {
    userId: params.session.userId,
    groupId: params.groupId,
  });
}

export async function leaveGroup(params: {
  session: FeedSession;
  groupId: string;
  /** The `UserGroup` row id — the Lambda deletes by it, not by group id. */
  userGroupId: string;
}): Promise<void> {
  // `keepHistory: false` drops the group's posts from the user's feed, matching
  // mobile — otherwise a left group's posts linger in aggregated views.
  await params.session.userFeed.unfollow("user", params.groupId, {
    keepHistory: false,
  });
  await raiseUserLambda(LambdaPayloadType.LEAVE_GROUP, usersLambdaName(), {
    id: params.userGroupId,
    userId: params.session.userId,
    groupId: params.groupId,
  });
}

/**
 * Toggles post notifications. `muted` is the state the group is in *now*, so
 * passing `true` unmutes — the same inverted convention as mobile's
 * `muteOrUnmuteGroup`, kept so the Lambda receives what it expects.
 */
export async function setGroupMuted(params: {
  userId: string;
  groupId: string;
  userGroupId: string;
  muted: boolean;
}): Promise<boolean> {
  const raw = await raiseUserLambda(
    params.muted ? LambdaPayloadType.UNMUTE_GROUP : LambdaPayloadType.MUTE_GROUP,
    usersLambdaName(),
    { id: params.userGroupId, userId: params.userId, groupId: params.groupId },
  );

  try {
    const parsed = JSON.parse(raw) as { statusCode?: number };
    return parsed?.statusCode === 204 || parsed?.statusCode === 200;
  } catch {
    return false;
  }
}

/** Number of members following a group's feed. */
export async function fetchGroupFollowerCount(
  session: FeedSession,
  groupId: string,
): Promise<number> {
  try {
    const groupFeed = session.client.feed("user", groupId, session.feedToken);
    const stats = await groupFeed.followStats();
    return stats?.results?.followers?.count ?? 0;
  } catch {
    return 0;
  }
}

/* ── Reporting ──────────────────────────────────────────────────────────── */

const REPORT_POST = /* GraphQL */ `
  mutation reportPost($input: CreateReportPostInput!) {
    createReportPost(input: $input) {
      id
    }
  }
`;

export async function reportPost(params: {
  postId: string;
  userId: string;
  reason: string;
}): Promise<void> {
  await executeAppSyncGraphql({
    query: REPORT_POST,
    variables: {
      input: {
        postId: params.postId,
        userId: params.userId,
        reason: params.reason,
      },
    },
    authWithUserPool: true,
  });
}
