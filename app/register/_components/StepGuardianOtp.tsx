"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button, ServerAlert } from "@/components/ui";
import { OtpInput } from "@/components/auth";
import { OTP_LENGTH } from "@/lib/user-signup/constants";
import type { UserRegisterFormValues } from "@/lib/user-signup/validation";
import { t } from "@/lib/i18n";

interface Props {
  submitting: boolean;
  resending: boolean;
  resendSecondsLeft: number;
  serverError: string | null;
  onVerify: () => void;
  onResend: () => void;
  onBack: () => void;
}

export function StepGuardianOtp({
  submitting,
  resending,
  resendSecondsLeft,
  serverError,
  onVerify,
  onResend,
  onBack,
}: Props) {
  const { watch, setValue, formState: { errors } } = useFormContext<UserRegisterFormValues>();

  const guardianEmail = watch("guardianEmail") ?? "";
  const code = watch("guardianOtp") ?? "";
  const [hasSubmittedOnce, setHasSubmittedOnce] = useState(false);

  const showError = Boolean(serverError) && hasSubmittedOnce;
  const codeFieldError = errors.guardianOtp?.message;

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.5rem, 2.1vw, 1.875rem)", lineHeight: 1.15 }}
        >
          {t("register.guardianOtp.heading")}
        </h1>
        <p className="mt-1 font-body text-[14px] text-cb-gray-500">
          {t("register.guardianOtp.sub", {
            length: OTP_LENGTH,
            email: guardianEmail,
          })}
        </p>
      </div>

      {showError ? (
        <ServerAlert message={serverError} className="mb-5" />
      ) : null}

      <div className="mb-2 flex justify-center sm:justify-start">
        <OtpInput
          length={OTP_LENGTH}
          value={code}
          onChange={(v) =>
            setValue("guardianOtp", v, { shouldValidate: false, shouldDirty: true })
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
        <div className="flex items-center justify-end gap-3 px-1 sm:px-0">
          <button
            type="button"
            onClick={onResend}
            disabled={resending || resendSecondsLeft > 0 || submitting}
            className="touch-manipulation font-body text-sm font-medium text-cb-black underline underline-offset-2 transition-colors hover:text-cb-gray-700 disabled:cursor-not-allowed disabled:text-cb-gray-400 disabled:no-underline"
          >
            {resendSecondsLeft > 0
              ? t("register.guardianOtp.resendIn", { seconds: resendSecondsLeft })
              : t("register.guardianOtp.resendCode")}
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
            onVerify();
          }}
          className="touch-manipulation"
        >
          {submitting
            ? t("register.guardianOtp.verifying")
            : t("register.guardianOtp.verify")}
        </Button>

        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="touch-manipulation font-body text-sm font-medium text-cb-gray-600 transition-colors hover:text-cb-black disabled:opacity-40"
        >
          {t("common.back")}
        </button>
      </div>
    </div>
  );
}
