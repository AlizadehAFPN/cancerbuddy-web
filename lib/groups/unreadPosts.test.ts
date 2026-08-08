import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearGroupUnread,
  hasUnread,
  markGroupUnread,
  resetUnreadGroups,
  subscribeToUnreadGroups,
} from "./unreadPosts";

/** Acceptance check for `groups-new-post-badge`, WORKLIST Phase 3. */
describe("the per-group NEW marker", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetUnreadGroups();
  });

  it("marks and reads back by group id", () => {
    markGroupUnread("G1");
    expect(hasUnread("G1")).toBe(true);
    expect(hasUnread("G2")).toBe(false);
  });

  it("clears on entry", () => {
    markGroupUnread("G1");
    clearGroupUnread("G1");
    expect(hasUnread("G1")).toBe(false);
  });

  /**
   * The deliberate difference from mobile: a phone keeps its process alive for
   * days, a browser tab does not, so an in-memory marker would never be seen.
   */
  it("survives a reload", () => {
    markGroupUnread("G1");
    expect(window.localStorage.getItem("cb.groups.unread")).toContain("G1");
  });

  it("ignores empty ids", () => {
    markGroupUnread("");
    markGroupUnread(null);
    markGroupUnread(undefined);
    expect(hasUnread("")).toBe(false);
  });

  it("notifies subscribers on a change, and only on a change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToUnreadGroups(listener);

    markGroupUnread("G1");
    expect(listener).toHaveBeenCalledTimes(1);

    // Already marked — no second render for the same fact.
    markGroupUnread("G1");
    expect(listener).toHaveBeenCalledTimes(1);

    clearGroupUnread("G1");
    expect(listener).toHaveBeenCalledTimes(2);

    // Already clear.
    clearGroupUnread("G1");
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    markGroupUnread("G2");
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
