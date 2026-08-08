import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { firstUnreadIndex } from "./unreadSeparator";
import { backoffDelays, withRetry } from "./retry";

const read = (p: string) =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** Acceptance check for `chat-unread-separator`, WORKLIST Phase 2. */
describe("firstUnreadIndex", () => {
  const msgs = [
    { createdAt: "2026-08-07T10:00:00Z", userId: "them" },
    { createdAt: "2026-08-07T11:00:00Z", userId: "them" },
    { createdAt: "2026-08-07T12:00:00Z", userId: "them" },
  ];
  const at = (iso: string) => new Date(iso).getTime();

  it("points at the first incoming message after the last read", () => {
    expect(firstUnreadIndex(msgs, at("2026-08-07T10:30:00Z"), "me")).toBe(1);
    expect(firstUnreadIndex(msgs, at("2026-08-07T09:00:00Z"), "me")).toBe(0);
  });

  it("returns -1 when everything has been read", () => {
    expect(firstUnreadIndex(msgs, at("2026-08-07T13:00:00Z"), "me")).toBe(-1);
  });

  /** Your own messages are never unread. */
  it("returns -1 when the only newer messages are mine", () => {
    const mineOnly = [{ createdAt: "2026-08-07T12:00:00Z", userId: "me" }];
    expect(firstUnreadIndex(mineOnly, at("2026-08-07T10:00:00Z"), "me")).toBe(-1);
  });

  it("skips my messages to find the first incoming one", () => {
    const mixed = [
      { createdAt: "2026-08-07T11:00:00Z", userId: "me" },
      { createdAt: "2026-08-07T12:00:00Z", userId: "them" },
    ];
    expect(firstUnreadIndex(mixed, at("2026-08-07T10:00:00Z"), "me")).toBe(1);
  });

  it("returns -1 without a user or a last-read time", () => {
    expect(firstUnreadIndex(msgs, at("2026-08-07T10:00:00Z"), null)).toBe(-1);
    expect(firstUnreadIndex(msgs, 0, "me")).toBe(-1);
  });

  /**
   * The load-bearing wiring: opening a conversation marks it read, so the
   * timestamp must be captured before that call or the separator never appears.
   */
  it("captures my last-read before markRead", () => {
    const hook = read("lib/chat/useChannelMessages.ts");
    const capture = hook.indexOf("setMyLastReadAt(");
    const markRead = hook.indexOf("ch.markRead()", capture);
    expect(capture).toBeGreaterThan(-1);
    expect(markRead).toBeGreaterThan(capture);
  });

  it("renders one separator element", () => {
    const thread = read("components/chat/MessageThread.tsx");
    expect(thread).toMatch(/data-testid="unread-separator"/);
    expect(thread).toMatch(/i === unreadFrom/);
  });
});

/** Acceptance check for `chat-header-profile-link`. */
describe("the conversation header is not a dead end", () => {
  const header = read("components/chat/ChatHeader.tsx");

  it("links the avatar and name to the contact's profile", () => {
    expect(header).toMatch(/href=\{`\/buddies\/\$\{otherUserId\}`\}/);
  });

  /** Ava is not a member with a profile, so that link would 404. */
  it("does not link a Support conversation", () => {
    expect(header).toMatch(/!!otherUserId && !profile\?\.isSupport/);
  });
});

/** Acceptance check for `chat-reaction-picker-selected-state`. */
describe("the reaction picker shows which one is mine", () => {
  const picker = read("components/chat/ReactionPicker.tsx");
  const bubble = read("components/chat/MessageBubble.tsx");

  it("marks the current reaction with aria-pressed", () => {
    expect(picker).toMatch(/aria-pressed=\{mine\}/);
    expect(picker).toMatch(/r\.type === currentType/);
  });

  /** Required, so a call site that cannot supply it fails to compile. */
  it("takes currentType as a required prop", () => {
    expect(picker).toMatch(/currentType: string \| undefined;/);
    expect(picker).not.toMatch(/currentType\?:/);
  });

  it("passes the member's own reaction from the bubble", () => {
    expect(bubble).toMatch(/message\.reactions\.find\(\(r\) => r\.mine\)\?\.type/);
    expect(bubble.match(/currentType=\{myReactionType\}/g)?.length).toBe(2);
  });
});

/** Acceptance check for `chat-message-actions-touch-reachable`. */
describe("message actions are reachable without hover", () => {
  const bubble = read("components/chat/MessageBubble.tsx");

  it("reveals the controls on a coarse pointer", () => {
    expect(bubble).toMatch(/pointer-coarse:opacity-100/);
  });

  it("opens the action menu on a long press", () => {
    expect(bubble).toMatch(/onTouchStart=/);
    expect(bubble).toMatch(/LONG_PRESS_MS = 500/);
    expect(bubble).toMatch(/setMenuOpen\(true\)/);
  });

  /** A press that turns into a scroll must not open the menu. */
  it("cancels on move, end and cancel", () => {
    for (const handler of ["onTouchEnd", "onTouchMove", "onTouchCancel"]) {
      expect(bubble).toMatch(new RegExp(`${handler}=\\{cancelLongPress\\}`));
    }
  });
});

/** Acceptance check for `chat-camera-capture`. */
describe("the composer can take a photo", () => {
  /** Raw: `accept="image/*"` contains a `/*` that a comment strip would misread. */
  const composer = readFileSync("components/chat/MessageComposer.tsx", "utf8");

  it("exposes an input carrying capture=environment", () => {
    expect(composer).toMatch(/capture="environment"/);
  });

  /**
   * A separate input from the file picker: a single input carrying `capture`
   * opens the camera and offers no way to choose an existing photo.
   */
  it("keeps the file picker separate and free of capture", () => {
    const pickerBlock = composer.slice(
      composer.indexOf("ref={fileRef}"),
      composer.indexOf("ref={cameraRef}"),
    );
    expect(pickerBlock).not.toMatch(/capture=/);
    expect(composer).toMatch(/accept="image\/\*"\s*\n\s*capture="environment"/);
  });
});

/** Acceptance check for `chat-connect-resilience-retry`, WORKLIST Phase 2. */
describe("backoffDelays", () => {
  it("is exponential from one second", () => {
    expect(backoffDelays(3)).toEqual([1000, 2000, 4000]);
    expect(backoffDelays(1)).toEqual([1000]);
    expect(backoffDelays(0)).toEqual([]);
  });
});

describe("withRetry", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resolves after two failures and calls the fn three times", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error("transient");
      return "ok";
    });

    const promise = withRetry(fn, 3);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  /** `attempts` counts total tries, not retries. */
  it("gives up after exactly three attempts and rethrows", async () => {
    const fn = vi.fn(async () => {
      throw new Error("down");
    });

    const promise = withRetry(fn, 3);
    const assertion = expect(promise).rejects.toThrow("down");
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not sleep when the first attempt succeeds", async () => {
    const fn = vi.fn(async () => "ok");
    await expect(withRetry(fn, 3)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("the conversation recovers rather than dead-ending", () => {
  const hook = read("lib/chat/useChannelMessages.ts");
  const screen = read("components/chat/ActiveConversation.tsx");
  const connections = read("lib/chat/connections.ts");

  it("retries the channel watch automatically", () => {
    expect(hook).toMatch(/withRetry\(\(\) => ch\.watch\(\)\)/);
  });

  it("offers a manual retry once the automatic ones are exhausted", () => {
    expect(hook).toMatch(/retryLoad:/);
    expect(screen).toMatch(/onClick=\{retryLoad\}/);
  });

  /**
   * The AppSync row is what removal means. Swallowing its failure left the
   * person still connected while the UI navigated away as though it had worked.
   */
  it("no longer swallows a failed removeConnection", () => {
    const fn = connections.slice(connections.indexOf("export async function removeConnection"));
    expect(fn).toMatch(/throw err;/);
    expect(screen).toMatch(/app\.chat\.removeError/);
  });
});
