import { z } from "zod";
import {
  privacySchema,
  profileSchema,
  credentialsSchema,
  otpSchema as emailOtpSchema,
} from "@/lib/signup/validation";
import {
  MIN_BIRTH_YEAR,
} from "@/lib/signup/constants";
import {
  phoneSchema,
  phoneOtpSchema,
  buildE164,
} from "@/lib/host-signup/validation";
import { t } from "@/lib/i18n";

/**
 * Per-step Zod schemas for the user-registration flow.
 *
 * Privacy / Profile / Credentials / EmailOtp re-use the regular signup
 * schemas (same rules, same translated messages). Phone / PhoneOtp re-use
 * the host schemas (same Twilio Verify pipeline). Later phases will add
 * the role-aware schemas (relationship, diagnosis, address, …) directly
 * to this file.
 */

export {
  privacySchema,
  profileSchema,
  credentialsSchema,
  emailOtpSchema,
  phoneSchema,
  phoneOtpSchema,
  buildE164,
};

/**
 * Profile schema for the user-registration flow — accepts ages ≥ CHILD_MIN_AGE (8).
 * The standard `profileSchema` rejects users under 13; this variant allows minors
 * who need guardian consent to pass the profile step and be routed correctly.
 */
export const profileSchemaForUser = z.object({
  firstName: profileSchema.shape.firstName,
  lastName: profileSchema.shape.lastName,
  birthMonth: profileSchema.shape.birthMonth,
  birthYear: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z
      .number({ error: t("validation.profile.birthYearRequired") })
      .int()
      .min(MIN_BIRTH_YEAR, t("validation.profile.birthYearTooEarly", { min: MIN_BIRTH_YEAR }))
      .max(new Date().getFullYear(), "Birth year cannot be in the future."),
  ),
  pronouns: profileSchema.shape.pronouns,
});

/* ── Combined form values type ─────────────────────────────────────────── */

/**
 * Top-level shape consumed by react-hook-form for `/register`. Loose typing
 * — per-step validation owns user-facing messages; this schema just ensures
 * the form initialises with the right field names.
 *
 * Phase 1 covers privacy → phone. Later phases extend this with userType,
 * diagnosis, address, etc.
 */
export const userRegisterFormSchema = z.object({
  privacyAccepted: z.boolean(),
  firstName: z.string(),
  lastName: z.string(),
  birthMonth: z.string(),
  birthYear: z.string(),
  pronouns: z.string(),
  // Guardian consent (for users aged 8–12)
  guardianFullName: z.string(),
  guardianEmail: z.string(),
  guardianConsent: z.boolean(),
  guardianConsentSupervision: z.boolean(),
  guardianOtp: z.string(),
  email: z.string(),
  password: z.string(),
  confirmPassword: z.string(),
  emailOtp: z.string(),
  phoneCountryIso2: z.string(),
  phoneNational: z.string(),
  phoneOtp: z.string(),
  // Phase 2 — role & profile
  userType: z.enum(["PATIENT", "CAREGIVER", "SURVIVOR", ""]),
  relationship: z.string(),
  patientBirthMonth: z.string(),
  patientBirthYear: z.string(),
  // Phase 2 — diagnosis
  diagnosis: z.string(),
  treatmentStatus: z.string(),
  treatments: z.string(),        // comma-separated IDs
  inRemissionSince: z.string(),  // MM/YYYY format
  disabilities: z.string(),      // comma-separated IDs
  // Phase 2 — medical center
  hospitals: z.string(),         // comma-separated IDs
  supportOrganizations: z.string(), // comma-separated IDs
  // Phase 2 — address (city = cityID, state = stateID, zipcode = CityZipCode record ID)
  state: z.string(),
  city: z.string(),
  zipcode: z.string(),
  // Phase 3 — about: university
  universityId: z.string(),
  // Phase 3 — profile completion
  profilePicId: z.string(),           // AppSync picture ID after upload
  bio: z.string(),
  cancerloss: z.boolean(),
  copingWithCancerLoss: z.string(),   // AppSync ID
  isUniversityStudent: z.boolean(),
  interests: z.string(),              // comma-separated AppSync IDs
  languages: z.string(),              // comma-separated AppSync IDs
  galleryPhotoIds: z.string(),        // comma-separated AppSync picture IDs
});

export type UserRegisterFormValues = z.infer<typeof userRegisterFormSchema>;

/* ── Per-step schemas (Phase 2) ───────────────────────────────────────── */

export const userRoleSchema = z.object({
  userType: z.enum(["PATIENT", "CAREGIVER", "SURVIVOR"]),
});

export const cgRelationshipSchema = z.object({
  relationship: z.string().min(1, "Please select a relationship"),
});

export const diagnosisSchemaPatient = z.object({
  diagnosis: z.string().min(1, "Please select a diagnosis"),
  treatmentStatus: z.string().min(1, "Please select a treatment status"),
});

export const diagnosisSchemaSurvivor = z.object({
  diagnosis: z.string().min(1, "Please select a diagnosis"),
  inRemissionSince: z.string().min(7, "Please enter the remission date"),
});

export const addressSchema = z.object({
  city: z.string().min(1, "Please select a city"),
  state: z.string().min(1, "Please select a state"),
  zipcode: z.string().min(1, "Please enter a valid zip code"),
});

export const aboutSchema = z.object({
  bio: z.string().min(1, "Please write something about yourself.").max(1000, "Bio must be 1000 characters or less."),
});

/** Zod schema for the guardian consent step (StepGuardian). */
export const guardianSchema = z.object({
  guardianFullName: z.string().trim().min(1, "Guardian's full name is required"),
  guardianEmail: z
    .string()
    .min(1, "Guardian's email is required")
    .email("Please enter a valid email address"),
  guardianConsent: z
    .boolean()
    .refine((v) => v === true, "Guardian consent is required"),
  guardianConsentSupervision: z
    .boolean()
    .refine((v) => v === true, "Supervision consent is required"),
});

/**
 * Field-name groups per step — passed to react-hook-form's `trigger()` to
 * scope error rendering to the active step's fields.
 */
export const USER_STEP_FIELDS = {
  privacy: ["privacyAccepted"] as const,
  profile: [
    "firstName",
    "lastName",
    "birthMonth",
    "birthYear",
    "pronouns",
  ] as const,
  guardian: [
    "guardianFullName",
    "guardianEmail",
    "guardianConsent",
    "guardianConsentSupervision",
  ] as const,
  guardianOtp: ["guardianOtp"] as const,
  credentials: ["email", "password", "confirmPassword"] as const,
  emailOtp: ["emailOtp"] as const,
  phone: ["phoneCountryIso2", "phoneNational"] as const,
  phoneOtp: ["phoneOtp"] as const,
  // Phase 2
  userRole: ["userType"] as const,
  cgRelationship: ["relationship"] as const,
  diagnosis: ["diagnosis", "treatmentStatus", "inRemissionSince"] as const,
  address: ["state", "city", "zipcode"] as const,
  // Phase 3
  about: ["bio", "universityId"] as const,
  interests: ["interests"] as const,
  languages: ["languages"] as const,
};
