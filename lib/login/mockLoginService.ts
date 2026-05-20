/**
 * Deterministic in-memory mock for the login service contract.
 *
 * Used when `NEXT_PUBLIC_AWS_USER_POOLS_ID` is not set (local dev / CI).
 * Any well-formed credentials return DONE by default. Use the special email
 * patterns below to exercise the other states without a real Cognito pool:
 *
 *   email contains ".phone"        → RESUME_PHONE
 *   email contains ".role"         → RESUME_USER_ROLE
 *   email contains ".unconfirmed"  → NOT_CONFIRMED
 *   password === "wrong"           → WRONG_CREDENTIALS
 *
 * Mirrors the mock conventions in `lib/user-signup/mockService.ts`.
 */

import type { LoginInput, LoginResult } from "./types";
import type { LoginService } from "./service";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockLoginService: LoginService = {
  async login(input: LoginInput): Promise<LoginResult> {
    await delay(200);
    const email = input.email.trim().toLowerCase();

    if (input.password === "wrong") return { status: "WRONG_CREDENTIALS" };
    if (email.includes(".unconfirmed")) return { status: "NOT_CONFIRMED" };
    if (email.includes(".phone")) return { status: "RESUME_PHONE" };
    if (email.includes(".role")) return { status: "RESUME_USER_ROLE" };

    return { status: "DONE" };
  },
};
