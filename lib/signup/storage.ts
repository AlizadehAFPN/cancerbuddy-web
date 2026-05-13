/**
 * Public signup-flow persistence API.
 *
 * Backed by the Zustand store in `./store`, which keeps state in memory
 * and mirrors the non-secret slice into `sessionStorage`. The behavioural
 * contract is unchanged from the previous direct-storage implementation:
 *
 *  - `loadDraft` rehydrates the persisted snapshot into a full
 *    `SignupFormValues`, with `password` / `confirmPassword` / `otp`
 *    re-zeroed. Returns `null` on SSR and when there is no draft.
 *  - `saveDraft` strips the secret-bearing fields before storing.
 *  - `clearDraft` wipes the draft entirely.
 *
 * Why sessionStorage instead of localStorage: the previous backing store
 * kept PII (name, DOB, email) on disk indefinitely. Now it is scoped to
 * the active tab; closing the tab wipes everything for this flow.
 */

import { useSignupStore, type PersistedSignupDraft } from "./store";
import type { SignupFormValues } from "./validation";

export function loadDraft(): {
  values: SignupFormValues;
  step: string;
} | null {
  if (typeof window === "undefined") return null;
  const state = useSignupStore.getState();
  if (!state.draft) return null;
  const values: SignupFormValues = {
    ...state.draft,
    password: "",
    confirmPassword: "",
    otp: "",
  } as SignupFormValues;
  return { values, step: state.step ?? "privacy" };
}

export function saveDraft(values: SignupFormValues, step: string): void {
  if (typeof window === "undefined") return;
  const stripped: PersistedSignupDraft = {
    privacyAccepted: values.privacyAccepted,
    firstName: values.firstName,
    lastName: values.lastName,
    birthMonth: values.birthMonth,
    birthYear: values.birthYear,
    pronouns: values.pronouns,
    email: values.email,
  };
  useSignupStore.getState().setDraft(stripped, step);
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  useSignupStore.getState().clearDraft();
}
