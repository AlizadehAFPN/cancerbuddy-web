import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/aws/raiseUserLambda", () => ({ raiseUserLambda: vi.fn() }));
vi.mock("@/lib/groups/feedClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/groups/feedClient")>();
  return {
    ...actual,
    fetchEnrichedActivity: vi.fn(),
    fetchNextReactions: vi.fn(),
  };
});

import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import {
  fetchEnrichedActivity,
  fetchNextReactions,
  relativeStreamPath,
  type FeedSession,
} from "@/lib/groups/feedClient";
import {
  EMPTY_FEED_RETRIES,
  fetchGroupPostsWithEmptyRetry,
  fetchMoreComments,
  fetchPostCommentsWithRetry,
} from "./posts";

const invoke = vi.mocked(raiseUserLambda);
const enriched = vi.mocked(fetchEnrichedActivity);
const nextReactions = vi.mocked(fetchNextReactions);

/** No real waiting — every retry path is asserted on call counts, not clocks. */
const noWait = async () => {};
const session = { userId: "me" } as unknown as FeedSession;

function lambdaPage(posts: unknown[]): string {
  return JSON.stringify({ posts, next: posts.length ? "cursor" : undefined });
}

/** Acceptance check for `groups-feed-empty-page-retry`, WORKLIST Phase 3. */
describe("fetchGroupPostsWithEmptyRetry", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_USERS_LAMBDA = "users-demo";
    invoke.mockReset();
  });

  const params = { groupId: "G1", currentUserId: "me" };

  it("retries an empty page and settles on the first answer that has posts", async () => {
    invoke
      .mockResolvedValueOnce(lambdaPage([]))
      .mockResolvedValueOnce(lambdaPage([]))
      .mockResolvedValueOnce(lambdaPage([{ id: "p1", time: "2026-01-01" }]));

    const page = await fetchGroupPostsWithEmptyRetry(params, { wait: noWait });

    expect(page.posts).toHaveLength(1);
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  /** Mobile stops after three retries and shows its empty state. */
  it("gives up after the retry budget and reports the empty page", async () => {
    invoke.mockResolvedValue(lambdaPage([]));

    const page = await fetchGroupPostsWithEmptyRetry(params, { wait: noWait });

    expect(page.posts).toHaveLength(0);
    expect(invoke).toHaveBeenCalledTimes(EMPTY_FEED_RETRIES + 1);
  });

  it("does not retry a page that already has posts", async () => {
    invoke.mockResolvedValue(lambdaPage([{ id: "p1", time: "2026-01-01" }]));

    await fetchGroupPostsWithEmptyRetry(params, { wait: noWait });

    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("waits between attempts", async () => {
    invoke.mockResolvedValue(lambdaPage([]));
    const wait = vi.fn(async () => {});

    await fetchGroupPostsWithEmptyRetry(params, { wait, delayMs: 1500 });

    expect(wait).toHaveBeenCalledTimes(EMPTY_FEED_RETRIES);
    expect(wait).toHaveBeenCalledWith(1500);
  });
});

/** Acceptance check for `groups-thread-not-found-retry`, WORKLIST Phase 3. */
describe("fetchPostCommentsWithRetry", () => {
  const activity = {
    id: "act-1",
    actor: "author-1",
    object: "<p>hi</p>",
    time: "2026-01-01",
    feedId: "G1",
    latest_reactions: { comment: [] },
  };

  beforeEach(() => {
    // A block body on purpose: `() => mock.mockReset()` *returns* the mock, and
    // vitest calls a value returned from `beforeEach` as the teardown — which
    // invokes the mock and leaks its rejected promise into the next test.
    enriched.mockReset();
  });

  it("retries a rejected first attempt and renders what the second returns", async () => {
    enriched
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce(activity as never);

    const result = await fetchPostCommentsWithRetry(
      session,
      "act-1",
      async () => undefined,
      { wait: noWait },
    );

    expect(enriched).toHaveBeenCalledTimes(2);
    expect(result.post?.id).toBe("act-1");
  });

  it("retries an empty first attempt", async () => {
    enriched.mockResolvedValueOnce(null).mockResolvedValueOnce(activity as never);

    const result = await fetchPostCommentsWithRetry(
      session,
      "act-1",
      async () => undefined,
      { wait: noWait },
    );

    expect(enriched).toHaveBeenCalledTimes(2);
    expect(result.post).not.toBeNull();
  });

  /** Two empty answers is the only evidence that the post is really gone. */
  it("reports no post when both attempts come back empty", async () => {
    enriched.mockResolvedValue(null);

    const result = await fetchPostCommentsWithRetry(
      session,
      "act-1",
      async () => undefined,
      { wait: noWait },
    );

    expect(enriched).toHaveBeenCalledTimes(2);
    expect(result.post).toBeNull();
    expect(result.comments).toEqual([]);
  });

  it("never retries a successful first attempt", async () => {
    enriched.mockResolvedValue(activity as never);

    await fetchPostCommentsWithRetry(session, "act-1", async () => undefined, {
      wait: noWait,
    });

    expect(enriched).toHaveBeenCalledTimes(1);
  });

  it("does not throw when both attempts reject", async () => {
    enriched.mockRejectedValue(new Error("down"));

    const result = await fetchPostCommentsWithRetry(
      session,
      "act-1",
      async () => undefined,
      { wait: noWait },
    );

    expect(result.post).toBeNull();
  });
});

/** Acceptance check for `groups-comment-paging`, WORKLIST Phase 3. */
describe("comment paging", () => {
  beforeEach(() => {
    enriched.mockReset();
    nextReactions.mockReset();
  });

  it("surfaces Stream's cursor from the first page", async () => {
    enriched.mockResolvedValue({
      id: "act-1",
      actor: "a",
      object: "<p>x</p>",
      time: "2026-01-01",
      feedId: "G1",
      latest_reactions: { comment: [] },
      latest_reactions_extra: { comment: { next: "/api/v1.0/enrich/reaction/?id_lt=r25" } },
    } as never);

    const page = await fetchPostCommentsWithRetry(
      session,
      "act-1",
      async () => undefined,
      { wait: noWait },
    );

    expect(page.next).toBe("/api/v1.0/enrich/reaction/?id_lt=r25");
  });

  it("follows the cursor and maps the next page of comments", async () => {
    nextReactions.mockResolvedValue({
      results: [
        {
          id: "r26",
          kind: "comment",
          user_id: "u2",
          created_at: "2026-01-02",
          data: { text: "twenty-sixth" },
        },
      ],
      next: undefined,
    });

    const page = await fetchMoreComments(session, "enrich/reaction/?id_lt=r25", async () => ({
      id: "u2",
      name: "Ada",
    }));

    expect(page.comments).toHaveLength(1);
    expect(page.comments[0]!.text).toBe("twenty-sixth");
    expect(page.comments[0]!.author?.name).toBe("Ada");
    expect(page.next).toBeUndefined();
  });
});

/** Stream hands the cursor back in three shapes; all reduce to one path. */
describe("relativeStreamPath", () => {
  it("strips an absolute Stream URL", () => {
    expect(
      relativeStreamPath("https://stream-io-api.com/api/v1.0/enrich/reaction/?x=1"),
    ).toBe("enrich/reaction/?x=1");
  });

  it("strips a root-relative api path", () => {
    expect(relativeStreamPath("/api/v1.0/enrich/reaction/?x=1")).toBe(
      "enrich/reaction/?x=1",
    );
  });

  it("leaves an already-relative path alone", () => {
    expect(relativeStreamPath("enrich/reaction/?x=1")).toBe("enrich/reaction/?x=1");
  });
});
