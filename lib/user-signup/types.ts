/**
 * Service-layer contract for the regular-user registration flow.
 *
 * Phase 1 mirrors the host service through phone confirmation. The post-phone
 * steps (role + profile-setup + user-info + finalize) will extend this file
 * incrementally — each phase adds the verbs it needs.
 *
 * When `NEXT_PUBLIC_AWS_USER_POOLS_ID` is set in the browser, the default
 * service uses Cognito + AppSync + `USERS_LAMBDA` (same backend as mobile);
 * otherwise a deterministic mock is used.
 */

export interface StartUserSignupInput {
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

/**
 * Where the user lands after a `RESUME_SIGNED_IN` outcome. The user flow has
 * far more resume points than host (role, address, profile-pic, …) — Phase 1
 * only knows the three points that already exist after the first half:
 * `PHONE` for an account with no verified phone, `USER_ROLE` for an account
 * that has a phone but no role chosen, and `DONE` for a fully-registered
 * user. Later phases will add finer-grained resume points.
 */
export type UserResumeStep = "PHONE" | "USER_ROLE" | "DONE";

export type StartUserSignupResult =
  | { status: "OTP_SENT"; nextStep: "CONFIRM_EMAIL" }
  | { status: "ALREADY_EXISTS"; provider: "email" | "google" | "apple" }
  /** Email exists, password wrong (or Cognito returns a generic NotAuthorized). */
  | { status: "EXISTING_EMAIL_WRONG_PASSWORD" }
  /** `signUp` never completed — same password works; continue email OTP (resend allowed). */
  | { status: "RESUME_UNCONFIRMED"; nextStep: "CONFIRM_EMAIL" }
  /** Pool user is CONFIRMED and signed in. Resume point depends on existing AppSync row. */
  | {
      status: "RESUME_SIGNED_IN";
      resumeStep: UserResumeStep;
      cognitoUserId: string;
    };

export interface ConfirmEmailInput {
  email: string;
  code: string;
  /** Used after `confirmSignUp` to call `signIn` and create the AppSync user row. */
  password: string;
  profile: StartUserSignupInput["profile"];
  acceptedPrivacyAt: string;
}

export type ConfirmEmailResult =
  | { status: "CONFIRMED" }
  | { status: "CODE_MISMATCH" }
  | { status: "CODE_EXPIRED" };

export interface ResendEmailCodeInput {
  email: string;
}

export type ResendEmailCodeResult = { ok: true };

export interface StartPhoneVerificationInput {
  /** E.164-formatted phone, e.g. "+14155551234". */
  phoneE164: string;
}

export type StartPhoneVerificationResult =
  | { status: "OTP_SENT"; nextStep: "CONFIRM_PHONE" }
  | { status: "ALREADY_IN_USE" }
  | { status: "INVALID_NUMBER" };

export interface ConfirmPhoneInput {
  phoneE164: string;
  code: string;
}

export type ConfirmPhoneResult =
  | { status: "CONFIRMED" }
  | { status: "CODE_MISMATCH" }
  | { status: "CODE_EXPIRED" };
