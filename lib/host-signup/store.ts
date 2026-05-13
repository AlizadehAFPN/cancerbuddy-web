/**
 * Zustand store for the host-application flow.
 *
 * Why this exists:
 *  - Replaces ad-hoc `localStorage` + `sessionStorage` reads/writes scattered
 *    across `storage.ts` and `cognitoHostSignupService.ts` with one typed,
 *    observable state container.
 *  - Persists ONLY what survives a same-tab reload, never longer:
 *    we use `sessionStorage` (per-tab, cleared when the tab closes) instead
 *    of `localStorage`. This is deliberate — the previous design kept PII
 *    (name, DOB month+year, email, phone, bio) on disk indefinitely.
 *  - The session password is held in memory ONLY — `partialize` strips it
 *    before writing to `sessionStorage`, so it never touches any storage
 *    backend at all. A `pagehide` listener also wipes it on tab unload as
 *    belt-and-braces.
 *  - Phone-verification SID lives in the same store but is also persisted
 *    (it's a Twilio Verify session id, not a secret).
 *
 * Consumers shouldn't import this file directly — call through the helpers
 * in `./storage`, which keep the public function-based API stable.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { HostRegisterFormValues } from "./validation";

/** Subset of form values that's safe to persist (no password / OTPs). */
export type PersistedHostDraft = Omit<
  HostRegisterFormValues,
  "password" | "confirmPassword" | "emailOtp" | "phoneOtp"
>;

/** Pool username stash, scoped to the email that produced it. */
interface PoolUsernameEntry {
  email: string;
  username: string;
}

interface HostSignupState {
  /** Persisted: PII-only draft snapshot (no secrets). */
  draft: PersistedHostDraft | null;
  /** Persisted: Cognito pool `Username` when it differs from the email alias. */
  poolUsername: PoolUsernameEntry | null;
  /** Persisted: Twilio Verify session id. */
  phoneSid: string | null;
  /** NOT persisted: raw password, kept in-memory only between credentials → OTP. */
  sessionPassword: string | null;

  /* Actions */
  setDraft: (values: PersistedHostDraft) => void;
  clearDraft: () => void;
  setPoolUsername: (email: string, username: string) => void;
  clearPoolUsername: () => void;
  setPhoneSid: (sid: string) => void;
  clearPhoneSid: () => void;
  setSessionPassword: (password: string) => void;
  clearSessionPassword: () => void;
  /** Reset everything — called after a successful registration. */
  reset: () => void;
}

const STORE_NAME = "cancerbuddy-host-signup-v2";

export const useHostSignupStore = create<HostSignupState>()(
  persist(
    (set) => ({
      draft: null,
      poolUsername: null,
      phoneSid: null,
      sessionPassword: null,

      setDraft: (values) => set({ draft: values }),
      clearDraft: () => set({ draft: null }),

      setPoolUsername: (email, username) => {
        const e = email.trim().toLowerCase();
        const u = username.trim();
        if (!e || !u) return;
        set({ poolUsername: { email: e, username: u } });
      },
      clearPoolUsername: () => set({ poolUsername: null }),

      setPhoneSid: (sid) => {
        const s = sid.trim();
        if (!s) return;
        set({ phoneSid: s });
      },
      clearPhoneSid: () => set({ phoneSid: null }),

      setSessionPassword: (password) => {
        if (typeof password !== "string" || !password) {
          set({ sessionPassword: null });
          return;
        }
        set({ sessionPassword: password });
        installPagehidePasswordWipe();
      },
      clearSessionPassword: () => set({ sessionPassword: null }),

      reset: () =>
        set({
          draft: null,
          poolUsername: null,
          phoneSid: null,
          sessionPassword: null,
        }),
    }),
    {
      name: STORE_NAME,
      /* `sessionStorage` (not `localStorage`) so the store dies when the
         user closes the tab. On the server `createJSONStorage` returns
         `undefined` and Zustand quietly skips persistence — that keeps the
         module SSR-safe even though every consumer is a client component. */
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? (undefined as unknown as Storage) : window.sessionStorage,
      ),
      /* Allowlist: anything not in here lives in memory only. The raw
         `sessionPassword` is intentionally omitted. */
      partialize: (state) => ({
        draft: state.draft,
        poolUsername: state.poolUsername,
        phoneSid: state.phoneSid,
      }),
      version: 1,
    },
  ),
);

/* ── Pagehide password wipe ──────────────────────────────────────────────
   Defence in depth on top of `partialize`: when the user leaves the page,
   purge the in-memory password so nothing survives even an injected
   `console.log(useHostSignupStore.getState())` from a stale DevTools
   session. Idempotent — installing twice is a no-op. */

let pagehideInstalled = false;
function installPagehidePasswordWipe(): void {
  if (typeof window === "undefined" || pagehideInstalled) return;
  pagehideInstalled = true;
  try {
    window.addEventListener("pagehide", () => {
      try {
        useHostSignupStore.getState().clearSessionPassword();
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* embedded environments may disallow listener registration */
  }
}
