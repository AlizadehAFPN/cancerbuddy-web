"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button, ServerAlert } from "@/components/ui";
import { OtpInput } from "@/components/auth";
import { OTP_LENGTH } from "@/lib/host-signup/constants";
import type { HostRegisterFormValues } from "@/lib/host-signup/validation";

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
  /** Shown when the user is continuing an unfinished sign-up (pool user still unconfirmed). */
  resumeInfo?: string | null;
  onSubmit: () => void;
  onResend: () => void;
  onChangeEmail: () => void;
}

export function StepEmailOtp({
  submitting,
  resending,
  resendSecondsLeft,
  serverError,
  resumeInfo,
  onSubmit,
  onResend,
  onChangeEmail,
}: Props) {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<HostRegisterFormValues>();

  const email = watch("email");
  const code = watch("emailOtp") ?? "";
  const [hasSubmittedOnce, setHasSubmittedOnce] = useState(false);

  const showError = Boolean(serverError) && hasSubmittedOnce;
  const codeFieldError = errors.emailOtp?.message;

  return (
    <div className="w-full">
      <div className="mb-5 flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cb-yellow text-cb-black">
          <MailIcon />
        </span>
        <div>
          <h1
            className="font-heading font-bold text-cb-black tracking-tight"
            style={{ fontSize: "clamp(1.5rem, 2.1vw, 1.875rem)", lineHeight: 1.15 }}
          >
            Confirm your email
          </h1>
          <p className="mt-1 font-body text-[14px] text-cb-gray-500">
            We sent a {OTP_LENGTH}-digit code to {maskEmail(email)}.
          </p>
          {resumeInfo ? (
            <p
              className="mt-3 rounded-xl border border-cb-gray-200 bg-cb-gray-50 px-3 py-2 font-body text-[13px] text-cb-gray-700"
              role="status"
            >
              {resumeInfo}
            </p>
          ) : null}
        </div>
      </div>

      {showError ? (
        <ServerAlert message={serverError} className="mb-5" />
      ) : null}

      <div className="mb-2 flex justify-center sm:justify-start">
        <OtpInput
          length={OTP_LENGTH}
          value={code}
          onChange={(v) =>
            setValue("emailOtp", v, { shouldValidate: false, shouldDirty: true })
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

      <div className="mt-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 px-1 sm:px-0">
          <button
            type="button"
            onClick={onChangeEmail}
            disabled={submitting}
            className="touch-manipulation font-body text-sm font-medium text-cb-gray-600 transition-colors hover:text-cb-black disabled:opacity-40"
          >
            ← Change email
          </button>
          <button
            type="button"
            onClick={onResend}
            disabled={resending || resendSecondsLeft > 0 || submitting}
            className="touch-manipulation font-body text-sm font-medium text-cb-black underline underline-offset-2 transition-colors hover:text-cb-gray-700 disabled:cursor-not-allowed disabled:text-cb-gray-400 disabled:no-underline"
          >
            {resendSecondsLeft > 0
              ? `Resend in ${resendSecondsLeft}s`
              : "Resend code"}
          </button>
        </div>

        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code) || submitting}
          onClick={() => {
            setHasSubmittedOnce(true);
            onSubmit();
          }}
          className="touch-manipulation"
        >
          {submitting ? "Verifying…" : "Verify email"}
        </Button>
      </div>
    </div>
  );
}
