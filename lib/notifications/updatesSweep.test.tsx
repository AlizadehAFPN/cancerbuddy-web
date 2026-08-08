import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("@/lib/notifications/fetch", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/notifications/fetch")
  >();
  return { ...actual, fetchNotifications: vi.fn() };
});

import { fetchNotifications } from "@/lib/notifications/fetch";
import { useNotifications } from "@/lib/notifications/useNotifications";
import { useLiveResync } from "@/lib/hooks/useLiveResync";
import NotificationRow from "@/components/notifications/NotificationRow";
import { senderName, formatName } from "@/lib/buddies/display";
import type { AppNotification } from "@/lib/notifications/types";

/**
 * Acceptance checks for WORKLIST Phase 8 — the Updates sweep.
 *
 * The worklist asks for Playwright on the live-refresh item; there is no browser
 * project, so the worker message is dispatched onto a stubbed
 * `navigator.serviceWorker` against a real React root, which exercises the same
 * path the page would.
 */

function sourceOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

/* ── Harness ────────────────────────────────────────────────────────────── */

let container: HTMLDivElement;
let root: Root;
/** The stub stands in for the worker; the page listens on this object. */
let serviceWorker: EventTarget;

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

function render(node: React.ReactNode) {
  act(() => root.render(node));
}

function postWorkerMessage(type: string, data?: unknown) {
  act(() => {
    const event = new Event("message") as Event & { data?: unknown };
    event.data = { type, data };
    serviceWorker.dispatchEvent(event);
  });
}

beforeEach(() => {
  /* Fake timers throughout so the coalescing window is steerable. Microtasks
     are untouched, so `await act(async () => {})` still flushes the fetches. */
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-08T12:00:00Z"));
  setVisibility("visible");

  serviceWorker = new EventTarget();
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    get: () => serviceWorker,
  });

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

/* ── notifications-full-sender-name ─────────────────────────────────────── */

function notification(
  remitent: Partial<AppNotification["remitent"]>,
): AppNotification {
  return {
    id: "n1",
    createdAt: "2026-08-08T11:00:00Z",
    typeNotification: "Posted in",
    remitent: { id: "u1", name: "Sarah Chen", ...remitent },
  } as AppNotification;
}

describe("a notification names its sender in full", () => {
  /**
   * Mobile prints `props.name` verbatim for every user type
   * (`ListNotification.tsx:60`). Web ran it through the discovery-card
   * formatter, which keeps the first word only — so a row from "Dr. Sarah Chen"
   * said "Dr.".
   */
  it("prints the whole name for a member", () => {
    render(
      <NotificationRow
        notification={notification({
          name: "Dr. Sarah Chen",
          userType: "PATIENT",
        })}
        now={Date.now()}
        onOpenRequests={() => {}}
      />,
    );
    expect(container.textContent).toContain("Dr. Sarah Chen");
    expect(container.textContent).not.toMatch(/\bDr\.(?!\s+Sarah)/);
  });

  it("prints the whole name for an organisation account", () => {
    render(
      <NotificationRow
        notification={notification({
          name: "CancerBuddy Support Team",
          userType: "SUPPORT",
        })}
        now={Date.now()}
        onOpenRequests={() => {}}
      />,
    );
    expect(container.textContent).toContain("CancerBuddy Support Team");
  });

  /** The two helpers must stay opposites — that contrast is the whole point. */
  it("is the opposite of the discovery formatter", () => {
    expect(senderName("Dr. Sarah Chen")).toBe("Dr. Sarah Chen");
    expect(formatName("Dr. Sarah Chen")).toBe("Dr.");
    expect(senderName("  Sarah Chen  ")).toBe("Sarah Chen");
    /* A missing name still occupies its line rather than collapsing the row. */
    expect(senderName(null)).toBe(" ");
    expect(senderName("")).toBe(" ");
  });

  it("no longer routes the row through the first-name formatter", () => {
    const row = sourceOf("components/notifications/NotificationRow.tsx");
    expect(row).toContain("senderName(remitent.name)");
    expect(row).not.toContain("formatName");
  });
});

/* ── updates-live-refresh ───────────────────────────────────────────────── */

function Feed({ userId }: { userId: string | null }) {
  const feed = useNotifications(userId);
  return <span data-testid="count">{feed.items.length}</span>;
}

const page = (n: number) => ({
  items: Array.from({ length: n }, (_, i) => notification({ id: `u${i}` })),
  nextToken: null,
});

describe("the Updates feed keeps itself current", () => {
  beforeEach(() => {
    vi.mocked(fetchNotifications).mockReset();
    vi.mocked(fetchNotifications).mockResolvedValue(page(1) as never);
  });

  async function mountFeed() {
    render(<Feed userId="me" />);
    /* Let the first page settle before measuring anything. */
    await act(async () => {});
    expect(fetchNotifications).toHaveBeenCalledTimes(1);
  }

  it("reloads when a push arrives", async () => {
    await mountFeed();

    vi.mocked(fetchNotifications).mockResolvedValue(page(3) as never);
    postWorkerMessage("cancerbuddy:push");
    await act(async () => {});

    expect(fetchNotifications).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe("3");
  });

  /** Every open tab hears this one, focused or not — the badge depends on it. */
  it("reloads on the every-tab message too", async () => {
    await mountFeed();

    postWorkerMessage("cancerbuddy:push-data", { type: "newPost" });
    await act(async () => {});

    expect(fetchNotifications).toHaveBeenCalledTimes(2);
  });

  it("reloads when the member comes back to the tab", async () => {
    await mountFeed();

    setVisibility("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    setVisibility("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => {});

    expect(fetchNotifications).toHaveBeenCalledTimes(2);
  });

  /**
   * The overlap is the common case, not a corner: a push lands, the member taps
   * the banner, and the tab hears the worker *and* becomes visible at once.
   */
  it("loads once when a push and a return arrive together", async () => {
    await mountFeed();

    postWorkerMessage("cancerbuddy:push");
    setVisibility("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    setVisibility("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => {});

    expect(fetchNotifications).toHaveBeenCalledTimes(2);
  });

  it("ignores messages that are not ours", async () => {
    await mountFeed();

    postWorkerMessage("workbox-broadcast-update");
    postWorkerMessage("");
    await act(async () => {});

    expect(fetchNotifications).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a signed-in member", async () => {
    render(<Feed userId={null} />);
    await act(async () => {});
    postWorkerMessage("cancerbuddy:push");
    await act(async () => {});

    expect(fetchNotifications).not.toHaveBeenCalled();
  });

  it("stops listening once the screen is gone", async () => {
    await mountFeed();

    act(() => root.unmount());
    postWorkerMessage("cancerbuddy:push");
    await act(async () => {});

    expect(fetchNotifications).toHaveBeenCalledTimes(1);

    /* Re-established so `afterEach` has something to unmount. */
    root = createRoot(container);
  });

  /**
   * A silent reload must not spin the button the member did not press, and must
   * not drop the list back to its skeleton.
   */
  it("refreshes without reporting activity the member did not cause", () => {
    const hook = sourceOf("lib/notifications/useNotifications.ts");
    expect(hook).toMatch(/reload\(\{ silent: true \}\)/);
    expect(hook).toMatch(/if \(!silent\) setRefreshing\(true\)/);
    expect(hook).toMatch(/enabled: canResync/);
    /* Never over a first page or a page-in-flight. */
    expect(hook).toMatch(/!loading && !loadingMore/);
  });
});

describe("the nav badge keeps itself current", () => {
  /**
   * The subscription alone is not enough: browsers suspend websockets in
   * background tabs, and it only hears about requests *created* — one accepted
   * on a phone leaves the number too high until something re-counts.
   */
  it("re-counts on the same signals as the feed", () => {
    const hook = sourceOf("lib/buddies/usePendingRequestCount.ts");
    expect(hook).toContain("useLiveResync(load,");
    expect(hook).toContain("onCreateConnectionByRecipientId");
  });
});

describe("useLiveResync", () => {
  it("runs again after the coalescing window closes", async () => {
    const seen: number[] = [];
    function Probe() {
      useLiveResync(() => seen.push(Date.now()));
      return null;
    }

    render(<Probe />);

    postWorkerMessage("cancerbuddy:push");
    postWorkerMessage("cancerbuddy:push");
    expect(seen).toHaveLength(1);

    /* A later push is a genuinely new one — more may have happened since. */
    vi.setSystemTime(new Date("2026-08-08T12:05:00Z"));
    postWorkerMessage("cancerbuddy:push");
    expect(seen).toHaveLength(2);
  });

  it("does not listen at all while disabled", () => {
    const cb = vi.fn();
    function Probe() {
      useLiveResync(cb, { enabled: false });
      return null;
    }
    render(<Probe />);

    postWorkerMessage("cancerbuddy:push");
    setVisibility("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    setVisibility("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(cb).not.toHaveBeenCalled();
  });

  /**
   * Listening needs `serviceWorker` and nothing else. `browserCapable()` also
   * demands `Notification` and `PushManager` — the wrong question for a
   * listener, and enough to silently disable it.
   */
  it("does not require permission to be grantable", () => {
    const client = sourceOf("lib/push/pushClient.ts");
    const at = client.indexOf("export function subscribePushSignal");
    expect(at).toBeGreaterThan(-1);
    const body = client.slice(at, at + 600);
    expect(body).not.toContain("browserCapable()");
    expect(body).toContain('"serviceWorker" in navigator');
  });

  /** One definition of the message names, shared with both older listeners. */
  it("matches both worker messages by the shared constants", () => {
    const client = sourceOf("lib/push/pushClient.ts");
    expect(client.match(/"cancerbuddy:push"/g)).toHaveLength(1);
    expect(client.match(/"cancerbuddy:push-data"/g)).toHaveLength(1);
    const worker = readFileSync("public/firebase-messaging-sw.js", "utf8");
    expect(worker).toContain('"cancerbuddy:push"');
    expect(worker).toContain('"cancerbuddy:push-data"');
  });
});
