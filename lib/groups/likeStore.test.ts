import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";

import {
  applyServerSnapshot,
  clearPendingLike,
  patchCommentCount,
  readLikes,
  resetLikeStore,
  setPendingLike,
} from "./likeStore";

const FALLBACK = { likeCount: 0, commentCount: 0, myLikeReactionId: undefined };

/** Acceptance check for `like-count-consistency-store`, WORKLIST Phase 0. */
describe("likeStore ordering", () => {
  beforeEach(() => resetLikeStore());

  it("falls back to the caller's copy before any snapshot", () => {
    expect(readLikes("p1", { likeCount: 7, commentCount: 2 })).toEqual({
      likeCount: 7,
      commentCount: 2,
    });
  });

  /**
   * The load-bearing rule. A refetch in flight since before the tap must not
   * land afterwards and undo it.
   */
  it("discards an earlier-stamped snapshot", () => {
    applyServerSnapshot("p1", { likeCount: 5, commentCount: 0 }, 200);
    expect(applyServerSnapshot("p1", { likeCount: 1, commentCount: 0 }, 100)).toBe(
      false,
    );
    expect(readLikes("p1", FALLBACK).likeCount).toBe(5);
  });

  it("applies a later-stamped snapshot", () => {
    applyServerSnapshot("p1", { likeCount: 5, commentCount: 0 }, 100);
    expect(applyServerSnapshot("p1", { likeCount: 9, commentCount: 0 }, 200)).toBe(
      true,
    );
    expect(readLikes("p1", FALLBACK).likeCount).toBe(9);
  });

  it("discards a snapshot with an equal stamp", () => {
    applyServerSnapshot("p1", { likeCount: 5, commentCount: 0 }, 100);
    expect(applyServerSnapshot("p1", { likeCount: 1, commentCount: 0 }, 100)).toBe(
      false,
    );
  });
});

describe("pending overlay", () => {
  beforeEach(() => resetLikeStore());

  it("adds exactly +1 until the echo arrives", () => {
    applyServerSnapshot("p1", { likeCount: 4, commentCount: 0 }, 100);
    setPendingLike("p1", true);

    expect(readLikes("p1", FALLBACK)).toMatchObject({
      likeCount: 5,
      myLikeReactionId: "pending",
    });

    // The echo agrees, so the overlay retires and the count does NOT become 6.
    applyServerSnapshot(
      "p1",
      { likeCount: 5, commentCount: 0, myLikeReactionId: "r1" },
      200,
    );
    expect(readLikes("p1", FALLBACK)).toMatchObject({
      likeCount: 5,
      myLikeReactionId: "r1",
    });
  });

  it("subtracts exactly 1 when unliking, and never goes below zero", () => {
    applyServerSnapshot(
      "p1",
      { likeCount: 1, commentCount: 0, myLikeReactionId: "r1" },
      100,
    );
    setPendingLike("p1", false);
    expect(readLikes("p1", FALLBACK)).toMatchObject({
      likeCount: 0,
      myLikeReactionId: undefined,
    });

    applyServerSnapshot("p1", { likeCount: 0, commentCount: 0 }, 50);
    setPendingLike("p1", false);
    expect(readLikes("p1", FALLBACK).likeCount).toBe(0);
  });

  it("restores the server truth when the overlay is cleared after a failure", () => {
    applyServerSnapshot("p1", { likeCount: 4, commentCount: 0 }, 100);
    setPendingLike("p1", true);
    expect(readLikes("p1", FALLBACK).likeCount).toBe(5);

    clearPendingLike("p1");
    expect(readLikes("p1", FALLBACK)).toMatchObject({
      likeCount: 4,
      myLikeReactionId: undefined,
    });
  });

  /** A stale snapshot from before the tap must not cancel the overlay. */
  it("keeps the overlay when a snapshot disagrees with it", () => {
    applyServerSnapshot("p1", { likeCount: 4, commentCount: 0 }, 100);
    setPendingLike("p1", true);
    applyServerSnapshot("p1", { likeCount: 4, commentCount: 0 }, 150);
    expect(readLikes("p1", FALLBACK).likeCount).toBe(5);
  });

  it("tracks comment counts without disturbing likes", () => {
    applyServerSnapshot(
      "p1",
      { likeCount: 4, commentCount: 1, myLikeReactionId: "r1" },
      100,
    );
    patchCommentCount("p1", 3);
    expect(readLikes("p1", FALLBACK)).toMatchObject({
      likeCount: 4,
      commentCount: 3,
      myLikeReactionId: "r1",
    });
  });
});

/** Acceptance check for `groups-thread-post-actions`, WORKLIST Phase 0. */
describe("the thread's post actions are wired", () => {
  const source = readFileSync("components/groups/PostThread.tsx", "utf8");

  it("has no empty-arrow stubs for like or actions", () => {
    expect(source).not.toMatch(/onToggleLike=\{\(\)\s*=>\s*\{\}\}/);
    expect(source).not.toMatch(/onOpenActions=\{\(\)\s*=>\s*\{\}\}/);
  });

  it("calls the shared toggle and delegates the ⋯ menu to the feed", () => {
    expect(source).toMatch(/useToggleLike\(/);
    expect(source).toMatch(/onOpenActions=\{onOpenActions\}/);
  });

  /** Both surfaces must read the same store, or the counts drift again. */
  it("renders counts from the shared store in PostCard", () => {
    const card = readFileSync("components/groups/PostCard.tsx", "utf8");
    expect(card).toMatch(/useLikeSnapshot\(/);
    expect(card).toMatch(/counts\.likeCount/);
    expect(card).toMatch(/counts\.commentCount/);
  });
});
