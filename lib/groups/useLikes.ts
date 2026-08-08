"use client";

import { useCallback, useSyncExternalStore } from "react";

import { likePost, unlikePost } from "@/lib/groups/posts";
import type { FeedSession } from "@/lib/groups/feedClient";
import {
  applyServerSnapshot,
  clearPendingLike,
  likeStamp,
  readLikes,
  setPendingLike,
  subscribeToLikes,
  type LikeSnapshot,
} from "@/lib/groups/likeStore";
import type { FeedPost } from "@/lib/groups/types";

/**
 * The like/comment counts for one post, from the shared store.
 *
 * `fallback` is the surface's own copy, used until a snapshot is recorded.
 */
export function useLikeSnapshot(
  postId: string,
  fallback: LikeSnapshot,
): LikeSnapshot {
  return useSyncExternalStore(
    subscribeToLikes,
    () => readLikes(postId, fallback),
    () => fallback,
  );
}

/**
 * Toggling a like, shared by the feed and the comment thread.
 *
 * The optimistic overlay goes up before the request and comes down when the
 * server echoes — or on failure, which restores the previous state exactly
 * because the overlay was never written into the snapshot.
 */
export function useToggleLike(
  requireFeedSession: () => Promise<FeedSession>,
): (post: FeedPost) => Promise<void> {
  return useCallback(
    async (post: FeedPost) => {
      const wasLiked = !!post.myLikeReactionId;

      // Seed the store from the caller's copy so the overlay has a base.
      applyServerSnapshot(
        post.id,
        {
          likeCount: post.likeCount,
          commentCount: post.commentCount,
          myLikeReactionId: post.myLikeReactionId,
        },
        likeStamp(),
      );
      setPendingLike(post.id, !wasLiked);

      const stamp = likeStamp();
      try {
        const session = await requireFeedSession();
        if (wasLiked) {
          await unlikePost(session, post.myLikeReactionId!);
          applyServerSnapshot(
            post.id,
            {
              likeCount: Math.max(0, post.likeCount - 1),
              commentCount: post.commentCount,
              myLikeReactionId: undefined,
            },
            stamp,
          );
        } else {
          const reactionId = await likePost(session, post.id);
          applyServerSnapshot(
            post.id,
            {
              likeCount: post.likeCount + 1,
              commentCount: post.commentCount,
              myLikeReactionId: reactionId,
            },
            stamp,
          );
        }
      } catch (err) {
        console.error("[groups] like failed:", err);
        throw err;
      } finally {
        clearPendingLike(post.id);
      }
    },
    [requireFeedSession],
  );
}
