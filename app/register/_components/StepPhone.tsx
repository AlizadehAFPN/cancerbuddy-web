"use client";

import { useFormContext } from "react-hook-form";
import { Button, ServerAlert } from "@/components/ui";
import { OtpInput, PhoneInput } from "@/components/auth";
import {
  PHONE_OTP_LENGTH,
  getCountryByIso2,
} from "@/lib/user-signup/constants";
import type { UserRegisterFormValues } from "@/lib/user-signup/validation";
import { t } from "@/lib/i18n";

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function maskPhone(dial: string, national: string): string {
  const digits = national.replace(/\D/g, "");
  if (digits.length === 0) return dial;
  if (digits.length <= 2) return `${dial} ${digits}`;
  const dots = "•".repeat(Math.max(2, digits.length - 2));
  return `${dial} ${dots}${digits.slice(-2)}`;
}

interface Props {
  codeSent: boolean;
  submitting: boolean;
  resending: boolean;
  resendSecondsLeft: number;
  serverError: string | null;
  onSendCode: () => void;
  onVerify: () => void;
  onResend: () => void;
  onChangePhone: () => void;
  onBack: () => void;
}

/**
 * Combined phone + OTP step. Renders a single screen where the OTP block
 * appears in-place after the user clicks "Send code". Mirrors the host
 * `StepPhone` — both flows share the Twilio Verify Lambda + AppSync
 * `UPDATE_USER_PHONE` pipeline (`startPhoneVerification` /
 * `confirmPhone` in the user-signup service).
 */
export function StepPhone({
  codeSent,
  submitting,
  resending,
  resendSecondsLeft,
  serverError,
  onSendCode,
  onVerify,
  onResend,
  onChangePhone,
  onBack,
}: Props) {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<UserRegisterFormValues>();

  const countryIso2 = watch("phoneCountryIso2") ?? "US";
  const national = watch("phoneNational") ?? "";
  const code = watch("phoneOtp") ?? "";
  const country = getCountryByIso2(countryIso2);

  const nationalDigits = national.replace(/\D/g, "");
  const canSendCode =
    Boolean(country) && nationalDigits.length >= 4 && !submitting;

  const fieldError =
    errors.phoneNational?.message ?? errors.phoneCountryIso2?.message;
  const codeFieldError = errors.phoneOtp?.message;

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.5rem, 2.1vw, 1.875rem)", lineHeight: 1.15 }}
        >
          {t("register.phone.heading")}
        </h1>
        <p className="mt-1 font-body text-[14px] text-cb-gray-500">
          {t("register.phone.sub")}
        </p>
      </div>

      {serverError ? (
        <ServerAlert message={serverError} className="mb-4" />
      ) : null}

      <PhoneInput
        label={t("register.phone.phoneInputLabel")}
        countryIso2={countryIso2}
        national={national}
        onCountryChange={(iso2) =>
          setValue("phoneCountryIso2", iso2, {
            shouldValidate: false,
            shouldDirty: true,
          })
        }
        onNationalChange={(value) => {
          if (codeSent) onChangePhone();
          setValue("phoneNational", value, {
            shouldValidate: false,
            shouldDirty: true,
          });
        }}
        error={fieldError}
        autoFocus={!codeSent}
        className="!mb-3"
      />

      <div
        aria-live="polite"
        className={[
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          codeSent ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        ].join(" ")}
      >
        <div className="overflow-hidden">
          <div className="rounded-2xl border border-cb-gray-200/80 bg-cb-gray-100/40 p-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-body text-[12.5px] text-cb-gray-600">
                {t("register.phone.codePromptLead", { length: PHONE_OTP_LENGTH })}{" "}
                <span className="font-medium text-cb-black">
                  {maskPhone(country?.dial ?? "+", national)}
                </span>
                .
              </p>
              <button
                type="button"
                onClick={onResend}
                disabled={resending || resendSecondsLeft > 0 || submitting}
                className="shrink-0 touch-manipulation font-body text-[12.5px] font-medium text-cb-black underline underline-offset-2 transition-colors hover:text-cb-gray-700 disabled:cursor-not-allowed disabled:text-cb-gray-400 disabled:no-underline"
              >
                {resendSecondsLeft > 0
                  ? t("register.phone.resendIn", { seconds: resendSecondsLeft })
                  : t("register.phone.resend")}
              </button>
            </div>

            <div className="mt-3 flex justify-center sm:justify-start">
              <OtpInput
                length={PHONE_OTP_LENGTH}
                value={code}
                onChange={(v) =>
                  setValue("phoneOtp", v, {
                    shouldValidate: false,
                    shouldDirty: true,
                  })
                }
                disabled={submitting}
                hasError={Boolean(codeFieldError)}
                autoFocus={codeSent}
              />
            </div>

            {codeFieldError ? (
              <p
                role="alert"
                className="mt-2 font-body text-[13px] text-cb-danger"
              >
                {codeFieldError}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={onBack}
          disabled={submitting}
          className="touch-manipulation"
        >
          {t("common.back")}
        </Button>
        {codeSent ? (
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={
              !new RegExp(`^\\d{${PHONE_OTP_LENGTH}}$`).test(code) || submitting
            }
            onClick={onVerify}
            className="touch-manipulation"
          >
            <CheckIcon className="h-4 w-4" />
            {submitting
              ? t("register.phone.verifying")
              : t("register.phone.verify")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={!canSendCode}
            onClick={onSendCode}
            className="touch-manipulation"
          >
            {t("register.phone.sendCode")}
          </Button>
        )}
      </div>
    </div>
  );
}
