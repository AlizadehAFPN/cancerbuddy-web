import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ALLOWED_POST_TAGS, sanitizePostHtml } from "./sanitizeHtml";
import {
  POST_MAX_CHARS,
  htmlToPlainText,
  isEmptyPostHtml,
  isOverLimit,
  linkifyPostHtml,
  normaliseHref,
  openForEdit,
  postTextLength,
  serialize,
  shouldShowCounter,
} from "./richText";

/** Acceptance check for `post-rich-text-editor`, WORKLIST Phase 1. */
describe("the edit round trip keeps formatting", () => {
  /**
   * Load-bearing. The old model was `postHtmlToText` → textarea →
   * `textToPostHtml`, which returned `hello world x` for this input and wiped
   * the formatting for every member on both clients.
   */
  it("survives bold and an anchor through open → serialize", () => {
    const original =
      '<p>hello <strong>world</strong> <a href="https://x.com">x</a></p>';
    const round = serialize(openForEdit(original));

    expect(round).toMatch(/<(b|strong)>world<\/(b|strong)>/);
    expect(round).toContain('href="https://x.com"');
    expect(htmlToPlainText(round)).toContain("hello world x");
  });

  it("keeps italics, underline and lists", () => {
    const round = serialize(
      openForEdit("<p><em>a</em> <u>b</u></p><ul><li>c</li></ul>"),
    );
    expect(round).toMatch(/<(i|em)>a<\/(i|em)>/);
    expect(round).toContain("<u>b</u>");
    expect(round).toContain("<li>c</li>");
  });

  /** The stored body is untrusted, so sanitising happens on the way in too. */
  it("strips scripts and handlers when opening for edit", () => {
    const opened = openForEdit('<p onclick="steal()">hi</p><script>x()</script>');
    expect(opened).not.toMatch(/script/i);
    expect(opened).not.toMatch(/onclick/i);
    expect(opened).toContain("hi");
  });

  /** Every tag the toolbar can emit must be permitted, or it is lost on save. */
  it("permits every tag the editor produces", () => {
    for (const tag of ["P", "BR", "B", "STRONG", "I", "EM", "U", "A"]) {
      expect(ALLOWED_POST_TAGS.has(tag), `${tag} must be allowed`).toBe(true);
    }
  });
});

/** Acceptance check for `post-char-limit`. */
describe("the 2000-character limit", () => {
  it("counts text, not markup", () => {
    expect(postTextLength("<p><strong>hello</strong></p>")).toBe(5);
    expect(postTextLength("<p>a</p><p>b</p>")).toBe(3); // a \n b
  });

  it("is over at 2001 and not at 2000", () => {
    expect(isOverLimit("x".repeat(2001))).toBe(true);
    expect(isOverLimit("x".repeat(POST_MAX_CHARS))).toBe(false);
  });

  /** Markup must not push a legal post over the edge. */
  it("does not count tags toward the limit", () => {
    const body = `<p><strong>${"x".repeat(2000)}</strong></p>`;
    expect(isOverLimit(body)).toBe(false);
  });

  it("shows the counter from 1920 and not before", () => {
    expect(shouldShowCounter(1919)).toBe(false);
    expect(shouldShowCounter(1920)).toBe(true);
  });

  it("treats a markup-only body as empty", () => {
    expect(isEmptyPostHtml("<p></p><p><br /></p>")).toBe(true);
    expect(isEmptyPostHtml("<p>x</p>")).toBe(false);
  });
});

/** Acceptance check for `post-linkify-and-href-repair`. */
describe("linkify and href repair", () => {
  it("links a bare host in body text", () => {
    expect(linkifyPostHtml("<p>see cancerbuddy.com now</p>")).toContain(
      '<a href="https://cancerbuddy.com"',
    );
  });

  it("normalises a doubled scheme", () => {
    expect(normaliseHref("https://https://x.com")).toBe("https://x.com");
    expect(normaliseHref("http://http://x.com")).toBe("http://x.com");
    expect(
      linkifyPostHtml('<p><a href="https://https://x.com">x</a></p>'),
    ).toContain('href="https://x.com"');
  });

  it("gives an email address a mailto scheme", () => {
    expect(normaliseHref("a@b.com")).toBe("mailto:a@b.com");
    expect(linkifyPostHtml("<p>write to a@b.com</p>")).toContain(
      '<a href="mailto:a@b.com"',
    );
  });

  /** A link the author made by hand must not be wrapped again. */
  it("does not double-wrap an existing anchor", () => {
    const out = linkifyPostHtml('<p><a href="https://x.com">x.com</a></p>');
    expect(out.match(/<a /g)).toHaveLength(1);
  });

  it("refuses javascript and data hrefs", () => {
    expect(normaliseHref("javascript:alert(1)")).toBeNull();
    expect(normaliseHref("data:text/html,<script>")).toBeNull();
    // The text survives; only the anchor is unwrapped.
    const out = linkifyPostHtml('<p><a href="javascript:alert(1)">click</a></p>');
    expect(out).not.toMatch(/javascript:/i);
    expect(out).toContain("click");
  });

  it("leaves trailing sentence punctuation outside the link", () => {
    const out = linkifyPostHtml("<p>go to cancerbuddy.com.</p>");
    expect(out).toContain('href="https://cancerbuddy.com"');
    expect(out).toMatch(/<\/a>\.\s*<\/p>/);
  });

  it("leaves ordinary prose alone", () => {
    const out = linkifyPostHtml("<p>I take 3.5 mg daily. It helps.</p>");
    expect(out).not.toContain("<a ");
  });

  /** Anchors this produces must survive the allowlist, or the work is undone. */
  it("produces anchors that survive sanitizePostHtml", () => {
    const out = sanitizePostHtml(linkifyPostHtml("<p>see cancerbuddy.com</p>"));
    expect(out).toContain('href="https://cancerbuddy.com"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
  });
});

describe("the composer uses the model", () => {
  const source = readFileSync("components/groups/PostComposer.tsx", "utf8");
  /** Comments stripped: the docblock names the old functions to explain them. */
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("no longer round-trips through plain text", () => {
    expect(code).not.toMatch(/postHtmlToText/);
    expect(code).not.toMatch(/textToPostHtml/);
    expect(code).toMatch(/openForEdit\(/);
    expect(code).toMatch(/serialize\(/);
  });

  it("offers the three formats mobile offers, plus links", () => {
    expect(code).toMatch(/"bold"/);
    expect(code).toMatch(/"italic"/);
    expect(code).toMatch(/"underline"/);
    expect(code).toMatch(/addLink/);
  });

  it("linkifies before sanitising on submit", () => {
    expect(code).toMatch(/serialize\(linkifyPostHtml\(/);
  });
});
