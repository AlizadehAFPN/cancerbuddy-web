import { describe, expect, it } from "vitest";

import { shouldShowActionBar } from "./actionBar";

/** Acceptance check for `profile-host-mode-action-suppression`, WORKLIST Phase 0. */
describe("shouldShowActionBar", () => {
  const base = {
    viewerGroupHostId: null,
    targetUserType: "PATIENT",
    isSelf: false,
    isBlocked: false,
  };

  it("shows for an ordinary member viewing another member", () => {
    expect(shouldShowActionBar(base)).toBe(true);
  });

  /** A host account browses members to moderate, not to make buddies. */
  it("hides when the viewer is a host account", () => {
    expect(shouldShowActionBar({ ...base, viewerGroupHostId: "gh-1" })).toBe(false);
  });

  it("hides on a SUPPORT profile", () => {
    expect(shouldShowActionBar({ ...base, targetUserType: "SUPPORT" })).toBe(false);
  });

  it("hides on your own profile", () => {
    expect(shouldShowActionBar({ ...base, isSelf: true })).toBe(false);
  });

  it("hides when either side has blocked the other", () => {
    expect(shouldShowActionBar({ ...base, isBlocked: true })).toBe(false);
  });

  /**
   * The two fields are easy to swap and the bug would be silent, so pin the
   * direction: a HOST-*typed* target is still connectable; a host *viewer* is not.
   */
  it("keys host-mode off the viewer, not the target", () => {
    expect(shouldShowActionBar({ ...base, targetUserType: "HOST" })).toBe(true);
    expect(
      shouldShowActionBar({ ...base, viewerGroupHostId: "gh-1", targetUserType: "HOST" }),
    ).toBe(false);
  });

  it("treats a blank groupHostId as not a host", () => {
    expect(shouldShowActionBar({ ...base, viewerGroupHostId: "   " })).toBe(true);
  });
});
