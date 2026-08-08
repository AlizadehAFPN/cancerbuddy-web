import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/aws/appsyncGraphql", () => ({
  executeAppSyncGraphql: vi.fn(),
}));
vi.mock("@/lib/aws/s3Image", () => ({
  getS3ImageUrl: vi.fn(async (file: unknown) =>
    file ? "https://signed.example/x.jpg" : undefined,
  ),
}));

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { getS3ImageUrl } from "@/lib/aws/s3Image";
import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { BMCF_WEBSITE_URL } from "@/lib/constants/contact";
import { AMBASSADOR_FORM_URL } from "@/components/buddies/AmbassadorBadge";
import { getShareUrl, resetShareUrlCache } from "@/lib/contentful/appLink";
import { fetchPendingRequests, hideUserFromDiscovery } from "./connections";
import {
  getNeighbours,
  neighbourSource,
  resetNeighbourQueue,
  setDiscoveryOrder,
  setNeighbourQueue,
} from "./discoveryOrder";
import { matchSummary } from "./display";
import { fetchBuddyProfileDetail } from "./profileDetail";
import type { CurrentUserData } from "./types";

const exec = vi.mocked(executeAppSyncGraphql);
const signUrl = vi.mocked(getS3ImageUrl);

/** Source with comments stripped — otherwise an assertion matches the prose. */
function sourceOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

/* ── requests-next-queue-from-requests ──────────────────────────────────── */

describe("the Previous/Next queue", () => {
  beforeEach(() => {
    resetNeighbourQueue();
  });

  it("walks a queue seeded from the pending requests", () => {
    setNeighbourQueue(["a", "b", "c"], "requests");
    expect(getNeighbours("b")).toEqual({
      previousId: "a",
      nextId: "c",
      position: { index: 2, total: 3 },
    });
    expect(neighbourSource()).toBe("requests");
  });

  it("has no neighbours for someone outside the queue", () => {
    setNeighbourQueue(["a", "b"], "requests");
    expect(getNeighbours("z")).toEqual({});
  });

  /** Last writer wins — walking into discovery pages through discovery. */
  it("is replaced by a discovery queue set afterwards", () => {
    setNeighbourQueue(["a", "b", "c"], "requests");
    setDiscoveryOrder(["x", "y"]);
    expect(getNeighbours("b")).toEqual({});
    expect(getNeighbours("x")).toEqual({
      nextId: "y",
      previousId: undefined,
      position: { index: 1, total: 2 },
    });
    expect(neighbourSource()).toBe("discovery");
  });

  it("is seeded from both request surfaces", () => {
    for (const path of [
      "components/buddies/RequestsSection.tsx",
      "components/notifications/RequestsPanel.tsx",
    ]) {
      expect(sourceOf(path)).toMatch(/setNeighbourQueue\(\s*\n?\s*\w+\.map/);
      expect(sourceOf(path)).toMatch(/"requests"/);
    }
  });
});

/* ── requests-shared-interest-line ──────────────────────────────────────── */

describe("a buddy request's subtitle", () => {
  beforeEach(() => {
    exec.mockReset();
  });

  const viewer = {
    id: "me",
    userType: "PATIENT",
    birth: "1990-01-01",
    interests: ["i1"],
    hospitals: ["h1"],
    treatments: [],
    diagnosis: [],
    desabilities: [],
    supportOrganizations: [],
  } as unknown as CurrentUserData;

  /** Mobile's order: interests, medical center, treatment, similar diagnosis. */
  it("names what the two have in common, after the state", () => {
    expect(
      matchSummary(
        {
          stateAbbreviation: "NY",
          interests: [{ id: "i1", name: "Cooking" }],
          hospitals: [{ id: "h1", name: "Mount Sinai" }],
          treatments: [{ id: "t9", name: "Chemo" }],
          diagnosis: [],
        },
        viewer,
      ),
    ).toBe("NY, interests, medical center");
  });

  it("falls back to the state alone when nothing matches", () => {
    expect(
      matchSummary(
        {
          stateAbbreviation: "NY",
          interests: [{ id: "i9", name: "Chess" }],
          hospitals: [],
          treatments: [],
          diagnosis: [],
        },
        viewer,
      ),
    ).toBe("NY");
  });

  it("drops the prefix when the sender has no state", () => {
    expect(
      matchSummary(
        {
          interests: [{ id: "i1", name: "Cooking" }],
          hospitals: [],
          treatments: [],
          diagnosis: [],
        },
        viewer,
      ),
    ).toBe("interests");
  });

  it("selects the sender's four relation lists", async () => {
    exec.mockResolvedValue({ data: { byRecipientId: { items: [] } } } as never);
    await fetchPendingRequests("me");

    const query = (exec.mock.calls[0]![0] as { query: string }).query;
    for (const relation of [
      /Interests \{ items \{ interest \{ id name \} \} \}/,
      /Hospitals \{ items \{ hospital \{ id name \} \} \}/,
      /Treatments \{ items \{ treatment \{ id name \} \} \}/,
      /Diagnosis \{ items \{ diagnosis \{ id name \} \} \}/,
      /State \{ stateAbbreviation \}/,
    ]) {
      expect(query).toMatch(relation);
    }
  });

  it("maps them onto the sender", async () => {
    exec.mockResolvedValue({
      data: {
        byRecipientId: {
          items: [
            {
              id: "conn-1",
              createdAt: "2026-01-01",
              Remitent: {
                id: "u1",
                name: "Ada Lovelace",
                State: { stateAbbreviation: "NY" },
                Interests: { items: [{ interest: { id: "i1", name: "Cooking" } }] },
                Hospitals: { items: [{ hospital: null }] },
                Treatments: { items: [] },
                Diagnosis: null,
              },
            },
          ],
        },
      },
    } as never);

    const [request] = await fetchPendingRequests("me");
    expect(request!.remitent.stateAbbreviation).toBe("NY");
    expect(request!.remitent.interests).toEqual([{ id: "i1", name: "Cooking" }]);
    // An unresolved relation row is dropped rather than rendered as a blank.
    expect(request!.remitent.hospitals).toEqual([]);
    expect(request!.remitent.diagnosis).toEqual([]);
  });

  /** The visible half: the card must show the summary, not the sender's bio. */
  it("renders the shared line and not the bio", () => {
    const card = sourceOf("components/buddies/RequestsSection.tsx");
    expect(card).toMatch(/matchSummary\(remitent, viewer\)/);
    expect(card).toMatch(/viewer \? matchSummary\(remitent, viewer\) : "…"/);
    expect(card).not.toMatch(/\{remitent\.bio\}/);
  });
});

/* ── profile-feedback-banner-and-context (the producer half) ────────────── */

describe("the Buddy-ID lookup hands the profile its context", () => {
  it("asks the caller what the pair's relationship is", () => {
    const hook = sourceOf("lib/buddies/useBuddyIdLookup.ts");
    expect(hook).toMatch(/contextFor\?: \(userId: string\) => ConnectionContext/);
    expect(hook).toMatch(/noticeForConnectionContext\(\s*\n?\s*contextFor\(outcome\.userId\)/);

    const sheet = sourceOf("components/buddies/BuddyIdSheet.tsx");
    expect(sheet).toMatch(/connectionContextFor\(connectionMap\[id\]\)/);
  });

  it("renders the banner as a status, not a toast", () => {
    const banner = sourceOf("components/buddies/ProfileNoticeBanner.tsx");
    expect(banner).toMatch(/role="status"/);
    // Every key the union declares has copy behind it.
    for (const key of [
      "noticeSentInvite",
      "noticeAlreadyBuddies",
      "noticeAgeRule",
      "noticeSnoozeAccount",
    ]) {
      expect(banner).toContain(key);
    }
  });

  it("only trusts a notice the union declares", () => {
    const screen = sourceOf("components/buddies/BuddyProfileScreen.tsx");
    expect(screen).toMatch(/isProfileNotice\(noticeParam\)/);
  });
});

/* ── profile-gallery-order-and-viewer ───────────────────────────────────── */

describe("the photo gallery", () => {
  beforeEach(() => {
    exec.mockReset();
    signUrl.mockReset();
    signUrl.mockImplementation(async (file: unknown) =>
      file ? "https://signed.example/x.jpg" : undefined,
    );
  });

  function profileResponse(pictures: unknown[]) {
    return (query: { query: string }) =>
      query.query.includes("listPictures")
        ? ({ data: { listPictures: { items: pictures } } } as never)
        : ({ data: { getUser: { id: "u1", name: "Ada" } } } as never);
  }

  it("asks for createdAt, because the order depends on it", () => {
    const source = sourceOf("lib/buddies/profileDetail.ts");
    const gallery = source.slice(
      source.indexOf("const GET_GALLERY"),
      source.indexOf("interface RawNamed"),
    );
    expect(gallery).toMatch(/createdAt/);
  });

  it("returns photos newest first", async () => {
    exec.mockImplementation((args) =>
      profileResponse([
        { id: "2024", createdAt: "2024-06-01", file: { key: "a" } },
        { id: "2025", createdAt: "2025-06-01", file: { key: "b" } },
        { id: "2023", createdAt: "2023-06-01", file: { key: "c" } },
      ])(args as { query: string }),
    );

    const detail = await fetchBuddyProfileDetail("u1");
    expect(detail!.gallery.map((p) => p.id)).toEqual(["2025", "2024", "2023"]);
  });

  /** A photo that fails to sign is counted, not silently dropped. */
  it("records a failed signed URL instead of hiding it", async () => {
    exec.mockImplementation((args) =>
      profileResponse([
        { id: "ok", createdAt: "2025-01-01", file: { key: "a" } },
        { id: "bad", createdAt: "2024-01-01", file: { key: "b" } },
      ])(args as { query: string }),
    );
    signUrl.mockImplementation(async (file: unknown) => {
      if ((file as { key?: string })?.key === "b") throw new Error("403");
      return "https://signed.example/x.jpg";
    });

    const detail = await fetchBuddyProfileDetail("u1");
    expect(detail!.gallery.map((p) => p.id)).toEqual(["ok"]);
    expect(detail!.galleryFailures).toBe(1);
  });

  it("opens a photo in a dialog the Escape key closes", () => {
    const viewer = sourceOf("components/buddies/PhotoViewer.tsx");
    expect(viewer).toMatch(/role="dialog"/);
    expect(viewer).toMatch(/aria-modal="true"/);
    expect(viewer).toMatch(/e\.key === "Escape"/);

    const profile = sourceOf("components/buddies/BuddyProfileScreen.tsx");
    expect(profile).toMatch(/onClick=\{\(\) => setViewerIndex\(i\)\}/);
    expect(profile).toMatch(/<PhotoViewer/);
  });
});

/* ── profile-pending-and-maybe-later ────────────────────────────────────── */

describe("the profile action bar", () => {
  const bar = sourceOf("components/buddies/ProfileActionBar.tsx");

  /** One mis-click used to withdraw an invite outright. */
  it("puts two dialogs between Pending and a deletion", () => {
    expect(bar).toMatch(/app\.buddies\.pendingGotIt/);
    expect(bar).toMatch(/app\.buddies\.pendingCancelRequest/);
    expect(bar).toMatch(/setConfirming\(true\)/);
    expect(bar).toMatch(/app\.buddies\.pendingCancelYes/);

    // Tapping Pending only opens the explanation; the deletion hangs off the
    // second dialog's confirm and nothing else calls it.
    expect(bar).toMatch(/onClick=\{\(\) => setPendingOpen\(true\)\}/);
    expect(bar.match(/props\.onCancelRequest\(\)/g)).toHaveLength(1);
    const confirmHandler = bar.slice(bar.indexOf("<PendingDialogs"));
    expect(confirmHandler).toMatch(
      /onConfirm=\{\(\) => \{\s*setPendingOpen\(false\);\s*props\.onCancelRequest\(\);/,
    );
  });

  it("labels the pending state Pending, not Withdraw", () => {
    expect(bar).toMatch(/app\.buddies\.pending"/);
    expect(bar).not.toMatch(/withdrawInvite/);
  });

  /** Maybe later needs the incoming request's id, which only a request has. */
  it("offers Maybe later only when a connectionId came with the link", () => {
    expect(bar).toMatch(/const showMaybeLater = !!incomingConnectionId && !isConnected/);

    const screen = sourceOf("components/buddies/BuddyProfileScreen.tsx");
    expect(screen).toMatch(/searchParams\.get\("connectionId"\)/);
    expect(screen).toMatch(/deleteConnection\(incomingConnectionId\)/);

    const card = sourceOf("components/buddies/RequestsSection.tsx");
    expect(card).toMatch(/\?connectionId=\$\{request\.id\}/);
  });
});

/* ── ambassador-explainer-and-cta ───────────────────────────────────────── */

describe("the ambassador explainer", () => {
  /**
   * The wire string is `ambassadorMessage`; the constant is named
   * `CREATE_AMBASSADOR_MESSAGE`. The Lambda rejects the constant's name.
   */
  it("sends the verb the Lambda accepts", () => {
    expect(LambdaPayloadType.CREATE_AMBASSADOR_MESSAGE).toBe("ambassadorMessage");
  });

  it("links to mobile's exact form", () => {
    expect(AMBASSADOR_FORM_URL).toBe(
      "https://docs.google.com/forms/d/e/1FAIpQLScmZ6br0nKbW9980SQM6qDAAihw0akZceawkAa28ftJrc7Dxg/viewform?pli=1",
    );
  });

  it("makes every ambassador badge a button", () => {
    for (const path of [
      "components/buddies/BuddyProfileScreen.tsx",
      "components/buddies/BuddyCard.tsx",
      "components/buddies/RequestsSection.tsx",
      "components/profile/ProfileHub.tsx",
    ]) {
      expect(sourceOf(path)).toMatch(/<AmbassadorBadge/);
    }
    expect(sourceOf("components/buddies/AmbassadorBadge.tsx")).toMatch(
      /<button[\s\S]*?aria-haspopup="dialog"/,
    );
  });

  it("shows the form and learn-more to others, and DISMISS on your own", () => {
    const badge = sourceOf("components/buddies/AmbassadorBadge.tsx");
    expect(badge).toMatch(/isSelf \? "app\.buddies\.ambassadorThanks"/);
    expect(badge).toMatch(/isSelf \? \(\s*<Button fullWidth onClick=\{onClose\}>/);
    expect(badge).toMatch(/ambassadorBecome/);
    expect(badge).toMatch(/ambassadorLearnMore/);
  });

  /** Learn more resolves the support pair's channel before it notifies. */
  it("resolves the support channel, then posts the verb, then navigates", () => {
    const module = sourceOf("lib/buddies/useAmbassadorModal.ts");
    // Only the callback's body — `notifyAmbassadorInterest` is defined above it.
    const hook = module.slice(module.indexOf("const learnMore = useCallback"));
    const order = [
      "fetchSupportUserId(",
      "resolveOrCreateDirectChannel(",
      "notifyAmbassadorInterest(",
      "router.push(",
    ];
    let cursor = -1;
    for (const token of order) {
      const at = hook.indexOf(token);
      expect(at, token).toBeGreaterThan(cursor);
      cursor = at;
    }
  });
});

/* ── app-store-share-qr ─────────────────────────────────────────────────── */

describe("sharing the app", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    resetShareUrlCache();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("shares the store link Contentful holds", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ appLink: "https://apps.apple.com/app/id1" }), {
        status: 200,
      }),
    ) as unknown as typeof fetch;

    await expect(getShareUrl()).resolves.toBe("https://apps.apple.com/app/id1");
  });

  it("falls back to the foundation's website when the entry is empty", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ appLink: null }), { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(getShareUrl()).resolves.toBe(BMCF_WEBSITE_URL);
  });

  it("falls back when the request fails outright", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    await expect(getShareUrl()).resolves.toBe(BMCF_WEBSITE_URL);
  });

  /** The defect: both surfaces used to share `window.location.origin`. */
  it("no longer shares the current page's origin", () => {
    for (const path of [
      "components/buddies/DiscoveryEmptyState.tsx",
      "components/app-shell/AccountSheet.tsx",
      "components/buddies/ShareAppPanel.tsx",
    ]) {
      expect(sourceOf(path)).not.toMatch(/location\.origin/);
    }
    expect(sourceOf("components/app-shell/AccountSheet.tsx")).toMatch(
      /await getShareUrl\(\)/,
    );
  });

  it("renders a QR of that same link", () => {
    const panel = sourceOf("components/buddies/ShareAppPanel.tsx");
    expect(panel).toMatch(/QRCode\.toCanvas\(canvasRef\.current, url/);
    expect(panel).toMatch(/getShareUrl\(\)/);
  });
});

/* ── buddy-recommendation-dismiss (already present — pinned, not rebuilt) ── */

describe("dismissing a recommendation", () => {
  beforeEach(() => {
    exec.mockReset();
  });

  /**
   * This item's premise — "today there is no way to, and it returns on every
   * load" — was already false: the card carries a dismiss control with a
   * confirmation, the write is the same `blocked: true` connection row mobile's
   * `omitConnectionUser` creates, and `fetchBlockedUserIds` filters it out on
   * the next load. Pinned here rather than rebuilt.
   */
  it("writes the blocked connection row mobile writes", async () => {
    exec.mockResolvedValue({ data: {} } as never);
    await hideUserFromDiscovery({ currentUserId: "me", hiddenUserId: "them" });

    const input = exec.mock.calls[0]![0].variables?.input as Record<string, unknown>;
    expect(input).toEqual({
      connectionRemitentId: "me",
      blockedUser: "them",
      blocked: true,
    });
  });

  it("is reachable from the card, behind a confirmation", () => {
    const card = sourceOf("components/buddies/BuddyCard.tsx");
    expect(card).toMatch(/app\.buddies\.hideAction/);
    expect(card).toMatch(/setConfirmingHide\(true\)/);
    expect(card).toMatch(/app\.buddies\.hideConfirm/);

    const screen = sourceOf("components/buddies/BuddiesScreen.tsx");
    expect(screen).toMatch(/hideUserFromDiscovery\(/);
    // And it stays dismissed: the blocked ids screen the next scan.
    expect(screen).toMatch(/blockedUserIds/);
  });
});
