import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  buddyChannelName,
  resolveBuddyChannelId,
  type ChatClientLike,
} from "./resolveBuddyChannel";

/** Acceptance check for `buddy-chat-channel-resolution`, WORKLIST Phase 1. */

function stubClient(existing: { id?: string }[]) {
  const channel = { create: vi.fn().mockResolvedValue(null), watch: vi.fn().mockResolvedValue(null) };
  const client = {
    queryChannels: vi.fn().mockResolvedValue(existing),
    channel: vi.fn().mockReturnValue(channel),
  };
  return { client: client as unknown as ChatClientLike, raw: client, channel };
}

describe("resolveBuddyChannelId", () => {
  /**
   * The case the item exists for: a pair who reconnected have a newer connection
   * row than the channel holding their history. Opening the connection id would
   * show an empty conversation beside the real one.
   */
  it("prefers the pair's existing channel over the connection id", async () => {
    const { client, raw } = stubClient([{ id: "older-conn" }]);

    await expect(
      resolveBuddyChannelId({ client, me: "me", them: "them", connectionId: "new-conn" }),
    ).resolves.toBe("older-conn");

    expect(raw.channel).not.toHaveBeenCalled();
    // Queried by member pair, newest first.
    expect(raw.queryChannels.mock.calls[0]![0]).toEqual({
      type: "messaging",
      members: { $eq: ["me", "them"] },
    });
    expect(raw.queryChannels.mock.calls[0]![1]).toEqual([{ last_message_at: -1 }]);
  });

  it("creates and watches the connection-id channel when none exists", async () => {
    const { client, raw, channel } = stubClient([]);

    await expect(
      resolveBuddyChannelId({
        client,
        me: "me",
        them: "them",
        connectionId: "conn-1",
        myName: "Ada Lovelace",
        theirName: "Grace Hopper",
      }),
    ).resolves.toBe("conn-1");

    expect(raw.channel).toHaveBeenCalledWith("messaging", "conn-1", {
      members: ["me", "them"],
      name: "Grace Ada",
    });
    expect(channel.create).toHaveBeenCalledTimes(1);
    expect(channel.watch).toHaveBeenCalledTimes(1);
  });

  /** Navigating to a channel that cannot exist shows an error page instead of the reason. */
  it("returns null when there is no channel and no connection", async () => {
    const { client, raw } = stubClient([]);
    await expect(
      resolveBuddyChannelId({ client, me: "me", them: "them", connectionId: null }),
    ).resolves.toBeNull();
    expect(raw.channel).not.toHaveBeenCalled();
  });

  it("returns null without a viewer or a target", async () => {
    const { client, raw } = stubClient([{ id: "x" }]);
    await expect(
      resolveBuddyChannelId({ client, me: "", them: "them", connectionId: "c" }),
    ).resolves.toBeNull();
    expect(raw.queryChannels).not.toHaveBeenCalled();
  });

  /** An unreachable Stream must not block a pair who are demonstrably connected. */
  it("falls back to the connection id when the query fails", async () => {
    const { client, raw } = stubClient([]);
    raw.queryChannels.mockRejectedValueOnce(new Error("offline"));
    await expect(
      resolveBuddyChannelId({ client, me: "me", them: "them", connectionId: "conn-1" }),
    ).resolves.toBe("conn-1");
  });

  it("still returns the id when provisioning throws", async () => {
    const { client, channel } = stubClient([]);
    channel.create.mockRejectedValueOnce(new Error("nope"));
    await expect(
      resolveBuddyChannelId({ client, me: "me", them: "them", connectionId: "conn-1" }),
    ).resolves.toBe("conn-1");
  });
});

describe("buddyChannelName", () => {
  /** Target's first name first — the order mobile builds it in. */
  it("uses first names, target first", () => {
    expect(buddyChannelName("Grace Hopper", "Ada Lovelace")).toBe("Grace Ada");
  });

  it("tolerates missing names", () => {
    expect(buddyChannelName(null, "Ada Lovelace")).toBe("Ada");
    expect(buddyChannelName("Grace Hopper", null)).toBe("Grace");
    expect(buddyChannelName(null, null)).toBe("");
  });
});

describe("the profile screen uses the resolver", () => {
  const source = readFileSync("components/buddies/BuddyProfileScreen.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  it("no longer navigates straight to the connection id", () => {
    expect(source).toMatch(/resolveBuddyChannelId\(/);
    expect(source).not.toMatch(/router\.push\(`\/chat\/\$\{connection\.connectionId\}`\)/);
  });

  it("says so rather than navigating when nothing resolves", () => {
    expect(source).toMatch(/chatUnavailable/);
  });
});
