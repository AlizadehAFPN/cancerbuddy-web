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
  existingEmailWrongPasswordMessage,
  type HostRegisterStep,
} from "@/lib/host-signup/constants";
import {
  HOST_STEP_FIELDS,
  buildE164,
  credentialsSchema,
  emailOtpSchema,
  hostRegisterFormSchema,
  phoneOtpSchema,
  phoneSchema,
  privacySchema,
  profileSchema,
  bioSchema,
  type HostRegisterFormValues,
} from "@/lib/host-signup/validation";
import {
  advanceFurthestHostStep,
  clearHostDraft,
  clearHostSignupSessionPassword,
  loadHostDraft,
  peekHostSignupSessionPassword,
  saveHostDraft,
  stashHostSignupSessionPassword,
} from "@/lib/host-signup/storage";
import { useHostSignupStore } from "@/lib/host-signup/store";
import { defaultHostSignupService } from "@/lib/host-signup/service";
import { userFacingErrorMessage } from "@/lib/errors/userFacingMessage";
import { t } from "@/lib/i18n";
import { createStepBackResolver } from "@/lib/navigation/stepBackResolver";
import { HOST_REGISTER_BACK_FALLBACK } from "@/lib/navigation/hostRegisterBackTargets";
import {
  HOST_FLOW_ORDER,
  clampToReachableHostStep,
} from "@/lib/navigation/hostStepGate";
import { HostRegisterShell } from "./_components/HostRegisterShell";
import { StepIntro } from "./_components/StepIntro";
import { StepPrivacy } from "./_components/StepPrivacy";
import { StepProfile } from "./_components/StepProfile";
import { StepCredentials } from "./_components/StepCredentials";
import { StepEmailOtp } from "./_components/StepEmailOtp";
import { StepPhone } from "./_components/StepPhone";
import { StepPhoto } from "./_components/StepPhoto";
import { StepBio } from "./_components/StepBio";
import { StepDone } from "./_components/StepDone";

/* ── URL-routed step model ─────────────────────────────────────────────
   The step lives in the URL as `?step=<name>` (intro = no param). This
   makes browser back/forward navigate between steps naturally and means
   we never have to persist the step in localStorage — which used to drift
   a step behind via a closed-over `step` value in the watch subscription. */

function isHostRegisterStep(value: string | null): value is HostRegisterStep {
  return value !== null && (HOST_FLOW_ORDER as readonly string[]).includes(value);
}

function stepToHref(step: HostRegisterStep): string {
  return step === "intro" ? "/become-a-host" : `/become-a-host?step=${step}`;
}

const DEFAULT_VALUES: HostRegisterFormValues = {
  privacyAccepted: false,
  firstName: "",
  lastName: "",
  birthMonth: "",
  birthYear: "",
  pronouns: "",
  email: "",
  password: "",
  confirmPassword: "",
  emailOtp: "",
  phoneCountryIso2: DEFAULT_DIAL_ISO2,
  phoneNational: "",
  phoneOtp: "",
  bio: "",
};

/** Maps StartSignup ALREADY_EXISTS → user-facing message. */
function alreadyExistsMessage(provider: "email" | "google" | "apple"): string {
  if (provider === "google") {
    return t("hostsRegister.serverError.alreadyExistsGoogle");
  }
  if (provider === "apple") {
    return t("hostsRegister.serverError.alreadyExistsApple");
  }
  return t("hostsRegister.serverError.alreadyExistsDefault");
}

/* ── Inner controller (reads ?step= via useSearchParams) ───────────── */

function HostsRegisterController() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawStep = searchParams.get("step");
  /** Step name as parsed from the URL — may be ahead of what the user has
   *  earned the right to see (deep-link, manual URL edit, stale bookmark). */
  const requestedStep: HostRegisterStep = isHostRegisterStep(rawStep)
    ? rawStep
    : "intro";

  /* ── Forward-step watermark ──────────────────────────────────────────
     `furthestStep` is the highest-ranked step the user has legitimately
     reached via the controller's own navigation (see `goToStep` below).
     Subscribing through `useHostSignupStore` makes this a real React
     dependency — the moment we advance the watermark, the controller
     re-renders and the gate below stops clamping. */
  const furthestStep = useHostSignupStore((s) => s.furthestStep);

  /** Effective step actually rendered on this tick. When the URL is
   *  ahead of the watermark we render the watermark instead — no flash
   *  of the unreachable step's UI — and the effect below corrects the
   *  address bar so the URL never lies about which screen the user is
   *  looking at. */
  const step: HostRegisterStep = clampToReachableHostStep(
    requestedStep,
    furthestStep,
  );

  /* react-hook-form is the single source of truth for textual fields. Photo
     lives in component state because File objects can't be persisted nor do
     they fit RHF's value contract cleanly. */
  const methods = useForm<HostRegisterFormValues>({
    resolver: zodResolver(hostRegisterFormSchema),
    mode: "onTouched",
    defaultValues: DEFAULT_VALUES,
  });

  /** In-place OTP reveal substate within the `phone` step. */
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendingPhone, setResendingPhone] = useState(false);
  const [emailResendLeft, setEmailResendLeft] = useState(0);
  const [phoneResendLeft, setPhoneResendLeft] = useState(0);
  const [serverError, setServerErrorState] = useState<string | null>(null);
  const setServerError = useCallback((msg: string | null) => {
    setServerErrorState(msg);
    if (msg) toast.error(msg);
  }, []);
  const [privacyError, setPrivacyError] = useState<string | undefined>(undefined);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [registrationDone, setRegistrationDone] = useState(false);
  const [buddyId, setBuddyId] = useState<string | null>(null);
  const [emailResumeInfo, setEmailResumeInfo] = useState<string | null>(null);

  /* ── Hydrate text-only draft on first mount ──────────────── */
  /** Timestamp captured when the user passes credentials (mirrors mobile `terms`). */
  const lastAcceptedPrivacyAtRef = useRef<string>("");

  const hostStepBackRef = useRef(
    createStepBackResolver<HostRegisterStep>(HOST_REGISTER_BACK_FALLBACK),
  );
  const hostStepBack = hostStepBackRef.current;

  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const saved = loadHostDraft();
    if (saved) methods.reset(saved.values);
  }, [methods]);

  /* ── Persist form-values draft on every change.
     The subscription doesn't close over `step` any more — the URL owns it,
     so the off-by-one drift that caused the back-to-step-5 bug is gone. */
  useEffect(() => {
    const sub = methods.watch((values) => {
      saveHostDraft(values as HostRegisterFormValues);
    });
    return () => sub.unsubscribe();
  }, [methods]);

  /* ── Resend countdowns ─────────────────────── */
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

  /* ── Clear server-side credential error when user edits credentials.
     `useWatch` is the React-19-safe way to subscribe to RHF values from
     the controller — `methods.watch([...])` inline in render is not a
     guaranteed subscription in concurrent rendering. */
  const watchedEmail = useWatch({ control: methods.control, name: "email" });
  const watchedPassword = useWatch({ control: methods.control, name: "password" });
  const watchedConfirmPassword = useWatch({ control: methods.control, name: "confirmPassword" });
  useEffect(() => {
    setServerError(null);
  }, [watchedEmail, watchedPassword, watchedConfirmPassword, setServerError]);

  /* `privacyAccepted` is consumed both for the checkbox UI and the
     Continue button's disabled state on the privacy step. Subscribing via
     `useWatch` guarantees the controller re-renders the privacy step
     immediately when the value flips — the previous `methods.watch(name)`
     call inside JSX could miss a tick on Android Chrome, leaving Continue
     stuck disabled even after the user checked the box. */
  const privacyAccepted = useWatch({
    control: methods.control,
    name: "privacyAccepted",
    defaultValue: false,
  });

  /* ── Cross-cutting reset on every step change.
     Fires whether the transition came from goToStep, in-page Back, or the
     browser back/forward buttons — clears OTP fields so stale codes never
     carry across steps. */
  useEffect(() => {
    methods.setValue("emailOtp", "", { shouldDirty: false });
    methods.setValue("phoneOtp", "", { shouldDirty: false });
    setPhoneCodeSent(false);
    setServerError(null);
    setPrivacyError(undefined);
    setPhotoError(null);
    if (step !== "emailOtp") {
      setEmailResumeInfo(null);
    }
  }, [step, methods, setServerError]);

  /* ── "done" needs a completed submit — without it, send the user home. ── */
  useEffect(() => {
    if (step === "done" && !registrationDone) {
      router.replace(stepToHref("intro"), { scroll: false });
    }
  }, [step, registrationDone, router]);

  /* ── Forward-step gate: keep URL honest about which step is rendered.
     `step` was already clamped to `furthestStep` during render, so the
     UI is safe; this effect just rewrites the address bar so the URL
     matches the screen the user is on. We use `router.replace` (not
     `push`) so the bogus URL never goes into history — pressing Back
     from a deep-linked attempt should land where the user *was*, not
     loop them through the clamped step. */
  useEffect(() => {
    if (requestedStep !== step) {
      router.replace(stepToHref(step), { scroll: false });
    }
  }, [requestedStep, step, router]);

  /* ── Per-step validation ───────────────────── */
  const validateStep = useCallback(
    async (
      forStep:
        | "privacy"
        | "profile"
        | "credentials"
        | "emailOtp"
        | "phone"
        | "phoneOtp"
        | "photo"
        | "bio",
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
          const result = profileSchema.safeParse({
            firstName: values.firstName,
            lastName: values.lastName,
            birthMonth: values.birthMonth,
            birthYear: values.birthYear,
            pronouns: values.pronouns,
          });
          if (!result.success) {
            for (const issue of result.error.issues) {
              const path = issue.path[0] as keyof HostRegisterFormValues;
              methods.setError(path, { type: "manual", message: issue.message });
            }
            toast.error(t("hostsRegister.serverError.profileFieldErrors"));
            await methods.trigger(HOST_STEP_FIELDS.profile);
            return false;
          }
          methods.clearErrors(HOST_STEP_FIELDS.profile);
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
              const path = issue.path[0] as keyof HostRegisterFormValues;
              methods.setError(path, { type: "manual", message: issue.message });
            }
            toast.error(t("hostsRegister.serverError.credentialFieldErrors"));
            return false;
          }
          methods.clearErrors(HOST_STEP_FIELDS.credentials);
          return true;
        }
        case "emailOtp": {
          const result = emailOtpSchema.safeParse({ otp: values.emailOtp });
          if (!result.success) {
            const msg = result.error.issues[0]?.message;
            methods.setError("emailOtp", {
              type: "manual",
              message: msg,
            });
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
              const path = issue.path[0] as keyof HostRegisterFormValues;
              methods.setError(path, { type: "manual", message: issue.message });
            }
            toast.error(t("hostsRegister.serverError.phoneCheckAndRetry"));
            return false;
          }
          methods.clearErrors(HOST_STEP_FIELDS.phone);
          return true;
        }
        case "phoneOtp": {
          const result = phoneOtpSchema.safeParse({ phoneOtp: values.phoneOtp });
          if (!result.success) {
            const msg = result.error.issues[0]?.message;
            methods.setError("phoneOtp", {
              type: "manual",
              message: msg,
            });
            if (msg) toast.error(msg);
            return false;
          }
          methods.clearErrors("phoneOtp");
          return true;
        }
        case "photo": {
          if (!photo) {
            const msg = t("hostsRegister.photo.continueDisabledTitle");
            setPhotoError(msg);
            toast.error(msg);
            return false;
          }
          setPhotoError(null);
          return true;
        }
        case "bio": {
          const result = bioSchema.safeParse({ bio: values.bio });
          if (!result.success) {
            const msg = result.error.issues[0]?.message;
            methods.setError("bio", {
              type: "manual",
              message: msg,
            });
            if (msg) toast.error(msg);
            return false;
          }
          methods.clearErrors("bio");
          return true;
        }
      }
    },
    [methods, photo],
  );

  /** Push the URL to the target step. The step-change effect above handles
   *  the OTP/error clean-up; everything else just navigates. */
  const goToStep = useCallback(
    (next: HostRegisterStep) => {
      /* Forward navigations are how the user *earns* access to a step,
         so this is the one and only place the watermark advances. The
         action is monotonic (it never lowers the watermark), so calling
         this for a Back navigation is harmless. */
      advanceFurthestHostStep(next);
      router.push(stepToHref(next), { scroll: false });
    },
    [router],
  );

  /** In-flow Back (header + step footers): previous wizard screen, including resume shortcuts. */
  const goBackInHostFlow = useCallback(() => {
    if (step === "intro" || step === "done") {
      router.push("/");
      return;
    }
    const target = hostStepBack.resolve(step);
    if (target) goToStep(target);
  }, [step, router, goToStep, hostStepBack]);

  /* ── Step transitions ──────────────────────── */

  const handleStart = useCallback(() => goToStep("privacy"), [goToStep]);

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
      lastAcceptedPrivacyAtRef.current = new Date().toISOString();
      const result = await defaultHostSignupService.startSignup({
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
        hostStepBack.clearOverride("photo");
        stashHostSignupSessionPassword(v.password);
        setEmailResendLeft(OTP_RESEND_COOLDOWN_SEC);
        goToStep("emailOtp");
      } else if (result.status === "RESUME_UNCONFIRMED") {
        setEmailResumeInfo(t("hostsRegister.emailOtp.resumeHint"));
        hostStepBack.clearOverride("photo");
        stashHostSignupSessionPassword(v.password);
        setEmailResendLeft(OTP_RESEND_COOLDOWN_SEC);
        goToStep("emailOtp");
      } else if (result.status === "RESUME_SIGNED_IN") {
        setEmailResumeInfo(null);
        stashHostSignupSessionPassword(v.password);
        setPhoneCodeSent(false);
        if (result.resumeStep === "DONE") {
          hostStepBack.clearOverride("photo");
          setBuddyId(result.buddyId ?? null);
          setRegistrationDone(true);
          goToStep("done");
        } else {
          if (result.resumeStep === "PHOTO") {
            hostStepBack.setOverride("photo", "credentials");
          } else {
            hostStepBack.clearOverride("photo");
          }
          goToStep(result.resumeStep === "PHOTO" ? "photo" : "phone");
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
          t("hostsRegister.serverError.somethingWrong"),
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }, [methods, validateStep, goToStep, hostStepBack, setServerError]);

  const handleEmailOtpSubmit = useCallback(async () => {
    const ok = await validateStep("emailOtp");
    if (!ok) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const v = methods.getValues();
      const password =
        v.password.trim() ||
        peekHostSignupSessionPassword()?.trim() ||
        "";
      if (!password) {
        setServerError(
          t("hostsRegister.serverError.missingPasswordAfterRefresh"),
        );
        return;
      }
      const result = await defaultHostSignupService.confirmEmail({
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
        clearHostSignupSessionPassword();
        setEmailResumeInfo(null);
        hostStepBack.clearOverride("photo");
        goToStep("phone");
      } else if (result.status === "CODE_MISMATCH") {
        setServerError(t("hostsRegister.serverError.codeMismatch"));
      } else {
        setServerError(t("hostsRegister.serverError.codeExpired"));
      }
    } catch (e) {
      setServerError(
        userFacingErrorMessage(
          e,
          t("hostsRegister.serverError.somethingWrong"),
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }, [methods, validateStep, goToStep, hostStepBack, setServerError]);

  const handleEmailResend = useCallback(async () => {
    if (emailResendLeft > 0) return;
    setResendingEmail(true);
    setServerError(null);
    try {
      const v = methods.getValues();
      await defaultHostSignupService.resendEmailCode({
        email: v.email.trim().toLowerCase(),
      });
      setEmailResendLeft(OTP_RESEND_COOLDOWN_SEC);
    } catch (e) {
      setServerError(
        userFacingErrorMessage(
          e,
          t("hostsRegister.serverError.couldntResend"),
        ),
      );
    } finally {
      setResendingEmail(false);
    }
  }, [methods, emailResendLeft, setServerError]);

  /** Phone step: action 1 — send the SMS code. Reveals the in-place OTP block. */
  const handlePhoneSendCode = useCallback(async () => {
    const ok = await validateStep("phone");
    if (!ok) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const v = methods.getValues();
      const e164 = buildE164(v.phoneCountryIso2, v.phoneNational);
      if (!e164) {
        setServerError(t("hostsRegister.serverError.phoneInvalid"));
        return;
      }
      const result = await defaultHostSignupService.startPhoneVerification({
        phoneE164: e164,
      });
      if (result.status === "OTP_SENT") {
        methods.setValue("phoneOtp", "", { shouldDirty: false });
        setPhoneResendLeft(PHONE_OTP_RESEND_COOLDOWN_SEC);
        setPhoneCodeSent(true);
      } else if (result.status === "ALREADY_IN_USE") {
        setServerError(t("hostsRegister.serverError.phoneAlreadyInUse"));
      } else {
        setServerError(t("hostsRegister.serverError.phoneCheckAndRetry"));
      }
    } catch (e) {
      setServerError(
        userFacingErrorMessage(
          e,
          t("hostsRegister.serverError.somethingWrong"),
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }, [methods, validateStep, setServerError]);

  /** Phone step: action 2 — verify the OTP and advance to photo. */
  const handlePhoneVerify = useCallback(async () => {
    const ok = await validateStep("phoneOtp");
    if (!ok) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const v = methods.getValues();
      const e164 = buildE164(v.phoneCountryIso2, v.phoneNational);
      if (!e164) {
        setServerError(t("hostsRegister.serverError.phoneBecameInvalid"));
        return;
      }
      const result = await defaultHostSignupService.confirmPhone({
        phoneE164: e164,
        code: v.phoneOtp,
      });
      if (result.status === "CONFIRMED") {
        hostStepBack.clearOverride("photo");
        goToStep("photo");
      } else if (result.status === "CODE_MISMATCH") {
        setServerError(t("hostsRegister.serverError.codeMismatch"));
      } else {
        setServerError(t("hostsRegister.serverError.codeExpired"));
      }
    } catch (e) {
      setServerError(
        userFacingErrorMessage(
          e,
          t("hostsRegister.serverError.somethingWrong"),
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }, [methods, validateStep, goToStep, hostStepBack, setServerError]);

  const handlePhoneChange = useCallback(() => {
    /* In-step interaction — not a URL navigation. Collapse the OTP block. */
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
      await defaultHostSignupService.resendPhoneCode({ phoneE164: e164 });
      methods.setValue("phoneOtp", "", { shouldDirty: false });
      setPhoneResendLeft(PHONE_OTP_RESEND_COOLDOWN_SEC);
    } catch (e) {
      setServerError(
        userFacingErrorMessage(
          e,
          t("hostsRegister.serverError.couldntResend"),
        ),
      );
    } finally {
      setResendingPhone(false);
    }
  }, [methods, phoneResendLeft, setServerError]);

  const handlePhotoContinue = useCallback(async () => {
    const ok = await validateStep("photo");
    if (ok) goToStep("bio");
  }, [validateStep, goToStep]);

  const handleApply = useCallback(async () => {
    const ok = await validateStep("bio");
    if (!ok) return;
    if (!photo) {
      setPhotoError(t("hostsRegister.serverError.photoMissingForApply"));
      hostStepBack.clearOverride("photo");
      goToStep("photo");
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      const v = methods.getValues();
      const result = await defaultHostSignupService.submitApplication({
        photo,
        bio: v.bio.trim(),
        firstName: v.firstName.trim(),
      });
      if (result.status === "SUBMITTED") {
        clearHostDraft();
        setBuddyId(result.buddyId);
        setRegistrationDone(true);
        goToStep("done");
      } else {
        setServerError(result.reason);
      }
    } catch (e) {
      setServerError(
        userFacingErrorMessage(
          e,
          t("hostsRegister.serverError.applyFailed"),
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }, [methods, validateStep, photo, goToStep, hostStepBack, setServerError]);

  /* ── Render ────────────────────────────────── */

  const hideProgress = step === "intro" || step === "done";

  return (
    <FormProvider {...methods}>
      <HostRegisterShell
        step={step}
        hideProgress={hideProgress}
        onFlowBack={goBackInHostFlow}
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
            onBack={goBackInHostFlow}
            onContinue={handlePrivacyContinue}
          />
        ) : null}

        {step === "profile" ? (
          <StepProfile
            onBack={goBackInHostFlow}
            onContinue={handleProfileContinue}
          />
        ) : null}

        {step === "credentials" ? (
          <StepCredentials
            submitting={submitting}
            serverError={serverError}
            onBack={goBackInHostFlow}
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
              clearHostSignupSessionPassword();
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
            /* Skip the already-verified email OTP on back. */
            onBack={goBackInHostFlow}
          />
        ) : null}

        {step === "photo" ? (
          <StepPhoto
            photo={photo}
            onPhotoChange={(f) => {
              setPhoto(f);
              setPhotoError(null);
            }}
            error={photoError}
            submitting={submitting}
            onBack={goBackInHostFlow}
            onContinue={handlePhotoContinue}
          />
        ) : null}

        {step === "bio" ? (
          <StepBio
            submitting={submitting}
            serverError={serverError}
            onBack={goBackInHostFlow}
            onApply={handleApply}
          />
        ) : null}

        {step === "done" && registrationDone ? (
          <StepDone buddyId={buddyId} />
        ) : null}
      </HostRegisterShell>
    </FormProvider>
  );
}

/* ── Page wrapper ────────────────────────────────────────────────────
   useSearchParams forces a Suspense boundary in Next 16's App Router,
   so HostsRegisterController is wrapped here. The fallback matches the
   shell background so there's no flash before hydration. */

export default function HostsRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh w-full items-center justify-center bg-white">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-cb-gray-400 border-t-transparent" />
        </div>
      }
    >
      <HostsRegisterController />
    </Suspense>
  );
}
