import { sanitizePostHtml } from "@/lib/groups/sanitizeHtml";

/**
 * The post body's value model.
 *
 * The composer used to hold **plain text**: it opened a post with
 * `postHtmlToText` and saved with `textToPostHtml`. That round trip is lossy by
 * construction — bold, italics, underline, lists and anchor `href`s all
 * disappeared — so editing a formatted post from web silently destroyed its
 * formatting for everyone on both clients.
 *
 * Holding HTML and sanitising at both ends keeps the round trip faithful while
 * still refusing anything the allowlist does not cover.
 *
 * Mobile's toolbar offers exactly bold / italic / underline
 * (`cancerbuddyapp/src/components/elements/format-toolbar/FormatToolbar.tsx:20-31`)
 * plus links from a separate dialog. TenTap emits `<p> <strong> <em> <u> <a>
 * <br>`, all of which `ALLOWED_TAGS` already permits.
 */

/** Seeds the editor. Sanitised on the way in as well as out — the stored body is untrusted. */
export function openForEdit(html: string | null | undefined): string {
  return sanitizePostHtml(html);
}

/** The value to store. */
export function serialize(html: string | null | undefined): string {
  return sanitizePostHtml(html);
}

/**
 * Visible characters, for the limit and the counter.
 *
 * Counts **text, not markup** — otherwise a bolded word would cost more than a
 * plain one and the limit would disagree with mobile's, which counts what the
 * user typed.
 */
export function postTextLength(html: string | null | undefined): number {
  return htmlToPlainText(html).length;
}

/** Shared with previews and `aria-label`s; entity-aware, tag-stripping. */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  const withBreaks = html
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const stripped = withBreaks.replace(/<[^>]*>/g, "");

  const entities: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
  };
  return stripped
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (m) => entities[m] ?? m)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A body with no visible text is empty however much markup it carries. */
export function isEmptyPostHtml(html: string | null | undefined): boolean {
  return postTextLength(html) === 0;
}

/* ── Comment bodies ─────────────────────────────────────────────────────── */

/**
 * A comment as it is stored.
 *
 * Comments are HTML too, not plain text: mobile sends
 * `comment.replaceAll('\n', '<br>')` (`PostDetails.tsx:273`) and renders the
 * result through `RenderHtml`. Web sent raw newlines and rendered with
 * `whitespace-pre-line`, so a mobile-authored line break arrived on web as the
 * literal characters `<br>`.
 *
 * Deliberately does **not** escape the rest of the text, because mobile does
 * not: a member who types `<b>` gets bold on both clients, and escaping on web
 * alone would make the same keystrokes mean different things depending on which
 * app was open. Safety on the web side comes from `sanitizePostHtml` at render.
 */
export function commentToHtml(text: string): string {
  return text.replace(/\r\n|\r|\n/g, "<br>");
}

/* ── Limit and counter ──────────────────────────────────────────────────── */

/** Mobile's cap. Web had none, so it could author bodies mobile would refuse. */
export const POST_MAX_CHARS = 2000;
/** Mobile reveals the counter in the last 4% — 1920 of 2000. */
export const POST_COUNTER_THRESHOLD = 1920;

export function isOverLimit(value: string | null | undefined): boolean {
  return postTextLength(value) > POST_MAX_CHARS;
}

export function shouldShowCounter(length: number): boolean {
  return length >= POST_COUNTER_THRESHOLD;
}

/* ── Linkifying and href repair ─────────────────────────────────────────── */

/**
 * A bare URL or email in body text. Deliberately conservative: it requires a
 * known scheme, a `www.` prefix, or a dotted host with a plausible TLD, so
 * ordinary prose like "3.5 mg" or a sentence ending in a full stop is left alone.
 */
const BARE_LINK =
  /\b((?:https?:\/\/|www\.)[^\s<>()]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?:[A-Za-z0-9-]+\.)+(?:com|org|net|edu|gov|io|co|health|app)(?:\/[^\s<>()]*)?)/g;

/** Trailing punctuation belongs to the sentence, not the URL. */
function trimTrailingPunctuation(value: string): { url: string; tail: string } {
  const m = /[.,;:!?)\]]+$/.exec(value);
  if (!m) return { url: value, tail: "" };
  return { url: value.slice(0, m.index), tail: value.slice(m.index) };
}

/**
 * Normalises an href into something a browser can follow.
 *
 * Repairs the malformed values mobile has authored — a doubled scheme is the one
 * seen in the wild — and gives a bare host or an email the scheme it is missing.
 * Returns null for anything that cannot be made safe, so the caller leaves the
 * text unlinked rather than emitting a dead or dangerous anchor.
 */
export function normaliseHref(raw: string | null | undefined): string | null {
  let value = (raw ?? "").trim();
  if (!value) return null;

  // `https://https://x.com` and friends — collapse a repeated scheme.
  value = value.replace(/^((?:https?:\/\/)+)/i, (m) =>
    m.toLowerCase().startsWith("http://") ? "http://" : "https://",
  );
  value = value.replace(/^(https?:\/\/)(?:https?:\/\/)+/i, "$1");

  const lower = value.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:")) return null;
  if (lower.startsWith("mailto:") || lower.startsWith("tel:")) return value;
  if (lower.startsWith("http://") || lower.startsWith("https://")) return value;
  if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value)) {
    return `mailto:${value}`;
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return null; // some other scheme
  return `https://${value}`;
}

function linkifyTextNode(text: string): string {
  return text.replace(BARE_LINK, (match) => {
    const { url, tail } = trimTrailingPunctuation(match);
    const href = normaliseHref(url);
    if (!href) return match;
    const escaped = url.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return `<a href="${href}">${escaped}</a>${tail}`;
  });
}

/**
 * Turns bare URLs and email addresses in body text into anchors, and repairs the
 * hrefs of anchors that are already there.
 *
 * Text inside an existing `<a>` is skipped, so a link the author made by hand is
 * never wrapped twice. Run before {@link serialize} — the sanitiser's allowlist
 * keeps the anchors and strips anything unsafe this produced.
 */
export function linkifyPostHtml(html: string | null | undefined): string {
  if (!html) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html;
  }

  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return "";

  // Repair authored hrefs first, so a malformed one is fixed rather than dropped.
  for (const anchor of Array.from(root.querySelectorAll("a"))) {
    const href = normaliseHref(anchor.getAttribute("href"));
    if (href) anchor.setAttribute("href", href);
    else anchor.replaceWith(...Array.from(anchor.childNodes));
  }

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest("a")) continue; // already linked
    if (BARE_LINK.test(node.data)) targets.push(node);
    BARE_LINK.lastIndex = 0;
  }

  for (const node of targets) {
    const span = doc.createElement("span");
    span.innerHTML = linkifyTextNode(node.data);
    node.replaceWith(...Array.from(span.childNodes));
  }

  return root.innerHTML;
}
