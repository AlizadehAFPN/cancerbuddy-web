import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { hasSessionEnded } from "@/lib/live/session";

/**
 * Acceptance checks for the mandatory pair `live-badge-truth` +
 * `live-session-entry-points`, WORKLIST Phase 0.
 *
 * The two ship together on purpose: `inLive` is flipped server-side by the first
 * host to join, so tightening the badge query without adding a way in would lock
 * hosts out of starting their own sessions.
 */
describe("live-badge-truth", () => {
  const source = readFileSync("lib/groups/groupQueries.ts", "utf8");

  /**
   * String assertions rather than a live query: the filter has to be *in the
   * document*, because doing it client-side is what produced the permanent badge.
   */
  it("filters listLiveStreamingGroups on inLive server-side", () => {
    expect(source).toMatch(/filter:\s*\{\s*inLive:\s*\{\s*eq:\s*true/);
  });

  /**
   * Without a limit AppSync applies its own default page size, which produces the
   * opposite bug — a genuinely-live group outside the first page gets no badge.
   */
  it("bounds the live query and follows nextToken", () => {
    const query = source.slice(
      source.indexOf("const LIST_LIVE_GROUPS"),
      source.indexOf("/* ── Raw shapes"),
    );
    expect(query).toMatch(/limit:/);
    expect(query).toMatch(/nextToken/);
  });

  /** Defence in depth: a resolver change that drops the filter must not resurrect it. */
  it("also tests inLive on the client", () => {
    const fetcher = source.slice(source.indexOf("export async function fetchLiveGroups"));
    expect(fetcher).toMatch(/inLive === true/);
  });
});

describe("live-session-entry-points", () => {
  /**
   * The load-bearing case. A scheduled session is not live yet — that is exactly
   * when a host needs to open it — so `hasSessionEnded` must say false, and it
   * must not consult `inLive`.
   */
  it("treats a scheduled, not-yet-live session as open", () => {
    expect(hasSessionEnded({ status: "scheduled", archived: null })).toBe(false);
    expect(hasSessionEnded({ status: "live", archived: null })).toBe(false);
    expect(hasSessionEnded({ status: null, archived: null })).toBe(false);
  });

  it("treats an ended or archived session as closed", () => {
    expect(hasSessionEnded({ status: "ended", archived: null })).toBe(true);
    expect(hasSessionEnded({ status: "scheduled", archived: true })).toBe(true);
  });

  /**
   * Both surfaces must link by the row's own id. Asserting the source rather
   * than rendering because these are server components inside providers; the
   * DOM-level half of this check is the Playwright assertion in the worklist.
   */
  it("links the calendar row and the host's own session list to /live/<id>", () => {
    const calendar = readFileSync("components/groups/LiveCalendar.tsx", "utf8");
    expect(calendar).toContain("href={`/live/${enterEventId}`}");
    // Entry must not be gated on live state, or hosts cannot start a session.
    expect(calendar).toMatch(/hasSessionEnded\(/);

    const hostList = readFileSync("components/profile/ManageLivesScreen.tsx", "utf8");
    expect(hostList).toContain("href={`/live/${session.id}`}");
    expect(hostList).toMatch(/hasSessionEnded\(session\)/);
  });
});
