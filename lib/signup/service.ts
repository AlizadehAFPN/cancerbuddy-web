import type {
  ConfirmSignupInput,
  ConfirmSignupResult,
  ResendCodeInput,
  ResendCodeResult,
  StartSignupInput,
  StartSignupResult,
} from "./types";

/**
 * Public signup service contract. To swap the mock for a real backend, change
 * only `defaultSignupService` below — every UI consumer imports the default
 * export, never the mock directly.
 */
export interface SignupService {
  startSignup(input: StartSignupInput): Promise<StartSignupResult>;
  confirmSignup(input: ConfirmSignupInput): Promise<ConfirmSignupResult>;
  resendCode(input: ResendCodeInput): Promise<ResendCodeResult>;
}

import { mockSignupService } from "./mockService";

export const defaultSignupService: SignupService = mockSignupService;
