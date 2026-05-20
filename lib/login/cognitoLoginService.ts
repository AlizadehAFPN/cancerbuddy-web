/**
 * Cognito + AppSync implementation of the login service contract.
 *
 * Flow mirrors the mobile app's `logIn()` in `useAuth.ts`:
 *  1. Auth.signIn(email, password)
 *  2. Fetch AppSync User row (same GET_USER_RESUME query used by the register flow)
 *  3. Classify the result based on phone + userType fields
 *
 * The classification logic is identical to `classifyUserResumeStep` in
 * `cognitoUserSignupService.ts` so both paths produce consistent resume points.
 */

import { Auth } from "aws-amplify";
import { ensureAmplifyConfigured } from "@/lib/aws/amplifyConfigure";
import {
  fetchUserRowForResume,
  userRowHasVerifiedPhone,
  type AppSyncUserResumeRow,
} from "@/lib/aws/appsyncUserQueries";
import type { LoginInput, LoginResult } from "./types";
import type { LoginService } from "./service";

/* ── Cognito error code extraction (mirrors cognitoUserSignupService) ── */

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
  if (msg.includes("UserNotConfirmedException")) return "UserNotConfirmedException";
  if (msg.includes("NotAuthorizedException")) return "NotAuthorizedException";
  if (msg.includes("UserNotFoundException")) return "UserNotFoundException";
  if (msg.includes("InvalidParameterException")) return "InvalidParameterException";
  return undefined;
}

/* ── Cognito user-id resolution (mirrors cognitoUserSignupService) ── */

function resolveUsernameFromSignIn(signedIn: unknown, fallback: string): string {
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
  return fallback;
}

async function resolveCognitoUserId(
  signedIn: unknown,
  emailFallback: string,
): Promise<string> {
  const fromSignIn = resolveUsernameFromSignIn(signedIn, emailFallback);
  try {
    const user = await Auth.currentAuthenticatedUser({ bypassCache: true });
    const u = user.getUsername?.();
    if (typeof u === "string" && u.trim()) return u.trim();
  } catch {
    /* use fromSignIn */
  }
  return fromSignIn;
}

/* ── Onboarding-completeness classifier ── */

/**
 * Identical logic to `classifyUserResumeStep` in `cognitoUserSignupService`.
 * Phase 1: phone present + userType set → DONE; phone missing → RESUME_PHONE;
 * phone present but no userType → RESUME_USER_ROLE.
 */
function classifyRow(row: AppSyncUserResumeRow | null): LoginResult {
  if (!row) return { status: "RESUME_PHONE" };
  if (!userRowHasVerifiedPhone(row)) return { status: "RESUME_PHONE" };
  const userType = (row.userType ?? "").trim().toUpperCase();
  if (!userType) return { status: "RESUME_USER_ROLE" };
  return { status: "DONE" };
}

/* ── Service implementation ── */

export const cognitoLoginService: LoginService = {
  async login(input: LoginInput): Promise<LoginResult> {
    ensureAmplifyConfigured();
    const email = input.email.trim().toLowerCase();

    /* ── 1. Cognito sign-in ── */
    let signedIn: unknown;
    try {
      signedIn = await Auth.signIn(email, input.password);
    } catch (err) {
      const code = cognitoErrorCode(err);
      if (code === "UserNotConfirmedException") return { status: "NOT_CONFIRMED" };
      if (
        code === "NotAuthorizedException" ||
        code === "UserNotFoundException" ||
        code === "NotAuthorized" ||
        code === "InvalidParameterException"
      ) {
        return { status: "WRONG_CREDENTIALS" };
      }
      throw err;
    }

    /* ── 2. Guard: extra challenge steps we can't complete in the browser ── */
    const challenge = (signedIn as { challengeName?: string }).challengeName;
    if (challenge) {
      try { await Auth.signOut(); } catch { /* ignore */ }
      throw new Error(
        challenge === "NEW_PASSWORD_REQUIRED"
          ? "Your account requires a new password. Use 'Forgot password' to reset it."
          : "Your account requires an extra sign-in step. Please use the mobile app or contact support.",
      );
    }

    /* ── 3. Resolve the Cognito pool username used as the AppSync PK ── */
    const cognitoUserId = await resolveCognitoUserId(signedIn, email);

    /* ── 4. Fetch AppSync User row and classify onboarding state ── */
    let row: AppSyncUserResumeRow | null;
    try {
      row = await fetchUserRowForResume(cognitoUserId, { authWithUserPool: true });
    } catch {
      // AppSync unreachable — RESUME_PHONE is the safest default: the phone
      // step is self-contained and will re-read fresh data from the server.
      return { status: "RESUME_PHONE" };
    }

    return classifyRow(row);
  },
};
