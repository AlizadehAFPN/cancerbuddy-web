import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/aws/appsyncGraphql", () => ({
  executeAppSyncGraphql: vi.fn(),
}));

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { isPairBlocked } from "./connections";

const exec = vi.mocked(executeAppSyncGraphql);
const sentQuery = () => (exec.mock.calls[0]![0] as { query: string }).query;

/** Acceptance check for `profile-blocked-user-guard`, WORKLIST Phase 0. */
describe("isPairBlocked", () => {
  beforeEach(() => exec.mockReset());

  it("reports blocked when a row exists", async () => {
    exec.mockResolvedValue({
      data: { listBlockedUsers: { items: [{ id: "c1" }] } },
    } as never);
    await expect(isPairBlocked("me", "them")).resolves.toBe(true);
  });

  it("reports not blocked when no row exists", async () => {
    exec.mockResolvedValue({ data: { listBlockedUsers: { items: [] } } } as never);
    await expect(isPairBlocked("me", "them")).resolves.toBe(false);
  });

  /**
   * The whole point of the item. `fetchBlockedUserIds` filters on
   * `connectionRemitentId: me`, so it only knows who *I* blocked; someone who
   * blocked *me* still got a live Connect button. The query must cover both.
   */
  it("asks about both directions of the pair", async () => {
    exec.mockResolvedValue({ data: { listBlockedUsers: { items: [] } } } as never);
    await isPairBlocked("me", "them");

    const q = sentQuery();
    expect(q).toMatch(/or:\s*\[/);
    expect(q).toMatch(
      /connectionRemitentId:\s*\{eq:\s*"me"\},\s*connectionRecipientId:\s*\{eq:\s*"them"\}/,
    );
    expect(q).toMatch(
      /connectionRemitentId:\s*\{eq:\s*"them"\},\s*connectionRecipientId:\s*\{eq:\s*"me"\}/,
    );
    expect(q).toMatch(/blocked:\s*\{eq:\s*true\}/);
  });

  it("does not query for self or missing ids", async () => {
    await expect(isPairBlocked("me", "me")).resolves.toBe(false);
    await expect(isPairBlocked("", "them")).resolves.toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  /**
   * Fail open: a network blip must not hide a profile that is not blocked.
   *
   * `mockImplementationOnce` rather than `mockRejectedValue` — the latter
   * constructs the rejected promise eagerly, which vitest reports as an
   * unhandled rejection even though the function under test catches it.
   */
  it("returns false when the query fails", async () => {
    exec.mockImplementationOnce(async () => {
      throw new Error("network");
    });
    await expect(isPairBlocked("me", "them")).resolves.toBe(false);
  });
});

describe("the profile screen consumes it", () => {
  const source = readFileSync("components/buddies/BuddyProfileScreen.tsx", "utf8");

  it("feeds isBlocked into the action-bar gate and shows a notice", () => {
    expect(source).toMatch(/isPairBlocked\(/);
    expect(source).toMatch(/isBlocked,/);
    expect(source).toContain('t("app.buddies.profileBlocked")');
  });
});
