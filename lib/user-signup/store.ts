/**
 * Zustand store for the regular-user registration flow.
 *
 * Mirrors the host-signup store in lifecycle, persistence rules, and
 * pagehide-wipe defence; the shape is just narrower for now (no host-only
 * `bio` field, fewer resume points). Later phases extend `PersistedUserDraft`
 * with the post-phone fields (userType, address, …) as they're collected.
 *
 * Consumers shouldn't import this file directly — call through the helpers
 * in `./storage`, which keep the public function-based API stable.
 */

import { create } from "zustand";
import type { UserRegisterStep } from "./constants";
import { maxUserStep } from "@/lib/navigation/userStepGate";
import type { UserRegisterFormValues } from "./validation";

/** Subset of form values that's safe to persist (no password / OTPs). */
export type PersistedUserDraft = Omit<
  UserRegisterFormValues,
  "password" | "confirmPassword" | "emailOtp" | "phoneOtp" | "guardianOtp"
>;

interface PoolUsernameEntry {
  email: string;
  username: string;
}

interface UserSignupState {
  draft: PersistedUserDraft | null;
  poolUsername: PoolUsernameEntry | null;
  phoneSid: string | null;
  guardianId: string | null;
  sessionPassword: string | null;
  /** Watermark: furthest step legitimately reached this session. */
  furthestStep: UserRegisterStep;

  setDraft: (values: PersistedUserDraft) => void;
  clearDraft: () => void;
  setPoolUsername: (email: string, username: string) => void;
  clearPoolUsername: () => void;
  setPhoneSid: (sid: string) => void;
  clearPhoneSid: () => void;
  setGuardianId: (id: string) => void;
  clearGuardianId: () => void;
  setSessionPassword: (password: string) => void;
  clearSessionPassword: () => void;
  advanceFurthestStep: (step: UserRegisterStep) => void;
  reset: () => void;
}

export const useUserSignupStore = create<UserSignupState>()((set) => ({
  draft: null,
  poolUsername: null,
  phoneSid: null,
  guardianId: null,
  sessionPassword: null,
  furthestStep: "intro",

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

  setGuardianId: (id) => {
    const s = id.trim();
    if (!s) return;
    set({ guardianId: s });
  },
  clearGuardianId: () => set({ guardianId: null }),

  setSessionPassword: (password) => {
    if (typeof password !== "string" || !password) {
      set({ sessionPassword: null });
      return;
    }
    set({ sessionPassword: password });
    installPagehidePasswordWipe();
  },
  clearSessionPassword: () => set({ sessionPassword: null }),

  advanceFurthestStep: (step) =>
    set((s) => {
      const next = maxUserStep(s.furthestStep, step);
      return next === s.furthestStep ? s : { furthestStep: next };
    }),

  reset: () =>
    set({
      draft: null,
      poolUsername: null,
      phoneSid: null,
      guardianId: null,
      sessionPassword: null,
      furthestStep: "intro",
    }),
}));

/* ── Pagehide password wipe (defence in depth) ────────────────────────── */

let pagehideInstalled = false;
function installPagehidePasswordWipe(): void {
  if (typeof window === "undefined" || pagehideInstalled) return;
  pagehideInstalled = true;
  try {
    window.addEventListener("pagehide", () => {
      try {
        useUserSignupStore.getState().clearSessionPassword();
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* embedded environments may disallow listener registration */
  }
}
