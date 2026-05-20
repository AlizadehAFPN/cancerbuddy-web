"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  DEFAULT_DIAL_ISO2,
  OTP_RESEND_COOLDOWN_SEC,
  PHONE_OTP_RESEND_COOLDOWN_SEC,
  MIN_AGE,
  existingEmailWrongPasswordMessage,
  type UserRegisterStep,
} from "@/lib/user-signup/constants";
import {
  USER_STEP_FIELDS,
  buildE164,
  credentialsSchema,
  emailOtpSchema,
  userRegisterFormSchema,
  phoneOtpSchema,
  phoneSchema,
  privacySchema,
  profileSchemaForUser,
  guardianSchema,
  userRoleSchema,
  cgRelationshipSchema,
  diagnosisSchemaPatient,
  diagnosisSchemaSurvivor,
  addressSchema,
  type UserRegisterFormValues,
} from "@/lib/user-signup/validation";
import {
  advanceFurthestUserStep,
  clearUserSignupSessionPassword,
  loadUserDraft,
  peekUserSignupSessionPassword,
  saveUserDraft,
  stashUserSignupSessionPassword,
  stashGuardianId,
  peekGuardianId,
} from "@/lib/user-signup/storage";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { getGuardianCode, markGuardianCodeUsed } from "@/lib/aws/appsyncGuardianQueries";
import { useUserSignupStore } from "@/lib/user-signup/store";
import { defaultUserSignupService } from "@/lib/user-signup/service";
import { userFacingErrorMessage } from "@/lib/errors/userFacingMessage";
import { t } from "@/lib/i18n";
import { createStepBackResolver } from "@/lib/navigation/stepBackResolver";
import { USER_REGISTER_BACK_FALLBACK } from "@/lib/navigation/userRegisterBackTargets";
import {
  USER_FLOW_ORDER,
  clampToReachableUserStep,
} from "@/lib/navigation/userStepGate";
import { RegisterShell } from "./_components/RegisterShell";
import { StepIntro } from "./_components/StepIntro";
import { StepPrivacy } from "./_components/StepPrivacy";
import { StepProfile } from "./_components/StepProfile";
import { StepCredentials } from "./_components/StepCredentials";
import { StepEmailOtp } from "./_components/StepEmailOtp";
import { StepPhone } from "./_components/StepPhone";
import { StepVerifiedSuccessfully } from "./_components/StepVerifiedSuccessfully";
import { StepUserRole } from "./_components/StepUserRole";
import { StepCGRelationship } from "./_components/StepCGRelationship";
import { StepCGPatientAge } from "./_components/StepCGPatientAge";
import { StepDiagnosis } from "./_components/StepDiagnosis";
import { StepMedicalCenter } from "./_components/StepMedicalCenter";
import { StepAddress } from "./_components/StepAddress";
import { StepCreateProfileWelcome } from "./_components/StepCreateProfileWelcome";
import { StepProfilePic } from "./_components/StepProfilePic";
import { StepAbout } from "./_components/StepAbout";
import { StepInterests } from "./_components/StepInterests";
import { StepLanguages } from "./_components/StepLanguages";
import { StepPhotos } from "./_components/StepPhotos";
import { StepLoading } from "./_components/StepLoading";
import { StepAllSet } from "./_components/StepAllSet";
import { StepGuardian } from "./_components/StepGuardian";
import { StepGuardianOtp } from "./_components/StepGuardianOtp";
import { USER_REGISTER_STEPS } from "@/lib/user-signup/constants";

/* ── URL-routed step model ─────────────────────────────────────────────
   Step lives in `?step=<name>` (privacy = no param, since the regular-user
   flow has no separate intro screen). Mirrors the `/hosts-register` pattern;
   see that page for the full rationale around URL-as-truth + the watermark
   gate that prevents URL-edit deep links into unreached steps. */

function isUserRegisterStep(value: string | null): value is UserRegisterStep {
  return value !== null && (USER_FLOW_ORDER as readonly string[]).includes(value);
}

function stepToHref(step: UserRegisterStep): string {
  return step === "intro" ? "/register" : `/register?step=${step}`;
}

const DEFAULT_VALUES: UserRegisterFormValues = {
  privacyAccepted: false,
  firstName: "",
  lastName: "",
  birthMonth: "",
  birthYear: "",
  pronouns: "",
  guardianFullName: "",
  guardianEmail: "",
  guardianConsent: false,
  guardianConsentSupervision: false,
  guardianOtp: "",
  email: "",
  password: "",
  confirmPassword: "",
  emailOtp: "",
  phoneCountryIso2: DEFAULT_DIAL_ISO2,
  phoneNational: "",
  phoneOtp: "",
  // Phase 2
  userType: "",
  relationship: "",
  patientBirthMonth: "",
  patientBirthYear: "",
  diagnosis: "",
  treatmentStatus: "",
  treatments: "",
  inRemissionSince: "",
  disabilities: "",
  hospitals: "",
  supportOrganizations: "",
  state: "",
  city: "",
  zipcode: "",
  // Phase 3
  profilePicId: "",
  bio: "",
  cancerloss: false,
  copingWithCancerLoss: "",
  isUniversityStudent: false,
  universityId: "",
  interests: "",
  languages: "",
  galleryPhotoIds: "",
};

/** Maps StartSignup ALREADY_EXISTS → user-facing message. */
function alreadyExistsMessage(provider: "email" | "google" | "apple"): string {
  if (provider === "google") {
    return t("register.serverError.alreadyExistsGoogle");
  }
  if (provider === "apple") {
    return t("register.serverError.alreadyExistsApple");
  }
  return t("register.serverError.alreadyExistsDefault");
}

function computeAge(birthMonth: string, birthYear: string): number | null {
  if (!birthMonth || !birthYear) return null;
  const bYear = Number(birthYear);
  const bMonth = Number(birthMonth);
  if (!Number.isFinite(bYear) || !Number.isFinite(bMonth)) return null;
  const now = new Date();
  let age = now.getFullYear() - bYear;
  if (now.getMonth() + 1 < bMonth) age -= 1;
  return age;
}

function usersLambdaName(): string {
  const name = process.env.NEXT_PUBLIC_USERS_LAMBDA;
  if (!name) throw new Error("NEXT_PUBLIC_USERS_LAMBDA is not configured.");
  return name;
}

function RegisterController() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawStep = searchParams.get("step");
  /** Intro is the landing step — same pattern as `/hosts-register`. */
  const requestedStep: UserRegisterStep = isUserRegisterStep(rawStep)
    ? rawStep
    : "intro";

  /* Forward-step watermark. We subscribe so the component re-renders when
     the watermark advances, but we read synchronously via getState() for
     the actual computation to avoid a race: router.push() can trigger a
     URL re-render before the Zustand subscriber fires, causing stale-hook
     step to clamp "privacy" back to "intro" and redirect. */
  useUserSignupStore((s) => s.furthestStep); // subscribe for re-render trigger

  const step: UserRegisterStep = clampToReachableUserStep(
    requestedStep,
    useUserSignupStore.getState().furthestStep,
  );

  const methods = useForm<UserRegisterFormValues>({
    resolver: zodResolver(userRegisterFormSchema),
    mode: "onTouched",
    defaultValues: DEFAULT_VALUES,
  });

  /* In-place OTP reveal substate within the `phone` step. */
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendingPhone, setResendingPhone] = useState(false);
  const [resendingGuardian, setResendingGuardian] = useState(false);
  const [emailResendLeft, setEmailResendLeft] = useState(0);
  const [phoneResendLeft, setPhoneResendLeft] = useState(0);
  const [guardianResendLeft, setGuardianResendLeft] = useState(0);
  const [serverError, setServerErrorState] = useState<string | null>(null);
  const setServerError = useCallback((msg: string | null) => {
    setServerErrorState(msg);
    if (msg) toast.error(msg);
  }, []);
  const [privacyError, setPrivacyError] = useState<string | undefined>(undefined);
  const [emailResumeInfo, setEmailResumeInfo] = useState<string | null>(null);

  const lastAcceptedPrivacyAtRef = useRef<string>("");

  const userStepBackRef = useRef(
    createStepBackResolver<UserRegisterStep>(USER_REGISTER_BACK_FALLBACK),
  );
  const userStepBack = userStepBackRef.current;

  /* ── Hydrate text-only draft on first mount ── */
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const saved = loadUserDraft();
    if (saved) methods.reset(saved.values);
  }, [methods]);

  /* ── Persist draft on every change. */
  useEffect(() => {
    const sub = methods.watch((values) => {
      saveUserDraft(values as UserRegisterFormValues);
    });
    return () => sub.unsubscribe();
  }, [methods]);

  /* ── Resend countdowns ── */
  useEffect(() => {
    if (emailResendLeft <= 0) return;
    const id = setTimeout(() => setEmailResendLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [emailResendLeft]);

  useEffect(() => {
    if (phoneResendLeft <= 0) return;
    const id = setTimeout(() => setPhoneResendLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [phoneResendLeft]);

  useEffect(() => {
    if (guardianResendLeft <= 0) return;
    const id = setTimeout(() => setGuardianResendLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [guardianResendLeft]);

  /* ── Clear server-side credential error when user edits credentials. */
  const watchedEmail = useWatch({ control: methods.control, name: "email" });
  const watchedPassword = useWatch({ control: methods.control, name: "password" });
  const watchedConfirmPassword = useWatch({ control: methods.control, name: "confirmPassword" });
  useEffect(() => {
    setServerError(null);
  }, [watchedEmail, watchedPassword, watchedConfirmPassword, setServerError]);

  const privacyAccepted = useWatch({
    control: methods.control,
    name: "privacyAccepted",
    defaultValue: false,
  });

  /* ── Cross-cutting reset on every step change. */
  useEffect(() => {
    methods.setValue("emailOtp", "", { shouldDirty: false });
    methods.setValue("phoneOtp", "", { shouldDirty: false });
    methods.setValue("guardianOtp", "", { shouldDirty: false });
    setPhoneCodeSent(false);
    setServerError(null);
    setPrivacyError(undefined);
    if (step !== "emailOtp") {
      setEmailResumeInfo(null);
    }
  }, [step, methods, setServerError]);

  /* ── Forward-step gate: keep URL honest about the rendered step.
     Use getState() here too — same race-condition reason as above. */
  useEffect(() => {
    const clamped = clampToReachableUserStep(
      requestedStep,
      useUserSignupStore.getState().furthestStep,
    );
    if (requestedStep !== clamped) {
      router.replace(stepToHref(clamped), { scroll: false });
    }
  }, [requestedStep, router]);

  /* ── Per-step validation ── */
  const validateStep = useCallback(
    async (
      forStep:
        | "privacy"
        | "profile"
        | "guardian"
        | "guardianOtp"
        | "credentials"
        | "emailOtp"
        | "phone"
        | "phoneOtp"
        | "userRole"
        | "cgRelationship"
        | "diagnosis"
        | "address",
    ): Promise<boolean> => {
      const values = methods.getValues();
      switch (forStep) {
        case "privacy": {
          const result = privacySchema.safeParse({
            privacyAccepted: values.privacyAccepted,
          });
          if (!result.success) {
            const msg = result.error.issues[0]?.message;
            setPrivacyError(msg);
            toast.error(msg);
            return false;
          }
          setPrivacyError(undefined);
          return true;
        }
        case "profile": {
          const result = profileSchemaForUser.safeParse({
            firstName: values.firstName,
            lastName: values.lastName,
            birthMonth: values.birthMonth,
            birthYear: values.birthYear,
            pronouns: values.pronouns,
          });
          if (!result.success) {
            for (const issue of result.error.issues) {
              const path = issue.path[0] as keyof UserRegisterFormValues;
              methods.setError(path, { type: "manual", message: issue.message });
            }
            toast.error(t("register.serverError.profileFieldErrors"));
            await methods.trigger(USER_STEP_FIELDS.profile);
            return false;
          }
          methods.clearErrors(USER_STEP_FIELDS.profile);
          return true;
        }
        case "guardian": {
          const result = guardianSchema.safeParse({
            guardianFullName: values.guardianFullName,
            guardianEmail: values.guardianEmail,
            guardianConsent: values.guardianConsent,
            guardianConsentSupervision: values.guardianConsentSupervision,
          });
          if (!result.success) {
            for (const issue of result.error.issues) {
              const path = issue.path[0] as keyof UserRegisterFormValues;
              methods.setError(path, { type: "manual", message: issue.message });
            }
            toast.error(result.error.issues[0]?.message ?? t("register.serverError.somethingWrong"));
            return false;
          }
          methods.clearErrors(USER_STEP_FIELDS.guardian);
          return true;
        }
        case "guardianOtp": {
          const code = values.guardianOtp ?? "";
          if (!/^\d{6}$/.test(code)) {
            methods.setError("guardianOtp", {
              type: "manual",
              message: t("register.serverError.codeMismatch"),
            });
            return false;
          }
          methods.clearErrors("guardianOtp");
          return true;
        }
        case "credentials": {
          const result = credentialsSchema.safeParse({
            email: values.email,
            password: values.password,
            confirmPassword: values.confirmPassword,
          });
          if (!result.success) {
            for (const issue of result.error.issues) {
              const path = issue.path[0] as keyof UserRegisterFormValues;
              methods.setError(path, { type: "manual", message: issue.message });
            }
            toast.error(t("register.serverError.credentialFieldErrors"));
            return false;
          }
          methods.clearErrors(USER_STEP_FIELDS.credentials);
          return true;
        }
        case "emailOtp": {
          const result = emailOtpSchema.safeParse({ otp: values.emailOtp });
          if (!result.success) {
            const msg = result.error.issues[0]?.message;
            methods.setError("emailOtp", { type: "manual", message: msg });
            if (msg) toast.error(msg);
            return false;
          }
          methods.clearErrors("emailOtp");
          return true;
        }
        case "phone": {
          const result = phoneSchema.safeParse({
            phoneCountryIso2: values.phoneCountryIso2,
            phoneNational: values.phoneNational,
          });
          if (!result.success) {
            for (const issue of result.error.issues) {
              const path = issue.path[0] as keyof UserRegisterFormValues;
              methods.setError(path, { type: "manual", message: issue.message });
            }
            toast.error(t("register.serverError.phoneCheckAndRetry"));
            return false;
          }
          methods.clearErrors(USER_STEP_FIELDS.phone);
          return true;
        }
        case "phoneOtp": {
          const result = phoneOtpSchema.safeParse({ phoneOtp: values.phoneOtp });
          if (!result.success) {
            const msg = result.error.issues[0]?.message;
            methods.setError("phoneOtp", { type: "manual", message: msg });
            if (msg) toast.error(msg);
            return false;
          }
          methods.clearErrors("phoneOtp");
          return true;
        }
        case "userRole": {
          const result = userRoleSchema.safeParse({ userType: values.userType });
          if (!result.success) {
            toast.error(t("register.serverError.roleRequired"));
            return false;
          }
          return true;
        }
        case "cgRelationship": {
          const result = cgRelationshipSchema.safeParse({
            relationship: values.relationship,
          });
          if (!result.success) {
            toast.error(t("register.serverError.relationshipRequired"));
            return false;
          }
          return true;
        }
        case "diagnosis": {
          const role = values.userType;
          const schema =
            role === "SURVIVOR" ? diagnosisSchemaSurvivor : diagnosisSchemaPatient;
          const result = schema.safeParse({
            diagnosis: values.diagnosis,
            treatmentStatus: values.treatmentStatus,
            inRemissionSince: values.inRemissionSince,
          });
          if (!result.success) {
            toast.error(t("register.serverError.diagnosisRequired"));
            return false;
          }
          return true;
        }
        case "address": {
          const result = addressSchema.safeParse({
            state: values.state,
            city: values.city,
            zipcode: values.zipcode,
          });
          if (!result.success) {
            toast.error(t("register.serverError.addressRequired"));
            return false;
          }
          return true;
        }
      }
    },
    [methods],
  );

  const goToStep = useCallback(
    (next: UserRegisterStep) => {
      advanceFurthestUserStep(next);
      router.push(stepToHref(next), { scroll: false });
    },
    [router],
  );

  const goBackInUserFlow = useCallback(() => {
    if (
      step === "intro" ||
      step === "verifiedSuccessfully" ||
      step === "createProfile" ||
      step === "loading" ||
      step === "allSet"
    ) {
      router.push("/");
      return;
    }
    // Age-dependent back target for credentials step
    if (step === "credentials") {
      const { birthMonth, birthYear } = methods.getValues();
      const age = computeAge(birthMonth, birthYear);
      if (age !== null && age < MIN_AGE) {
        goToStep("guardianOtp");
      } else {
        goToStep("profile");
      }
      return;
    }
    // Role-dependent back target for address step
    if (step === "address") {
      const role = methods.getValues("userType");
      if (role === "CAREGIVER") {
        goToStep("cgPatientAge");
      } else {
        goToStep("medicalCenter");
      }
      return;
    }
    const target = userStepBack.resolve(step);
    if (target) goToStep(target);
  }, [step, router, goToStep, userStepBack, methods]);

  const handleStart = useCallback(() => goToStep("privacy"), [goToStep]);

  /* ── Step transitions ── */

  const handlePrivacyContinue = useCallback(async () => {
    const ok = await validateStep("privacy");
    if (ok) goToStep("profile");
  }, [validateStep, goToStep]);

  const handleProfileContinue = useCallback(async () => {
    const ok = await validateStep("profile");
    if (!ok) return;
    const { birthMonth, birthYear } = methods.getValues();
    const age = computeAge(birthMonth, birthYear);
    if (age !== null && age < MIN_AGE) {
      goToStep("guardian");
    } else {
      goToStep("credentials");
    }
  }, [validateStep, goToStep, methods]);

  const handleGuardianContinue = useCallback(async () => {
    const ok = await validateStep("guardian");
    if (!ok) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const v = methods.getValues();
      const raw = await raiseUserLambda(
        LambdaPayloadType.CREATE_GUARDIAN,
        usersLambdaName(),
        {
          guardianEmail: v.guardianEmail.trim().toLowerCase(),
          guardianFullName: v.guardianFullName.trim(),
          consent: v.guardianConsent,
          consentSupervision: v.guardianConsentSupervision,
        },
      );
      let guardianId: string;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        setServerError(t("register.serverError.guardianSaveFailed"));
        return;
      }
      if (typeof parsed === "string" && parsed.trim()) {
        guardianId = parsed.trim();
      } else if (parsed && typeof parsed === "object" && "message" in parsed) {
        setServerError((parsed as { message: string }).message || t("register.serverError.guardianSaveFailed"));
        return;
      } else {
        setServerError(t("register.serverError.guardianSaveFailed"));
        return;
      }
      stashGuardianId(guardianId);
      setGuardianResendLeft(OTP_RESEND_COOLDOWN_SEC);
      goToStep("guardianOtp");
    } catch (e) {
      setServerError(
        userFacingErrorMessage(e, t("register.serverError.guardianSaveFailed")),
      );
    } finally {
      setSubmitting(false);
    }
  }, [methods, validateStep, goToStep, setServerError]);

  const handleGuardianOtpVerify = useCallback(async () => {
    const ok = await validateStep("guardianOtp");
    if (!ok) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const v = methods.getValues();
      const guardianId = peekGuardianId();
      if (!guardianId) {
        setServerError(t("register.serverError.somethingWrong"));
        return;
      }
      const storedCode = await getGuardianCode(guardianId);
      if (storedCode === null) {
        setServerError(t("register.serverError.codeExpired"));
        return;
      }
      if (storedCode !== Number(v.guardianOtp)) {
        setServerError(t("register.serverError.guardianCodeMismatch"));
        return;
      }
      await markGuardianCodeUsed(guardianId);
      goToStep("credentials");
    } catch (e) {
      setServerError(
        userFacingErrorMessage(e, t("register.serverError.somethingWrong")),
      );
    } finally {
      setSubmitting(false);
    }
  }, [methods, validateStep, goToStep, setServerError]);

  const handleGuardianResend = useCallback(async () => {
    if (guardianResendLeft > 0) return;
    setResendingGuardian(true);
    setServerError(null);
    try {
      const v = methods.getValues();
      const raw = await raiseUserLambda(
        LambdaPayloadType.CREATE_GUARDIAN,
        usersLambdaName(),
        {
          guardianEmail: v.guardianEmail.trim().toLowerCase(),
          guardianFullName: v.guardianFullName.trim(),
          consent: v.guardianConsent,
          consentSupervision: v.guardianConsentSupervision,
        },
      );
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed === "string" && parsed.trim()) {
        stashGuardianId(parsed.trim());
      }
      methods.setValue("guardianOtp", "", { shouldDirty: false });
      setGuardianResendLeft(OTP_RESEND_COOLDOWN_SEC);
    } catch (e) {
      setServerError(
        userFacingErrorMessage(e, t("register.serverError.couldntResend")),
      );
    } finally {
      setResendingGuardian(false);
    }
  }, [methods, guardianResendLeft, setServerError]);

  const handleCredentialsContinue = useCallback(async () => {
    const ok = await validateStep("credentials");
    if (!ok) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const v = methods.getValues();
      lastAcceptedPrivacyAtRef.current = new Date().toISOString();
      const result = await defaultUserSignupService.startSignup({
        email: v.email.trim().toLowerCase(),
        password: v.password,
        profile: {
          firstName: v.firstName.trim(),
          lastName: (v.lastName ?? "").trim(),
          birthMonth: Number(v.birthMonth),
          birthYear: Number(v.birthYear),
          pronouns: (v.pronouns as string) || "",
        },
        acceptedPrivacyAt: lastAcceptedPrivacyAtRef.current,
      });
      if (result.status === "OTP_SENT") {
        setEmailResumeInfo(null);
        stashUserSignupSessionPassword(v.password);
        setEmailResendLeft(OTP_RESEND_COOLDOWN_SEC);
        goToStep("emailOtp");
      } else if (result.status === "RESUME_UNCONFIRMED") {
        setEmailResumeInfo(t("register.emailOtp.resumeHint"));
        stashUserSignupSessionPassword(v.password);
        setEmailResendLeft(OTP_RESEND_COOLDOWN_SEC);
        goToStep("emailOtp");
      } else if (result.status === "RESUME_SIGNED_IN") {
        setEmailResumeInfo(null);
        stashUserSignupSessionPassword(v.password);
        setPhoneCodeSent(false);
        if (result.resumeStep === "PHONE") {
          goToStep("phone");
        } else if (result.resumeStep === "DONE") {
          router.push("/dashboard");
        } else {
          // USER_ROLE — phone confirmed but role not yet chosen
          goToStep("userRole");
        }
      } else if (result.status === "EXISTING_EMAIL_WRONG_PASSWORD") {
        setEmailResumeInfo(null);
        setServerError(existingEmailWrongPasswordMessage());
      } else if (result.status === "ALREADY_EXISTS") {
        setEmailResumeInfo(null);
        setServerError(alreadyExistsMessage(result.provider));
      }
    } catch (e) {
      setServerError(
        userFacingErrorMessage(
          e,
          t("register.serverError.somethingWrong"),
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }, [methods, validateStep, goToStep, setServerError]);

  const handleEmailOtpSubmit = useCallback(async () => {
    const ok = await validateStep("emailOtp");
    if (!ok) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const v = methods.getValues();
      const password =
        v.password.trim() ||
        peekUserSignupSessionPassword()?.trim() ||
        "";
      if (!password) {
        setServerError(
          t("register.serverError.missingPasswordAfterRefresh"),
        );
        return;
      }
      const result = await defaultUserSignupService.confirmEmail({
        email: v.email.trim().toLowerCase(),
        code: v.emailOtp,
        password,
        acceptedPrivacyAt: lastAcceptedPrivacyAtRef.current,
        profile: {
          firstName: v.firstName.trim(),
          lastName: (v.lastName ?? "").trim(),
          birthMonth: Number(v.birthMonth),
          birthYear: Number(v.birthYear),
          pronouns: (v.pronouns as string) || "",
        },
      });
      if (result.status === "CONFIRMED") {
        clearUserSignupSessionPassword();
        setEmailResumeInfo(null);
        goToStep("phone");
      } else if (result.status === "CODE_MISMATCH") {
        setServerError(t("register.serverError.codeMismatch"));
      } else {
        setServerError(t("register.serverError.codeExpired"));
      }
    } catch (e) {
      setServerError(
        userFacingErrorMessage(
          e,
          t("register.serverError.somethingWrong"),
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }, [methods, validateStep, goToStep, setServerError]);

  const handleEmailResend = useCallback(async () => {
    if (emailResendLeft > 0) return;
    setResendingEmail(true);
    setServerError(null);
    try {
      const v = methods.getValues();
      await defaultUserSignupService.resendEmailCode({
        email: v.email.trim().toLowerCase(),
      });
      setEmailResendLeft(OTP_RESEND_COOLDOWN_SEC);
    } catch (e) {
      setServerError(
        userFacingErrorMessage(
          e,
          t("register.serverError.couldntResend"),
        ),
      );
    } finally {
      setResendingEmail(false);
    }
  }, [methods, emailResendLeft, setServerError]);

  const handlePhoneSendCode = useCallback(async () => {
    const ok = await validateStep("phone");
    if (!ok) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const v = methods.getValues();
      const e164 = buildE164(v.phoneCountryIso2, v.phoneNational);
      if (!e164) {
        setServerError(t("register.serverError.phoneInvalid"));
        return;
      }
      const result = await defaultUserSignupService.startPhoneVerification({
        phoneE164: e164,
      });
      if (result.status === "OTP_SENT") {
        methods.setValue("phoneOtp", "", { shouldDirty: false });
        setPhoneResendLeft(PHONE_OTP_RESEND_COOLDOWN_SEC);
        setPhoneCodeSent(true);
      } else if (result.status === "ALREADY_IN_USE") {
        setServerError(t("register.serverError.phoneAlreadyInUse"));
      } else {
        setServerError(t("register.serverError.phoneCheckAndRetry"));
      }
    } catch (e) {
      setServerError(
        userFacingErrorMessage(
          e,
          t("register.serverError.somethingWrong"),
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }, [methods, validateStep, setServerError]);

  const handlePhoneVerify = useCallback(async () => {
    const ok = await validateStep("phoneOtp");
    if (!ok) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const v = methods.getValues();
      const e164 = buildE164(v.phoneCountryIso2, v.phoneNational);
      if (!e164) {
        setServerError(t("register.serverError.phoneBecameInvalid"));
        return;
      }
      const result = await defaultUserSignupService.confirmPhone({
        phoneE164: e164,
        code: v.phoneOtp,
      });
      if (result.status === "CONFIRMED") {
        goToStep("verifiedSuccessfully");
      } else if (result.status === "CODE_MISMATCH") {
        setServerError(t("register.serverError.codeMismatch"));
      } else {
        setServerError(t("register.serverError.codeExpired"));
      }
    } catch (e) {
      setServerError(
        userFacingErrorMessage(
          e,
          t("register.serverError.somethingWrong"),
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }, [methods, validateStep, goToStep, setServerError]);

  const handlePhoneChange = useCallback(() => {
    setPhoneCodeSent(false);
    methods.setValue("phoneOtp", "", { shouldDirty: false });
    methods.clearErrors("phoneOtp");
    setServerError(null);
  }, [methods, setServerError]);

  const handlePhoneResend = useCallback(async () => {
    if (phoneResendLeft > 0) return;
    setResendingPhone(true);
    setServerError(null);
    try {
      const v = methods.getValues();
      const e164 = buildE164(v.phoneCountryIso2, v.phoneNational);
      if (!e164) return;
      await defaultUserSignupService.resendPhoneCode({ phoneE164: e164 });
      methods.setValue("phoneOtp", "", { shouldDirty: false });
      setPhoneResendLeft(PHONE_OTP_RESEND_COOLDOWN_SEC);
    } catch (e) {
      setServerError(
        userFacingErrorMessage(
          e,
          t("register.serverError.couldntResend"),
        ),
      );
    } finally {
      setResendingPhone(false);
    }
  }, [methods, phoneResendLeft, setServerError]);

  const handleVerifiedContinue = useCallback(() => {
    goToStep("userRole");
  }, [goToStep]);

  /* ── Phase 2 handlers ── */

  const handleUserRoleContinue = useCallback(async () => {
    const ok = await validateStep("userRole");
    if (!ok) return;
    const role = methods.getValues("userType");
    if (role === "CAREGIVER") {
      goToStep("cgRelationship");
    } else {
      goToStep("diagnosis");
    }
  }, [validateStep, methods, goToStep]);

  const handleCGRelationshipContinue = useCallback(async () => {
    const ok = await validateStep("cgRelationship");
    if (ok) goToStep("cgPatientAge");
  }, [validateStep, goToStep]);

  const handleCGPatientAgeContinue = useCallback(() => {
    goToStep("address");
  }, [goToStep]);

  const handleDiagnosisContinue = useCallback(async () => {
    const ok = await validateStep("diagnosis");
    if (ok) goToStep("medicalCenter");
  }, [validateStep, goToStep]);

  const handleMedicalCenterContinue = useCallback(() => {
    goToStep("address");
  }, [goToStep]);

  const handleAddressContinue = useCallback(async () => {
    const ok = await validateStep("address");
    if (ok) goToStep("createProfile");
  }, [validateStep, goToStep]);

  /* ── Phase 3 handlers ── */

  const handleCreateProfileContinue = useCallback(() => {
    goToStep("profilePic");
  }, [goToStep]);

  const handleProfilePicContinue = useCallback(() => {
    goToStep("about");
  }, [goToStep]);

  const handleProfilePicSkip = useCallback(() => {
    goToStep("about");
  }, [goToStep]);

  const handleAboutContinue = useCallback(async () => {
    const values = methods.getValues();
    if (!values.bio?.trim()) return;
    goToStep("interests");
  }, [methods, goToStep]);

  const handleAboutSkip = useCallback(() => {
    goToStep("interests");
  }, [goToStep]);

  const handleInterestsContinue = useCallback(() => {
    goToStep("languages");
  }, [goToStep]);

  const handleInterestsSkip = useCallback(() => {
    goToStep("languages");
  }, [goToStep]);

  const handleLanguagesContinue = useCallback(() => {
    goToStep("photos");
  }, [goToStep]);

  const handleLanguagesSkip = useCallback(() => {
    goToStep("photos");
  }, [goToStep]);

  const handlePhotosContinue = useCallback(() => {
    goToStep("loading");
  }, [goToStep]);

  const handlePhotosSkip = useCallback(() => {
    goToStep("loading");
  }, [goToStep]);

  /* ── Phase 4 handlers ── */

  const handleLoadingDone = useCallback(() => {
    goToStep("allSet");
  }, [goToStep]);

  /* ── Render ── */

  const hideProgress =
    step === "intro" ||
    step === "verifiedSuccessfully" ||
    !(USER_REGISTER_STEPS as readonly string[]).includes(step);

  return (
    <FormProvider {...methods}>
      <RegisterShell
        step={step}
        hideProgress={hideProgress}
        onFlowBack={
          step === "verifiedSuccessfully" ||
          step === "userRole" ||
          step === "createProfile" ||
          step === "loading" ||
          step === "allSet"
            ? undefined
            : goBackInUserFlow
        }
      >
        {step === "intro" ? <StepIntro onStart={handleStart} /> : null}

        {step === "privacy" ? (
          <StepPrivacy
            accepted={Boolean(privacyAccepted)}
            error={privacyError}
            onAcceptedChange={(next) =>
              methods.setValue("privacyAccepted", next, {
                shouldValidate: false,
                shouldDirty: true,
              })
            }
            onBack={goBackInUserFlow}
            onContinue={handlePrivacyContinue}
          />
        ) : null}

        {step === "profile" ? (
          <StepProfile
            onBack={goBackInUserFlow}
            onContinue={handleProfileContinue}
          />
        ) : null}

        {step === "guardian" ? (
          <StepGuardian
            submitting={submitting}
            serverError={serverError}
            onContinue={handleGuardianContinue}
            onBack={goBackInUserFlow}
          />
        ) : null}

        {step === "guardianOtp" ? (
          <StepGuardianOtp
            submitting={submitting}
            resending={resendingGuardian}
            resendSecondsLeft={guardianResendLeft}
            serverError={serverError}
            onVerify={handleGuardianOtpVerify}
            onResend={handleGuardianResend}
            onBack={goBackInUserFlow}
          />
        ) : null}

        {step === "credentials" ? (
          <StepCredentials
            submitting={submitting}
            serverError={serverError}
            onBack={goBackInUserFlow}
            onContinue={handleCredentialsContinue}
          />
        ) : null}

        {step === "emailOtp" ? (
          <StepEmailOtp
            submitting={submitting}
            resending={resendingEmail}
            resendSecondsLeft={emailResendLeft}
            serverError={serverError}
            resumeInfo={emailResumeInfo}
            onSubmit={handleEmailOtpSubmit}
            onResend={handleEmailResend}
            onChangeEmail={() => {
              clearUserSignupSessionPassword();
              setEmailResumeInfo(null);
              goToStep("credentials");
            }}
          />
        ) : null}

        {step === "phone" ? (
          <StepPhone
            codeSent={phoneCodeSent}
            submitting={submitting}
            resending={resendingPhone}
            resendSecondsLeft={phoneResendLeft}
            serverError={serverError}
            onSendCode={handlePhoneSendCode}
            onVerify={handlePhoneVerify}
            onResend={handlePhoneResend}
            onChangePhone={handlePhoneChange}
            onBack={goBackInUserFlow}
          />
        ) : null}

        {step === "verifiedSuccessfully" ? (
          <StepVerifiedSuccessfully onContinue={handleVerifiedContinue} />
        ) : null}

        {step === "userRole" ? (
          <StepUserRole onContinue={handleUserRoleContinue} />
        ) : null}

        {step === "cgRelationship" ? (
          <StepCGRelationship onContinue={handleCGRelationshipContinue} />
        ) : null}

        {step === "cgPatientAge" ? (
          <StepCGPatientAge
            onContinue={handleCGPatientAgeContinue}
            onSkip={handleCGPatientAgeContinue}
          />
        ) : null}

        {step === "diagnosis" ? (
          <StepDiagnosis
            userType={
              methods.getValues("userType") === "SURVIVOR" ? "SURVIVOR" : "PATIENT"
            }
            onContinue={handleDiagnosisContinue}
          />
        ) : null}

        {step === "medicalCenter" ? (
          <StepMedicalCenter
            onContinue={handleMedicalCenterContinue}
            onSkip={handleMedicalCenterContinue}
          />
        ) : null}

        {step === "address" ? (
          <StepAddress onContinue={handleAddressContinue} />
        ) : null}

        {step === "createProfile" ? (
          <StepCreateProfileWelcome onContinue={handleCreateProfileContinue} />
        ) : null}

        {step === "profilePic" ? (
          <StepProfilePic
            onContinue={handleProfilePicContinue}
            onSkip={handleProfilePicSkip}
          />
        ) : null}

        {step === "about" ? (
          <StepAbout
            onContinue={handleAboutContinue}
            onSkip={handleAboutSkip}
          />
        ) : null}

        {step === "interests" ? (
          <StepInterests
            onContinue={handleInterestsContinue}
            onSkip={handleInterestsSkip}
          />
        ) : null}

        {step === "languages" ? (
          <StepLanguages
            onContinue={handleLanguagesContinue}
            onSkip={handleLanguagesSkip}
          />
        ) : null}

        {step === "photos" ? (
          <StepPhotos
            onContinue={handlePhotosContinue}
            onSkip={handlePhotosSkip}
          />
        ) : null}

        {step === "loading" ? (
          <StepLoading onDone={handleLoadingDone} />
        ) : null}

        {step === "allSet" ? <StepAllSet /> : null}
      </RegisterShell>
    </FormProvider>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh w-full items-center justify-center bg-white">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-cb-gray-400 border-t-transparent" />
        </div>
      }
    >
      <RegisterController />
    </Suspense>
  );
}
