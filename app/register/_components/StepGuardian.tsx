"use client";

import { useFormContext } from "react-hook-form";
import { Button, Input } from "@/components/ui";
import type { UserRegisterFormValues } from "@/lib/user-signup/validation";
import { t } from "@/lib/i18n";

interface Props {
  submitting: boolean;
  serverError: string | null;
  onContinue: () => void;
  onBack: () => void;
}

export function StepGuardian({ submitting, serverError, onContinue, onBack }: Props) {
  const { register, watch, setValue, formState: { errors } } = useFormContext<UserRegisterFormValues>();

  const guardianFullName = watch("guardianFullName") ?? "";
  const guardianEmail = watch("guardianEmail") ?? "";
  const guardianConsent = watch("guardianConsent") ?? false;
  const guardianConsentSupervision = watch("guardianConsentSupervision") ?? false;

  const canContinue =
    guardianFullName.trim() !== "" &&
    guardianEmail.trim() !== "" &&
    guardianConsent &&
    guardianConsentSupervision;

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.5rem, 2.1vw, 1.875rem)", lineHeight: 1.15 }}
        >
          {t("register.guardian.heading")}
        </h1>
        <p className="mt-1 font-body text-[14px] text-cb-gray-500">
          {t("register.guardian.sub")}
        </p>
      </div>

      <Input
        label={t("register.guardian.fullNameLabel")}
        placeholder={t("register.guardian.fullNamePlaceholder")}
        autoComplete="off"
        error={errors.guardianFullName?.message}
        {...register("guardianFullName")}
      />

      <Input
        label={t("register.guardian.emailLabel")}
        placeholder={t("register.guardian.emailPlaceholder")}
        type="email"
        autoComplete="off"
        inputMode="email"
        error={errors.guardianEmail?.message}
        {...register("guardianEmail")}
      />

      <div className="mb-4 flex flex-col gap-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] border-cb-gray-200 px-4 py-3.5 transition-colors hover:border-cb-gray-400 hover:bg-cb-gray-50">
          <input
            type="checkbox"
            checked={guardianConsent}
            onChange={(e) =>
              setValue("guardianConsent", e.target.checked, { shouldDirty: true })
            }
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-cb-gray-300 accent-cb-black"
          />
          <span className="font-body text-[14px] leading-snug text-cb-black">
            {t("register.guardian.consentLabel")}
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] border-cb-gray-200 px-4 py-3.5 transition-colors hover:border-cb-gray-400 hover:bg-cb-gray-50">
          <input
            type="checkbox"
            checked={guardianConsentSupervision}
            onChange={(e) =>
              setValue("guardianConsentSupervision", e.target.checked, { shouldDirty: true })
            }
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-cb-gray-300 accent-cb-black"
          />
          <span className="font-body text-[14px] leading-snug text-cb-black">
            {t("register.guardian.supervisionLabel")}
          </span>
        </label>
      </div>

      {serverError && (
        <p role="alert" className="mb-4 font-body text-[13px] text-cb-danger">
          {serverError}
        </p>
      )}

      <div className="flex items-center gap-3">
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
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          onClick={onContinue}
          disabled={!canContinue || submitting}
          className="touch-manipulation"
        >
          {submitting ? t("register.guardian.sending") : t("register.guardian.sendCta")}
        </Button>
      </div>
    </div>
  );
}
