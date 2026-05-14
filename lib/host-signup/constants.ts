/**
 * Host registration constants. After Cognito + phone verification, the host
 * path collects a profile photo and bio, then persists them to AppSync and
 * runs the same post-enrollment Lambdas as mobile (`LoginInLambdaUtil`).
 */

import { OTP_LENGTH, OTP_RESEND_COOLDOWN_SEC } from "@/lib/signup/constants";
import { t } from "@/lib/i18n";

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

/** Phone OTP shares length + cooldown with the email OTP for consistency. */
export const PHONE_OTP_LENGTH = OTP_LENGTH;
export const PHONE_OTP_RESEND_COOLDOWN_SEC = OTP_RESEND_COOLDOWN_SEC;

/** Bio constraints — optional field, capped at 1000 chars. */
export const BIO_MAX_LENGTH = 1000;

/** Photo constraints — typical avatar/portrait sizes. */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type PhotoMimeType = (typeof PHOTO_MIME_TYPES)[number];

export const HOST_REGISTER_DRAFT_STORAGE_KEY = "cancerbuddy-host-register-draft";
export const HOST_REGISTER_DRAFT_VERSION = 1 as const;

/**
 * Visible step ids for the host-application flow. `intro` and `done` are
 * presentational states — they aren't shown in the progress strip.
 */
/**
 * `phone` is a composite step covering both number entry and OTP confirmation
 * — they share a progress segment so the user perceives a single "verify your
 * phone" task.
 */
export const HOST_REGISTER_STEPS = [
  "privacy",
  "profile",
  "credentials",
  "emailOtp",
  "phone",
  "photo",
  "bio",
] as const;

export type HostRegisterStep =
  | (typeof HOST_REGISTER_STEPS)[number]
  | "intro"
  | "done";

export const HOST_STEP_TITLES: Record<
  (typeof HOST_REGISTER_STEPS)[number],
  string
> = {
  privacy: t("hostsRegister.stepTitles.privacy"),
  profile: t("hostsRegister.stepTitles.profile"),
  credentials: t("hostsRegister.stepTitles.credentials"),
  emailOtp: t("hostsRegister.stepTitles.emailOtp"),
  phone: t("hostsRegister.stepTitles.phone"),
  photo: t("hostsRegister.stepTitles.photo"),
  bio: t("hostsRegister.stepTitles.bio"),
};

/**
 * Curated country list with E.164 dial codes. Kept compact so the picker stays
 * usable without a search box — extend as the platform launches in new
 * regions. Order: brand-priority markets first, then alphabetical.
 */
export interface DialCountry {
  /** ISO 3166-1 alpha-2 code. */
  iso2: string;
  /** Human-readable name. */
  name: string;
  /** Leading "+" plus 1–4 digits, e.g. "+1", "+44", "+971". */
  dial: string;
  /** Unicode flag emoji — falls back gracefully on systems without emoji fonts. */
  flag: string;
}

export const DIAL_COUNTRIES: readonly DialCountry[] = [
  { iso2: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { iso2: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { iso2: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { iso2: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { iso2: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" },
  { iso2: "AT", name: "Austria", dial: "+43", flag: "🇦🇹" },
  { iso2: "BE", name: "Belgium", dial: "+32", flag: "🇧🇪" },
  { iso2: "BR", name: "Brazil", dial: "+55", flag: "🇧🇷" },
  { iso2: "CH", name: "Switzerland", dial: "+41", flag: "🇨🇭" },
  { iso2: "CN", name: "China", dial: "+86", flag: "🇨🇳" },
  { iso2: "CZ", name: "Czechia", dial: "+420", flag: "🇨🇿" },
  { iso2: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { iso2: "DK", name: "Denmark", dial: "+45", flag: "🇩🇰" },
  { iso2: "EG", name: "Egypt", dial: "+20", flag: "🇪🇬" },
  { iso2: "ES", name: "Spain", dial: "+34", flag: "🇪🇸" },
  { iso2: "FI", name: "Finland", dial: "+358", flag: "🇫🇮" },
  { iso2: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { iso2: "GR", name: "Greece", dial: "+30", flag: "🇬🇷" },
  { iso2: "HK", name: "Hong Kong", dial: "+852", flag: "🇭🇰" },
  { iso2: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { iso2: "IE", name: "Ireland", dial: "+353", flag: "🇮🇪" },
  { iso2: "IL", name: "Israel", dial: "+972", flag: "🇮🇱" },
  { iso2: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { iso2: "IR", name: "Iran", dial: "+98", flag: "🇮🇷" },
  { iso2: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { iso2: "JP", name: "Japan", dial: "+81", flag: "🇯🇵" },
  { iso2: "KR", name: "South Korea", dial: "+82", flag: "🇰🇷" },
  { iso2: "MX", name: "Mexico", dial: "+52", flag: "🇲🇽" },
  { iso2: "MY", name: "Malaysia", dial: "+60", flag: "🇲🇾" },
  { iso2: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱" },
  { iso2: "NO", name: "Norway", dial: "+47", flag: "🇳🇴" },
  { iso2: "NZ", name: "New Zealand", dial: "+64", flag: "🇳🇿" },
  { iso2: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { iso2: "PL", name: "Poland", dial: "+48", flag: "🇵🇱" },
  { iso2: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { iso2: "QA", name: "Qatar", dial: "+974", flag: "🇶🇦" },
  { iso2: "RO", name: "Romania", dial: "+40", flag: "🇷🇴" },
  { iso2: "RU", name: "Russia", dial: "+7", flag: "🇷🇺" },
  { iso2: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { iso2: "SE", name: "Sweden", dial: "+46", flag: "🇸🇪" },
  { iso2: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { iso2: "TH", name: "Thailand", dial: "+66", flag: "🇹🇭" },
  { iso2: "TR", name: "Türkiye", dial: "+90", flag: "🇹🇷" },
  { iso2: "TW", name: "Taiwan", dial: "+886", flag: "🇹🇼" },
  { iso2: "UA", name: "Ukraine", dial: "+380", flag: "🇺🇦" },
  { iso2: "VN", name: "Vietnam", dial: "+84", flag: "🇻🇳" },
  { iso2: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
];

export const DEFAULT_DIAL_ISO2 = "US";

export function getCountryByIso2(iso2: string): DialCountry | undefined {
  return DIAL_COUNTRIES.find((c) => c.iso2 === iso2);
}

/** Shown when Cognito has the email but `signIn` rejects the password (same UX as mobile guidance). */
export function existingEmailWrongPasswordMessage(): string {
  return t("hostsRegister.serverError.existingEmailWrongPassword");
}
