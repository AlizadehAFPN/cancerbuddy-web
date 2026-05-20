/**
 * Cognito + AppSync + Twilio Verify implementation of the user-signup
 * contract. Mirrors mobile `AccountSetupMailPass`, `AccountSetupValidation`,
 * `AccountSetupPhoneNumber`, `AccountSetupOtp` — same Cognito pool, same
 * `createUser` payload (no `userType` yet; that's chosen later), same
 * `users-lambda` Twilio Verify flow.
 *
 * The first half here is intentionally near-identical to
 * `cognitoHostSignupService` so the two flows stay byte-compatible at the
 * Cognito + AppSync layer; the divergence happens after phone verification
 * (next phase) when the user picks a role.
 */

import { Auth } from "aws-amplify";
import type {
  ConfirmEmailInput,
  ConfirmEmailResult,
  ConfirmPhoneInput,
  ConfirmPhoneResult,
  ResendEmailCodeInput,
  ResendEmailCodeResult,
  StartUserSignupInput,
  StartUserSignupResult,
  StartPhoneVerificationInput,
  StartPhoneVerificationResult,
  UserResumeStep,
} from "./types";
import type { UserSignupService } from "./service";
import {
  clearUserPoolUsername,
  resolveUserPoolUsername,
  stashUserPoolUsername,
} from "./storage";
import { useUserSignupStore } from "./store";
import { ensureAmplifyConfigured } from "@/lib/aws/amplifyConfigure";
import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import {
  fetchUserRowForResume,
  userRowHasVerifiedPhone,
  type AppSyncUserResumeRow,
} from "@/lib/aws/appsyncUserQueries";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";

const CREATE_USER = /* GraphQL */ `
  mutation addUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
    }
  }
`;

const UPDATE_USER_PHONE = /* GraphQL */ `
  mutation updateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
    }
  }
`;

function usersLambdaName(): string {
  const name = process.env.NEXT_PUBLIC_USERS_LAMBDA;
  if (!name) throw new Error("NEXT_PUBLIC_USERS_LAMBDA is not configured.");
  return name;
}

/* ── Date helpers ── */

/**
 * Mobile stores birth as the last day of the selected month (`birthDate`
 * helper in `src/utils/birth.ts`). We replicate that here so the AppSync row
 * looks identical regardless of which client created it.
 */
function birthEndOfMonthIso(month: number, year: number): string {
  const last = new Date(year, month, 0);
  const y = last.getFullYear();
  const m = String(last.getMonth() + 1).padStart(2, "0");
  const d = String(last.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* ── Cognito error normalisation ── */

function cognitoErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const o = err as Record<string, unknown>;
  if (typeof o.code === "string") return o.code;
  if (typeof o.name === "string") return o.name;
  if (typeof o.__type === "string") {
    const t = o.__type;
    return t.includes("#") ? (t.split("#").pop() ?? t) : t;
  }
  const msg = typeof o.message === "string" ? o.message : "";
  if (msg.includes("CodeMismatchException")) return "CodeMismatchException";
  if (msg.includes("ExpiredCodeException")) return "ExpiredCodeException";
  if (msg.includes("NotAuthorizedException")) return "NotAuthorizedException";
  if (msg.includes("UserNotConfirmedException")) return "UserNotConfirmedException";
  if (msg.includes("AliasExistsException")) return "AliasExistsException";
  if (msg.includes("UsernameExistsException")) return "UsernameExistsException";
  if (msg.includes("UserNotFoundException")) return "UserNotFoundException";
  if (msg.includes("InvalidParameterException")) return "InvalidParameterException";
  if (msg.includes("InvalidPasswordException")) return "InvalidPasswordException";
  return undefined;
}

function cognitoErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    return typeof m === "string" ? m : "";
  }
  return "";
}

function normalizeConfirmationCode(raw: string): string {
  return raw.replace(/\D/g, "");
}

function isAlreadyConfirmedCognitoError(err: unknown): boolean {
  const msg = cognitoErrorMessage(err).toLowerCase();
  return (
    /already\s+confirmed/.test(msg) ||
    /current\s+status\s+is\s+confirmed/.test(msg)
  );
}

function describeCognitoFailure(err: unknown): string {
  const isDev =
    typeof process !== "undefined" && process.env?.NODE_ENV !== "production";
  if (isDev) {
    const code = cognitoErrorCode(err);
    const message = cognitoErrorMessage(err).trim();
    if (code && message) return `${code}: ${message}`;
    if (message) return message;
    if (code) return code;
  }
  return "We couldn't complete that request. Please try again, or contact support if it keeps happening.";
}

async function trySilentSignOut(): Promise<void> {
  try {
    await Auth.signOut();
  } catch {
    /* no active session */
  }
}

function resolveCognitoUsernameFromSignInResult(
  signedIn: unknown,
  emailFallback: string,
): string {
  if (signedIn && typeof signedIn === "object") {
    const u = signedIn as { getUsername?: () => string; username?: string };
    if (typeof u.getUsername === "function") {
      const n = u.getUsername();
      if (typeof n === "string" && n.trim()) return n.trim();
    }
    if (typeof u.username === "string" && u.username.trim()) {
      return u.username.trim();
    }
  }
  return emailFallback;
}

async function resolveCognitoUserIdAfterPoolSignIn(
  signedIn: unknown,
  emailFallback: string,
): Promise<string> {
  const fromSignIn = resolveCognitoUsernameFromSignInResult(
    signedIn,
    emailFallback,
  );
  try {
    const user = await Auth.currentAuthenticatedUser({ bypassCache: true });
    const u = user.getUsername?.();
    if (typeof u === "string" && u.trim()) return u.trim();
  } catch {
    /* use fromSignIn */
  }
  return fromSignIn;
}

/* ── CREATE_USER input ── */

/**
 * Baseline AppSync `User` row written immediately after Cognito confirms the
 * email. Matches the mobile shape: name, birth, no `userType` yet (the user
 * picks it on the next step), and the terms acceptance timestamp.
 */
function buildCreateUserInput(
  cognitoUserId: string,
  profile: StartUserSignupInput["profile"],
  acceptedPrivacyAt: string,
): Record<string, unknown> {
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  const birth = birthEndOfMonthIso(profile.birthMonth, profile.birthYear);
  return {
    id: cognitoUserId,
    name,
    birth,
    isSnooze: false,
    guardianFullName: null,
    guardianConsent: null,
    guardianConsentSupervision: null,
    userGuardianId: null,
    terms: {
      acceptTerms: true,
      termsTimestamp: new Date(acceptedPrivacyAt).toISOString(),
    },
  };
}

function isLikelyDuplicateUserWrite(err: unknown): boolean {
  const s = `${cognitoErrorMessage(err)} ${String(err)}`.toLowerCase();
  return (
    s.includes("duplicate") ||
    s.includes("already exists") ||
    s.includes("conditionalcheckfailed") ||
    s.includes("conflict") ||
    s.includes("the conditional request failed")
  );
}

async function createUserOrRecoverDuplicate(
  cognitoUserId: string,
  input: StartUserSignupInput,
): Promise<void> {
  const variables = {
    input: buildCreateUserInput(
      cognitoUserId,
      input.profile,
      input.acceptedPrivacyAt,
    ),
  };
  try {
    await executeAppSyncGraphql<{ createUser: { id: string } }>({
      query: CREATE_USER,
      variables,
    });
  } catch (err) {
    if (!isLikelyDuplicateUserWrite(err)) throw err;
    const row = await fetchUserRowForResume(cognitoUserId, {
      authWithUserPool: true,
    });
    if (!row) throw err;
  }
}

/**
 * For now (Phase 1) the resume logic only distinguishes three points: no
 * phone → PHONE; phone but no role/profile → USER_ROLE; everything → DONE.
 * `DONE` is conservative — Phase 1 considers a user "done" only when both
 * `userType` and `phone` are set on the AppSync row. Later phases will
 * tighten this with additional required fields as they're persisted.
 */
function classifyUserResumeStep(
  row: AppSyncUserResumeRow | null,
): UserResumeStep {
  if (!row) return "PHONE";
  if (!userRowHasVerifiedPhone(row)) return "PHONE";
  const userType = (row.userType ?? "").trim().toUpperCase();
  if (!userType) return "USER_ROLE";
  return "DONE";
}

async function ensureUserRowAndResumeStep(
  cognitoUserId: string,
  input: StartUserSignupInput,
): Promise<UserResumeStep> {
  let row = await fetchUserRowForResume(cognitoUserId, {
    authWithUserPool: true,
  });
  if (!row) {
    await createUserOrRecoverDuplicate(cognitoUserId, input);
    row = await fetchUserRowForResume(cognitoUserId, {
      authWithUserPool: true,
    });
  }
  return classifyUserResumeStep(row);
}

async function resumeAfterUsernameCollision(
  email: string,
  password: string,
  input: StartUserSignupInput,
): Promise<StartUserSignupResult> {
  await trySilentSignOut();
  try {
    const signedIn = await Auth.signIn(email, password);
    const challenge = (signedIn as { challengeName?: string }).challengeName;
    if (challenge) {
      await trySilentSignOut();
      if (challenge === "NEW_PASSWORD_REQUIRED") {
        throw new Error(
          "Your account requires a new password before you can continue. Use Forgot password when it is available.",
        );
      }
      throw new Error(
        "Your account needs an extra sign-in step we cannot complete in the browser. Try the mobile app or contact support.",
      );
    }

    const cognitoUserId = await resolveCognitoUserIdAfterPoolSignIn(
      signedIn,
      email,
    );
    clearPhoneSid();
    const resumeStep = await ensureUserRowAndResumeStep(cognitoUserId, input);
    return {
      status: "RESUME_SIGNED_IN",
      resumeStep,
      cognitoUserId,
    };
  } catch (signInErr) {
    const c = cognitoErrorCode(signInErr);
    if (c === "UserNotConfirmedException") {
      return { status: "RESUME_UNCONFIRMED", nextStep: "CONFIRM_EMAIL" };
    }
    if (
      c === "NotAuthorizedException" ||
      c === "InvalidPasswordException" ||
      c === "NotAuthorized"
    ) {
      return { status: "EXISTING_EMAIL_WRONG_PASSWORD" };
    }
    if (signInErr instanceof Error) throw signInErr;
    throw new Error(String(signInErr));
  }
}

async function getCognitoUserId(): Promise<string> {
  const user = await Auth.currentAuthenticatedUser({ bypassCache: true });
  return user.getUsername();
}

/* ── Twilio Verify SID stash ── */

function storePhoneSid(sid: string): void {
  useUserSignupStore.getState().setPhoneSid(sid);
}

function readPhoneSid(): string | null {
  return useUserSignupStore.getState().phoneSid;
}

function clearPhoneSid(): void {
  useUserSignupStore.getState().clearPhoneSid();
}

async function startPhoneVerificationCore(
  input: StartPhoneVerificationInput,
): Promise<StartPhoneVerificationResult> {
  ensureAmplifyConfigured();
  const phone = input.phoneE164.replace(/\s/g, "");
  let userId: string;
  try {
    userId = await getCognitoUserId();
  } catch {
    return { status: "INVALID_NUMBER" };
  }

  try {
    const raw = await raiseUserLambda(
      LambdaPayloadType.SEND_CODE_PHONE,
      usersLambdaName(),
      { phone, userId },
    );
    let parsed: { sid?: string; errorMessage?: string; message?: string; statusCode?: number };
    try {
      parsed = JSON.parse(raw) as { sid?: string; errorMessage?: string; message?: string; statusCode?: number };
    } catch {
      return { status: "INVALID_NUMBER" };
    }
    if (parsed.sid) {
      storePhoneSid(parsed.sid);
      return { status: "OTP_SENT", nextStep: "CONFIRM_PHONE" };
    }
    const msg = (parsed.errorMessage ?? parsed.message ?? "").toLowerCase();
    if (msg.includes("already") || msg.includes("in use")) {
      return { status: "ALREADY_IN_USE" };
    }
    return { status: "INVALID_NUMBER" };
  } catch {
    return { status: "INVALID_NUMBER" };
  }
}

export const cognitoUserSignupService: UserSignupService = {
  async startSignup(input: StartUserSignupInput): Promise<StartUserSignupResult> {
    ensureAmplifyConfigured();
    const email = input.email.trim().toLowerCase();
    try {
      const signupResult = await Auth.signUp({
        username: email,
        password: input.password,
        attributes: { email },
      });
      const poolUsername = signupResult?.user?.getUsername?.();
      if (typeof poolUsername === "string" && poolUsername.trim()) {
        stashUserPoolUsername(email, poolUsername.trim());
      }
      return { status: "OTP_SENT", nextStep: "CONFIRM_EMAIL" };
    } catch (err) {
      const code = cognitoErrorCode(err);
      if (code === "UsernameExistsException" || code === "AliasExistsException") {
        return resumeAfterUsernameCollision(email, input.password, input);
      }
      throw err;
    }
  },

  async resendEmailCode(
    input: ResendEmailCodeInput,
  ): Promise<ResendEmailCodeResult> {
    ensureAmplifyConfigured();
    const email = input.email.trim().toLowerCase();
    await Auth.resendSignUp(resolveUserPoolUsername(email));
    return { ok: true };
  },

  async confirmEmail(input: ConfirmEmailInput): Promise<ConfirmEmailResult> {
    ensureAmplifyConfigured();
    const email = input.email.trim().toLowerCase();
    const confirmationCode = normalizeConfirmationCode(input.code);
    if (!confirmationCode) {
      return { status: "CODE_MISMATCH" };
    }

    const cognitoUsername = resolveUserPoolUsername(email);

    try {
      await Auth.confirmSignUp(cognitoUsername, confirmationCode);
    } catch (err) {
      const code = cognitoErrorCode(err);
      if (code === "CodeMismatchException") return { status: "CODE_MISMATCH" };
      if (code === "ExpiredCodeException") return { status: "CODE_EXPIRED" };
      if (!isAlreadyConfirmedCognitoError(err)) {
        throw new Error(describeCognitoFailure(err));
      }
      /* Already verified — continue with sign-in below. */
    }

    if (!input.password?.trim()) {
      throw new Error(
        "Missing password for sign-in after email verification. Go back to the previous step, enter it again, then verify your email.",
      );
    }

    await trySilentSignOut();
    const signedIn = await Auth.signIn(email, input.password);
    const challenge = (signedIn as { challengeName?: string }).challengeName;
    if (challenge) {
      await trySilentSignOut();
      throw new Error(
        challenge === "NEW_PASSWORD_REQUIRED"
          ? "Your account requires a new password before you can continue. Use Forgot password when it is available."
          : "Your account needs an extra sign-in step we cannot complete in the browser. Try the mobile app or contact support.",
      );
    }

    const cognitoUserId = await resolveCognitoUserIdAfterPoolSignIn(
      signedIn,
      email,
    );

    await createUserOrRecoverDuplicate(cognitoUserId, {
      email,
      password: input.password,
      profile: input.profile,
      acceptedPrivacyAt: input.acceptedPrivacyAt,
    });

    clearUserPoolUsername();
    return { status: "CONFIRMED" };
  },

  async startPhoneVerification(
    input: StartPhoneVerificationInput,
  ): Promise<StartPhoneVerificationResult> {
    return startPhoneVerificationCore(input);
  },

  async resendPhoneCode(
    input: StartPhoneVerificationInput,
  ): Promise<{ ok: true }> {
    const again = await startPhoneVerificationCore(input);
    if (again.status !== "OTP_SENT") {
      throw new Error("resendPhoneCode failed");
    }
    return { ok: true };
  },

  async confirmPhone(input: ConfirmPhoneInput): Promise<ConfirmPhoneResult> {
    ensureAmplifyConfigured();
    const phone = input.phoneE164.replace(/\s/g, "");
    const sid = readPhoneSid();
    if (!sid) {
      return { status: "CODE_EXPIRED" };
    }

    let userId: string;
    try {
      userId = await getCognitoUserId();
    } catch {
      return { status: "CODE_EXPIRED" };
    }

    try {
      const raw = await raiseUserLambda(
        LambdaPayloadType.VERIFY_CODE_PHONE,
        usersLambdaName(),
        {
          phone,
          code: input.code,
          sid,
          userId,
        },
      );
      let parsed: { status?: string };
      try {
        parsed = JSON.parse(raw) as { status?: string };
      } catch {
        return { status: "CODE_MISMATCH" };
      }
      if (parsed.status !== "approved") {
        return { status: "CODE_MISMATCH" };
      }
    } catch {
      return { status: "CODE_MISMATCH" };
    }

    try {
      await executeAppSyncGraphql<{ updateUser: { id: string } }>({
        query: UPDATE_USER_PHONE,
        variables: { input: { id: userId, phone } },
      });
    } catch {
      /* Same as mobile: verification succeeded; DB update is best-effort. */
    }

    try {
      const cognitoUser = await Auth.currentAuthenticatedUser({
        bypassCache: true,
      });
      await Auth.updateUserAttributes(cognitoUser, {
        phone_number: phone,
        phone_number_verified: "true",
      });
    } catch {
      /* Cognito sync is best-effort (matches mobile AccountSetupOtp). */
    }

    clearPhoneSid();
    return { status: "CONFIRMED" };
  },
};
