/**
 * Forward-only step gating for the `/hosts-register` wizard.
 *
 * Why this exists:
 *   The wizard reads its current step from `?step=…`, which makes browser
 *   back/forward navigation feel native — but it also means a user (or a
 *   stale bookmark, or an autocomplete suggestion) can paste any step name
 *   into the URL bar and land in the middle of registration without having
 *   completed the prior steps. That breaks the product contract (privacy
 *   must be accepted before profile, profile before credentials, …) and
 *   produces broken downstream calls (e.g. confirming an OTP we never
 *   sent).
 *
 * Design:
 *   We track a single `furthestStep` watermark per session, advanced only
 *   when the controller calls `goToStep(next)` *after* the corresponding
 *   step's success criteria have passed. The watermark is monotonic — going
 *   Back never lowers it, so a user who pressed Back from `photo` to
 *   `profile` can still URL-jump forward to `photo` (they earned that
 *   right). Forward jumps beyond the watermark are clamped down.
 *
 * This module is intentionally pure (no React, no store, no DOM) so it
 * can be unit-tested and reused from both the page controller and any
 * future navigation guard / loader.
 */

import type { HostRegisterStep } from "@/lib/host-signup/constants";

/**
 * Canonical forward order of the host-application flow. Every step the
 * user can reach via `?step=…` appears exactly once, in the order they
 * must legitimately be completed.
 *
 * `intro` is the implicit start (the landing screen). `done` is the
 * terminal success screen and is gated by a separate in-memory flag
 * (`registrationDone`) on top of this watermark — see `page.tsx`.
 */
export const HOST_FLOW_ORDER: readonly HostRegisterStep[] = [
  "intro",
  "privacy",
  "profile",
  "credentials",
  "emailOtp",
  "phone",
  "photo",
  "bio",
  "done",
] as const;

/**
 * Numeric position of `step` in `HOST_FLOW_ORDER`. Returns `0` (intro) for
 * any unrecognised value so a bad URL can't crash the gate; the page
 * separately replaces unrecognised `?step=` values with `"intro"` before
 * calling in here, so this fallback is belt-and-braces.
 */
export function hostStepRank(step: HostRegisterStep): number {
  const idx = HOST_FLOW_ORDER.indexOf(step);
  return idx < 0 ? 0 : idx;
}

/** True when `target` is at or before `furthest` in the flow order. */
export function isHostStepReachable(
  target: HostRegisterStep,
  furthest: HostRegisterStep,
): boolean {
  return hostStepRank(target) <= hostStepRank(furthest);
}

/**
 * If `target` is reachable from the current watermark, return it
 * unchanged; otherwise clamp it down to the watermark. The clamped value
 * is what the controller should *render* on this tick; it should then
 * silently `router.replace` the URL to match so the browser address bar
 * doesn't lie about which step the user is on.
 */
export function clampToReachableHostStep(
  target: HostRegisterStep,
  furthest: HostRegisterStep,
): HostRegisterStep {
  return isHostStepReachable(target, furthest) ? target : furthest;
}

/**
 * Monotonic "max" over the flow order — returns whichever of the two
 * inputs is further along. Used by the store action that advances the
 * watermark: `next = maxHostStep(prev, justNavigatedTo)`.
 */
export function maxHostStep(
  a: HostRegisterStep,
  b: HostRegisterStep,
): HostRegisterStep {
  return hostStepRank(a) >= hostStepRank(b) ? a : b;
}
