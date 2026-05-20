"use client";

import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui";
import { MonthYearPicker } from "@/components/auth";
import type { UserRegisterFormValues } from "@/lib/user-signup/validation";
import { t } from "@/lib/i18n";

interface Props {
  onContinue: () => void;
  onSkip: () => void;
}

export function StepCGPatientAge({ onContinue, onSkip }: Props) {
  const { watch, setValue } = useFormContext<UserRegisterFormValues>();

  const patientBirthMonth = watch("patientBirthMonth") ?? "";
  const patientBirthYear = watch("patientBirthYear") ?? "";

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.5rem, 2.1vw, 1.875rem)", lineHeight: 1.15 }}
        >
          {t("register.cgPatientAge.heading")}
        </h1>
        <p className="mt-1 font-body text-[14px] text-cb-gray-500">
          {t("register.cgPatientAge.sub")}
        </p>
        <p className="mt-0.5 font-body text-[13px] text-cb-gray-400">
          {t("register.cgPatientAge.sub2")}
        </p>
      </div>

      <div className="mb-4">
        <MonthYearPicker
          label={t("register.profile.dateOfBirthLabel")}
          month={patientBirthMonth}
          year={patientBirthYear}
          onChange={(m, y) => {
            setValue("patientBirthMonth", m, {
              shouldValidate: false,
              shouldDirty: true,
            });
            setValue("patientBirthYear", y, {
              shouldValidate: false,
              shouldDirty: true,
            });
          }}
        />
      </div>

      <Button
        type="button"
        variant="primary"
        size="lg"
        fullWidth
        onClick={onContinue}
        className="touch-manipulation"
      >
        {t("common.continue")}
      </Button>

      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={onSkip}
          className="font-body text-sm text-cb-gray-500 underline-offset-2 hover:text-cb-black hover:underline transition-colors"
        >
          {t("register.cgPatientAge.skipLink")}
        </button>
      </div>
    </div>
  );
}
