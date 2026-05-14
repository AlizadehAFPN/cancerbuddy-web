"use client";

import { useFormContext } from "react-hook-form";
import { Button, Input } from "@/components/ui";
import { PasswordStrengthMeter } from "@/components/auth";
import type { SignupFormValues } from "@/lib/signup/validation";
import { t } from "@/lib/i18n";

/* ── Inline icons ── */

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

interface Props {
  submitting: boolean;
  serverError: string | null;
  onBack: () => void;
  onContinue: () => void;
}

export function StepCredentials({
  submitting,
  serverError,
  onBack,
  onContinue,
}: Props) {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<SignupFormValues>();

  const email = watch("email") ?? "";
  const password = watch("password") ?? "";
  const confirmPassword = watch("confirmPassword") ?? "";

  /* All three fields must have a value before Continue is enabled. Full
     validation (format, strength, match) still runs on click. */
  const canContinue =
    email.trim() !== "" && password !== "" && confirmPassword !== "";

  return (
    <div>
      <div className="mb-8">
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.6rem, 2.2vw, 2rem)", lineHeight: 1.15 }}
        >
          {t("signup.credentials.heading")}
        </h1>
        <p className="mt-1 font-body text-cb-gray-500">
          {t("signup.credentials.sub")}
        </p>
      </div>

      {serverError ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-cb-danger/20 bg-cb-danger/10 px-4 py-3 font-body text-sm text-cb-danger"
        >
          {serverError}
        </div>
      ) : null}

      <Input
        label={t("signup.credentials.emailLabel")}
        placeholder={t("signup.credentials.emailPlaceholder")}
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus
        leftIcon={<MailIcon />}
        hint={!errors.email ? t("signup.credentials.emailHint") : undefined}
        error={errors.email?.message}
        {...register("email")}
      />

      <Input
        label={t("signup.credentials.passwordLabel")}
        placeholder={t("signup.credentials.passwordPlaceholder")}
        type="password"
        autoComplete="new-password"
        leftIcon={<LockIcon />}
        error={errors.password?.message}
        {...register("password")}
      />
      <div className="-mt-3 mb-5">
        <PasswordStrengthMeter value={password} />
      </div>

      <Input
        label={t("signup.credentials.confirmPasswordLabel")}
        placeholder={t("signup.credentials.confirmPasswordPlaceholder")}
        type="password"
        autoComplete="new-password"
        leftIcon={<LockIcon />}
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      <div className="mt-2 flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={onBack}
          disabled={submitting}
        >
          {t("common.back")}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!canContinue || submitting}
          title={
            !canContinue
              ? t("signup.credentials.continueDisabledTitle")
              : undefined
          }
          onClick={onContinue}
        >
          {t("common.continue")}
        </Button>
      </div>
    </div>
  );
}
