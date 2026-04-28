export const MIN_AGE = 13;
export const MAX_AGE = 120;

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
  he_him: "He/him",
  she_her: "She/her",
  they_them: "They/them",
  not_say: "I'd rather not disclose",
};

export const SIGNUP_DRAFT_STORAGE_KEY = "cancerbuddy-signup-draft";
export const SIGNUP_DRAFT_VERSION = 3 as const;

export const SIGNUP_STEPS = [
  "privacy",
  "profile",
  "credentials",
  "otp",
] as const;

export type SignupStep = (typeof SIGNUP_STEPS)[number] | "done";

export const STEP_TITLES: Record<(typeof SIGNUP_STEPS)[number], string> = {
  privacy: "Before we begin",
  profile: "Tell us a little about you",
  credentials: "Set up sign-in",
  otp: "Confirm your email",
};
