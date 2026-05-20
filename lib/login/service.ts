/**
 * Public service contract + lazy-loading factory for the sign-in flow.
 *
 * When `NEXT_PUBLIC_AWS_USER_POOLS_ID` is set, the Cognito-backed implementation
 * is loaded via dynamic `import()` so the AWS Amplify bundle lands in a separate
 * chunk and never bloats the login page's initial JS. Matches the same pattern
 * used by `lib/user-signup/service.ts` and `lib/host-signup/service.ts`.
 */

import type { LoginInput, LoginResult } from "./types";
import { mockLoginService } from "./mockLoginService";

export type { LoginInput, LoginResult };

export interface LoginService {
  login(input: LoginInput): Promise<LoginResult>;
}

/* ── Lazy resolution ── */

let resolved: LoginService | null = null;
let resolving: Promise<LoginService> | null = null;

function shouldUseCognito(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(process.env.NEXT_PUBLIC_AWS_USER_POOLS_ID)
  );
}

function resolveLoginService(): Promise<LoginService> {
  if (resolved) return Promise.resolve(resolved);
  if (resolving) return resolving;

  if (!shouldUseCognito()) {
    resolved = mockLoginService;
    return Promise.resolve(resolved);
  }

  resolving = import(
    /* webpackChunkName: "cognito-login-service" */
    "./cognitoLoginService"
  ).then((mod) => {
    resolved = mod.cognitoLoginService;
    resolving = null;
    return resolved;
  });
  return resolving;
}

/**
 * Default login service. Uses Cognito + AppSync when
 * `NEXT_PUBLIC_AWS_USER_POOLS_ID` is configured, otherwise the deterministic
 * mock (for local dev / CI).
 */
export const defaultLoginService: LoginService = {
  async login(input: LoginInput): Promise<LoginResult> {
    const impl = await resolveLoginService();
    return impl.login(input);
  },
};
