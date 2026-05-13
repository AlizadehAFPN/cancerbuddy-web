import type {
  ConfirmEmailInput,
  ConfirmEmailResult,
  ConfirmPhoneInput,
  ConfirmPhoneResult,
  ResendEmailCodeInput,
  ResendEmailCodeResult,
  StartHostSignupInput,
  StartHostSignupResult,
  StartPhoneVerificationInput,
  StartPhoneVerificationResult,
  SubmitHostApplicationInput,
  SubmitHostApplicationResult,
} from "./types";

/**
 * Public host-application service contract. To swap the mock for a real
 * backend, change only `defaultHostSignupService` below — every UI consumer
 * imports the default export, never the mock directly.
 */
export interface HostSignupService {
  startSignup(input: StartHostSignupInput): Promise<StartHostSignupResult>;
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
  submitApplication(
    input: SubmitHostApplicationInput,
  ): Promise<SubmitHostApplicationResult>;
}

import { mockHostSignupService } from "./mockService";

/* ── Lazy implementation resolution ───────────────────────────────────────
 *
 * The Cognito-backed implementation pulls in AWS Amplify, Cognito Identity
 * JS, the AWS SDK Lambda client, smithy core, and axios — well over a
 * megabyte of compiled JavaScript. If we `import` it (or `require()` it,
 * which the bundler also resolves statically) at the top of this module,
 * Turbopack / webpack will include all of that code in the **initial**
 * chunk that the `/hosts-register` page hydrates with. On a mid-range
 * Android device that's a multi-second blocking parse before any React
 * event handlers are attached — which means `onClick`/`onChange` buttons
 * appear visually but do nothing when tapped. (Native `<a>` links keep
 * working because they don't need hydration.)
 *
 * Using a true dynamic `import()` here is what gets the AWS code into a
 * separate chunk that's only fetched the first time a host-signup service
 * method is actually called. The intro screen, the privacy / profile /
 * photo / bio screens, and every button on them hydrate immediately. */

let resolvedImplementation: HostSignupService | null = null;
let resolvingPromise: Promise<HostSignupService> | null = null;

function shouldUseCognito(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(process.env.NEXT_PUBLIC_AWS_USER_POOLS_ID)
  );
}

function resolveHostSignupService(): Promise<HostSignupService> {
  if (resolvedImplementation) return Promise.resolve(resolvedImplementation);
  if (resolvingPromise) return resolvingPromise;

  if (!shouldUseCognito()) {
    resolvedImplementation = mockHostSignupService;
    return Promise.resolve(resolvedImplementation);
  }

  /* The `webpackChunkName` magic comment also works under Turbopack: it
     forces the AWS-heavy code into a clearly named, separately-loaded
     async chunk instead of being inlined into the route bundle. */
  resolvingPromise = import(
    /* webpackChunkName: "host-cognito-service" */
    "./cognitoHostSignupService"
  ).then((mod) => {
    resolvedImplementation = mod.cognitoHostSignupService;
    resolvingPromise = null;
    return resolvedImplementation;
  });
  return resolvingPromise;
}

/**
 * Uses Cognito + AppSync + `USERS_LAMBDA` when `NEXT_PUBLIC_AWS_USER_POOLS_ID`
 * is set in the browser; otherwise the deterministic mock (local / CI).
 *
 * Each call awaits a dynamic import of the heavy AWS-backed implementation
 * so the route's initial client bundle stays small — see the note above
 * `resolveHostSignupService` for the full reasoning.
 */
export const defaultHostSignupService: HostSignupService = {
  async startSignup(input) {
    const impl = await resolveHostSignupService();
    return impl.startSignup(input);
  },
  async confirmEmail(input) {
    const impl = await resolveHostSignupService();
    return impl.confirmEmail(input);
  },
  async resendEmailCode(input) {
    const impl = await resolveHostSignupService();
    return impl.resendEmailCode(input);
  },
  async startPhoneVerification(input) {
    const impl = await resolveHostSignupService();
    return impl.startPhoneVerification(input);
  },
  async confirmPhone(input) {
    const impl = await resolveHostSignupService();
    return impl.confirmPhone(input);
  },
  async resendPhoneCode(input) {
    const impl = await resolveHostSignupService();
    return impl.resendPhoneCode(input);
  },
  async submitApplication(input) {
    const impl = await resolveHostSignupService();
    return impl.submitApplication(input);
  },
};
