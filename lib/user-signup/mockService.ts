/**
 * Deterministic in-memory mock for the user-signup service contract.
 *
 * Used when `NEXT_PUBLIC_AWS_USER_POOLS_ID` is not set (local dev / CI). The
 * mock accepts any well-formed input, "remembers" registered emails for the
 * lifetime of the page, and treats the code `123456` as the only valid OTP.
 * It mirrors `lib/host-signup/mockService.ts` so manual QA of the two flows
 * shares the same testing rituals.
 */

import type { UserSignupService } from "./service";
import type {
  ConfirmEmailInput,
  ConfirmEmailResult,
  ConfirmPhoneInput,
  ConfirmPhoneResult,
  ResendEmailCodeInput,
  ResendEmailCodeResult,
  StartPhoneVerificationInput,
  StartPhoneVerificationResult,
  StartUserSignupInput,
  StartUserSignupResult,
} from "./types";

const MOCK_OTP = "123456";
const registered = new Set<string>();
const phonesInUse = new Set<string>();
let lastSentPhoneE164: string | null = null;
let confirmedEmails = new Set<string>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockUserSignupService: UserSignupService = {
  async startSignup(input: StartUserSignupInput): Promise<StartUserSignupResult> {
    await delay(220);
    const email = input.email.trim().toLowerCase();
    if (registered.has(email) && confirmedEmails.has(email)) {
      return { status: "ALREADY_EXISTS", provider: "email" };
    }
    registered.add(email);
    return { status: "OTP_SENT", nextStep: "CONFIRM_EMAIL" };
  },

  async resendEmailCode(
    _input: ResendEmailCodeInput,
  ): Promise<ResendEmailCodeResult> {
    await delay(140);
    return { ok: true };
  },

  async confirmEmail(input: ConfirmEmailInput): Promise<ConfirmEmailResult> {
    await delay(220);
    const code = input.code.trim();
    if (code !== MOCK_OTP) {
      return { status: "CODE_MISMATCH" };
    }
    confirmedEmails.add(input.email.trim().toLowerCase());
    return { status: "CONFIRMED" };
  },

  async startPhoneVerification(
    input: StartPhoneVerificationInput,
  ): Promise<StartPhoneVerificationResult> {
    await delay(180);
    const phone = input.phoneE164.replace(/\s/g, "");
    if (phonesInUse.has(phone)) {
      return { status: "ALREADY_IN_USE" };
    }
    lastSentPhoneE164 = phone;
    return { status: "OTP_SENT", nextStep: "CONFIRM_PHONE" };
  },

  async resendPhoneCode(
    _input: StartPhoneVerificationInput,
  ): Promise<{ ok: true }> {
    await delay(120);
    return { ok: true };
  },

  async confirmPhone(input: ConfirmPhoneInput): Promise<ConfirmPhoneResult> {
    await delay(220);
    if (lastSentPhoneE164 !== input.phoneE164.replace(/\s/g, "")) {
      return { status: "CODE_EXPIRED" };
    }
    if (input.code.trim() !== MOCK_OTP) {
      return { status: "CODE_MISMATCH" };
    }
    phonesInUse.add(input.phoneE164);
    return { status: "CONFIRMED" };
  },
};
