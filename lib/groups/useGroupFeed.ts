"use client";

/**
 * A group's post feed: paging, realtime refresh, and the write actions that
 * mutate it.
 *
 * Posts are paged from `USERS_LAMBDA`; new posts by *other* members arrive via
 * an AppSync subscription and trigger a reload of the first page (the Lambda
 * doesn't stream, and a full reload is cheap next to reconciling by hand).
 * Likes are optimistic — the count and heart flip immediately and roll back if
 * the request fails, because a like that lags reads as a broken button.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { API, graphqlOperation } from "aws-amplify";
import { useGroups } from "@/lib/groups/GroupsProvider";
import {
  POSTS_PER_PAGE,
  deletePost,
  editPost,
  fetchGroupPosts,
  likePost,
  sortPosts,
  unlikePost,
} from "@/lib/groups/posts";
import type { FeedPost } from "@/lib/groups/types";

const ON_CREATE_POST = /* GraphQL */ `
  subscription OnCreatePostByGroupId($groupId: ID!) {
    onCreatePostByGroupId(groupId: $groupId) {
      id
      groupId
      actorId
    }
  }
`;

export interface GroupFeed {
  posts: FeedPost[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => Promise<void>;
  toggleLike: (post: FeedPost) => Promise<void>;
  removePost: (post: FeedPost) => Promise<void>;
  updatePostBody: (post: FeedPost, html: string) => Promise<void>;
  /** Merges a locally-known change (new comment count, pin state) into the list. */
  patchPost: (postId: string, patch: Partial<FeedPost>) => void;
}

export function useGroupFeed(groupId: string | null): GroupFeed {
  const { userId, requireFeedSession } = useGroups();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const mountedRef = useRef(true);
  const runIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadPage = useCallback(
    async (pageIndex: number, mode: "replace" | "append") => {
      if (!groupId || !userId) return;

      const runId = ++runIdRef.current;
      if (mode === "replace") setLoading(true);
      else setLoadingMore(true);

      try {
        const result = await fetchGroupPosts({
          groupId,
          currentUserId: userId,
          offset: pageIndex * POSTS_PER_PAGE,
        });
        if (!mountedRef.current || runId !== runIdRef.current) return;

        setPosts((prev) => {
          if (mode === "replace") return result.posts;
          // De-dupe: paging by offset can repeat a row when someone posts mid-scroll.
          const seen = new Set(prev.map((p) => p.id));
          return sortPosts([
            ...prev,
            ...result.posts.filter((p) => !seen.has(p.id)),
          ]);
        });
        setHasMore(!!result.next && result.posts.length > 0);
        setError(null);
      } catch (err) {
        console.error("[groups] feed load failed:", err);
        if (mountedRef.current && runId === runIdRef.current) {
          setError("We couldn't load this group's posts.");
        }
      } finally {
        if (mountedRef.current && runId === runIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [groupId, userId],
  );

  // Reset and load whenever the selected group changes.
  useEffect(() => {
    setPosts([]);
    setPage(0);
    setHasMore(false);
    setError(null);
    if (groupId && userId) void loadPage(0, "replace");
    else setLoading(false);
  }, [groupId, userId, loadPage]);

  useEffect(() => {
    if (!groupId || !userId) return;

    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const observable = API.graphql(
        graphqlOperation(ON_CREATE_POST, { groupId }),
      ) as {
        subscribe: (handlers: {
          next: (msg: {
            value?: { data?: { onCreatePostByGroupId?: { actorId?: string } } };
          }) => void;
          error: () => void;
        }) => { unsubscribe: () => void };
      };

      subscription = observable.subscribe({
        next: (msg) => {
          const actorId = msg?.value?.data?.onCreatePostByGroupId?.actorId;
          // Our own post is already in the list optimistically.
          if (actorId && actorId !== userId) {
            setPage(0);
            void loadPage(0, "replace");
          }
        },
        error: () => {},
      });
    } catch (err) {
      console.error("[groups] post subscription failed:", err);
    }

    return () => subscription?.unsubscribe();
  }, [groupId, userId, loadPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    void loadPage(next, "append");
  }, [loading, loadingMore, hasMore, page, loadPage]);

  const refresh = useCallback(async () => {
    setPage(0);
    await loadPage(0, "replace");
  }, [loadPage]);

  const patchPost = useCallback((postId: string, patch: Partial<FeedPost>) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)),
    );
  }, []);

  const toggleLike = useCallback(
    async (post: FeedPost) => {
      const liked = !!post.myLikeReactionId;

      // Optimistic flip.
      patchPost(post.id, {
        myLikeReactionId: liked ? undefined : "pending",
        likeCount: Math.max(0, post.likeCount + (liked ? -1 : 1)),
      });

      try {
        const session = await requireFeedSession();
        if (liked) {
          await unlikePost(session, post.myLikeReactionId!);
        } else {
          const reactionId = await likePost(session, post.id);
          patchPost(post.id, { myLikeReactionId: reactionId });
        }
      } catch (err) {
        console.error("[groups] like failed:", err);
        patchPost(post.id, {
          myLikeReactionId: post.myLikeReactionId,
          likeCount: post.likeCount,
        });
        throw err;
      }
    },
    [patchPost, requireFeedSession],
  );

  const removePost = useCallback(
    async (post: FeedPost) => {
      const session = await requireFeedSession();
      await deletePost(session, post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    },
    [requireFeedSession],
  );

  const updatePostBody = useCallback(
    async (post: FeedPost, html: string) => {
      const session = await requireFeedSession();
      await editPost(session, post.id, html);
      patchPost(post.id, { html, edited: true });
    },
    [requireFeedSession, patchPost],
  );

  return {
    posts,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
    toggleLike,
    removePost,
    updatePostBody,
    patchPost,
  };
}
