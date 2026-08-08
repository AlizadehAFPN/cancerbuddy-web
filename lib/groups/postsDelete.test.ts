import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/aws/raiseUserLambda", () => ({
  raiseUserLambda: vi.fn(),
}));

import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import { buildDeletePayload, deleteComment, deletePost } from "./posts";

const invoke = vi.mocked(raiseUserLambda);
const post = { id: "act-1", feedId: "feed-9" };

/**
 * Acceptance check for `groups-delete-via-deletemessage-lambda`, WORKLIST Phase 0.
 *
 * The bug was not a wrong payload — it was calling `feed.removeActivity` on the
 * *caller's own* feed, which resolves successfully while deleting nothing another
 * member wrote. So these assert both halves: the wire shape mobile sends, and that
 * a non-success response is surfaced as a failure instead of a silent no-op.
 */
describe("deleteMessage payload", () => {
  it("shapes a post delete the way mobile does", () => {
    expect(buildDeletePayload({ kind: "post", post })).toEqual({
      type: "deleteMessage",
      feedId: "feed-9",
      postId: "act-1",
      commentId: "act-1",
      isPost: true,
    });
  });

  /** `postId` is the parent post, `commentId` the reaction being removed. */
  it("shapes a comment delete with isPost false and the parent post id", () => {
    expect(
      buildDeletePayload({ kind: "comment", post, commentId: "reaction-7" }),
    ).toEqual({
      type: "deleteMessage",
      feedId: "feed-9",
      postId: "act-1",
      commentId: "reaction-7",
      isPost: false,
    });
  });
});

describe("deletePost / deleteComment", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_USERS_LAMBDA = "users-demo";
  });

  it("invokes the users Lambda with the deleteMessage verb", async () => {
    invoke.mockResolvedValue(JSON.stringify({ success: true }));
    await deletePost(post);

    expect(invoke).toHaveBeenCalledTimes(1);
    const [verb, fn, payload] = invoke.mock.calls[0]!;
    expect(verb).toBe("deleteMessage");
    expect(fn).toBe("users-demo");
    expect(payload).toMatchObject({ postId: "act-1", isPost: true });
  });

  it("passes the comment variant through for a reply", async () => {
    invoke.mockResolvedValue(JSON.stringify({ success: true }));
    await deleteComment(post, "reaction-7");
    expect(invoke.mock.calls[0]![2]).toMatchObject({
      commentId: "reaction-7",
      isPost: false,
    });
  });

  /** This is the regression that mattered: success must not be assumed. */
  it("throws when the Lambda does not report success", async () => {
    invoke.mockResolvedValue(JSON.stringify({ success: false }));
    await expect(deletePost(post)).rejects.toThrow(/could not delete/i);
  });

  it("throws when the response is not JSON", async () => {
    invoke.mockResolvedValue("<html>gateway timeout</html>");
    await expect(deletePost(post)).rejects.toThrow(/could not delete/i);
  });

  it("throws on an empty response", async () => {
    invoke.mockResolvedValue("");
    await expect(deleteComment(post, "r-1")).rejects.toThrow(/could not delete/i);
  });

  /** The Lambda double-encodes sometimes; `parseLambdaJson` unwraps it. */
  it("accepts a double-encoded success body", async () => {
    invoke.mockResolvedValue(JSON.stringify(JSON.stringify({ success: true })));
    await expect(deletePost(post)).resolves.toBeUndefined();
  });
});
