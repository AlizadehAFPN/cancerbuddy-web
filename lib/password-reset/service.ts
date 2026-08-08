/**
 * Password reset, straight onto Cognito.
 *
 * The same two calls mobile makes — `sendForgotPasswordCode` and
 * `submitNewPassword` in `cancerbuddyapp/src/context/auth/authUtils.ts:126-150`
 * wrap `Auth.forgotPassword` and `Auth.forgotPasswordSubmit`. There is no
 * Lambda, no AppSync row, and nothing for the app to remember between the two
 * steps beyond the email.
 *
 * The username is the plain lowercased email, as on mobile and as
 * `cognitoLoginService` uses for `Auth.signIn` — deliberately *not*
 * `resolveUserPoolUsername`, whose stash only exists inside a signup session
 * that someone resetting their password has not started.
 *
 * Every result is a status rather than a thrown error, because the interesting
 * failures here are all expected ones the form has to explain.
 */

import { Auth } from "aws-amplify";
import { ensureAmplifyConfigured } from "@/lib/aws/amplifyConfigure";

function errorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const o = err as Record<string, unknown>;
  if (typeof o.code === "string") return o.code;
  if (typeof o.name === "string") return o.name;
  const msg = typeof o.message === "string" ? o.message : "";
  for (const c of [
    "UserNotFoundException",
    "LimitExceededException",
    "InvalidParameterException",
    "CodeMismatchException",
    "ExpiredCodeException",
    "InvalidPasswordException",
    "NotAuthorizedException",
  ]) {
    if (msg.includes(c)) return c;
  }
  return undefined;
}

export type SendResetCodeResult =
  | { status: "SENT" }
  /**
   * Cognito distinguishes "no such user" from "sent", and echoing that back
   * would turn this form into an account-existence oracle. It is reported to
   * the caller so it can be logged, and the form shows the same screen either
   * way — the behaviour mobile happens to have because it toasts optimistically.
   */
  | { status: "UNKNOWN_EMAIL" }
  /** Cognito's own rate limit. Retrying immediately will not help. */
  | { status: "RATE_LIMITED" }
  /**
   * The account exists but has never confirmed its email, so there is no
   * verified channel to send a reset code to. Registration is the way out.
   */
  | { status: "UNCONFIRMED" };

export type SubmitNewPasswordResult =
  | { status: "OK" }
  | { status: "CODE_MISMATCH" }
  | { status: "CODE_EXPIRED" }
  | { status: "WEAK_PASSWORD"; message: string }
  | { status: "RATE_LIMITED" };

export async function sendResetCode(
  email: string,
): Promise<SendResetCodeResult> {
  ensureAmplifyConfigured();
  try {
    await Auth.forgotPassword(email.trim().toLowerCase());
    return { status: "SENT" };
  } catch (err) {
    const code = errorCode(err);
    if (code === "UserNotFoundException") return { status: "UNKNOWN_EMAIL" };
    if (code === "LimitExceededException") return { status: "RATE_LIMITED" };
    /* Cognito reports an unconfirmed account through this generic code. */
    if (code === "InvalidParameterException") return { status: "UNCONFIRMED" };
    throw err;
  }
}

export async function submitNewPassword(input: {
  email: string;
  code: string;
  password: string;
}): Promise<SubmitNewPasswordResult> {
  ensureAmplifyConfigured();
  try {
    await Auth.forgotPasswordSubmit(
      input.email.trim().toLowerCase(),
      input.code.trim(),
      input.password,
    );
    return { status: "OK" };
  } catch (err) {
    const code = errorCode(err);
    if (code === "CodeMismatchException") return { status: "CODE_MISMATCH" };
    if (code === "ExpiredCodeException") return { status: "CODE_EXPIRED" };
    if (code === "LimitExceededException") return { status: "RATE_LIMITED" };
    if (code === "InvalidPasswordException") {
      /* The form checks the same five rules, so reaching here means the pool
         policy is stricter than this build knows about — pass it through. */
      return {
        status: "WEAK_PASSWORD",
        message:
          err instanceof Error
            ? err.message
            : "That password does not meet the requirements.",
      };
    }
    throw err;
  }
}
