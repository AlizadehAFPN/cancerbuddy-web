import type { SignupStep } from "@/lib/signup/constants";

/** Default in-flow Back targets for `/signup` (linear today; resume can override). */
export const SIGNUP_BACK_FALLBACK: Partial<Record<SignupStep, SignupStep>> = {
  profile: "privacy",
  credentials: "profile",
  otp: "credentials",
};
