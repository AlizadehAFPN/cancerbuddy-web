export interface LoginInput {
  email: string;
  password: string;
}

/**
 * All possible outcomes from a sign-in attempt.
 *
 * DONE            — Cognito session active + AppSync row confirms userType is set.
 *                   Show "registration complete" modal.
 * RESUME_PHONE    — Signed in but phone not yet verified (or no AppSync row at all).
 *                   Navigate to /register?step=phone.
 * RESUME_USER_ROLE — Phone verified but userType not chosen yet.
 *                   Navigate to /register?step=userRole.
 * NOT_CONFIRMED   — Cognito pool user exists but email OTP was never completed.
 *                   Show inline notice with link to /register.
 * WRONG_CREDENTIALS — NotAuthorizedException / UserNotFoundException.
 *                   Show inline form error.
 */
export type LoginResult =
  | { status: "DONE" }
  | { status: "RESUME_PHONE" }
  | { status: "RESUME_USER_ROLE" }
  | { status: "NOT_CONFIRMED" }
  | { status: "WRONG_CREDENTIALS" };
