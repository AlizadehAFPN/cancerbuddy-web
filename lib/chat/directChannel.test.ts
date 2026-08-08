import { describe, expect, it, vi } from "vitest";

import {
  askToHostChannelName,
  replyPrivatelyChannelName,
  resolveOrCreateDirectChannel,
  type DirectChatClient,
} from "./directChannel";

/**
 * Acceptance check for `groups-reply-privately` and `groups-ask-the-host`,
 * WORKLIST Phase 3 — both consume this one find-or-create implementation, so the
 * order of its three calls is the contract being pinned.
 */

function makeClient(existing: { id?: string }[]): {
  client: DirectChatClient;
  calls: string[];
  channelArgs: unknown[][];
} {
  const calls: string[] = [];
  const channelArgs: unknown[][] = [];

  const client: DirectChatClient = {
    queryChannels: vi.fn(async (...args: unknown[]) => {
      calls.push("queryChannels");
      channelArgs.push(args);
      return existing;
    }),
    channel: vi.fn((type: string, id: string, data: Record<string, unknown>) => {
      calls.push("channel");
      channelArgs.push([type, id, data]);
      return {
        id,
        create: async () => {
          calls.push("create");
        },
        watch: async () => {
          calls.push("watch");
        },
      };
    }),
  };

  return { client, calls, channelArgs };
}

describe("resolveOrCreateDirectChannel", () => {
  it("reuses the pair's existing channel and creates no connection", async () => {
    const { client, calls } = makeClient([{ id: "older-conn" }]);
    const createConnection = vi.fn();
    const acceptConnection = vi.fn();

    const id = await resolveOrCreateDirectChannel({
      client,
      me: "me",
      them: "them",
      name: "Ada Host",
      createConnection,
      acceptConnection,
    });

    expect(id).toBe("older-conn");
    expect(createConnection).not.toHaveBeenCalled();
    expect(acceptConnection).not.toHaveBeenCalled();
    expect(calls).toEqual(["queryChannels"]);
  });

  it("queries by the exact member pair", async () => {
    const { client, channelArgs } = makeClient([{ id: "c1" }]);
    await resolveOrCreateDirectChannel({
      client,
      me: "me",
      them: "them",
      name: "x",
      createConnection: vi.fn(),
      acceptConnection: vi.fn(),
    });

    expect(channelArgs[0]![0]).toEqual({
      type: "messaging",
      members: { $eq: ["me", "them"] },
    });
  });

  /** Mobile's ladder: createConnection → AcceptConnection → channel watch. */
  it("mints the connection first, then watches the channel it names", async () => {
    const { client, calls, channelArgs } = makeClient([]);
    const order: string[] = [];
    const createConnection = vi.fn(async () => {
      order.push("createConnection");
      calls.push("createConnection");
      return "new-conn";
    });
    const acceptConnection = vi.fn(async () => {
      order.push("acceptConnection");
      calls.push("acceptConnection");
    });

    const id = await resolveOrCreateDirectChannel({
      client,
      me: "me",
      them: "them",
      name: "Ada Host",
      createConnection,
      acceptConnection,
    });

    expect(id).toBe("new-conn");
    expect(calls).toEqual([
      "queryChannels",
      "createConnection",
      "acceptConnection",
      "channel",
      "create",
      "watch",
    ]);
    expect(channelArgs[1]).toEqual([
      "messaging",
      "new-conn",
      { members: ["me", "them"], name: "Ada Host" },
    ]);
  });

  /**
   * A Stream outage must not mint a second connection row for a pair who already
   * have one — that is the one failure this cannot undo.
   */
  it("gives up rather than creating a connection when the lookup fails", async () => {
    const client: DirectChatClient = {
      queryChannels: vi.fn(async () => {
        throw new Error("stream down");
      }),
      channel: vi.fn(),
    };
    const createConnection = vi.fn();

    const id = await resolveOrCreateDirectChannel({
      client,
      me: "me",
      them: "them",
      name: "x",
      createConnection,
      acceptConnection: vi.fn(),
    });

    expect(id).toBeNull();
    expect(createConnection).not.toHaveBeenCalled();
  });

  it("returns null rather than messaging yourself", async () => {
    const { client, calls } = makeClient([{ id: "c1" }]);
    const id = await resolveOrCreateDirectChannel({
      client,
      me: "me",
      them: "me",
      name: "x",
      createConnection: vi.fn(),
      acceptConnection: vi.fn(),
    });

    expect(id).toBeNull();
    expect(calls).toEqual([]);
  });

  it("returns null when the connection could not be created", async () => {
    const { client } = makeClient([]);
    const id = await resolveOrCreateDirectChannel({
      client,
      me: "me",
      them: "them",
      name: "x",
      createConnection: vi.fn(async () => ""),
      acceptConnection: vi.fn(),
    });
    expect(id).toBeNull();
  });
});

/** Both literals are mobile's, including the odd one. */
describe("channel names", () => {
  it("names a private reply after the author's first name", () => {
    expect(replyPrivatelyChannelName("Ada Lovelace")).toBe("Ada Host");
  });

  it("names an ask-the-host channel after the asker, with mobile's suffix", () => {
    expect(askToHostChannelName("Ada Lovelace")).toBe("Ada Lovelace Ambassador");
  });

  it("survives a missing name", () => {
    expect(replyPrivatelyChannelName(null)).toBe("Host");
    expect(askToHostChannelName(undefined)).toBe("Ambassador");
  });
});
