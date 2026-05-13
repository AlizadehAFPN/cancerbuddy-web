import type {
  ConfirmEmailResult,
  ConfirmPhoneResult,
  StartHostSignupResult,
  StartPhoneVerificationResult,
  SubmitHostApplicationInput,
  SubmitHostApplicationResult,
} from "./types";
import type { HostSignupService } from "./service";

/**
 * Deterministic mock for the host-application contract. Mirrors the regular
 * signup mock so QA can exercise the same branches.
 *
 * Test inputs:
 *   • email     = "wrongpass@example.com"     → EXISTING_EMAIL_WRONG_PASSWORD
 *   • email     = "resume-otp@example.com"    → RESUME_UNCONFIRMED (email OTP)
 *   • email     = "resume-phone@example.com" → RESUME_SIGNED_IN / PHONE
 *   • email     = "resume-photo@example.com" → RESUME_SIGNED_IN / PHOTO
 *   • email     = "resume-done@example.com" → RESUME_SIGNED_IN / DONE (completed host)
 *   • email     = "exists@example.com"      → ALREADY_EXISTS / email
 *   • email     = "google@example.com"      → ALREADY_EXISTS / google
 *   • email     = "apple@example.com"       → ALREADY_EXISTS / apple
 *   • emailOtp  = "000000"                  → CODE_MISMATCH
 *   • emailOtp  = "111111"                  → CODE_EXPIRED
 *   • phoneE164 ends in "0000000"           → ALREADY_IN_USE
 *   • phoneE164 ends in "1111111"           → INVALID_NUMBER
 *   • phoneOtp  = "000000"                  → CODE_MISMATCH
 *   • phoneOtp  = "111111"                  → CODE_EXPIRED
 *   • bio       starts with "REJECT:"       → REJECTED with the rest as reason
 *   • everything else                       → success
 */

const FAKE_LATENCY_MS = 700;

function delay<T>(value: T, ms = FAKE_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function generateMockBuddyId(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(100000 + Math.random() * 900000);
  return `CB-${year}-${seq}`;
}

export const mockHostSignupService: HostSignupService = {
  async startSignup({ email }) {
    const e = email.trim().toLowerCase();
    let result: StartHostSignupResult;
    if (e === "wrongpass@example.com") {
      result = { status: "EXISTING_EMAIL_WRONG_PASSWORD" };
    } else if (e === "resume-otp@example.com") {
      result = { status: "RESUME_UNCONFIRMED", nextStep: "CONFIRM_EMAIL" };
    } else if (e === "resume-phone@example.com") {
      result = {
        status: "RESUME_SIGNED_IN",
        resumeStep: "PHONE",
        cognitoUserId: "mock-cognito-user-id",
      };
    } else if (e === "resume-photo@example.com") {
      result = {
        status: "RESUME_SIGNED_IN",
        resumeStep: "PHOTO",
        cognitoUserId: "mock-cognito-user-id",
      };
    } else if (e === "resume-done@example.com") {
      result = {
        status: "RESUME_SIGNED_IN",
        resumeStep: "DONE",
        cognitoUserId: "mock-cognito-user-id",
        buddyId: generateMockBuddyId(),
      };
    } else if (e === "exists@example.com") {
      result = { status: "ALREADY_EXISTS", provider: "email" };
    } else if (e === "google@example.com") {
      result = { status: "ALREADY_EXISTS", provider: "google" };
    } else if (e === "apple@example.com") {
      result = { status: "ALREADY_EXISTS", provider: "apple" };
    } else {
      result = { status: "OTP_SENT", nextStep: "CONFIRM_EMAIL" };
    }
    return delay(result);
  },

  async confirmEmail({ code }) {
    let result: ConfirmEmailResult;
    if (code === "000000") result = { status: "CODE_MISMATCH" };
    else if (code === "111111") result = { status: "CODE_EXPIRED" };
    else result = { status: "CONFIRMED" };
    return delay(result);
  },

  async resendEmailCode() {
    return delay({ ok: true } as const);
  },

  async startPhoneVerification({ phoneE164 }) {
    let result: StartPhoneVerificationResult;
    if (phoneE164.endsWith("0000000")) {
      result = { status: "ALREADY_IN_USE" };
    } else if (phoneE164.endsWith("1111111")) {
      result = { status: "INVALID_NUMBER" };
    } else {
      result = { status: "OTP_SENT", nextStep: "CONFIRM_PHONE" };
    }
    return delay(result);
  },

  async confirmPhone({ code }) {
    let result: ConfirmPhoneResult;
    if (code === "000000") result = { status: "CODE_MISMATCH" };
    else if (code === "111111") result = { status: "CODE_EXPIRED" };
    else result = { status: "CONFIRMED" };
    return delay(result);
  },

  async resendPhoneCode() {
    return delay({ ok: true } as const);
  },

  async submitApplication(input: SubmitHostApplicationInput) {
    const trimmed = input.bio.trim();
    let result: SubmitHostApplicationResult;
    if (trimmed.startsWith("REJECT:")) {
      result = {
        status: "REJECTED",
        reason: trimmed.slice("REJECT:".length).trim() ||
          "Please review and re-submit.",
      };
    } else {
      result = {
        status: "SUBMITTED",
        buddyId: generateMockBuddyId(),
        supportChannelReady: true,
        supportChannelDeferredToApp: false,
      };
    }
    return delay(result, 900);
  },
};
