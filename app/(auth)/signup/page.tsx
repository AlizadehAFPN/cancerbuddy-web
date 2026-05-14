"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  OTP_RESEND_COOLDOWN_SEC,
  type SignupStep,
} from "@/lib/signup/constants";
import {
  STEP_FIELDS,
  type SignupFormValues,
  signupFormSchema,
  privacySchema,
  profileSchema,
  credentialsSchema,
  otpSchema,
} from "@/lib/signup/validation";
import {
  clearDraft,
  loadDraft,
  saveDraft,
} from "@/lib/signup/storage";
import { defaultSignupService } from "@/lib/signup/service";
import { createStepBackResolver } from "@/lib/navigation/stepBackResolver";
import { SIGNUP_BACK_FALLBACK } from "@/lib/navigation/signupBackTargets";
import { SignupShell } from "./_components/SignupShell";
import { StepPrivacy } from "./_components/StepPrivacy";
import { StepProfile } from "./_components/StepProfile";
import { StepCredentials } from "./_components/StepCredentials";
import { StepOtp } from "./_components/StepOtp";
import { t } from "@/lib/i18n";

const DEFAULT_VALUES: SignupFormValues = {
  privacyAccepted: false,
  firstName: "",
  lastName: "",
  birthMonth: "",
  birthYear: "",
  pronouns: "",
  email: "",
  password: "",
  confirmPassword: "",
  otp: "",
};

/** Maps StartSignup ALREADY_EXISTS → user-facing message. */
function alreadyExistsMessage(provider: "email" | "google" | "apple"): string {
  if (provider === "google") {
    return t("signup.serverError.alreadyExistsGoogle");
  }
  if (provider === "apple") {
    return t("signup.serverError.alreadyExistsApple");
  }
  return t("signup.serverError.alreadyExistsDefault");
}

export default function SignupPage() {
  const router = useRouter();

  /* react-hook-form is the single source of truth for all field values. We
     swap the resolver per step so validation error messages match the active
     step's rules — when the user clicks Continue we trigger() that step's
     fields, then advance. */
  const methods = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    mode: "onTouched",
    defaultValues: DEFAULT_VALUES,
  });

  const [step, setStep] = useState<SignupStep>("privacy");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [done, setDone] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | undefined>(undefined);

  const signupBackRef = useRef(
    createStepBackResolver<SignupStep>(SIGNUP_BACK_FALLBACK),
  );
  const signupBack = signupBackRef.current;

  /* ── Hydrate draft on mount ──────────────── */
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const saved = loadDraft();
    if (saved) {
      methods.reset(saved.values);
      const validSteps: SignupStep[] = ["privacy", "profile", "credentials", "otp"];
      if (validSteps.includes(saved.step as SignupStep)) {
        /* Don't restore the user to the OTP step — the OTP code wasn't
           persisted, and the upstream session may have expired. Restart from
           credentials so they re-trigger the email send. */
        const restored = saved.step === "otp" ? "credentials" : (saved.step as SignupStep);
        setStep(restored);
      }
    }
  }, [methods]);

  /* ── Persist draft on every value change ── */
  useEffect(() => {
    const sub = methods.watch((values) => {
      saveDraft(values as SignupFormValues, step);
    });
    return () => sub.unsubscribe();
  }, [methods, step]);

  /* ── Resend countdown ────────────────────── */
  useEffect(() => {
    if (resendSecondsLeft <= 0) return;
    const id = setTimeout(() => setResendSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendSecondsLeft]);

  /* ── Clear server-side credential error when user edits credentials ── */
  const watched = methods.watch(["email", "password", "confirmPassword"]);
  useEffect(() => {
    setServerError(null);
  }, [watched]);

  /** Validate the active step's fields against its dedicated schema (cleaner
   *  messages than the loose top-level schema), then advance. */
  const validateStep = useCallback(
    async (forStep: Exclude<SignupStep, "done">): Promise<boolean> => {
      const values = methods.getValues();
      switch (forStep) {
        case "privacy": {
          const result = privacySchema.safeParse({
            privacyAccepted: values.privacyAccepted,
          });
          if (!result.success) {
            setPrivacyError(result.error.issues[0]?.message);
            return false;
          }
          setPrivacyError(undefined);
          return true;
        }
        case "profile": {
          const result = profileSchema.safeParse({
            firstName: values.firstName,
            lastName: values.lastName,
            birthMonth: values.birthMonth,
            birthYear: values.birthYear,
            pronouns: values.pronouns,
          });
          if (!result.success) {
            for (const issue of result.error.issues) {
              const path = issue.path[0] as keyof SignupFormValues;
              methods.setError(path, { type: "manual", message: issue.message });
            }
            await methods.trigger(STEP_FIELDS.profile);
            return false;
          }
          methods.clearErrors(STEP_FIELDS.profile);
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
              const path = issue.path[0] as keyof SignupFormValues;
              methods.setError(path, { type: "manual", message: issue.message });
            }
            return false;
          }
          methods.clearErrors(STEP_FIELDS.credentials);
          return true;
        }
        case "otp": {
          const result = otpSchema.safeParse({ otp: values.otp });
          if (!result.success) {
            methods.setError("otp", {
              type: "manual",
              message: result.error.issues[0]?.message,
            });
            return false;
          }
          methods.clearErrors("otp");
          return true;
        }
      }
    },
    [methods],
  );

  const goToStep = useCallback((next: SignupStep) => {
    setServerError(null);
    setStep(next);
  }, []);

  const goBackInSignupFlow = useCallback(() => {
    if (done) {
      router.push("/");
      return;
    }
    if (step === "privacy") {
      router.push("/");
      return;
    }
    const target = signupBack.resolve(step);
    if (target) goToStep(target);
  }, [done, step, router, goToStep, signupBack]);

  const handlePrivacyContinue = useCallback(async () => {
    const ok = await validateStep("privacy");
    if (ok) goToStep("profile");
  }, [validateStep, goToStep]);

  const handleProfileContinue = useCallback(async () => {
    const ok = await validateStep("profile");
    if (ok) goToStep("credentials");
  }, [validateStep, goToStep]);

  const handleCredentialsContinue = useCallback(async () => {
    const ok = await validateStep("credentials");
    if (!ok) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const v = methods.getValues();
      const result = await defaultSignupService.startSignup({
        email: v.email.trim().toLowerCase(),
        password: v.password,
        profile: {
          firstName: v.firstName.trim(),
          lastName: (v.lastName ?? "").trim(),
          birthMonth: Number(v.birthMonth),
          birthYear: Number(v.birthYear),
          pronouns: (v.pronouns as string) || "",
        },
        acceptedPrivacyAt: new Date().toISOString(),
      });
      if (result.status === "OTP_SENT") {
        setResendSecondsLeft(OTP_RESEND_COOLDOWN_SEC);
        goToStep("otp");
      } else if (result.status === "ALREADY_EXISTS") {
        setServerError(alreadyExistsMessage(result.provider));
      }
    } catch {
      setServerError(t("signup.serverError.somethingWrong"));
    } finally {
      setSubmitting(false);
    }
  }, [methods, validateStep, goToStep]);

  const handleOtpSubmit = useCallback(async () => {
    const ok = await validateStep("otp");
    if (!ok) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const v = methods.getValues();
      const result = await defaultSignupService.confirmSignup({
        email: v.email.trim().toLowerCase(),
        code: v.otp,
      });
      if (result.status === "CONFIRMED") {
        clearDraft();
        setDone(true);
      } else if (result.status === "CODE_MISMATCH") {
        setServerError(t("signup.serverError.codeMismatch"));
      } else {
        setServerError(t("signup.serverError.codeExpired"));
      }
    } catch {
      setServerError(t("signup.serverError.somethingWrong"));
    } finally {
      setSubmitting(false);
    }
  }, [methods, validateStep]);

  const handleResend = useCallback(async () => {
    if (resendSecondsLeft > 0) return;
    setResending(true);
    setServerError(null);
    try {
      const v = methods.getValues();
      await defaultSignupService.resendCode({
        email: v.email.trim().toLowerCase(),
      });
      setResendSecondsLeft(OTP_RESEND_COOLDOWN_SEC);
    } catch {
      setServerError(t("signup.serverError.couldntResend"));
    } finally {
      setResending(false);
    }
  }, [methods, resendSecondsLeft]);

  return (
    <FormProvider {...methods}>
      <SignupShell
        step={step}
        hideProgress={done}
        onFlowBack={done ? undefined : goBackInSignupFlow}
      >
        {!done && step === "privacy" ? (
          <StepPrivacy
            accepted={methods.watch("privacyAccepted")}
            error={privacyError}
            onAcceptedChange={(next) =>
              methods.setValue("privacyAccepted", next, {
                shouldValidate: false,
                shouldDirty: true,
              })
            }
            onContinue={handlePrivacyContinue}
          />
        ) : null}

        {!done && step === "profile" ? (
          <StepProfile onBack={goBackInSignupFlow} onContinue={handleProfileContinue} />
        ) : null}

        {!done && step === "credentials" ? (
          <StepCredentials
            submitting={submitting}
            serverError={serverError}
            onBack={goBackInSignupFlow}
            onContinue={handleCredentialsContinue}
          />
        ) : null}

        {(!done && step === "otp") || done ? (
          <StepOtp
            submitting={submitting}
            resending={resending}
            resendSecondsLeft={resendSecondsLeft}
            serverError={serverError}
            done={done}
            onSubmit={handleOtpSubmit}
            onResend={handleResend}
            onChangeEmail={() => goToStep("credentials")}
          />
        ) : null}
      </SignupShell>
    </FormProvider>
  );
}
