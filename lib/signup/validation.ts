import { z } from "zod";
import {
  MAX_AGE,
  MAX_BIRTH_YEAR,
  MIN_AGE,
  MIN_BIRTH_YEAR,
  OTP_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "./constants";
import { t } from "@/lib/i18n";

/**
 * One Zod schema per signup step. The controller validates per-step before
 * advancing via `trigger(stepFieldNames)`. Professional, actionable error
 * messages guide the user to fix each issue without jargon.
 */

export const privacySchema = z.object({
  privacyAccepted: z
    .boolean()
    .refine(
      (v) => v === true,
      t("validation.privacy.mustAccept"),
    ),
});

export const profileSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, t("validation.profile.firstNameRequired"))
      .max(60, t("validation.profile.firstNameTooLong")),
    lastName: z
      .string()
      .trim()
      .min(1, t("validation.profile.lastNameRequired"))
      .max(60, t("validation.profile.lastNameTooLong")),
    birthMonth: z.preprocess(
      (v) => (v === "" || v == null ? undefined : Number(v)),
      z
        .number({ error: t("validation.profile.birthMonthRequired") })
        .int()
        .min(1, t("validation.profile.birthMonthInvalid"))
        .max(12, t("validation.profile.birthMonthInvalid")),
    ),
    birthYear: z.preprocess(
      (v) => (v === "" || v == null ? undefined : Number(v)),
      z
        .number({ error: t("validation.profile.birthYearRequired") })
        .int()
        .min(MIN_BIRTH_YEAR, t("validation.profile.birthYearTooEarly", { min: MIN_BIRTH_YEAR }))
        .max(
          MAX_BIRTH_YEAR,
          t("validation.profile.birthYearTooLate", { minAge: MIN_AGE }),
        ),
    ),
    pronouns: z
      .string()
      .optional()
      .or(z.literal("").transform(() => undefined)),
  });

/* Strict RFC 5322-compliant email regex — catches the most common mistakes
   (missing @, invalid TLD, spaces) while giving a clear example in the message. */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export const credentialsSchema = z
  .object({
    email: z
      .string()
      .min(1, t("validation.credentials.emailRequired"))
      .regex(
        EMAIL_REGEX,
        t("validation.credentials.emailInvalid"),
      ),
    password: z
      .string()
      .min(
        PASSWORD_MIN_LENGTH,
        t("validation.credentials.passwordTooShort", { min: PASSWORD_MIN_LENGTH }),
      )
      .regex(
        /[A-Z]/,
        t("validation.credentials.passwordNoUppercase"),
      )
      .regex(
        /[a-z]/,
        t("validation.credentials.passwordNoLowercase"),
      )
      .regex(/\d/, t("validation.credentials.passwordNoDigit"))
      .regex(
        /[!?¿@#$%^&*_]/,
        t("validation.credentials.passwordNoSpecial"),
      ),
    confirmPassword: z
      .string()
      .min(1, t("validation.credentials.confirmRequired")),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: t("validation.credentials.passwordsDontMatch"),
  });

export const otpSchema = z.object({
  otp: z
    .string()
    .regex(
      new RegExp(`^\\d{${OTP_LENGTH}}$`),
      t("validation.emailOtp.mustMatchLength", { length: OTP_LENGTH }),
    ),
});

/** Lightweight password rule checks for the live strength meter. */
export interface PasswordChecks {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
}

export function checkPassword(value: string): PasswordChecks {
  return {
    minLength: value.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    number: /\d/.test(value),
  };
}

