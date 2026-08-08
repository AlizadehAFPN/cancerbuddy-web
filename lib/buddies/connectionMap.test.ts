import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/aws/appsyncGraphql", () => ({
  executeAppSyncGraphql: vi.fn(),
}));

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import {
  createConnectionRequest,
  fetchConnectionMap,
  findExistingPendingRequest,
} from "./connections";

const exec = vi.mocked(executeAppSyncGraphql);

/** Acceptance check for `buddies-connection-map-indexed-read`, WORKLIST Phase 0. */
describe("fetchConnectionMap reads through the indexes", () => {
  beforeEach(() => exec.mockReset());

  /**
   * The defect: `listConnections(filter: {connectionRecipientId: ...})` is a
   * table scan, and DynamoDB applies `limit` *before* the filter — so on a large
   * table the user's own rows can fall outside the page entirely and someone
   * already connected shows a live Connect button.
   */
  it("uses byRecipientId / byRemitentId, not a filtered listConnections", () => {
    const code = readFileSync("lib/buddies/connections.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    const received = code.slice(
      code.indexOf("const CONNECTIONS_RECEIVED"),
      code.indexOf("const CONNECTIONS_SENT"),
    );
    const sent = code.slice(
      code.indexOf("const CONNECTIONS_SENT"),
      code.indexOf("const BLOCKED_USERS"),
    );

    expect(received).toMatch(/byRecipientId\(/);
    expect(received).not.toMatch(/listConnections/);
    expect(sent).toMatch(/byRemitentId\(/);
    expect(sent).not.toMatch(/listConnections/);

    // The id is the index key, not a filter entry.
    expect(received).toMatch(/connectionRecipientId:\s*"\$\{safeId\(userId\)\}"/);
    expect(sent).toMatch(/connectionRemitentId:\s*"\$\{safeId\(userId\)\}"/);

    // Bounded page — the huge limit only existed to make the scan work.
    expect(received).toMatch(/limit:\s*\$\{CONNECTION_PAGE_SIZE\}/);
    expect(sent).toMatch(/limit:\s*\$\{CONNECTION_PAGE_SIZE\}/);
  });

  it("pages both directions and maps every row", async () => {
    // Order is deterministic: `Promise.all` starts received then sent, and each
    // direction pages sequentially. Received returns two pages, sent one.
    exec
      .mockImplementationOnce(
        async () =>
          ({
            data: {
              byRecipientId: {
                items: [{ id: "c1", accepted: true, userID: "u1" }],
                nextToken: "r2",
              },
            },
          }) as never,
      )
      .mockImplementationOnce(
        async () =>
          ({
            data: {
              byRemitentId: {
                items: [{ id: "c3", accepted: false, userID: "u3" }],
                nextToken: null,
              },
            },
          }) as never,
      )
      .mockImplementationOnce(
        async () =>
          ({
            data: {
              byRecipientId: {
                items: [{ id: "c2", accepted: false, userID: "u2" }],
                nextToken: null,
              },
            },
          }) as never,
      );

    const map = await fetchConnectionMap("me");

    expect(exec).toHaveBeenCalledTimes(3);
    expect(map).toEqual({
      u1: { status: "connected", connectionId: "c1" },
      u2: { status: "pending", connectionId: "c2" },
      u3: { status: "pending", connectionId: "c3" },
    });
    // Page two must carry the token, or paging is a no-op loop.
    const queries = exec.mock.calls.map((c) => (c[0] as { query: string }).query);
    expect(queries.some((q) => q.includes('nextToken: "r2"'))).toBe(true);
  });

  /**
   * A resolver change or a partial GraphQL error yields a response without the
   * index key. That must produce an empty map, not a crash on the profile screen.
   *
   * (The network-failure path is `collectConnections`' own try/catch, which
   * predates this item; asserting it here only exercises vitest's
   * unhandled-rejection reporting.)
   */
  it("returns an empty map when the response has no rows", async () => {
    exec.mockImplementation(async () => ({ data: {} }) as never);
    await expect(fetchConnectionMap("me")).resolves.toEqual({});
  });

  it("skips rows with no counterpart id", async () => {
    exec.mockImplementation(
      async () =>
        ({
          data: {
            byRecipientId: {
              items: [{ id: "c1", accepted: true, userID: null }],
              nextToken: null,
            },
            byRemitentId: { items: [], nextToken: null },
          },
        }) as never,
    );
    await expect(fetchConnectionMap("me")).resolves.toEqual({});
  });
});

/** Acceptance check for `buddies-duplicate-request-server-guard`, WORKLIST Phase 0. */
describe("createConnectionRequest duplicate guard", () => {
  beforeEach(() => exec.mockReset());

  it("returns the existing id and does not create a second row", async () => {
    exec.mockImplementation(
      async () =>
        ({
          data: { byRemitentId: { items: [{ id: "existing-1" }], nextToken: null } },
        }) as never,
    );

    await expect(
      createConnectionRequest({ fromUserId: "me", toUserId: "them" }),
    ).resolves.toBe("existing-1");

    // One call: the pre-flight check. No createConnection mutation followed.
    expect(exec).toHaveBeenCalledTimes(1);
    const queries = exec.mock.calls.map((c) => (c[0] as { query: string }).query);
    expect(queries.some((q) => q.includes("createConnection"))).toBe(false);
  });

  it("creates exactly once when there is no open request", async () => {
    exec
      .mockImplementationOnce(
        async () => ({ data: { byRemitentId: { items: [], nextToken: null } } }) as never,
      )
      .mockImplementationOnce(
        async () => ({ data: { createConnection: { id: "new-1" } } }) as never,
      );

    await expect(
      createConnectionRequest({ fromUserId: "me", toUserId: "them" }),
    ).resolves.toBe("new-1");
    expect(exec).toHaveBeenCalledTimes(2);
  });

  /** Read through the index, not a scan — a missed row would wave a duplicate through. */
  it("checks through byRemitentId scoped to the recipient", async () => {
    exec.mockImplementation(
      async () => ({ data: { byRemitentId: { items: [], nextToken: null } } }) as never,
    );
    await findExistingPendingRequest("me", "them");

    const q = (exec.mock.calls[0]![0] as { query: string }).query;
    expect(q).toMatch(/byRemitentId\(/);
    expect(q).not.toMatch(/listConnections/);
    expect(q).toMatch(/connectionRecipientId:\s*\{eq:\s*"them"\}/);
    expect(q).toMatch(/accepted:\s*\{eq:\s*false\}/);
    expect(q).toMatch(/ignored:\s*\{eq:\s*false\}/);
  });

  it("does not query for a self-request", async () => {
    await expect(findExistingPendingRequest("me", "me")).resolves.toBeNull();
    expect(exec).not.toHaveBeenCalled();
  });
});
