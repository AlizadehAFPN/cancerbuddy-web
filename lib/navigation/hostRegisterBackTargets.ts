import type { HostRegisterStep } from "@/lib/host-signup/constants";

/**
 * Default in-flow Back targets for `/hosts-register`.
 * `phone` → `credentials` skips the email-OTP step on purpose (matches product).
 */
export const HOST_REGISTER_BACK_FALLBACK: Partial<
  Record<HostRegisterStep, HostRegisterStep>
> = {
  privacy: "intro",
  profile: "privacy",
  credentials: "profile",
  emailOtp: "credentials",
  phone: "credentials",
  photo: "phone",
  bio: "photo",
};
