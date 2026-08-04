/**
 * Profile-completion percentages for the hub's progress rings.
 *
 * A direct port of `cancerbuddyapp/src/utils/userProgress.ts`, including the
 * per-UserType differences: a SURVIVOR is scored on "in remission since"
 * instead of treatments and treatment status, and an adult PATIENT is scored on
 * two extra college fields nobody else is asked for. The denominators come from
 * `constants/userInformationLimits.ts` and are reproduced verbatim — changing
 * one silently changes what the ring means.
 */

import { displayAge } from "@/lib/buddies/age";
import type { ProfileUser } from "@/lib/profile/types";
import { UserType } from "@/lib/profile/types";

/* Limits — mirror of `constants/userInformationLimits.ts`. */
const LIMIT_INTERESTS = 10;
const LIMIT_PHOTOS = 6;
const LIMIT_PATIENT_PERSONAL_INFO = 13;
const LIMIT_CAREGIVER_AND_SURVIVOR_PERSONAL_INFO = 11;
const LIMIT_CAREGIVER_PERSONAL_INFO = 2;
const LIMIT_MEDICAL_INFORMATION_CAREGIVER = 6;

/**
 * Age at which the college questions count toward completion (`MAXAGE` in
 * mobile's `utils/birth.ts`).
 *
 * Note this is **not** the age at which the college fields become visible —
 * `PersonalInformation` uses `UNIVERSITY_AGE = 17` for that. A 17-year-old
 * patient therefore sees the college questions but is still scored out of 11.
 * That inconsistency is mobile's; it is reproduced here rather than fixed so
 * the same profile shows the same percentage on both clients.
 */
const COLLEGE_SCORING_AGE = 18;

/** Age at which the college fields are shown on the personal-information form. */
export const COLLEGE_VISIBLE_AGE = 17;

/**
 * Mobile's `calcProgress`. It does **not** clamp — over-filling a section can
 * exceed 100 — so the ring component clamps at render instead of here, keeping
 * this function a faithful port.
 */
function calcProgress(count: number, limit: number): number {
  if (!count) return 0;
  return (count / limit) * 100;
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (value === "" || value === false) return false;
  return true;
}

/** Truthy for a populated AppSync connection (`{ items: [...] }`). */
function hasItems(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const items = (value as { items?: unknown[] }).items;
  return Array.isArray(items) && items.length > 0;
}

export function interestProgress(items: unknown[] | undefined): number {
  if (!items) return 0;
  return calcProgress(items.length, LIMIT_INTERESTS);
}

export function galleryProgress(items: unknown[] | undefined): number {
  if (!items) return 0;
  return calcProgress(items.length, LIMIT_PHOTOS);
}

/**
 * The user's own personal-information section.
 *
 * Note the asymmetry ported from mobile: the two college fields are added to
 * the checklist *and* the denominator only for an adult PATIENT — a survivor of
 * the same age is scored out of 11, not 13.
 */
export function personalInformationProgress(user: ProfileUser | null): number {
  if (!user) return 0;

  const isAdultPatient =
    user.userType === UserType.PATIENT &&
    displayAge(user.birth) >= COLLEGE_SCORING_AGE;

  const checks: boolean[] = [
    hasValue(user.userPronounId),
    hasValue(user.bio),
    hasValue(user.zipcode),
    hasValue(user.userCityId),
    hasValue(user.userStateId),
    hasValue(user.cancerloss),
    hasValue(user.userCopingwithcancerlossId),
    hasValue(user.userEthnicitiesId),
    hasValue(user.userSexualOrientationId),
    hasValue(user.userTransgenderId),
    hasValue(user.userWorkplaceId),
    hasItems(user.languages),
  ];

  if (isAdultPatient) {
    checks.push(hasValue(user.CurrentlyInCollege), hasValue(user.userCollegeId));
  }

  return calcProgress(
    checks.filter(Boolean).length,
    isAdultPatient
      ? LIMIT_PATIENT_PERSONAL_INFO
      : LIMIT_CAREGIVER_AND_SURVIVOR_PERSONAL_INFO,
  );
}

/**
 * Medical information.
 *
 * For a SURVIVOR the treatments and treatment-status questions are replaced by
 * "in remission since", and the denominator drops by one accordingly.
 *
 * For a CAREGIVER this scores the *patient's* medical record — mobile's hub
 * hides the caregiver's own medical card and points the patient's card at the
 * same screen.
 */
export function medicalInformationProgress(
  user: ProfileUser | null,
  userType: string | null | undefined,
): number {
  if (!user) return 0;

  const isSurvivor = userType === UserType.SURVIVOR;
  const limit = isSurvivor
    ? LIMIT_MEDICAL_INFORMATION_CAREGIVER - 1
    : LIMIT_MEDICAL_INFORMATION_CAREGIVER;

  const checks: boolean[] = [
    hasItems(user.diagnosis),
    hasItems(user.hospitals),
    hasItems(user.supportOrganizations),
    hasItems(user.desabilities),
  ];

  if (isSurvivor) {
    checks.push(hasValue(user.inRemissionSince));
  } else {
    checks.push(hasItems(user.treatments), hasValue(user.userTreatmentStatusId));
  }

  return calcProgress(checks.filter(Boolean).length, limit);
}

/** The caregiver's record *about* their patient: birth date and relationship. */
export function caregiverPersonalInformationProgress(
  user: ProfileUser | null,
): number {
  if (!user) return 0;
  const checks = [hasValue(user.patientBirth), hasValue(user.userRelationshipId)];
  return calcProgress(
    checks.filter(Boolean).length,
    LIMIT_CAREGIVER_PERSONAL_INFO,
  );
}
