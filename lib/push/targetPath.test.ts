import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { notificationTag, targetPath } from "./targetPath";

/** Acceptance check for `push-deeplink-routing`, WORKLIST Phase 1. */
describe("targetPath", () => {
  /**
   * The three chat payload shapes the backend actually sends. All were `/groups`
   * before this — the worker matched only `channel_type === "messaging"`.
   */
  it.each([
    [{ type: "CHAT_MESSAGE", channelId: "c1" }, "/chat/c1"],
    [{ channelId: "c1" }, "/chat/c1"],
    [{ channel_type: "messaging", channel_id: "c1" }, "/chat/c1"],
    [{ channel: JSON.stringify({ id: "c1", name: "x" }) }, "/chat/c1"],
  ])("routes chat payload %j to %s", (data, expected) => {
    expect(targetPath(data)).toBe(expected);
  });

  /**
   * Order matters: these carry a Connection id in `activityId` **and** `feedId`,
   * so the post-detail branch would open a post that does not exist. Mobile
   * documents the same trap.
   */
  it("routes a friend request to the requests tab, not a post", () => {
    expect(
      targetPath({ type: "FRIEND_REQUEST", activityId: "conn-1", feedId: "conn-1" }),
    ).toBe("/notifications?tab=requests");
  });

  it("routes an accepted request to the new buddy", () => {
    expect(targetPath({ type: "BUDDY", userId: "u1", activityId: "conn-1", feedId: "conn-1" })).toBe(
      "/buddies/u1",
    );
    expect(targetPath({ type: "BUDDY", activityId: "conn-1", feedId: "conn-1" })).toBe(
      "/notifications",
    );
  });

  it("routes a live session to its room", () => {
    expect(targetPath({ type: "LIVE_NOTIFY", eventId: "e1" })).toBe("/live/e1");
    expect(targetPath({ type: "LIVE_NOTIFY" })).toBe("/groups");
  });

  it("opens the post for a comment, and its thread for a reply", () => {
    expect(targetPath({ activityId: "a1", feedId: "g1" })).toBe(
      "/groups/g1?post=a1&feed=g1",
    );
    expect(
      targetPath({ activityId: "a1", feedId: "g1", parentReactionId: "r1" }),
    ).toBe("/groups/g1?post=a1&feed=g1&reaction=r1");
  });

  it("opens the group feed for a new post with no activity id", () => {
    expect(targetPath({ type: "POST", groupId: "g1" })).toBe("/groups/g1");
    expect(targetPath({ type: "POST" })).toBe("/groups");
  });

  it("falls back for unknown and empty payloads", () => {
    expect(targetPath({ type: "SOMETHING_NEW" })).toBe("/groups");
    expect(targetPath({})).toBe("/groups");
    expect(targetPath(null)).toBe("/groups");
    expect(targetPath(undefined)).toBe("/groups");
  });

  it("survives a malformed legacy channel blob", () => {
    expect(targetPath({ channel: "not json" })).toBe("/groups");
    expect(targetPath({ channel: JSON.stringify({ noId: true }) })).toBe("/groups");
  });
});

describe("notificationTag", () => {
  /**
   * One conversation must raise one banner. The worker used to compute its tag
   * from `cid || channel_id || group_id`, so the other two chat shapes each got
   * their own banner for the same thread.
   */
  it("gives all three chat shapes for one conversation the same tag", () => {
    const tags = new Set([
      notificationTag({ type: "CHAT_MESSAGE", channelId: "c1" }),
      notificationTag({ channel_type: "messaging", channel_id: "c1" }),
      notificationTag({ channel: JSON.stringify({ id: "c1" }) }),
    ]);
    expect(tags.size).toBe(1);
    expect([...tags][0]).toBe("chat:c1");
  });

  it("separates different conversations", () => {
    expect(notificationTag({ channelId: "c1" })).not.toBe(
      notificationTag({ channelId: "c2" }),
    );
  });

  it("groups by post and by live session", () => {
    expect(notificationTag({ activityId: "a1" })).toBe("post:a1");
    expect(notificationTag({ type: "LIVE_NOTIFY", eventId: "e1" })).toBe("live:e1");
  });
});

describe("the service worker copy stays in step", () => {
  const between = (src: string) =>
    src.slice(
      src.indexOf("/* ── ROUTING START ── */"),
      src.indexOf("/* ── ROUTING END ── */"),
    );

  /**
   * A service worker cannot import from the app bundle, so the block is
   * duplicated. Compared with type annotations stripped: the logic must match
   * exactly and only the annotations may differ.
   */
  it("matches the shared module once annotations are removed", () => {
    const moduleBlock = between(readFileSync("lib/push/targetPath.ts", "utf8"))
      .replace("function chatIdFrom(data: PushData): string {", "function chatIdFrom(data) {")
      .replace(
        "function targetPath(data: PushData | null | undefined): string {",
        "function targetPath(data) {",
      )
      .replace(
        "function notificationTag(data: PushData | null | undefined): string {",
        "function notificationTag(data) {",
      );

    const workerBlock = between(readFileSync("public/firebase-messaging-sw.js", "utf8"));

    expect(workerBlock).toBe(moduleBlock);
  });

  it("the worker uses both shared functions", () => {
    const worker = readFileSync("public/firebase-messaging-sw.js", "utf8");
    expect(worker).toMatch(/const tag = notificationTag\(data\);/);
    expect(worker).toMatch(/targetPath\(/);
    // The one-branch version is gone.
    expect(worker).not.toMatch(/if \(data\.channel_type === "messaging" && data\.channel_id\) \{\s*return `\/chat\//);
  });
});
