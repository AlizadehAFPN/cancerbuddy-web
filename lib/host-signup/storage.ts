/**
 * Public host-signup persistence API.
 *
 * This module used to read/write `localStorage` and `sessionStorage`
 * directly. It now delegates to the Zustand store (`./store`), keeping
 * these named functions stable so the page and service layers don't have
 * to change.
 *
 * Behavioural contract:
 *  - `loadHostDraft` returns the persisted PII-only snapshot rehydrated
 *    into the full `HostRegisterFormValues` shape (password / OTP fields
 *    re-zeroed). It returns `null` when there is no draft — including the
 *    SSR / no-window path.
 *  - `saveHostDraft` strips the secret-bearing fields before storing.
 *  - `clearHostDraft` is the "everything for this flow" reset — it wipes
 *    the draft, the cached pool username, the session password, and the
 *    phone-verify SID. Call it after a successful submit or when the user
 *    explicitly aborts.
 *  - The session password and pool username live in the store but are
 *    excluded from the `sessionStorage` persistence layer (password) or
 *    are session-scoped (pool username). See `./store` for details.
 */

import { useHostSignupStore, type PersistedHostDraft } from "./store";
import type { HostRegisterFormValues } from "./validation";

export function loadHostDraft(): {
  values: HostRegisterFormValues;
} | null {
  if (typeof window === "undefined") return null;
  const persisted = useHostSignupStore.getState().draft;
  if (!persisted) return null;
  const values: HostRegisterFormValues = {
    ...persisted,
    password: "",
    confirmPassword: "",
    emailOtp: "",
    phoneOtp: "",
  } as HostRegisterFormValues;
  return { values };
}

export function saveHostDraft(values: HostRegisterFormValues): void {
  if (typeof window === "undefined") return;
  const stripped: PersistedHostDraft = {
    privacyAccepted: values.privacyAccepted,
    firstName: values.firstName,
    lastName: values.lastName,
    birthMonth: values.birthMonth,
    birthYear: values.birthYear,
    pronouns: values.pronouns,
    email: values.email,
    phoneCountryIso2: values.phoneCountryIso2,
    phoneNational: values.phoneNational,
    bio: values.bio,
  };
  useHostSignupStore.getState().setDraft(stripped);
}

export function clearHostDraft(): void {
  if (typeof window === "undefined") return;
  useHostSignupStore.getState().reset();
}

/* ── Cognito pool `Username` (only when it differs from the email alias) ── */

export function stashHostPoolUsername(email: string, poolUsername: string): void {
  if (typeof window === "undefined") return;
  useHostSignupStore.getState().setPoolUsername(email, poolUsername);
}

export function resolveHostPoolUsername(email: string): string {
  const e = email.trim().toLowerCase();
  if (typeof window === "undefined") return e;
  const stash = useHostSignupStore.getState().poolUsername;
  if (stash && stash.email === e && stash.username) return stash.username;
  return e;
}

export function clearHostPoolUsername(): void {
  if (typeof window === "undefined") return;
  useHostSignupStore.getState().clearPoolUsername();
}

/* ── Session-only password (never persisted) ─────────────────────────────
   Kept so `signIn` works after Amplify's draft hydration zeros the
   in-form password. The Zustand store holds it in memory only — it is
   excluded from `partialize`, so it never touches `sessionStorage`. */

export function stashHostSignupSessionPassword(password: string): void {
  if (typeof window === "undefined") return;
  useHostSignupStore.getState().setSessionPassword(password);
}

export function peekHostSignupSessionPassword(): string | null {
  if (typeof window === "undefined") return null;
  return useHostSignupStore.getState().sessionPassword;
}

export function clearHostSignupSessionPassword(): void {
  if (typeof window === "undefined") return;
  useHostSignupStore.getState().clearSessionPassword();
}
