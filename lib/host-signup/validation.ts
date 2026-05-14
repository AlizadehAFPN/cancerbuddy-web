import { z } from "zod";
import {
  BIO_MAX_LENGTH,
  DIAL_COUNTRIES,
  PHOTO_MAX_BYTES,
  PHOTO_MIME_TYPES,
  PHONE_OTP_LENGTH,
} from "./constants";
import {
  privacySchema,
  profileSchema,
  credentialsSchema,
  otpSchema as emailOtpSchema,
} from "@/lib/signup/validation";
import { PRONOUN_OPTIONS } from "@/lib/signup/constants";
import { t } from "@/lib/i18n";

/**
 * Per-step Zod schemas for the host-application flow.
 * Privacy / Profile / Credentials / EmailOtp re-use the regular signup
 * schemas (same rules, same messages). The host-only schemas (phone,
 * phoneOtp, photo, bio) live below.
 */

export {
  privacySchema,
  profileSchema,
  credentialsSchema,
  emailOtpSchema,
};

/* ── Phone ─────────────────────────────────────────────────────────────── */

const ALLOWED_ISO2_VALUES = DIAL_COUNTRIES.map((c) => c.iso2) as [
  string,
  ...string[],
];

/**
 * E.164 lower-bound is 7 digits (small island/feature codes); upper-bound is
 * 15 digits (the spec's hard cap). We validate the *national* portion (after
 * the country dial code) and bound the total combined length so users can't
 * paste a malformed country code.
 */
const NATIONAL_MIN_DIGITS = 4;
const NATIONAL_MAX_DIGITS = 10;

export const phoneSchema = z
  .object({
    phoneCountryIso2: z
      .enum(ALLOWED_ISO2_VALUES, {
        error: t("validation.phone.countryRequired"),
      }),
    phoneNational: z
      .string()
      .trim()
      .min(1, t("validation.phone.numberRequired")),
  })
  .superRefine((value, ctx) => {
    const digits = value.phoneNational.replace(/\D/g, "");
    if (digits.length < NATIONAL_MIN_DIGITS) {
      ctx.addIssue({
        code: "custom",
        path: ["phoneNational"],
        message: t("validation.phone.numberTooShort"),
      });
      return;
    }
    if (digits.length > NATIONAL_MAX_DIGITS) {
      ctx.addIssue({
        code: "custom",
        path: ["phoneNational"],
        message: t("validation.phone.numberTooLong"),
      });
      return;
    }
  });

/* ── Phone OTP ─────────────────────────────────────────────────────────── */

export const phoneOtpSchema = z.object({
  phoneOtp: z
    .string()
    .regex(
      new RegExp(`^\\d{${PHONE_OTP_LENGTH}}$`),
      t("validation.phone.otpMustMatchLength", { length: PHONE_OTP_LENGTH }),
    ),
});

/* ── Photo ─────────────────────────────────────────────────────────────── */

/**
 * Photo validation runs imperatively when a file is selected (file lives in
 * component state, not the form values). This helper returns a friendly
 * error string or `null` if the file is acceptable.
 */
export function validatePhotoFile(file: File): string | null {
  if (!PHOTO_MIME_TYPES.includes(file.type as (typeof PHOTO_MIME_TYPES)[number])) {
    return t("validation.photo.wrongType");
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return t("validation.photo.tooBig", { max: Math.round(PHOTO_MAX_BYTES / (1024 * 1024)) });
  }
  if (file.size === 0) {
    return t("validation.photo.empty");
  }
  return null;
}

/* ── Bio ───────────────────────────────────────────────────────────────── */

/** Bio is optional — only enforce the upper bound. */
export const bioSchema = z.object({
  bio: z
    .string()
    .max(
      BIO_MAX_LENGTH,
      t("validation.bio.tooLong", { max: BIO_MAX_LENGTH }),
    ),
});

/* ── Combined form values type ─────────────────────────────────────────── */

/**
 * Top-level schema used by react-hook-form. We keep every field loosely typed
 * here so per-step validation owns the user-facing messages; this schema only
 * ensures the shape is right when the form is constructed.
 */
export const hostRegisterFormSchema = z.object({
  privacyAccepted: z.boolean(),
  firstName: z.string(),
  lastName: z.string(),
  birthMonth: z.string(),
  birthYear: z.string(),
  pronouns: z.enum(PRONOUN_OPTIONS).or(z.literal("")),
  email: z.string(),
  password: z.string(),
  confirmPassword: z.string(),
  emailOtp: z.string(),
  phoneCountryIso2: z.string(),
  phoneNational: z.string(),
  phoneOtp: z.string(),
  bio: z.string(),
});

export type HostRegisterFormValues = z.infer<typeof hostRegisterFormSchema>;

/**
 * Field name groups per step — passed to react-hook-form's `trigger()` to
 * scope error rendering to the active step's fields.
 */
export const HOST_STEP_FIELDS = {
  privacy: ["privacyAccepted"] as const,
  profile: [
    "firstName",
    "lastName",
    "birthMonth",
    "birthYear",
    "pronouns",
  ] as const,
  credentials: ["email", "password", "confirmPassword"] as const,
  emailOtp: ["emailOtp"] as const,
  phone: ["phoneCountryIso2", "phoneNational"] as const,
  phoneOtp: ["phoneOtp"] as const,
  bio: ["bio"] as const,
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

/**
 * Build an E.164-formatted phone string from a country ISO and the national
 * portion the user typed. Strips any non-digit characters from the national
 * input so users can paste "(415) 555-1234" without surprises.
 */
export function buildE164(
  countryIso2: string,
  national: string,
): string | null {
  const country = DIAL_COUNTRIES.find((c) => c.iso2 === countryIso2);
  if (!country) return null;
  const digits = national.replace(/\D/g, "");
  if (digits.length === 0) return null;
  return `${country.dial}${digits}`;
}
