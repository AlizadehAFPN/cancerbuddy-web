import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { sanitizePostHtml } from "@/lib/groups/sanitizeHtml";

/**
 * Acceptance checks for `chat-host-badge-detection` and
 * `chat-hard-delete-message`, WORKLIST Phase 0.
 *
 * Both live inside hooks wired to a live Stream client, so these assert the two
 * decisive lines in the source. The behavioural halves are the Playwright and
 * request-interception checks recorded against these items in the worklist.
 */
describe("chat-host-badge-detection", () => {
  const source = readFileSync("lib/chat/contactProfile.ts", "utf8");

  /** One undeclared field fails the whole AppSync query, so assert it is selected. */
  it("selects groupHostId in GET_AVATAR_INFORMATION", () => {
    const query = source.slice(
      source.indexOf("const GET_AVATAR_INFORMATION"),
      source.indexOf("interface RawUser"),
    );
    expect(query).toMatch(/^\s*groupHostId$/m);
  });

  /**
   * The rule mobile applies: a non-null `groupHostId` makes someone a host
   * whatever their `userType`, so a PATIENT who hosts a group is not reportable.
   */
  it("derives isHost from groupHostId, not userType", () => {
    expect(source).toMatch(/isHost:\s*!!u\.groupHostId/);
    expect(source).not.toMatch(/isHost:\s*u\.userType === "HOST"/);
  });

  /** `isSupport` is a different question and must keep reading `userType`. */
  it("still derives isSupport from userType", () => {
    expect(source).toMatch(/isSupport:\s*u\.userType === "SUPPORT"/);
  });
});

describe("chat-hard-delete-message", () => {
  const source = readFileSync("lib/chat/useChannelMessages.ts", "utf8");

  it("passes hard=true to client.deleteMessage", () => {
    expect(source).toMatch(/client\.deleteMessage\(\s*id\s*,\s*true\s*\)/);
  });

  it("leaves no soft-delete call behind", () => {
    expect(source).not.toMatch(/client\.deleteMessage\(\s*id\s*\)/);
  });
});

/** Acceptance check for `chat-html-message-body`, WORKLIST Phase 1. */
describe("chat-html-message-body", () => {
  const hook = readFileSync("lib/chat/useChannelMessages.ts", "utf8");
  const bubble = readFileSync("components/chat/MessageBubble.tsx", "utf8");

  /**
   * The defect: the empty-body filter was `text.length > 0 || attachments.length > 0`,
   * so a server-authored message carrying only `html` was dropped and the member
   * saw nothing where mobile shows the message.
   */
  it("an html-only message survives the empty-body filter", () => {
    expect(hook).toMatch(/!!m\.html\?\.trim\(\)/);
    expect(hook).toMatch(/html\?:\s*string/);
  });

  it("carries html off the raw Stream message", () => {
    expect(hook).toMatch(/\(m as \{ html\?: unknown \}\)\.html/);
  });

  /** Server-authored markup is untrusted; it goes through the same allowlist. */
  it("renders the html body sanitised", () => {
    expect(bubble).toMatch(/sanitizePostHtml\(message\.html\)/);
    expect(bubble).toMatch(/message\.text\.length === 0 && !!message\.html/);
  });
});

describe("the sanitizer handles what a server body can contain", () => {
  it("keeps anchors and paragraphs, strips scripts and handlers", () => {
    const out = sanitizePostHtml(
      '<p>Hello <a href="https://x">x</a></p><script>steal()</script><p onclick="y()">z</p>',
    );
    expect(out).toContain('href="https://x"');
    expect(out).toContain("<p>");
    expect(out).not.toMatch(/script/i);
    expect(out).not.toMatch(/onclick/i);
    expect(out).toContain("z");
  });

  it("keeps bold and italic", () => {
    const out = sanitizePostHtml("<p><b>a</b> <i>b</i></p>");
    expect(out).toContain("<b>a</b>");
    expect(out).toContain("<i>b</i>");
  });
});
