/**
 * Forward-only step gating for the `/register` wizard.
 *
 * Identical design to `hostStepGate` — see that file for the full rationale.
 * The flow order grows phase by phase; intermediate stages are kept inside
 * the array so future-phase steps can be added without changing the existing
 * watermark semantics.
 */

import type { UserRegisterStep } from "@/lib/user-signup/constants";

/**
 * Canonical forward order of the user-registration flow. Phase 1 stops at
 * the `verifiedSuccessfully` splash; later phases extend the array with the
 * role-aware steps that follow phone verification on mobile.
 *
 * `intro` is the implicit start. `done` is the terminal success screen and
 * is gated by a separate in-memory flag on top of this watermark.
 */
export const USER_FLOW_ORDER: readonly UserRegisterStep[] = [
  "intro",
  "privacy",
  "profile",
  "guardian",
  "guardianOtp",
  "credentials",
  "emailOtp",
  "phone",
  "verifiedSuccessfully",
  "userRole",
  "cgRelationship",
  "cgPatientAge",
  "diagnosis",
  "medicalCenter",
  "address",
  "createProfile",
  "profilePic",
  "about",
  "interests",
  "languages",
  "photos",
  "loading",
  "allSet",
  "done",
] as const;

export function userStepRank(step: UserRegisterStep): number {
  const idx = USER_FLOW_ORDER.indexOf(step);
  return idx < 0 ? 0 : idx;
}

export function isUserStepReachable(
  target: UserRegisterStep,
  furthest: UserRegisterStep,
): boolean {
  return userStepRank(target) <= userStepRank(furthest);
}

export function clampToReachableUserStep(
  target: UserRegisterStep,
  furthest: UserRegisterStep,
): UserRegisterStep {
  return isUserStepReachable(target, furthest) ? target : furthest;
}

export function maxUserStep(
  a: UserRegisterStep,
  b: UserRegisterStep,
): UserRegisterStep {
  return userStepRank(a) >= userStepRank(b) ? a : b;
}
