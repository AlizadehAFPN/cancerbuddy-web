/**
 * Public i18n API.
 *
 * Why a tiny custom helper instead of a third-party library:
 *  • The app is English-only today, so a runtime locale negotiator,
 *    pluralisation engine, and lazy-loading machinery would be pure cost.
 *  • A typed `t(key, params)` gives us compile-time autocomplete on every
 *    string key and runtime placeholder interpolation — the only two
 *    features we actually need.
 *  • Switching to a real i18n library later (next-intl, react-intl, …) is
 *    mechanical: keep the `t` signature, swap the implementation.
 *
 * Usage:
 *  ```ts
 *  import { t } from "@/lib/i18n";
 *  t("login.heading");                                 // → "Welcome back"
 *  t("signup.otp.sub", { length: 6, email: "x@y.z" }); // interpolated
 *  ```
 *
 * Conventions:
 *  • Keys live in `lib/i18n/locales/en.ts` — keep that file alphabetised
 *    inside each feature block. `Messages` is the inferred type.
 *  • Long-form legal content (PRIVACY_POLICY, TERMS_OF_USE, CHILD_SAFETY)
 *    is structured data, not strings, and is re-exported here so every
 *    surface that needs copy has a single import root.
 */

import en, { type Messages } from "./locales/en";

/* ── Long-form legal content (already a structured i18n source) ───────── */
export {
  PRIVACY_POLICY,
  CHILD_SAFETY,
  TERMS_OF_USE,
  LEGAL_DOCUMENTS,
  type LegalDocument,
  type LegalBlock,
} from "@/lib/legal/content";

/* ── Types ───────────────────────────────────────────────────────────── */

/** Locale ids the app understands today. Extended when we add languages. */
export type Locale = "en";
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Dot-joined paths to every *string-leaf* (or *array-of-strings-leaf*) in
 * the messages object. Powers `t(key)` autocomplete.
 *
 * Arrays of strings count as leaves so callers can read e.g. month-name
 * lists via `tList(...)` without losing key safety.
 */
export type MessageKey = DotPathOfStringLeaves<Messages>;

/** Subset of `MessageKey` whose leaf is a `readonly string[]`. */
export type MessageListKey = DotPathOfStringArrayLeaves<Messages>;

/** Runtime params accepted by `t`. Numbers are stringified verbatim. */
export type MessageParams = Record<string, string | number>;

/* ── Dictionary lookup ────────────────────────────────────────────────── */

const dictionaries: Record<Locale, Messages> = { en };

/**
 * Walks `obj` along the dotted `path`. Returns `undefined` if any segment
 * is missing or refers to a non-object container before the final segment.
 * Purposefully untyped at the boundary — the public `t()` / `tList()`
 * helpers narrow the result type from the typed leaf union.
 */
function resolvePath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === "object" && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, obj);
}

/** Replace every `{name}` token with its `params[name]` value. Missing
 *  names are left as-is so the dev sees the unrendered placeholder rather
 *  than `undefined`. */
function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in params ? String(params[key as keyof MessageParams]) : `{${key}}`,
  );
}

function warnMissing(key: string): void {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[i18n] Missing or non-string value for key: ${key}`);
  }
}

/**
 * Look up a string message and interpolate any `{name}` placeholders.
 *
 * Returns the *key itself* in dev when the leaf is missing or has the
 * wrong shape — that surfaces the bug in screenshots and tests instead of
 * silently rendering `undefined`. In production we still return the key
 * as a last-resort fallback (better than an empty string).
 */
export function t(key: MessageKey, params?: MessageParams): string {
  const value = resolvePath(dictionaries[DEFAULT_LOCALE], key);
  if (typeof value === "string") {
    return interpolate(value, params);
  }
  warnMissing(key);
  return key;
}

/**
 * Look up a `readonly string[]` leaf. Useful for fixed lists (month names,
 * etc.) so they live alongside the rest of the catalog.
 */
export function tList(key: MessageListKey): readonly string[] {
  const value = resolvePath(dictionaries[DEFAULT_LOCALE], key);
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return value as readonly string[];
  }
  warnMissing(key);
  return [];
}

/* ── Type plumbing ────────────────────────────────────────────────────── */

/** True iff `T` is `readonly string[]` (or `string[]`). */
type IsStringArray<T> = T extends readonly string[] ? true : false;

/** Dot-joined path of every *string* leaf in the tree. */
type DotPathOfStringLeaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: IsStringArray<T[K]> extends true
    ? never
    : T[K] extends string
      ? `${Prefix}${K}`
      : T[K] extends Record<string, unknown>
        ? DotPathOfStringLeaves<T[K], `${Prefix}${K}.`>
        : never;
}[keyof T & string];

/** Dot-joined path of every *string array* leaf in the tree. */
type DotPathOfStringArrayLeaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: IsStringArray<T[K]> extends true
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
      ? DotPathOfStringArrayLeaves<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];
