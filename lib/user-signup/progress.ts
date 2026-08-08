/**
 * How far through `/register` the member is.
 *
 * The strip used to be driven by `USER_REGISTER_STEPS`, a six-entry tuple left
 * over from the phase that only built as far as phone verification. Every step
 * after it — role, the medical branch, address, photo, about, interests,
 * languages, photos, all set, and the two guardian steps — fell outside the
 * tuple, so `RegisterShell` hid the strip entirely on fourteen screens. The
 * longest half of registration ran with no sense of how much was left.
 *
 * Mobile has one number for the whole flow (`SetProgressNextEnrollmentUtil`
 * divides the current index by the path length), so this is a rank over one
 * ordered list, not per-branch arithmetic.
 */

import type { UserRegisterStep } from "./constants";

/**
 * Every step, in walk order, with the rank it reports.
 *
 * Written as an exhaustive `Record` rather than derived from `USER_FLOW_ORDER`
 * on purpose: adding a step to the union without giving it a rank has to fail
 * `tsc --noEmit`, which is the guard that stops this drifting out of date the
 * way the tuple did. The ordinals match `USER_FLOW_ORDER` in
 * `lib/navigation/userStepGate.ts` — that file owns reachability, this one owns
 * display.
 *
 * `intro`, `loading` and `done` carry a rank so the record stays exhaustive but
 * are excluded from {@link PROGRESS_STEPS}: none of them is a step the member
 * is working through.
 */
const STEP_RANK: Record<UserRegisterStep, number> = {
  intro: 0,
  privacy: 1,
  profile: 2,
  guardian: 3,
  guardianOtp: 4,
  credentials: 5,
  emailOtp: 6,
  phone: 7,
  verifiedSuccessfully: 8,
  userRole: 9,
  cgRelationship: 10,
  cgPatientAge: 11,
  diagnosis: 12,
  medicalCenter: 13,
  address: 14,
  createProfile: 15,
  profilePic: 16,
  about: 17,
  interests: 18,
  languages: 19,
  photos: 20,
  loading: 21,
  allSet: 22,
  done: 23,
};

/** Steps that show the strip, in order. */
export const PROGRESS_STEPS: readonly UserRegisterStep[] = (
  Object.keys(STEP_RANK) as UserRegisterStep[]
)
  .filter((s) => s !== "intro" && s !== "loading" && s !== "done")
  .sort((a, b) => STEP_RANK[a] - STEP_RANK[b]);

export const PROGRESS_TOTAL = PROGRESS_STEPS.length;

export interface StepProgress {
  /** 1-based position among {@link PROGRESS_STEPS}. */
  current: number;
  total: number;
  /** 0–100, rounded. Drives both the fill width and `aria-valuenow`. */
  percent: number;
}

export function hasProgress(step: UserRegisterStep): boolean {
  return PROGRESS_STEPS.includes(step);
}

/**
 * Rank-based, so a walk through the flow never goes backwards — including the
 * two branches, because both the caregiver pair and the patient pair sit in
 * walk order inside the one list.
 *
 * A member on either branch skips ranks rather than seeing a different total.
 * That is what mobile reports too: its denominator is the whole path length,
 * not the length of the route this particular person takes.
 */
export function progressFor(step: UserRegisterStep): StepProgress {
  const index = PROGRESS_STEPS.indexOf(step);
  const current = index < 0 ? 1 : index + 1;
  return {
    current,
    total: PROGRESS_TOTAL,
    percent: Math.round((current / PROGRESS_TOTAL) * 100),
  };
}
