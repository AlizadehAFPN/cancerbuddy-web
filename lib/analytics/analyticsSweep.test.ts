import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/aws/appsyncGraphql", () => ({
  executeAppSyncGraphql: vi.fn(),
}));

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import {
  accountAgeMs,
  clearAccountAgeCache,
  emitEvent,
  hasFired,
  latchKey,
  markAllFired,
  markFired,
  resetAnalyticsTransportForTests,
  setAnalyticsTransport,
  splitSearchWords,
  trackConnectWithFirstBuddy,
  trackEnrollmentComplete,
  trackMilestone,
  trackNewPost,
  trackTimeToSendMessage,
  NOT_YET_EMITTED,
  ONCE_ONLY_EVENTS,
  type AnalyticsEventName,
} from "@/lib/analytics";
import {
  aboutSchema,
  profileBioSchema,
  profileSchemaForUser,
} from "@/lib/user-signup/validation";
import { BIO_MAX_LENGTH, MAX_AGE, MIN_BIRTH_YEAR } from "@/lib/signup/constants";

/**
 * Acceptance checks for WORKLIST Phase 9 — cross-cutting finishers.
 *
 * The worklist asks for Playwright on the groups item; there is no browser
 * project, so the transport is stubbed here the same way it would be stubbed on
 * `window` there, and the wiring is asserted on the source. Noted per test.
 */

function sourceOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

/* ── Harness ────────────────────────────────────────────────────────────── */

let tracked: Array<{ name: string; params?: Record<string, unknown> }>;

/** Lets a test await the fire-and-forget helpers without a timer. */
const settle = () => new Promise<void>((r) => setTimeout(r, 0));

beforeEach(() => {
  localStorage.clear();
  clearAccountAgeCache();
  resetAnalyticsTransportForTests();
  tracked = [];
  setAnalyticsTransport({
    track: (name, params) => tracked.push({ name, params }),
  });

  vi.mocked(executeAppSyncGraphql).mockReset();
  vi.mocked(executeAppSyncGraphql).mockResolvedValue({
    data: { getUser: { createdAt: "2026-01-01T00:00:00.000Z" } },
  } as never);
});

/* ── analytics-event-layer ──────────────────────────────────────────────── */

describe("the once-only latch is per account", () => {
  /** The worklist's exact case. */
  it("emits once for an account, and again for a different one", () => {
    emitEvent({ name: "joinFirstGroup", params: { timestamp: 1 } }, "acc-1");
    emitEvent({ name: "joinFirstGroup", params: { timestamp: 2 } }, "acc-1");
    expect(tracked).toHaveLength(1);

    emitEvent({ name: "joinFirstGroup", params: { timestamp: 3 } }, "acc-2");
    expect(tracked).toHaveLength(2);
  });

  /**
   * The reason this is per-account at all. Mobile's keys are bare
   * (`joinFirstGroup`), which on a shared browser silences the second member.
   */
  it("puts the account in the key", () => {
    expect(latchKey("acc-1", "post")).toContain("acc-1");
    expect(latchKey("acc-1", "post")).not.toBe(latchKey("acc-2", "post"));

    markFired("acc-1", "post");
    expect(hasFired("acc-1", "post")).toBe(true);
    expect(hasFired("acc-2", "post")).toBe(false);
  });

  it("latches every milestone mobile latches, and nothing else", () => {
    expect([...ONCE_ONLY_EVENTS].sort()).toEqual([
      "chatWithFirstBuddy",
      "comment",
      "connectWithFirstBuddy",
      "joinFirstGroup",
      "post",
    ]);
  });

  /** Repeatable events must not be silenced by a latch that never applies. */
  it("does not latch the repeatable events", () => {
    trackTimeToSendMessage("acc-1", 111);
    trackTimeToSendMessage("acc-1", 222);
    expect(tracked.map((e) => e.name)).toEqual([
      "timeToSendMessage",
      "timeToSendMessage",
    ]);
  });

  /**
   * Mobile's `case 'post'` reads the *comment* flag and writes the *post* flag,
   * so a member who comments first can never emit `post`. Not carried.
   */
  it("does not carry mobile's post/comment key mix-up", () => {
    emitEvent({ name: "comment", params: { timestamp: 1 } }, "acc-1");
    emitEvent({ name: "post", params: { timestamp: 2 } }, "acc-1");
    expect(tracked.map((e) => e.name)).toEqual(["comment", "post"]);
  });

  /** Unlatchable is worse than absent: it would re-report a first every visit. */
  it("drops a milestone it cannot keep once-only", () => {
    emitEvent({ name: "post", params: { timestamp: 1 } }, null);
    expect(tracked).toHaveLength(0);
  });

  it("marks every milestone at once for a returning member", () => {
    markAllFired("acc-1", ONCE_ONLY_EVENTS);
    for (const name of ONCE_ONLY_EVENTS) {
      expect(hasFired("acc-1", name), name).toBe(true);
    }
    emitEvent({ name: "joinFirstGroup", params: { timestamp: 1 } }, "acc-1");
    expect(tracked).toHaveLength(0);
  });

  /** A throwing localStorage must not take down the action being measured. */
  it("survives storage being unavailable", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    expect(() =>
      emitEvent({ name: "post", params: { timestamp: 1 } }, "acc-1"),
    ).not.toThrow();
    expect(tracked).toHaveLength(1);
    spy.mockRestore();
  });

  it("never lets a failing transport reach the caller", () => {
    setAnalyticsTransport({
      track: () => {
        throw new Error("sink down");
      },
    });
    expect(() =>
      emitEvent({ name: "timeToSendMessage", params: { timestamp: 1 } }, "acc-1"),
    ).not.toThrow();
  });
});

describe("new_post fans out per word", () => {
  /** The worklist's exact case. */
  it("produces one payload per word", () => {
    emitEvent({ name: "new_post", params: { search: "a b c" } }, "acc-1");
    expect(tracked).toEqual([
      { name: "new_post", params: { search: "a" } },
      { name: "new_post", params: { search: "b" } },
      { name: "new_post", params: { search: "c" } },
    ]);
  });

  /** The body arrives as rich text — mobile strips markup first too. */
  it("strips the markup before splitting", () => {
    expect(splitSearchWords("<p>hello <b>world</b></p>")).toEqual([
      "hello",
      "world",
    ]);
    expect(splitSearchWords("<p>a</p><p>b</p>")).toEqual(["a", "b"]);
  });

  /**
   * Mobile splits on a literal space, so a newline-separated body yields
   * `"first\nsecond"` — a term nobody searches for. Split on whitespace.
   */
  it("does not emit whitespace or empty terms", () => {
    expect(splitSearchWords("  double   spaces  ")).toEqual([
      "double",
      "spaces",
    ]);
    expect(splitSearchWords("")).toEqual([]);
    expect(splitSearchWords("<p></p>")).toEqual([]);
  });
});

describe("the event contract", () => {
  /**
   * Compile-time half: these are the literal names mobile logs. A typo in any
   * `emitEvent` call fails `tsc --noEmit` against the union rather than
   * producing an event nobody notices is missing.
   */
  it("matches mobile's names exactly", () => {
    const names: AnalyticsEventName[] = [
      "connectWithFirstBuddy",
      "joinFirstGroup",
      "chatWithFirstBuddy",
      "comment",
      "post",
      "timeToSendMessage",
      "bmcf_enrollment",
      "openEnrollment",
      "openApp",
      "new_post",
      "filtersToSearch",
      "searchTerms",
    ];
    /**
     * Read from the sibling checkout when it is there. This is the one
     * assertion that can catch a rename on the *mobile* side, which is why it
     * is worth having; it is skipped rather than failed where the repo is
     * absent, since a missing checkout is not a defect in this one.
     */
    const MOBILE = "/Users/wallex/cancerbuddyapp/src/analytics/events.ts";
    if (!existsSync(MOBILE)) return;
    const mobile = readFileSync(MOBILE, "utf8");

    for (const name of names) {
      if (name === "openApp") continue; // mobile calls logAppOpen(), not logEvent
      expect(mobile, name).toContain(`'${name}'`);
    }
  });

  /** Declared-but-unwired is documented, not silent. */
  it("records which events have no web emitter yet", () => {
    expect([...NOT_YET_EMITTED].sort()).toEqual([
      "filtersToSearch",
      "openApp",
      "openEnrollment",
      "searchTerms",
    ]);
  });
});

describe("account age", () => {
  /** Mobile re-queries on every emit; once per account per tab is enough. */
  it("asks the server once and reuses the answer", async () => {
    const created = Date.parse("2026-01-01T00:00:00.000Z");
    const now = created + 60_000;

    await expect(accountAgeMs("acc-1", now)).resolves.toBe(60_000);
    await expect(accountAgeMs("acc-1", now)).resolves.toBe(60_000);
    expect(executeAppSyncGraphql).toHaveBeenCalledTimes(1);
  });

  it("does not issue two queries for two emits in the same tick", async () => {
    await Promise.all([accountAgeMs("acc-1"), accountAgeMs("acc-1")]);
    expect(executeAppSyncGraphql).toHaveBeenCalledTimes(1);
  });

  /** A zero would read as "did this the instant they signed up". */
  it("returns null rather than guessing when it cannot be read", async () => {
    vi.mocked(executeAppSyncGraphql).mockRejectedValue(new Error("down"));
    await expect(accountAgeMs("acc-1")).resolves.toBeNull();

    clearAccountAgeCache();
    vi.mocked(executeAppSyncGraphql).mockResolvedValue({
      data: { getUser: { createdAt: null } },
    } as never);
    await expect(accountAgeMs("acc-2")).resolves.toBeNull();
  });

  it("emits nothing when the age is unknown", async () => {
    vi.mocked(executeAppSyncGraphql).mockRejectedValue(new Error("down"));
    trackMilestone("joinFirstGroup", "acc-1");
    await settle();
    expect(tracked).toHaveLength(0);
    /* And the latch is untouched, so a later attempt can still record it. */
    expect(hasFired("acc-1", "joinFirstGroup")).toBe(false);
  });
});

/* ── chat-analytics-events ──────────────────────────────────────────────── */

describe("chat events", () => {
  it("records the first chat once and the send time every time", async () => {
    trackMilestone("chatWithFirstBuddy", "acc-1");
    await settle();
    trackTimeToSendMessage("acc-1", 1000);
    trackMilestone("chatWithFirstBuddy", "acc-1");
    await settle();
    trackTimeToSendMessage("acc-1", 2000);

    expect(tracked.map((e) => e.name)).toEqual([
      "chatWithFirstBuddy",
      "timeToSendMessage",
      "timeToSendMessage",
    ]);
  });

  it("logs nothing for chatWithFirstBuddy once the latch is set", async () => {
    markFired("acc-1", "chatWithFirstBuddy");
    trackMilestone("chatWithFirstBuddy", "acc-1");
    await settle();
    expect(tracked).toHaveLength(0);
  });

  /**
   * Mobile times this one to the *earliest channel*, not to now — a member who
   * made a buddy on day one still reports one day a year later.
   */
  it("times connectWithFirstBuddy to the earliest conversation", async () => {
    trackConnectWithFirstBuddy(
      [
        "2026-01-03T00:00:00.000Z",
        "2026-01-02T00:00:00.000Z",
        undefined,
      ],
      "acc-1",
    );
    await settle();
    expect(tracked).toEqual([
      { name: "connectWithFirstBuddy", params: { timestamp: 86_400_000 } },
    ]);
  });

  it("emits nothing when the member has no conversations", async () => {
    trackConnectWithFirstBuddy([], "acc-1");
    await settle();
    expect(tracked).toHaveLength(0);
  });

  /** Stands in for the Playwright walk: the wiring, at the one send path. */
  it("is wired to a send that actually succeeded", () => {
    const hook = sourceOf("lib/chat/useChannelMessages.ts");
    expect(hook).toMatch(
      /await ch\.sendMessage\(\{[\s\S]{0,200}\}\);[\s\S]{0,200}trackMilestone\("chatWithFirstBuddy", userId\)/,
    );
    expect(hook).toContain("trackTimeToSendMessage(userId)");

    const list = sourceOf("lib/chat/useChannelList.ts");
    expect(list).toContain("trackConnectWithFirstBuddy(");
  });
});

/* ── groups-analytics-events ────────────────────────────────────────────── */

describe("groups events", () => {
  it("counts a first group join once", async () => {
    trackMilestone("joinFirstGroup", "acc-1");
    await settle();
    trackMilestone("joinFirstGroup", "acc-1");
    await settle();

    expect(tracked).toHaveLength(1);
    expect(tracked[0]!.name).toBe("joinFirstGroup");
    expect(typeof tracked[0]!.params?.timestamp).toBe("number");
    expect(hasFired("acc-1", "joinFirstGroup")).toBe(true);
  });

  it("issues both post events for one publish, in mobile's order", () => {
    trackNewPost("<p>hello world</p>", "acc-1");
    emitEvent({ name: "post", params: { timestamp: 5 } }, "acc-1");
    /* `post` is latched, `new_post` is not — a second publish sends words only. */
    trackNewPost("<p>again</p>", "acc-1");
    emitEvent({ name: "post", params: { timestamp: 6 } }, "acc-1");

    expect(tracked.map((e) => e.name)).toEqual([
      "new_post",
      "new_post",
      "post",
      "new_post",
    ]);
  });

  /** Stands in for the Playwright walk on the three group actions. */
  it("is wired to the actions themselves, not to one button", () => {
    const membership = sourceOf("lib/groups/membership.ts");
    expect(membership).toMatch(
      /raiseUserLambda\(LambdaPayloadType\.JOIN_GROUP[\s\S]{0,200}trackMilestone\("joinFirstGroup"/,
    );

    const posts = sourceOf("lib/groups/posts.ts");
    expect(posts).toContain('trackMilestone("post", session.userId)');
    expect(posts).toContain("trackNewPost(html, session.userId)");
    expect(posts).toContain('trackMilestone("comment", params.session.userId)');
  });
});

/* ── register-login-analytics-events ────────────────────────────────────── */

describe("enrollment and login", () => {
  /** Wall-clock, as mobile sends it — not an account age. */
  it("records a finished registration once, with a clock reading", () => {
    trackEnrollmentComplete("acc-1", 1_800_000_000_000);
    expect(tracked).toEqual([
      { name: "bmcf_enrollment", params: { timestamp: 1_800_000_000_000 } },
    ]);
    expect(executeAppSyncGraphql).not.toHaveBeenCalled();
  });

  it("is called by the finalize service", () => {
    const finalize = sourceOf("lib/user-signup/userEnrollmentFinalize.ts");
    expect(finalize).toContain("trackEnrollmentComplete(cognitoUserId)");
    /* The bare placeholder keys are gone — they could collide across accounts. */
    expect(finalize).not.toContain("ENROLLMENT_ANALYTICS_KEYS");
  });

  /**
   * A returning member has already had every first. Mobile writes the same five
   * flags on sign-in (`Login.tsx:41-57`).
   */
  it("closes the milestone window on a completed sign-in", () => {
    const login = sourceOf("lib/login/cognitoLoginService.ts");
    expect(login).toMatch(
      /result\.status === "DONE"[\s\S]{0,400}markAllFired\(cognitoUserId, ONCE_ONLY_EVENTS\)/,
    );
  });

  it("sets all five keys for that account and no other", () => {
    markAllFired("acc-1", ONCE_ONLY_EVENTS);
    const keys = Object.keys(localStorage);
    expect(keys).toHaveLength(5);
    expect(keys.every((k) => k.includes("acc-1"))).toBe(true);
  });
});

/* ── age-and-limit-constant-alignment ───────────────────────────────────── */

describe("registration bounds", () => {
  const registrant = (born: number) => ({
    firstName: "Ada",
    lastName: "Lovelace",
    birthMonth: "6",
    birthYear: String(born),
    pronouns: "she_her",
  });

  /** Mobile's bound is 130 in all three places it appears. */
  it("accepts a registrant aged 125", () => {
    expect(MAX_AGE).toBe(130);
    const born = new Date().getFullYear() - 125;
    expect(born).toBeGreaterThanOrEqual(MIN_BIRTH_YEAR);
    expect(profileSchemaForUser.safeParse(registrant(born)).success).toBe(true);
  });

  it("still refuses an impossible age", () => {
    const born = new Date().getFullYear() - 131;
    expect(profileSchemaForUser.safeParse(registrant(born)).success).toBe(false);
  });

  /**
   * The worklist's invariant. A bio written at registration has to be saveable
   * from the profile editor; the two limits were 1000 and 300.
   */
  it("applies one bio limit to both forms", () => {
    for (const length of [299, 301, 999]) {
      const value = "x".repeat(length);
      expect(
        profileBioSchema.safeParse({ bio: value }).success,
        `length ${length}`,
      ).toBe(aboutSchema.safeParse({ bio: value }).success);
    }
    expect(BIO_MAX_LENGTH).toBe(300);
    expect(aboutSchema.safeParse({ bio: "x".repeat(300) }).success).toBe(true);
    expect(aboutSchema.safeParse({ bio: "x".repeat(301) }).success).toBe(false);
  });

  it("leaves the editor reading the shared constant", () => {
    const form = sourceOf("components/profile/PersonalInfoForm.tsx");
    expect(form).toContain("const BIO_MAX = BIO_MAX_LENGTH");
  });
});

/* ── Transport ──────────────────────────────────────────────────────────── */

describe("the transport", () => {
  it("prefers a stub installed on window", () => {
    resetAnalyticsTransportForTests();
    const seen: string[] = [];
    window.__cbAnalytics = { track: (name) => seen.push(name) };

    emitEvent({ name: "timeToSendMessage", params: { timestamp: 1 } }, "acc-1");
    expect(seen).toEqual(["timeToSendMessage"]);

    delete window.__cbAnalytics;
  });

  /**
   * Web has its own Firebase project — it cannot reach mobile's GA4 property,
   * and the measurement id is not set. Unconfigured must mean "logged", never
   * "thrown": nothing a member does may fail for want of analytics.
   */
  it("degrades to logging when nothing is configured", () => {
    resetAnalyticsTransportForTests();
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});

    expect(() =>
      emitEvent({ name: "timeToSendMessage", params: { timestamp: 1 } }, "acc-1"),
    ).not.toThrow();
    expect(debug).toHaveBeenCalled();

    debug.mockRestore();
  });
});
