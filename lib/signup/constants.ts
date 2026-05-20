import { t } from "@/lib/i18n";

export const CHILD_MIN_AGE = 8;
export const MIN_AGE = 13;
export const MAX_AGE = 120;

/** Latest accepted birth year for minor registration (guardian consent required for 8–12). */
export const GUARDIAN_MAX_BIRTH_YEAR = new Date().getFullYear() - CHILD_MIN_AGE;

/** Earliest accepted birth year (age ≤ 120). */
export const MIN_BIRTH_YEAR = new Date().getFullYear() - MAX_AGE;
/** Latest accepted birth year (user must be at least MIN_AGE years old). */
export const MAX_BIRTH_YEAR = new Date().getFullYear() - MIN_AGE;

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

