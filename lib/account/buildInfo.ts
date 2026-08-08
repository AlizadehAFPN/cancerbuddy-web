/**
 * Which build am I running.
 *
 * Mobile prints its version in Settings so support can ask "what does the
 * bottom of your settings screen say?" and get a useful answer. Web printed
 * nothing, which on a continuously-deployed web app is worse: there is no store
 * listing to infer a version from.
 *
 * Both values are injected at build time by `next.config.ts` — the version from
 * `package.json`, the SHA from the checkout — so they describe the bundle in the
 * member's browser rather than whatever is on the server now.
 */

/** `1.4.0 (a1b2c3d)`, or a placeholder when either half is missing. */
export function formatBuildIdentification(
  version: string | undefined,
  sha: string | undefined,
): string {
  const v = version?.trim();
  const s = sha?.trim();
  if (!v || !s) return "Development build";
  return `${v} (${s.slice(0, 7)})`;
}

export function buildIdentification(): string {
  return formatBuildIdentification(
    process.env.NEXT_PUBLIC_APP_VERSION,
    process.env.NEXT_PUBLIC_BUILD_SHA,
  );
}
