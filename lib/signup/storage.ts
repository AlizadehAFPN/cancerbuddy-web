import {
  SIGNUP_DRAFT_STORAGE_KEY,
  SIGNUP_DRAFT_VERSION,
} from "./constants";
import type { SignupFormValues } from "./validation";

/**
 * Draft persistence is a thin localStorage adapter so it can be swapped for a
 * server-side draft endpoint later (e.g. POST /signup/draft) without touching
 * the form. Passwords + OTPs are stripped before saving — defence in depth in
 * case a future swap routes payloads to a backend that logs them.
 */

interface PersistedDraft {
  version: number;
  values: Omit<SignupFormValues, "password" | "confirmPassword" | "otp">;
  step: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadDraft(): {
  values: SignupFormValues;
  step: string;
} | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(SIGNUP_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedDraft>;
    if (parsed?.version !== SIGNUP_DRAFT_VERSION || !parsed.values) return null;
    const values: SignupFormValues = {
      ...parsed.values,
      password: "",
      confirmPassword: "",
      otp: "",
    } as SignupFormValues;
    return { values, step: parsed.step ?? "privacy" };
  } catch {
    return null;
  }
}

export function saveDraft(values: SignupFormValues, step: string): void {
  if (!isBrowser()) return;
  try {
    const stripped = {
      privacyAccepted: values.privacyAccepted,
      firstName: values.firstName,
      lastName: values.lastName,
      birthMonth: values.birthMonth,
      birthYear: values.birthYear,
      pronouns: values.pronouns,
      email: values.email,
    } as PersistedDraft["values"];
    const persisted: PersistedDraft = {
      version: SIGNUP_DRAFT_VERSION,
      values: stripped,
      step,
    };
    window.localStorage.setItem(
      SIGNUP_DRAFT_STORAGE_KEY,
      JSON.stringify(persisted),
    );
  } catch {
    /* Quota exceeded or private mode — silently no-op. */
  }
}

export function clearDraft(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
