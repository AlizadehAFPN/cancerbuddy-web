import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ON_DELETE_CONNECTION,
  ON_UPDATE_CONNECTION,
  otherPartyOf,
  reduceConnectionEvent,
  type ConnectionFrame,
} from "./connectionLiveness";

/** Acceptance check for `connection-liveness-subscriptions`, WORKLIST Phase 1. */

const MOBILE = "/Users/wallex/cancerbuddyapp/src/graphql/suscriptions/connections.ts";
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

describe("the subscription documents match mobile", () => {
  const mobileSource = readFileSync(MOBILE, "utf8");

  /**
   * Compared against the mobile source rather than a copy pasted into the test:
   * a filter that drifts stops matching and the subscription dies silently.
   */
  it("uses the same or-filter over both participant ids", () => {
    for (const doc of [ON_UPDATE_CONNECTION, ON_DELETE_CONNECTION]) {
      expect(squash(doc)).toContain(
        squash(`filter: {
          or: [
            {connectionRemitentId: {eq: $userId}},
            {connectionRecipientId: {eq: $userId}}
          ]
        }`),
      );
    }
  });

  it("matches the mobile documents field for field", () => {
    const mobileUpdate = squash(
      mobileSource.slice(
        mobileSource.indexOf("subscription OnConnectionUpdated"),
        mobileSource.indexOf("export const OnConnectionDeletedSuscription"),
      ),
    ).replace(/`;?$/, "").trim();
    expect(squash(ON_UPDATE_CONNECTION)).toContain(
      squash("onUpdateConnection"),
    );
    for (const field of [
      "id",
      "connectionRecipientId",
      "connectionRemitentId",
      "accepted",
      "ignored",
    ]) {
      expect(mobileUpdate).toContain(field);
      expect(squash(ON_UPDATE_CONNECTION)).toContain(field);
    }
  });

  /**
   * Load-bearing and easy to undo: AppSync evaluates the filter against the
   * fields the *mutation* returned. `updateConnection` used to select only
   * `{id, accepted}`, which would have made these subscriptions dead on arrival.
   */
  it("every connection mutation still selects both participant ids", () => {
    const code = readFileSync("lib/buddies/connections.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    for (const name of ["CREATE_CONNECTION", "ACCEPT_CONNECTION", "DELETE_CONNECTION"]) {
      const start = code.indexOf(`const ${name}`);
      expect(start, `${name} not found`).toBeGreaterThan(-1);
      const doc = code.slice(start, code.indexOf("`;", start));
      expect(doc, `${name} must select connectionRecipientId`).toContain(
        "connectionRecipientId",
      );
      expect(doc, `${name} must select connectionRemitentId`).toContain(
        "connectionRemitentId",
      );
    }
  });
});

describe("otherPartyOf", () => {
  it("returns whichever side is not the viewer", () => {
    const frame: ConnectionFrame = {
      id: "c1",
      connectionRemitentId: "them",
      connectionRecipientId: "me",
    };
    expect(otherPartyOf(frame, "me")).toBe("them");
    expect(otherPartyOf({ ...frame, connectionRemitentId: "me", connectionRecipientId: "them" }, "me")).toBe("them");
  });

  /** Would otherwise write a map entry keyed `undefined`. */
  it("returns null when the frame names neither party", () => {
    expect(otherPartyOf({ id: "c1" }, "me")).toBeNull();
    expect(otherPartyOf({ id: "c1", connectionRemitentId: "me", connectionRecipientId: "me" }, "me")).toBeNull();
  });
});

describe("reduceConnectionEvent", () => {
  const frame: ConnectionFrame = {
    id: "c1",
    connectionRemitentId: "them",
    connectionRecipientId: "me",
  };

  it("flips pending → connected on an accept frame", () => {
    expect(
      reduceConnectionEvent({
        kind: "updated",
        frame: { ...frame, accepted: true },
        otherUserId: "them",
      }),
    ).toEqual({ userId: "them", status: "connected" });
  });

  it("keeps an un-accepted update as pending", () => {
    expect(
      reduceConnectionEvent({
        kind: "updated",
        frame: { ...frame, accepted: false },
        otherUserId: "them",
      }),
    ).toEqual({ userId: "them", status: "pending" });
  });

  it("removes the entry on a delete frame", () => {
    expect(
      reduceConnectionEvent({ kind: "deleted", frame, otherUserId: "them" }),
    ).toEqual({ userId: "them", status: null });
  });

  /** A decline arrives as an update with `ignored`, and must remove, not mark. */
  it("removes the entry when the request was declined", () => {
    expect(
      reduceConnectionEvent({
        kind: "updated",
        frame: { ...frame, ignored: true },
        otherUserId: "them",
      }),
    ).toEqual({ userId: "them", status: null });
  });
});

/** Acceptance check for `buddies-revalidate-on-focus`, the proving consumer. */
describe("the provider consumes both", () => {
  const source = readFileSync("lib/buddies/BuddiesProvider.tsx", "utf8");

  it("subscribes to liveness and revalidates on focus", () => {
    expect(source).toMatch(/subscribeToConnectionLiveness\(/);
    expect(source).toMatch(/reduceConnectionEvent\(/);
    expect(source).toMatch(/useVisibilityResync\(/);
  });

  it("only runs them once the session is ready", () => {
    expect(source).toMatch(/enabled:\s*status === "ready" && !!userId/);
  });
});
