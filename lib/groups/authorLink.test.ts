import { describe, expect, it } from "vitest";

import { connectAgeRules, connectAgeRulesBuddySearching } from "@/lib/buddies/age";
import {
  authorHref,
  authorProfileHref,
  canConnectFromPost,
} from "./authorLink";

/** Acceptance check for `post-author-is-a-link`, WORKLIST Phase 3. */

/** A birth date `years` ago — old enough that the month never straddles today. */
function birthFor(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(0, 1);
  return `${d.getFullYear()}-01-01`;
}

describe("authorHref — mobile's three branches", () => {
  it("sends a host posting in someone else's group to their host page", () => {
    expect(
      authorHref({ authorId: "u1", groupHostId: "G2", postFeedId: "G1" }),
    ).toBe("/groups/hosts/u1");
  });

  it("sends a host posting in their own group to the group", () => {
    expect(
      authorHref({ authorId: "u1", groupHostId: "G1", postFeedId: "G1" }),
    ).toBe("/groups/G1");
  });

  it("sends everyone else to their profile", () => {
    expect(
      authorHref({ authorId: "u1", groupHostId: null, postFeedId: "G1" }),
    ).toBe("/buddies/u1");
  });

  /** A deleted account resolves to no author at all — render plain text. */
  it("returns null when there is no author id", () => {
    expect(authorHref({ authorId: "", groupHostId: null, postFeedId: "G1" })).toBeNull();
  });
});

/**
 * Mobile's strict rule, which applies at exactly two call sites — both the
 * tappable post author (`usePostActions.ts:73`). Its truth table, verbatim.
 */
describe("connectAgeRules (strict)", () => {
  const cases: [number, number, boolean][] = [
    [30, 40, true], // 18+/18+
    [18, 15, false], // adult and teen never match
    [15, 16, true], // both in the 13–17 band
    [8, 11, true], // both in the 7–12 band
    [12, 13, false], // straddling the band boundary
  ];

  for (const [mine, theirs, expected] of cases) {
    it(`${mine} and ${theirs} → ${expected}`, () => {
      expect(connectAgeRules(birthFor(mine), birthFor(theirs))).toBe(expected);
    });
  }

  /** The one comparison that separates it from the Buddy-ID rule. */
  it("is stricter than connectAgeRulesBuddySearching for an adult and a teen", () => {
    expect(connectAgeRulesBuddySearching(birthFor(18), birthFor(15))).toBe(true);
    expect(connectAgeRules(birthFor(18), birthFor(15))).toBe(false);
  });
});

describe("canConnectFromPost", () => {
  const viewer = { viewerId: "me", viewerBirth: birthFor(30) };

  it("allows an unsnoozed adult stranger", () => {
    expect(
      canConnectFromPost({ ...viewer, author: { id: "them", birth: birthFor(35) } }),
    ).toBe(true);
  });

  it("refuses a snoozed member", () => {
    expect(
      canConnectFromPost({
        ...viewer,
        author: { id: "them", birth: birthFor(35), isSnooze: true },
      }),
    ).toBe(false);
  });

  it("refuses someone outside the viewer's age bracket", () => {
    expect(
      canConnectFromPost({ ...viewer, author: { id: "them", birth: birthFor(15) } }),
    ).toBe(false);
  });

  it("refuses yourself", () => {
    expect(
      canConnectFromPost({ ...viewer, author: { id: "me", birth: birthFor(30) } }),
    ).toBe(false);
  });
});

describe("authorProfileHref carries the connect decision", () => {
  it("appends connect=0 when connecting is not allowed", () => {
    expect(
      authorProfileHref(
        { authorId: "them", groupHostId: null, postFeedId: "G1" },
        {
          viewerId: "me",
          viewerBirth: birthFor(30),
          author: { id: "them", birth: birthFor(15) },
        },
      ),
    ).toBe("/buddies/them?connect=0");
  });

  it("leaves the profile link alone when it is", () => {
    expect(
      authorProfileHref(
        { authorId: "them", groupHostId: null, postFeedId: "G1" },
        {
          viewerId: "me",
          viewerBirth: birthFor(30),
          author: { id: "them", birth: birthFor(35) },
        },
      ),
    ).toBe("/buddies/them");
  });

  /** Host destinations are not profiles; the connect rule does not apply. */
  it("never annotates a host or group link", () => {
    expect(
      authorProfileHref(
        { authorId: "them", groupHostId: "G2", postFeedId: "G1" },
        {
          viewerId: "me",
          viewerBirth: birthFor(30),
          author: { id: "them", birth: birthFor(15) },
        },
      ),
    ).toBe("/groups/hosts/them");
  });
});
