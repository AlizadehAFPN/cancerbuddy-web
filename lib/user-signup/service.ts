/**
 * Public service contract for the regular-user `/register` flow.
 *
 * Phase 1 only needs the same first-half verbs as the host flow (startSignup,
 * resendEmailCode, confirmEmail, startPhoneVerification, resendPhoneCode,
 * confirmPhone). The post-phone verbs (createOrUpdateProfile, finalize, …)
 * will be added in later phases without changing the existing surface.
 *
 * The default implementation resolves lazily — when
 * `NEXT_PUBLIC_AWS_USER_POOLS_ID` is set in the browser, the Cognito-backed
 * implementation is loaded via `import()` so the AWS SDK / Amplify code lands
 * in a separate chunk and the route's initial bundle stays small (same
 * pattern + reasoning as `lib/host-signup/service.ts`).
 */

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

export interface UserSignupService {
  startSignup(input: StartUserSignupInput): Promise<StartUserSignupResult>;
  confirmEmail(input: ConfirmEmailInput): Promise<ConfirmEmailResult>;
  resendEmailCode(
    input: ResendEmailCodeInput,
  ): Promise<ResendEmailCodeResult>;
  startPhoneVerification(
    input: StartPhoneVerificationInput,
  ): Promise<StartPhoneVerificationResult>;
  confirmPhone(input: ConfirmPhoneInput): Promise<ConfirmPhoneResult>;
  resendPhoneCode(
    input: StartPhoneVerificationInput,
  ): Promise<{ ok: true }>;
}

import { mockUserSignupService } from "./mockService";

let resolvedImplementation: UserSignupService | null = null;
let resolvingPromise: Promise<UserSignupService> | null = null;

function shouldUseCognito(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(process.env.NEXT_PUBLIC_AWS_USER_POOLS_ID)
  );
}

function resolveUserSignupService(): Promise<UserSignupService> {
  if (resolvedImplementation) return Promise.resolve(resolvedImplementation);
  if (resolvingPromise) return resolvingPromise;

  if (!shouldUseCognito()) {
    resolvedImplementation = mockUserSignupService;
    return Promise.resolve(resolvedImplementation);
  }

  resolvingPromise = import(
    /* webpackChunkName: "user-cognito-service" */
    "./cognitoUserSignupService"
  ).then((mod) => {
    resolvedImplementation = mod.cognitoUserSignupService;
    resolvingPromise = null;
    return resolvedImplementation;
  });
  return resolvingPromise;
}

/**
 * Default user-signup service. Uses Cognito + AppSync + `USERS_LAMBDA` when
 * `NEXT_PUBLIC_AWS_USER_POOLS_ID` is set, otherwise the deterministic mock.
 */
export const defaultUserSignupService: UserSignupService = {
  async startSignup(input) {
    const impl = await resolveUserSignupService();
    return impl.startSignup(input);
  },
  async confirmEmail(input) {
    const impl = await resolveUserSignupService();
    return impl.confirmEmail(input);
  },
  async resendEmailCode(input) {
    const impl = await resolveUserSignupService();
    return impl.resendEmailCode(input);
  },
  async startPhoneVerification(input) {
    const impl = await resolveUserSignupService();
    return impl.startPhoneVerification(input);
  },
  async confirmPhone(input) {
    const impl = await resolveUserSignupService();
    return impl.confirmPhone(input);
  },
  async resendPhoneCode(input) {
    const impl = await resolveUserSignupService();
    return impl.resendPhoneCode(input);
  },
};
