import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("aws-amplify", () => ({
  API: { graphql: vi.fn() },
  graphqlOperation: (query: string, variables: unknown) => ({
    query,
    variables,
  }),
}));

import { API } from "aws-amplify";
import {
  reconcileDeviceToken,
  registerDeviceToken,
  tokenRegistrationEnabled,
  unregisterDeviceToken,
} from "@/lib/push/deviceToken";
import { extractBuddyIdFromScan, scanFrame } from "@/lib/buddies/scanBuddyId";

/**
 * Acceptance checks for WORKLIST Phase 10.
 *
 * The worklist asks for Playwright (fake camera, granted notifications) and a
 * live-AppSync integration run; neither exists here, so the decodable and
 * reducible parts are unit-tested and the wiring is asserted on source. The one
 * thing that genuinely cannot be faked — a real push, a real camera — is called
 * out in `docs/PUSH.md` and `docs/parity/WORKLIST.md`.
 *
 * The `push-backend-token-registration` tests below are as much about proving
 * the mobile app **cannot** be affected as about the feature working.
 */

function sourceOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

/* ── push-backend-token-registration ────────────────────────────────────── */

describe("the device-token reducer", () => {
  const WEB = "web-token-abc";
  const ME = "me";

  /** The worklist's case: N foreign rows → N deletes, then one create. */
  it("frees the token from other accounts, then claims it", () => {
    const plan = reconcileDeviceToken({
      token: WEB,
      userID: ME,
      foreignRows: [
        { token: WEB, userID: "someone" },
        { token: WEB, userID: "someone-else" },
      ],
      alreadyMine: false,
    });

    expect(plan.deletes).toEqual([{ token: WEB }, { token: WEB }]);
    expect(plan.create).toEqual({ token: WEB, userID: ME });
  });

  it("creates nothing when the row is already ours", () => {
    const plan = reconcileDeviceToken({
      token: WEB,
      userID: ME,
      foreignRows: [],
      alreadyMine: true,
    });
    expect(plan).toEqual({ deletes: [], create: null });
  });

  /**
   * The safety property that matters most.
   *
   * `UserDeviceToken`'s primary key is the token string — introspected against
   * the live endpoint: `DeleteUserDeviceTokenInput { token: String! }`. A phone
   * token is a different string, minted by a different Firebase project, so it
   * can never appear in `foreignRows` for a web token. This asserts that even
   * if a malformed server response *did* hand one over, the reducer refuses it.
   */
  it("cannot propose deleting a row that is not this exact token", () => {
    const plan = reconcileDeviceToken({
      token: WEB,
      userID: ME,
      foreignRows: [
        { token: "phone-token-of-the-same-member", userID: "someone" },
        { token: WEB, userID: "someone" },
      ],
      alreadyMine: false,
    });

    expect(plan.deletes).toEqual([{ token: WEB }]);
    expect(
      plan.deletes.some((d) => d.token.includes("phone")),
      "a phone row must be unreachable from here",
    ).toBe(false);
  });

  /** Nor one of ours under our own id — mobile's filter excludes it too. */
  it("never deletes our own row", () => {
    const plan = reconcileDeviceToken({
      token: WEB,
      userID: ME,
      foreignRows: [{ token: WEB, userID: ME }],
      alreadyMine: true,
    });
    expect(plan.deletes).toEqual([]);
  });
});

describe("token registration is off, and provably inert", () => {
  beforeEach(() => {
    vi.mocked(API.graphql).mockReset();
    delete process.env.NEXT_PUBLIC_PUSH_TOKEN_REGISTRATION;
  });

  /**
   * The state this ships in. A web FCM token cannot receive anything from a
   * sender holding the mobile project's credentials (`SENDER_ID_MISMATCH`), so
   * registering it would deliver nothing and add a token guaranteed to fail.
   */
  it("issues no GraphQL at all while the switch is off", async () => {
    expect(tokenRegistrationEnabled()).toBe(false);

    await expect(
      registerDeviceToken({ token: "t", userID: "me" }),
    ).resolves.toEqual({ status: "skipped", reason: "disabled" });

    await expect(
      unregisterDeviceToken({ token: "t", userID: "me" }),
    ).resolves.toEqual({ status: "skipped" });

    expect(API.graphql).not.toHaveBeenCalled();
  });

  it("writes nothing without both a token and an account", async () => {
    process.env.NEXT_PUBLIC_PUSH_TOKEN_REGISTRATION = "true";
    await expect(
      registerDeviceToken({ token: "", userID: "me" }),
    ).resolves.toEqual({ status: "skipped", reason: "incomplete" });
    await expect(
      registerDeviceToken({ token: "t", userID: "  " }),
    ).resolves.toEqual({ status: "skipped", reason: "incomplete" });
    expect(API.graphql).not.toHaveBeenCalled();
  });

  it("runs the full plan once enabled", async () => {
    process.env.NEXT_PUBLIC_PUSH_TOKEN_REGISTRATION = "true";

    vi.mocked(API.graphql)
      /* foreign rows */
      .mockResolvedValueOnce({
        data: {
          listUserDeviceTokens: { items: [{ token: "t", userID: "other" }] },
        },
      } as never)
      /* mine */
      .mockResolvedValueOnce({
        data: { listUserDeviceTokens: { items: [] } },
      } as never)
      /* delete */
      .mockResolvedValueOnce({ data: {} } as never)
      /* create */
      .mockResolvedValueOnce({ data: {} } as never);

    await expect(
      registerDeviceToken({ token: "t", userID: "me" }),
    ).resolves.toEqual({ status: "registered", deleted: 1, created: true });

    const calls = vi.mocked(API.graphql).mock.calls.map(
      (c) => (c[0] as { query: string }).query,
    );
    expect(calls[2]).toContain("deleteUserDeviceToken");
    expect(calls[3]).toContain("createUserDeviceToken");
  });

  /** Removal is scoped to this browser's own row, as mobile's logout is. */
  it("removes only this token on sign-out", async () => {
    process.env.NEXT_PUBLIC_PUSH_TOKEN_REGISTRATION = "true";
    vi.mocked(API.graphql)
      .mockResolvedValueOnce({
        data: { listUserDeviceTokens: { items: [{ token: "t" }] } },
      } as never)
      .mockResolvedValueOnce({ data: {} } as never);

    await expect(
      unregisterDeviceToken({ token: "t", userID: "me" }),
    ).resolves.toEqual({ status: "removed" });

    const del = vi.mocked(API.graphql).mock.calls[1]![0] as {
      query: string;
      variables: { input: { token: string } };
    };
    expect(del.query).toContain("deleteUserDeviceToken");
    expect(del.variables.input).toEqual({ token: "t" });
  });

  it("says so rather than throwing when the backend refuses", async () => {
    process.env.NEXT_PUBLIC_PUSH_TOKEN_REGISTRATION = "true";
    vi.mocked(API.graphql).mockRejectedValue(new Error("denied"));
    await expect(
      registerDeviceToken({ token: "t", userID: "me" }),
    ).resolves.toEqual({ status: "failed" });
  });

  /**
   * Every mutation this module can issue is keyed by `token`, which is the
   * table's primary key. A grep is the honest check here: it catches a future
   * edit that adds a delete keyed by `userID`, which is the one shape that
   * *could* reach a member's phone row.
   */
  it("has no mutation keyed by anything but the token", () => {
    const source = sourceOf("lib/push/deviceToken.ts");
    expect(source).toContain("DeleteUserDeviceTokenInput");
    expect(source).not.toMatch(/delete[A-Za-z]*\([^)]*userID/i);
    /* The reducer only ever emits `{ token }` delete inputs. */
    expect(source).toMatch(/\.map\(\(row\) => \(\{ token: row\.token \}\)\)/);
  });

  it("is wired behind the switch on both lifecycle paths", () => {
    const client = sourceOf("lib/push/pushClient.ts");
    expect(client).toContain("registerDeviceToken({");
    expect(client).toContain("unregisterDeviceToken({");
    /* Stream's removeDevice must run first — it is what delivers today. */
    expect(client).toMatch(
      /removeDevice\(currentToken[\s\S]{0,300}unregisterDeviceToken/,
    );
  });
});

/* ── buddy-id-qr-scanner ────────────────────────────────────────────────── */

describe("reading a Buddy ID out of a scan", () => {
  /** The worklist's exact case. */
  it("takes the id out of a shared link", () => {
    expect(
      extractBuddyIdFromScan(
        "https://cancerbuddy.bonemarrow.org/buddyId/BI-0000-0001",
      ),
    ).toBe("BI-0000-0001");
  });

  it("accepts the three payloads mobile accepts", () => {
    /* Bare id, scheme link, and an unformatted id — mobile's `handleReadScanner`
       normalises all three (`QrIdentification.tsx:37-58`). */
    expect(extractBuddyIdFromScan("BI-0000-0001")).toBe("BI-0000-0001");
    expect(extractBuddyIdFromScan("cancerbuddy://buddyId/BI-0000-0001")).toBe(
      "BI-0000-0001",
    );
    expect(extractBuddyIdFromScan("bi00000001")).toBe("BI-0000-0001");
  });

  /** A camera sees a lot that is not a Buddy ID. */
  it("refuses anything that is not one", () => {
    for (const payload of [
      "",
      "   ",
      "https://example.com",
      "https://example.com/BI-0000-0001",
      "WIFI:S=cafe;T=WPA;P=hunter2;;",
      "BI-0000",
      "https://cancerbuddy.bonemarrow.org/groups",
      /* Stricter than the typed field on purpose: a scanner decodes seven times
         a second, so an eight-character coupon must not read as a member. */
      "12345678",
    ]) {
      expect(extractBuddyIdFromScan(payload), payload).toBeNull();
    }
  });

  it("ignores other codes in frame and returns the first Buddy ID", async () => {
    const detector = {
      detect: async () => [
        { rawValue: "https://example.com" },
        { rawValue: "https://cancerbuddy.bonemarrow.org/buddyId/BI-0000-0002" },
      ],
    };
    await expect(
      scanFrame(detector, {} as CanvasImageSource),
    ).resolves.toBe("BI-0000-0002");
  });

  it("reports nothing rather than throwing on a frameless video", async () => {
    const detector = {
      detect: async () => {
        throw new DOMException("not ready");
      },
    };
    await expect(scanFrame(detector, {} as CanvasImageSource)).resolves.toBeNull();
  });

  /**
   * The point of the whole item: a scanned id must not be a laxer route into a
   * profile than a typed one.
   */
  it("hands the scan to the same guard ladder as the typed field", () => {
    const screen = sourceOf("components/profile/BuddyIdScreen.tsx");
    expect(screen).toMatch(/handleScan[\s\S]{0,400}buddyIdLookup\.lookup\(scanned\)/);
    expect(screen).toContain("qrScanningSupported()");
  });

  /** The camera must be released on every exit path. */
  it("stops the camera when it is done", () => {
    const scanner = sourceOf("components/profile/BuddyIdScanner.tsx");
    expect(scanner).toMatch(/getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
    expect(scanner).toMatch(/return \(\) => \{\s*cancelled = true;\s*stop\(\);/);
    expect(scanner).toMatch(/doneRef\.current = true;\s*stop\(\);/);
  });
});

/* ── push-badge-and-tray-hygiene ────────────────────────────────────────── */

describe("badge and tray hygiene", () => {
  const worker = readFileSync("public/firebase-messaging-sw.js", "utf8");

  it("counts up on each push that the member has to come back to", () => {
    expect(worker).toMatch(/badgeCount \+= 1/);
    expect(worker).toMatch(/setAppBadge\?\.\(badgeCount\)/);
    /* Not for one handed to a focused tab — that one returns before showing. */
    expect(worker).toMatch(
      /showNotification\(title, options\);[\s\S]{0,200}await bumpBadge\(\)/,
    );
  });

  it("clears the badge on any notification tap, as mobile does", () => {
    expect(worker).toMatch(
      /addEventListener\("notificationclick"[\s\S]{0,600}await resetBadge\(\)/,
    );
    expect(worker).toMatch(/clearAppBadge\?\.\(\)/);
  });

  /**
   * Mobile's rule, and its own comment explains why: tapping a buddy request
   * sweeps the other buddy requests, but must leave chat and live alone —
   * they point somewhere else entirely.
   */
  it("sweeps sibling connect notifications but not chat or live", () => {
    expect(worker).toContain("function isConnectLike");
    expect(worker).toContain('data.type !== "CHAT_MESSAGE"');
    expect(worker).toContain('data.type !== "LIVE_NOTIFY"');
    expect(worker).toMatch(
      /if \(isConnectLike\(data\)\)[\s\S]{0,300}isConnectLike\(notification\.data\)\) notification\.close\(\)/,
    );
  });

  it("clears the whole tray when the page asks, and only then", () => {
    expect(worker).toContain('"cancerbuddy:clear-tray"');
    expect(worker).toContain('"cancerbuddy:clear-badge"');
    expect(worker).toMatch(
      /clear-tray"[\s\S]{0,200}clearTray\(\)[\s\S]{0,60}resetBadge\(\)/,
    );
  });

  it("is asked by the two screens mobile clears in", () => {
    const updates = sourceOf("components/notifications/UpdatesScreen.tsx");
    expect(updates).toContain('clearPushNotices("tray")');

    const bridge = sourceOf("components/push/PushBridge.tsx");
    expect(bridge).toContain('clearPushNotices("badge")');
    /* Foreground, not mount — mobile clears on app state change. */
    expect(bridge).toContain("useLiveResync(");
  });

  it("degrades silently where the Badging API does not exist", () => {
    /* Firefox and Safari-on-macOS. The notification still arrives. */
    expect(worker).toMatch(/self\.navigator\?\.setAppBadge\?\./);
    expect(worker).toMatch(/self\.navigator\?\.clearAppBadge\?\./);
  });
});
