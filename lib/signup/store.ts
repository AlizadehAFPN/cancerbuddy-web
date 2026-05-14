/**
 * Zustand store for the regular signup flow (`app/(auth)/signup`).
 *
 * Same shape and security model as `lib/host-signup/store.ts`:
 *  - Persists only the non-secret draft snapshot to `sessionStorage`.
 *  - Dies when the tab closes — no PII left on disk.
 *  - No password or OTP is ever held here; those live in react-hook-form
 *    state and never leave the active page.
 *
 * Consumers should import via `./storage`, which keeps the function-based
 * API (`loadDraft`, `saveDraft`, `clearDraft`) used by the existing page.
 */

import { create } from "zustand";
import type { SignupFormValues } from "./validation";

export type PersistedSignupDraft = Omit<
  SignupFormValues,
  "password" | "confirmPassword" | "otp"
>;

interface SignupState {
  /** Persisted: PII-only snapshot (no secrets). */
  draft: PersistedSignupDraft | null;
  /** Persisted: which step the user was on when last persisted. */
  step: string | null;

  setDraft: (values: PersistedSignupDraft, step: string) => void;
  clearDraft: () => void;
}

export const useSignupStore = create<SignupState>()((set) => ({
  draft: null,
  step: null,

  setDraft: (values, step) => set({ draft: values, step }),
  clearDraft: () => set({ draft: null, step: null }),
}));
