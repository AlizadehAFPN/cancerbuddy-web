import { z } from "zod";
import {
  MAX_AGE,
  MAX_BIRTH_YEAR,
  MIN_AGE,
  MIN_BIRTH_YEAR,
  OTP_LENGTH,
  PASSWORD_MIN_LENGTH,
  PRONOUN_OPTIONS,
} from "./constants";

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
      "Please accept all three policies to continue.",
    ),
});

export const profileSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required — please enter it.")
      .max(60, "That name is a bit long. Please keep it under 60 characters."),
    lastName: z
      .string()
      .trim()
      .min(1, "Last name is required — please enter it.")
      .max(60, "That name is a bit long. Please keep it under 60 characters."),
    birthMonth: z.preprocess(
      (v) => (v === "" || v == null ? undefined : Number(v)),
      z
        .number({ error: "Please select your birth month." })
        .int()
        .min(1, "Please select a valid month.")
        .max(12, "Please select a valid month."),
    ),
    birthYear: z.preprocess(
      (v) => (v === "" || v == null ? undefined : Number(v)),
      z
        .number({ error: "Please select your birth year." })
        .int()
        .min(MIN_BIRTH_YEAR, `Please enter a birth year after ${MIN_BIRTH_YEAR}.`)
        .max(
          MAX_BIRTH_YEAR,
          `You must be at least ${MIN_AGE} years old to sign up.`,
        ),
    ),
    pronouns: z
      .enum(PRONOUN_OPTIONS)
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
      .min(1, "Email address is required.")
      .regex(
        EMAIL_REGEX,
        "That doesn't look like a valid email. Try something like name@example.com.",
      ),
    password: z
      .string()
      .min(
        PASSWORD_MIN_LENGTH,
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
      )
      .regex(
        /[A-Z]/,
        "Add at least one uppercase letter (A–Z) to strengthen your password.",
      )
      .regex(
        /[a-z]/,
        "Add at least one lowercase letter (a–z) to strengthen your password.",
      )
      .regex(/\d/, "Add at least one number (0–9) to strengthen your password."),
    confirmPassword: z
      .string()
      .min(1, "Please re-enter your password to confirm it."),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Those passwords don't match. Please retype your password exactly.",
  });

export const otpSchema = z.object({
  otp: z
    .string()
    .regex(
      new RegExp(`^\\d{${OTP_LENGTH}}$`),
      `Enter the ${OTP_LENGTH}-digit code we sent to your email.`,
    ),
});

export const signupFormSchema = z.object({
  privacyAccepted: z.boolean(),
  firstName: z.string(),
  lastName: z.string(),
  birthMonth: z.string(),
  birthYear: z.string(),
  pronouns: z.enum(PRONOUN_OPTIONS).or(z.literal("")),
  email: z.string(),
  password: z.string(),
  confirmPassword: z.string(),
  otp: z.string(),
});

export type SignupFormValues = z.infer<typeof signupFormSchema>;

/**
 * Field name groups per step — passed to react-hook-form's `trigger()` to
 * validate only the active step's fields when the user clicks Continue.
 */
export const STEP_FIELDS = {
  privacy: ["privacyAccepted"] as const,
  profile: [
    "firstName",
    "lastName",
    "birthMonth",
    "birthYear",
    "pronouns",
  ] as const,
  credentials: ["email", "password", "confirmPassword"] as const,
  otp: ["otp"] as const,
};

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

/** Derive approximate age (in years) from a birth year. */
export function ageFromBirthYear(birthYear: number): number {
  return new Date().getFullYear() - birthYear;
}

/** Guard: returns true if age is within the app's accepted range. */
export function isAgeAcceptable(birthYear: number): boolean {
  const age = ageFromBirthYear(birthYear);
  return age >= MIN_AGE && age <= MAX_AGE;
}
