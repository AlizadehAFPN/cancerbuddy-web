/**
 * Public user-signup persistence API.
 *
 * Thin wrappers over the Zustand store (`./store`). Keeps function-based
 * symmetry with `lib/host-signup/storage.ts` so page-level code reads the
 * same shape regardless of which flow it's driving.
 */

import { useUserSignupStore, type PersistedUserDraft } from "./store";
import type { UserRegisterFormValues } from "./validation";
import type { UserRegisterStep } from "./constants";

export function loadUserDraft(): {
  values: UserRegisterFormValues;
} | null {
  if (typeof window === "undefined") return null;
  const persisted = useUserSignupStore.getState().draft;
  if (!persisted) return null;
  const values: UserRegisterFormValues = {
    ...persisted,
    password: "",
    confirmPassword: "",
    emailOtp: "",
    phoneOtp: "",
    guardianOtp: "",
  } as UserRegisterFormValues;
  return { values };
}

export function saveUserDraft(values: UserRegisterFormValues): void {
  if (typeof window === "undefined") return;
  const stripped: PersistedUserDraft = {
    privacyAccepted: values.privacyAccepted,
    firstName: values.firstName,
    lastName: values.lastName,
    birthMonth: values.birthMonth,
    birthYear: values.birthYear,
    pronouns: values.pronouns,
    // Guardian consent (non-sensitive)
    guardianFullName: values.guardianFullName,
    guardianEmail: values.guardianEmail,
    guardianConsent: values.guardianConsent,
    guardianConsentSupervision: values.guardianConsentSupervision,
    email: values.email,
    phoneCountryIso2: values.phoneCountryIso2,
    phoneNational: values.phoneNational,
    // Phase 2
    userType: values.userType,
    relationship: values.relationship,
    patientBirthMonth: values.patientBirthMonth,
    patientBirthYear: values.patientBirthYear,
    diagnosis: values.diagnosis,
    treatmentStatus: values.treatmentStatus,
    treatments: values.treatments,
    inRemissionSince: values.inRemissionSince,
    disabilities: values.disabilities,
    hospitals: values.hospitals,
    supportOrganizations: values.supportOrganizations,
    state: values.state,
    city: values.city,
    zipcode: values.zipcode,
    // Phase 3
    profilePicId: values.profilePicId,
    bio: values.bio,
    cancerloss: values.cancerloss,
    copingWithCancerLoss: values.copingWithCancerLoss,
    isUniversityStudent: values.isUniversityStudent,
    universityId: values.universityId,
    interests: values.interests,
    languages: values.languages,
    galleryPhotoIds: values.galleryPhotoIds,
  };
  useUserSignupStore.getState().setDraft(stripped);
}

export function clearUserDraft(): void {
  if (typeof window === "undefined") return;
  useUserSignupStore.getState().reset();
}

/* ── Cognito pool `Username` ── */

export function stashUserPoolUsername(email: string, poolUsername: string): void {
  if (typeof window === "undefined") return;
  useUserSignupStore.getState().setPoolUsername(email, poolUsername);
}

export function resolveUserPoolUsername(email: string): string {
  const e = email.trim().toLowerCase();
  if (typeof window === "undefined") return e;
  const stash = useUserSignupStore.getState().poolUsername;
  if (stash && stash.email === e && stash.username) return stash.username;
  return e;
}

export function clearUserPoolUsername(): void {
  if (typeof window === "undefined") return;
  useUserSignupStore.getState().clearPoolUsername();
}

/* ── Session-only password (never persisted) ── */

export function stashUserSignupSessionPassword(password: string): void {
  if (typeof window === "undefined") return;
  useUserSignupStore.getState().setSessionPassword(password);
}

export function peekUserSignupSessionPassword(): string | null {
  if (typeof window === "undefined") return null;
  return useUserSignupStore.getState().sessionPassword;
}

export function clearUserSignupSessionPassword(): void {
  if (typeof window === "undefined") return;
  useUserSignupStore.getState().clearSessionPassword();
}

/* ── Forward-step watermark ── */

export function getFurthestUserStep(): UserRegisterStep {
  if (typeof window === "undefined") return "intro";
  return useUserSignupStore.getState().furthestStep;
}

export function advanceFurthestUserStep(step: UserRegisterStep): void {
  if (typeof window === "undefined") return;
  useUserSignupStore.getState().advanceFurthestStep(step);
}

/* ── Guardian ID (session-only, not persisted) ── */

export function stashGuardianId(id: string): void {
  if (typeof window === "undefined") return;
  useUserSignupStore.getState().setGuardianId(id);
}

export function peekGuardianId(): string | null {
  if (typeof window === "undefined") return null;
  return useUserSignupStore.getState().guardianId;
}

export function clearGuardianId(): void {
  if (typeof window === "undefined") return;
  useUserSignupStore.getState().clearGuardianId();
}
