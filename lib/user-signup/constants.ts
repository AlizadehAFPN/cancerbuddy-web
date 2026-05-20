/**
 * User registration constants.
 *
 * The user (non-host) flow mirrors the mobile app's enrollment sequence. After
 * Cognito + phone verification it branches by role (Patient / Caregiver /
 * Survivor) and collects profile data, medical info, address, then user-info
 * (photo / about / interests / languages / gallery). Finalisation runs the
 * same UPDATE_USER + many-to-many AppSync mutations and post-signup Lambdas
 * as `LoadingPersonalInformation` on mobile.
 *
 * Phase 1 only ships through `phone` (phone OTP confirmed). Subsequent phases
 * extend `USER_REGISTER_STEPS` with the role-aware steps that follow.
 */

import { OTP_LENGTH, OTP_RESEND_COOLDOWN_SEC } from "@/lib/signup/constants";

export {
  OTP_LENGTH,
  OTP_RESEND_COOLDOWN_SEC,
  PASSWORD_MIN_LENGTH,
  PRONOUN_OPTIONS,
  PRONOUN_LABELS,
  MIN_BIRTH_YEAR,
  MAX_BIRTH_YEAR,
  MIN_AGE,
  MAX_AGE,
} from "@/lib/signup/constants";
export type { PronounOption } from "@/lib/signup/constants";

/** Re-export of the host phone constants — same Twilio Verify pipeline. */
export {
  DIAL_COUNTRIES,
  DEFAULT_DIAL_ISO2,
  getCountryByIso2,
  type DialCountry,
} from "@/lib/host-signup/constants";

/** Phone OTP shares length + cooldown with the email OTP for consistency. */
export const PHONE_OTP_LENGTH = OTP_LENGTH;
export const PHONE_OTP_RESEND_COOLDOWN_SEC = OTP_RESEND_COOLDOWN_SEC;

export const USER_REGISTER_DRAFT_STORAGE_KEY = "cancerbuddy-register-draft";
export const USER_REGISTER_DRAFT_VERSION = 1 as const;

/**
 * Visible step ids for the user-registration flow.
 *
 * Phase 1 stops at the `verifiedSuccessfully` splash screen — the equivalent
 * of mobile's `AccountSetupVerifiedSuccessfully`. Subsequent phases extend
 * the tuple with the post-phone steps (userRole, role-branched profile-setup,
 * address, profile pic, about, interests, languages, photos, loading,
 * allSet).
 */
export const USER_REGISTER_STEPS = [
  "privacy",
  "profile",
  "credentials",
  "emailOtp",
  "phone",
  "verifiedSuccessfully",
] as const;

export type UserRegisterStep =
  | (typeof USER_REGISTER_STEPS)[number]
  | "guardian"
  | "guardianOtp"
  | "userRole"
  | "cgRelationship"
  | "cgPatientAge"
  | "diagnosis"
  | "medicalCenter"
  | "address"
  | "createProfile"
  | "profilePic"
  | "about"
  | "interests"
  | "languages"
  | "photos"
  | "loading"
  | "allSet"
  | "intro"
  | "done";

/* ── Cognito error messaging ──────────────────────────────────────────── */

import { t } from "@/lib/i18n";

/** Shown when Cognito has the email but `signIn` rejects the password. */
export function existingEmailWrongPasswordMessage(): string {
  return t("register.serverError.existingEmailWrongPassword");
}
