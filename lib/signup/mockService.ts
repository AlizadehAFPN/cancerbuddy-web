import type { SignupService } from "./service";
import type {
  ConfirmSignupResult,
  StartSignupResult,
} from "./types";

/**
 * Deterministic mock for the signup contract. Lets the UI exercise every
 * branch (success, account-exists, code mismatch, code expired) without a
 * backend.
 *
 * Test inputs:
 *   • email = "exists@example.com"  → ALREADY_EXISTS / email
 *   • email = "google@example.com"  → ALREADY_EXISTS / google
 *   • email = "apple@example.com"   → ALREADY_EXISTS / apple
 *   • code  = "000000"              → CODE_MISMATCH
 *   • code  = "111111"              → CODE_EXPIRED
 *   • any other valid 6-digit code  → CONFIRMED
 */

const FAKE_LATENCY_MS = 700;

function delay<T>(value: T, ms = FAKE_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const mockSignupService: SignupService = {
  async startSignup({ email }) {
    const e = email.trim().toLowerCase();
    let result: StartSignupResult;
    if (e === "exists@example.com") {
      result = { status: "ALREADY_EXISTS", provider: "email" };
    } else if (e === "google@example.com") {
      result = { status: "ALREADY_EXISTS", provider: "google" };
    } else if (e === "apple@example.com") {
      result = { status: "ALREADY_EXISTS", provider: "apple" };
    } else {
      result = { status: "OTP_SENT", nextStep: "CONFIRM_SIGN_UP" };
    }
    return delay(result);
  },

  async confirmSignup({ code }) {
    let result: ConfirmSignupResult;
    if (code === "000000") result = { status: "CODE_MISMATCH" };
    else if (code === "111111") result = { status: "CODE_EXPIRED" };
    else result = { status: "CONFIRMED" };
    return delay(result);
  },

  async resendCode() {
    return delay({ ok: true } as const);
  },
};
