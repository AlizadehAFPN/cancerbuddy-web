/**
 * Service-layer contract for the host-registration flow. Mirrors the email
 * signup contract (start → confirm → resend) and adds parallel verbs for the
 * phone-OTP step, plus a final `submitApplication` that uploads the profile
 * photo, writes bio + `userType` HOST to AppSync, and invokes the same
 * post-enrollment Lambdas as mobile (`LoginInLambdaUtil` after
 * `LoadingPersonalInformation`).
 *
 * When `NEXT_PUBLIC_AWS_USER_POOLS_ID` is set in the browser, the default
 * service implementation uses Cognito + AppSync + `USERS_LAMBDA` (same as the
 * mobile app); otherwise a deterministic mock is used.
 */

export interface StartHostSignupInput {
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

export type StartHostSignupResult =
  | { status: "OTP_SENT"; nextStep: "CONFIRM_EMAIL" }
  | { status: "ALREADY_EXISTS"; provider: "email" | "google" | "apple" }
  /** Email exists, password wrong (or Cognito uses a generic NotAuthorized). Forgot password TBD. */
  | { status: "EXISTING_EMAIL_WRONG_PASSWORD" }
  /** `signUp` never completed — same password works; continue email OTP (resend allowed). */
  | { status: "RESUME_UNCONFIRMED"; nextStep: "CONFIRM_EMAIL" }
  /**
   * Pool user is CONFIRMED and signed in. `resumeStep` uses AppSync `User`:
   * finished web host application (phone + HOST + bio + profile photo) → `DONE`
   * (success screen); else same as mobile — empty phone → `PHONE`, else `PHOTO`.
   */
  | {
      status: "RESUME_SIGNED_IN";
      resumeStep: "PHONE" | "PHOTO" | "DONE";
      cognitoUserId: string;
      /** Present when `resumeStep === "DONE"` — public Buddy ID when available. */
      buddyId?: string | null;
    };

export interface ConfirmEmailInput {
  email: string;
  code: string;
  /**
   * Used after Cognito `confirmSignUp` to call `signIn` and create the AppSync
   * user row — same ordering as `AccountSetupValidation` in the mobile app.
   */
  password: string;
  profile: StartHostSignupInput["profile"];
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

export interface SubmitHostApplicationInput {
  /** Object URL is unsuitable for upload — the real service expects the File. */
  photo: File;
  bio: string;
  /**
   * First name from the profile step — used as the GetStream `name` argument
   * (mobile uses the first word of the enrollee’s full legal name).
   */
  firstName: string;
}

export type SubmitHostApplicationResult =
  | {
      status: "SUBMITTED";
      /**
       * Public Buddy identifier from AppSync `User.buddyId` (same as mobile profile).
       * `null` when the field is not yet populated or the lookup failed — the done
       * step explains where to find it in the app.
       */
      buddyId: string | null;
      /**
       * When true, the same support path as mobile first-open chat completed:
       * support connection in AppSync + welcome message from Ava (GetStream)
       * via Lambdas.
       */
      supportChannelReady: boolean;
      /**
       * When true, web hit an error wiring support; mobile `HomeBuddies` can
       * retry (`pendingSupportChannel`). When false and `supportChannelReady`
       * is false, the backend returned nothing to wire (same as empty
       * `connectChannelSupport` on mobile).
       */
      supportChannelDeferredToApp: boolean;
    }
  | { status: "REJECTED"; reason: string };
