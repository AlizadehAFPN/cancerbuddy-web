import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buddyProfileHref,
  evaluateBuddyIdMatch,
  formatBuddyId,
  maskBuddyId,
} from "./useBuddyIdLookup";

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** Acceptance check for `profile-buddy-id-lookup-safety`, WORKLIST Phase 1. */
describe("formatBuddyId", () => {
  it("normalises a bare id whatever its casing or separators", () => {
    expect(formatBuddyId("bi00001234")).toBe("BI-0000-1234");
    expect(formatBuddyId("BI-0000-1234")).toBe("BI-0000-1234");
    expect(formatBuddyId("bi 0000 1234")).toBe("BI-0000-1234");
    expect(formatBuddyId("00001234")).toBe("BI-0000-1234");
  });

  /** People share the link far more often than the id. */
  it("accepts a shared link", () => {
    expect(
      formatBuddyId("https://cancerbuddy.bonemarrow.org/buddyId/BI-0000-1234"),
    ).toBe("BI-0000-1234");
  });

  /** No slash here on purpose — a slash means "this is a link", tested above. */
  it("strips anything that is not alphanumeric", () => {
    expect(formatBuddyId("BI 0*0_0=0!1²234")).toBe("BI-0000-1234");
    expect(formatBuddyId("bi_0000_1234")).toBe("BI-0000-1234");
  });
});

describe("maskBuddyId", () => {
  /** A display mask, so a half-typed value must survive unchanged. */
  it("formats progressively while typing", () => {
    expect(maskBuddyId("B")).toBe("B");
    expect(maskBuddyId("BI")).toBe("BI");
    expect(maskBuddyId("BI0000")).toBe("BI-0000");
    expect(maskBuddyId("BI00001234")).toBe("BI-0000-1234");
  });
});

describe("the guard ladder", () => {
  const viewer = { id: "me", birth: "1990-01-01" };
  const adult = { id: "them", name: "Grace Hopper", birth: "1988-05-04" };

  it("returns the id when every guard passes", () => {
    expect(evaluateBuddyIdMatch(adult, viewer)).toEqual({
      kind: "found",
      userId: "them",
    });
  });

  it("reports a missing account", () => {
    const out = evaluateBuddyIdMatch(null, viewer);
    expect(out.kind).toBe("error");
  });

  it("refuses your own id", () => {
    const out = evaluateBuddyIdMatch({ ...adult, id: "me" }, viewer);
    expect(out.kind).toBe("error");
  });

  /**
   * The two the profile screen used to miss entirely: it ran a bare not-found
   * check, so a snoozed or age-blocked profile opened as though connectable.
   */
  it("refuses a snoozed account", () => {
    const out = evaluateBuddyIdMatch({ ...adult, isSnooze: true }, viewer);
    expect(out.kind).toBe("error");
  });

  /**
   * The age rule is the one guard that does not stop the member: mobile opens
   * the profile with the connect action withheld and the reason on screen
   * (`useValidateRules.ts:209-224`), which is more use than an error beside an
   * id they cannot place. Phase 4 corrected this; Phase 1 had it as an error.
   */
  it("opens an out-of-bracket profile with the age-rule notice", () => {
    // A child in the 7–12 bracket is not connectable from an adult account.
    const child = { id: "them", name: "Sam", birth: "2016-01-01" };
    const out = evaluateBuddyIdMatch(child, viewer);
    expect(out).toEqual({ kind: "notice", userId: "them", notice: "ageRule" });
    expect(buddyProfileHref(out as never)).toBe("/buddies/them?notice=ageRule");
  });

  it("opens a permitted profile with no notice at all", () => {
    const out = evaluateBuddyIdMatch(adult, viewer);
    expect(out).toEqual({ kind: "found", userId: "them" });
    expect(buddyProfileHref(out as never)).toBe("/buddies/them");
  });

  it("gives each refusal its own message", () => {
    const messages = new Set(
      [
        evaluateBuddyIdMatch(null, viewer),
        evaluateBuddyIdMatch({ ...adult, id: "me" }, viewer),
        evaluateBuddyIdMatch({ ...adult, isSnooze: true }, viewer),
      ].map((o) => (o.kind === "error" ? o.message : "")),
    );
    expect(messages.size).toBe(3);
  });

  it("refuses when the viewer has not loaded", () => {
    expect(evaluateBuddyIdMatch(adult, null).kind).toBe("error");
  });
});

describe("both entry points share the ladder", () => {
  it("the profile screen no longer runs a bare not-found check", () => {
    const screen = stripComments(
      readFileSync("components/profile/BuddyIdScreen.tsx", "utf8"),
    );
    expect(screen).toMatch(/useBuddyIdLookup\(/);
    expect(screen).not.toMatch(/setNotFound/);
    expect(screen).not.toMatch(/findUserByBuddyId\(/);
  });

  /**
   * Phase 1 asserted only that the sheet shared the *formatter*; it kept its own
   * copy of the ladder, which then drifted — it stopped on an age-bracket
   * mismatch where the hook opens the profile with a notice. Both entry points
   * now run the hook itself.
   */
  it("the buddies sheet runs the shared ladder, not its own", () => {
    const sheet = stripComments(
      readFileSync("components/buddies/BuddyIdSheet.tsx", "utf8"),
    );
    expect(sheet).toMatch(/useBuddyIdLookup\(/);
    expect(sheet).toMatch(/maskBuddyId\(raw\)/);
    // No second copy of any rung of the ladder.
    expect(sheet).not.toMatch(/findUserByBuddyId\(/);
    expect(sheet).not.toMatch(/connectAgeRulesBuddySearching/);
    expect(sheet).not.toMatch(/function formatBuddyId/);
    expect(sheet).not.toMatch(/function maskBuddyId/);
  });
});
