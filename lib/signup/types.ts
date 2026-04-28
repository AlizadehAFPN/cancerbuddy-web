/**
 * BE-friendly service-layer types. Mirrors a typical email-OTP signup contract
 * (e.g. AWS Cognito's signUp + confirmSignUp) so swapping the mock for a real
 * backend is a single-file change in `mockService.ts` → `realService.ts`.
 */

export interface StartSignupInput {
  email: string;
  password: string;
  profile: {
    firstName: string;
    lastName: string;
    birthMonth: number;
    birthYear: number;
    pronouns: string;
  };
  acceptedPrivacyAt: string;
}

export type StartSignupResult =
  | { status: "OTP_SENT"; nextStep: "CONFIRM_SIGN_UP" }
  | { status: "ALREADY_EXISTS"; provider: "email" | "google" | "apple" };

export interface ConfirmSignupInput {
  email: string;
  code: string;
}

export type ConfirmSignupResult =
  | { status: "CONFIRMED" }
  | { status: "CODE_MISMATCH" }
  | { status: "CODE_EXPIRED" };

export interface ResendCodeInput {
  email: string;
}

export type ResendCodeResult = { ok: true };
