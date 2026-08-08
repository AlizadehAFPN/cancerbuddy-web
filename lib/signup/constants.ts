import { t } from "@/lib/i18n";

export const CHILD_MIN_AGE = 8;
export const MIN_AGE = 13;
/**
 * 130, not 120.
 *
 * Mobile's bound is 130 in all three places it appears — `birth.ts:72`
 * (`MAXIMUM_AGE`), `dates.ts:4` (`MAX_DIFF_YEARS`) and the change-status
 * validator's own message. Web's 120 rejected a registrant a phone would
 * accept, which is a small population and a real one: at the time of writing
 * the oldest verified people alive are past 115.
 */
export const MAX_AGE = 130;

/** Latest accepted birth year for minor registration (guardian consent required for 8–12). */
export const GUARDIAN_MAX_BIRTH_YEAR = new Date().getFullYear() - CHILD_MIN_AGE;

/** Earliest accepted birth year (age ≤ MAX_AGE). */
export const MIN_BIRTH_YEAR = new Date().getFullYear() - MAX_AGE;
/** Latest accepted birth year (user must be at least MIN_AGE years old). */
export const MAX_BIRTH_YEAR = new Date().getFullYear() - MIN_AGE;

/**
 * The bio cap, shared by registration and the profile editor.
 *
 * Mobile applies 300 in both places — `BioSchema` at enrolment and
 * `PersonalInformationSchema` on the profile form
 * (`EnrollmentFormValidations.ts:238-247, 262-266`). Web allowed 1000 at
 * registration and 300 in the editor, so a bio written during signup could not
 * be saved again from the profile: the field arrived already over its own limit
 * with no way to know why. One number, one place.
 */
export const BIO_MAX_LENGTH = 300;

export const OTP_LENGTH = 6;
export const OTP_RESEND_COOLDOWN_SEC = 30;
export const PASSWORD_MIN_LENGTH = 8;

export const PRONOUN_OPTIONS = [
  "he_him",
  "she_her",
  "they_them",
  "not_say",
] as const;

export type PronounOption = (typeof PRONOUN_OPTIONS)[number];

export const PRONOUN_LABELS: Record<PronounOption, string> = {
  he_him: t("pronouns.he_him"),
  she_her: t("pronouns.she_her"),
  they_them: t("pronouns.they_them"),
  not_say: t("pronouns.not_say"),
};

