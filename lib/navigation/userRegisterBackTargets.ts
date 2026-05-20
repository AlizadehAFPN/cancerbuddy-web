import type { UserRegisterStep } from "@/lib/user-signup/constants";

/**
 * Default in-flow Back targets for `/register`.
 *
 * `phone` → `credentials` skips the already-verified email-OTP step on purpose
 * (matches the host flow + the mobile app's stack semantics).
 *
 * `verifiedSuccessfully` has no Back target — it's a one-way celebration on
 * top of a confirmed phone, and Back from there returns the user to the
 * landing page (handled by the page controller, not this map).
 */
export const USER_REGISTER_BACK_FALLBACK: Partial<
  Record<UserRegisterStep, UserRegisterStep>
> = {
  privacy: "intro",
  profile: "privacy",
  guardian: "profile",
  guardianOtp: "guardian",
  // credentials back is age-dependent — handled in page.tsx goBackInUserFlow
  emailOtp: "credentials",
  phone: "credentials",
  cgRelationship: "userRole",
  cgPatientAge: "cgRelationship",
  diagnosis: "userRole",
  medicalCenter: "diagnosis",
  // address back is role-dependent — handled in page.tsx goBackInUserFlow
  profilePic: "createProfile",
  about: "profilePic",
  interests: "about",
  languages: "interests",
  photos: "languages",
};
