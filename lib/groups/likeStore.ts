/**
 * One truth for a post's like and comment counts, shared by every surface that
 * renders them.
 *
 * The feed and the comment thread each held their own copy, so liking a post in
 * the feed and then opening its thread showed two different numbers — and a
 * refetch that had been in flight since before the tap could land afterwards and
 * undo it.
 *
 * Two rules make that impossible:
 *
 * 1. **Server snapshots are monotonic.** Each carries a stamp taken when its
 *    request *started*; an older stamp is discarded rather than applied. A slow
 *    response can therefore never overwrite a newer local truth.
 * 2. **A tap is an overlay, not a write.** `pendingIsLiked` sits on top of the
 *    server count and contributes exactly ±1 until the server echo arrives. That
 *    way the optimistic delta is never double-counted when the echo agrees.
 */

export interface LikeSnapshot {
  likeCount: number;
  commentCount: number;
  myLikeReactionId?: string;
}

interface Entry extends LikeSnapshot {
  /** `performance.now()`-style stamp of the snapshot that produced this. */
  stamp: number;
  /** Set while a tap is in flight; cleared when the server echoes. */
  pendingIsLiked?: boolean;
}

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function subscribeToLikes(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Monotonic stamp source. Callers take one *before* issuing their request. */
export function likeStamp(): number {
  return Date.now();
}

/**
 * Applies a server-authored snapshot, unless a newer one has already landed.
 *
 * Returns whether it was applied, which the tests assert on directly.
 */
export function applyServerSnapshot(
  postId: string,
  snapshot: LikeSnapshot,
  stamp: number,
): boolean {
  const existing = entries.get(postId);
  if (existing && stamp <= existing.stamp) return false;

  entries.set(postId, {
    ...snapshot,
    stamp,
    // A snapshot that agrees with the pending overlay retires it; one that does
    // not is from before the tap, so the overlay stays until its own echo.
    pendingIsLiked:
      existing?.pendingIsLiked !== undefined &&
      existing.pendingIsLiked !== !!snapshot.myLikeReactionId
        ? existing.pendingIsLiked
        : undefined,
  });
  emit();
  return true;
}

/** Records an in-flight tap. */
export function setPendingLike(postId: string, isLiked: boolean): void {
  const existing = entries.get(postId);
  if (!existing) return;
  entries.set(postId, { ...existing, pendingIsLiked: isLiked });
  emit();
}

/** Drops the overlay — after the echo lands, or after a failure. */
export function clearPendingLike(postId: string): void {
  const existing = entries.get(postId);
  if (!existing || existing.pendingIsLiked === undefined) return;
  entries.set(postId, { ...existing, pendingIsLiked: undefined });
  emit();
}

/** Local-only count edit — a new comment, say — without touching the stamp. */
export function patchCommentCount(postId: string, commentCount: number): void {
  const existing = entries.get(postId);
  if (!existing) return;
  entries.set(postId, { ...existing, commentCount });
  emit();
}

/**
 * The numbers to render: the server snapshot with the pending overlay applied.
 *
 * `fallback` is used when nothing has been recorded for this post yet, so a
 * surface that renders before its first snapshot still shows its own data.
 */
export function readLikes(postId: string, fallback: LikeSnapshot): LikeSnapshot {
  const entry = entries.get(postId);
  if (!entry) return fallback;

  const serverIsLiked = !!entry.myLikeReactionId;
  const { pendingIsLiked } = entry;

  if (pendingIsLiked === undefined || pendingIsLiked === serverIsLiked) {
    return {
      likeCount: entry.likeCount,
      commentCount: entry.commentCount,
      myLikeReactionId: entry.myLikeReactionId,
    };
  }

  return {
    likeCount: Math.max(0, entry.likeCount + (pendingIsLiked ? 1 : -1)),
    commentCount: entry.commentCount,
    // The overlay decides the heart's state; the id is unknown until the echo.
    myLikeReactionId: pendingIsLiked ? (entry.myLikeReactionId ?? "pending") : undefined,
  };
}

/** Test seam, and used when a feed unmounts so a stale entry cannot leak. */
export function resetLikeStore(): void {
  entries.clear();
  emit();
}
