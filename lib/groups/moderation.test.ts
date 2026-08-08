import { describe, expect, it } from "vitest";

import { canLeaveGroup, canModerateGroup, isHostOfGroup } from "./moderation";

/** Acceptance check for `groups-support-role-moderation`, WORKLIST Phase 0. */
describe("canModerateGroup", () => {
  it("grants a SUPPORT account moderation in a group it does not host", () => {
    expect(
      canModerateGroup({ userId: "u1", userType: "SUPPORT", hosts: [] }),
    ).toBe(true);
  });

  it("grants a host of that group", () => {
    expect(
      canModerateGroup({
        userId: "u1",
        userType: "PATIENT",
        hosts: [{ id: "u9" }, { id: "u1" }],
      }),
    ).toBe(true);
  });

  it("refuses a plain member", () => {
    expect(
      canModerateGroup({ userId: "u1", userType: "PATIENT", hosts: [{ id: "u9" }] }),
    ).toBe(false);
  });

  /**
   * SUPPORT is checked before `userId`, because a SUPPORT account moderates every
   * group regardless of membership — and the provider may still be loading.
   */
  it("does not depend on a resolved userId for SUPPORT", () => {
    expect(canModerateGroup({ userId: null, userType: "SUPPORT" })).toBe(true);
  });

  it("refuses when the session has not loaded yet", () => {
    expect(canModerateGroup({ userId: null, userType: null, hosts: null })).toBe(
      false,
    );
    expect(canModerateGroup({})).toBe(false);
  });

  /** A HOST-typed account is not automatically a host of *this* group. */
  it("does not grant a HOST account rights in a group it does not host", () => {
    expect(
      canModerateGroup({ userId: "u1", userType: "HOST", hosts: [{ id: "u9" }] }),
    ).toBe(false);
  });

  it("tolerates null ids in the hosts array", () => {
    expect(
      canModerateGroup({ userId: "u1", userType: "PATIENT", hosts: [{ id: null }] }),
    ).toBe(false);
  });
});

/** Acceptance check for `groups-host-cannot-leave-own-group`, WORKLIST Phase 0. */
describe("canLeaveGroup", () => {
  it("refuses a host of that group", () => {
    expect(canLeaveGroup({ userId: "u1", hosts: [{ id: "u1" }] })).toBe(false);
  });

  it("allows a plain member", () => {
    expect(canLeaveGroup({ userId: "u1", hosts: [{ id: "u9" }] })).toBe(true);
  });

  /** A HOST-typed account is not a host of every group; only these hosts matter. */
  it("allows a host of some other group", () => {
    expect(canLeaveGroup({ userId: "u1", hosts: [] })).toBe(true);
  });

  it("allows when the session has not loaded", () => {
    expect(canLeaveGroup({ userId: null, hosts: null })).toBe(true);
  });
});

describe("isHostOfGroup", () => {
  it("is membership of the hosts array, not a userType check", () => {
    expect(isHostOfGroup({ userId: "u1", hosts: [{ id: "u1" }] })).toBe(true);
    expect(isHostOfGroup({ userId: "u1", hosts: [{ id: "u2" }] })).toBe(false);
    expect(isHostOfGroup({ userId: "u1", hosts: [{ id: null }] })).toBe(false);
  });
});
