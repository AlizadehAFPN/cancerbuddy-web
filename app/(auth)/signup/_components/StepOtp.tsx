"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import Link from "next/link";
import { Button } from "@/components/ui";
import { OtpInput } from "@/components/auth";
import { OTP_LENGTH } from "@/lib/signup/constants";
import type { SignupFormValues } from "@/lib/signup/validation";
import { t } from "@/lib/i18n";

/* ── Inline icons ── */

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-7 h-7"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 1) return `${local}@${domain}`;
  const middle = "•".repeat(Math.max(2, local.length - 2));
  return `${local[0]}${middle}${local.slice(-1)}@${domain}`;
}

interface Props {
  submitting: boolean;
  resending: boolean;
  resendSecondsLeft: number;
  serverError: string | null;
  done: boolean;
  onSubmit: () => void;
  onResend: () => void;
  onChangeEmail: () => void;
}

export function StepOtp({
  submitting,
  resending,
  resendSecondsLeft,
  serverError,
  done,
  onSubmit,
  onResend,
  onChangeEmail,
}: Props) {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<SignupFormValues>();

  const email = watch("email");
  const code = watch("otp") ?? "";
  const [hasSubmittedOnce, setHasSubmittedOnce] = useState(false);

  /* Auto-submit when 6 digits entered (debounced so paste lands cleanly). */
  const autoSubmit = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (autoSubmit.current) {
      clearTimeout(autoSubmit.current);
      autoSubmit.current = null;
    }
    const isComplete = /^\d{6}$/.test(code);
    if (!isComplete || submitting || done) return;
    autoSubmit.current = setTimeout(() => {
      setHasSubmittedOnce(true);
      onSubmit();
    }, 300);
    return () => {
      if (autoSubmit.current) clearTimeout(autoSubmit.current);
    };
  }, [code, submitting, done, onSubmit]);

  if (done) {
    return (
      <div className="text-center">
        <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cb-success/15 text-cb-success">
          <CheckIcon />
        </div>
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.75rem, 2.4vw, 2.25rem)", lineHeight: 1.15 }}
        >
          {t("signup.otp.doneHeading")}
        </h1>
        <p className="mx-auto mt-2 max-w-[36ch] font-body text-cb-gray-500">
          {t("signup.otp.doneSub")}
        </p>
        <Link href="/login" className="mt-7 inline-block w-full">
          <Button type="button" variant="primary" size="lg" fullWidth>
            {t("signup.otp.doneCta")}
          </Button>
        </Link>
      </div>
    );
  }

  const showError = Boolean(serverError) && hasSubmittedOnce;
  const codeFieldError = errors.otp?.message;

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cb-yellow text-cb-black">
          <MailIcon />
        </span>
        <div>
          <h1
            className="font-heading font-bold text-cb-black tracking-tight"
            style={{ fontSize: "clamp(1.6rem, 2.2vw, 2rem)", lineHeight: 1.15 }}
          >
            {t("signup.otp.heading")}
          </h1>
          <p className="mt-1 font-body text-cb-gray-500">
            {t("signup.otp.sub", {
              length: OTP_LENGTH,
              email: maskEmail(email),
            })}
          </p>
        </div>
      </div>

      {showError ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-cb-danger/20 bg-cb-danger/10 px-4 py-3 font-body text-sm text-cb-danger"
        >
          {serverError}
        </div>
      ) : null}

      <div className="mb-2 flex justify-center sm:justify-start">
        <OtpInput
          length={OTP_LENGTH}
          value={code}
          onChange={(v) =>
            setValue("otp", v, { shouldValidate: false, shouldDirty: true })
          }
          disabled={submitting}
          hasError={showError || Boolean(codeFieldError && hasSubmittedOnce)}
          autoFocus
        />
      </div>
      {codeFieldError && hasSubmittedOnce ? (
        <p role="alert" className="mt-1 mb-3 font-body text-sm text-cb-danger">
          {codeFieldError}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onChangeEmail}
          disabled={submitting}
          className="font-body text-sm font-medium text-cb-gray-600 transition-colors hover:text-cb-black disabled:opacity-40"
        >
          {t("signup.otp.changeEmail")}
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={resending || resendSecondsLeft > 0 || submitting}
          className="font-body text-sm font-medium text-cb-black underline underline-offset-2 transition-colors hover:text-cb-gray-700 disabled:cursor-not-allowed disabled:text-cb-gray-400 disabled:no-underline"
        >
          {resendSecondsLeft > 0
            ? t("signup.otp.resendIn", { seconds: resendSecondsLeft })
            : t("signup.otp.resendCode")}
        </button>
      </div>

      <Button
        type="button"
        variant="primary"
        size="lg"
        fullWidth
        loading={submitting}
        disabled={!/^\d{6}$/.test(code) || submitting}
        onClick={() => {
          setHasSubmittedOnce(true);
          onSubmit();
        }}
        className="mt-6"
      >
        {submitting ? t("signup.otp.submitting") : t("signup.otp.submit")}
      </Button>
    </div>
  );
}
