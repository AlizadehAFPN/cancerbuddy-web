/**
 * Sanitiser for group post bodies.
 *
 * Posts are authored as HTML in a rich-text composer and stored verbatim by
 * GetStream, so what comes back is attacker-controlled markup. React Native
 * renders it through a parser that ignores scripts; a browser does not — so on
 * the web this content **must** be sanitised before it reaches
 * `dangerouslySetInnerHTML`.
 *
 * The approach is an allowlist, not a blocklist: parse into a detached
 * document, drop every element that isn't explicitly permitted, and strip every
 * attribute except a vetted few. Anything novel is removed by default, which is
 * the only way this stays safe as the composer changes.
 */

/** Formatting the composer can produce. Anything else is unwrapped or dropped. */
const ALLOWED_TAGS = new Set([
  "P", "BR", "B", "STRONG", "I", "EM", "U", "S", "SPAN", "DIV",
  "UL", "OL", "LI", "BLOCKQUOTE", "A", "H1", "H2", "H3", "H4", "H5", "H6",
]);

/** Elements removed with their contents — never merely unwrapped. */
const DROP_ENTIRELY = new Set([
  "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META",
  "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT", "SVG", "MATH",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  A: new Set(["href", "target", "rel"]),
};

/** `javascript:` and `data:` URLs are the classic href payloads. */
function isSafeHref(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) return true;
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  );
}

function scrub(node: Element): void {
  // Walk a static copy: the live list shifts as children are removed.
  for (const child of [...node.children]) {
    const tag = child.tagName.toUpperCase();

    if (DROP_ENTIRELY.has(tag)) {
      child.remove();
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      // Keep the text, lose the element.
      scrub(child);
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }

    const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>();
    for (const attr of [...child.attributes]) {
      const name = attr.name.toLowerCase();
      // `on*` handlers and `style` are stripped along with everything unlisted.
      if (!allowed.has(name)) {
        child.removeAttribute(attr.name);
        continue;
      }
      if (name === "href" && !isSafeHref(attr.value)) {
        child.removeAttribute(attr.name);
      }
    }

    if (tag === "A") {
      // Links open away from the app, so deny the opener reference.
      child.setAttribute("target", "_blank");
      child.setAttribute("rel", "noopener noreferrer nofollow");
    }

    scrub(child);
  }
}

/**
 * Returns markup safe to inject. On the server (no DOM) it falls back to
 * stripping all tags, so an SSR pass can never emit unsanitised HTML.
 */
export function sanitizePostHtml(html: string | null | undefined): string {
  if (!html) return "";

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html.replace(/<[^>]*>/g, "");
  }

  const doc = new DOMParser().parseFromString(
    `<div id="root">${html}</div>`,
    "text/html",
  );
  const root = doc.getElementById("root");
  if (!root) return "";

  scrub(root);
  return root.innerHTML;
}

/** Plain text version — for previews, search and `aria-label`s. */
export function postHtmlToText(html: string | null | undefined): string {
  if (!html) return "";
  const withBreaks = html
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const stripped = withBreaks.replace(/<[^>]*>/g, "");

  // Decode the handful of entities the composer emits.
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

/** Turns composer plain text into the minimal HTML the feed stores. */
export function textToPostHtml(text: string): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escape(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}
