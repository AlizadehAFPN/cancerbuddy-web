import { describe, expect, it } from "vitest";

import {
  connectionContextFor,
  isProfileNotice,
  noticeForConnectionContext,
  showConnectAction,
} from "./connectContext";
import type { ConnectionEntry } from "./types";

/**
 * Acceptance checks for `connect-gate-snooze-and-age` and
 * `profile-feedback-banner-and-context`, WORKLIST Phase 4.
 */

function birthFor(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(0, 1);
  return `${d.getFullYear()}-01-01`;
}

const viewer = { viewerId: "me", viewerBirth: birthFor(30) };
const pending: ConnectionEntry = { status: "pending", connectionId: "c1" };
const connected: ConnectionEntry = { status: "connected", connectionId: "c1" };

describe("showConnectAction — mobile's ConnectionButtonBar:39 disjunction", () => {
  /**
   * The gap this closes: web filtered snoozed accounts out of the *discovery
   * query* and nowhere else, so a snoozed member opened from a group's member
   * list still showed a live Connect button.
   */
  it("refuses a snoozed stranger", () => {
    expect(
      showConnectAction({
        ...viewer,
        target: { id: "them", isSnooze: true, birth: birthFor(35) },
        connection: null,
      }),
    ).toBe(false);
  });

  it("refuses someone outside the viewer's age bracket", () => {
    expect(
      showConnectAction({
        ...viewer,
        target: { id: "them", birth: birthFor(9) },
        connection: null,
      }),
    ).toBe(false);
  });

  it("allows an unsnoozed, in-bracket stranger", () => {
    expect(
      showConnectAction({
        ...viewer,
        target: { id: "them", birth: birthFor(35) },
        connection: null,
      }),
    ).toBe(true);
  });

  /**
   * The half that is easy to get wrong: snooze must not strand an existing
   * relationship. Someone who snoozed after you connected is still someone you
   * can open a chat with, and a request you sent is still one you can cancel.
   */
  it("allows a snoozed member you are already connected to", () => {
    expect(
      showConnectAction({
        ...viewer,
        target: { id: "them", isSnooze: true, birth: birthFor(35) },
        connection: connected,
      }),
    ).toBe(true);
  });

  it("allows a snoozed member with a request already pending", () => {
    expect(
      showConnectAction({
        ...viewer,
        target: { id: "them", isSnooze: true, birth: birthFor(35) },
        connection: pending,
      }),
    ).toBe(true);
  });

  it("refuses yourself", () => {
    expect(
      showConnectAction({
        ...viewer,
        target: { id: "me", birth: birthFor(30) },
        connection: null,
      }),
    ).toBe(false);
  });

  /** The looser Buddy-ID rule, not the strict post-author one. */
  it("allows an adult and a 15-year-old, which the strict rule refuses", () => {
    expect(
      showConnectAction({
        ...viewer,
        target: { id: "them", birth: birthFor(15) },
        connection: null,
      }),
    ).toBe(true);
  });
});

describe("noticeForConnectionContext", () => {
  it("maps the four contexts to a banner and the showButtons flag", () => {
    expect(noticeForConnectionContext("none")).toEqual({
      notice: null,
      showActions: true,
    });
    expect(noticeForConnectionContext("pending")).toEqual({
      notice: "sentInvite",
      showActions: false,
    });
    expect(noticeForConnectionContext("accepted")).toEqual({
      notice: "alreadyBuddies",
      showActions: true,
    });
    expect(noticeForConnectionContext("ageRule")).toEqual({
      notice: "ageRule",
      showActions: false,
    });
  });
});

describe("connectionContextFor", () => {
  it("classifies the connection map's three states", () => {
    expect(connectionContextFor(null)).toBe("none");
    expect(connectionContextFor(undefined)).toBe("none");
    expect(connectionContextFor(pending)).toBe("pending");
    expect(connectionContextFor(connected)).toBe("accepted");
  });
});

describe("isProfileNotice", () => {
  it("accepts only the four keys, so a URL cannot inject copy", () => {
    expect(isProfileNotice("ageRule")).toBe(true);
    expect(isProfileNotice("sentInvite")).toBe(true);
    expect(isProfileNotice("nonsense")).toBe(false);
    expect(isProfileNotice(null)).toBe(false);
  });
});
