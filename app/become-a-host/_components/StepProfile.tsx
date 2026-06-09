"use client";

import { useFormContext } from "react-hook-form";
import { Button, Input } from "@/components/ui";
import { MonthYearPicker, PronounPicker } from "@/components/auth";
import type { HostRegisterFormValues } from "@/lib/host-signup/validation";
import { t, tList } from "@/lib/i18n";

interface Props {
  onBack: () => void;
  onContinue: () => void;
}

/**
 * Step 2 — name, birth month/year, pronouns. Same rules as the regular
 * signup flow; only the heading copy differs to set the host context.
 */
export function StepProfile({ onBack, onContinue }: Props) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<HostRegisterFormValues>();

  const firstName = watch("firstName") ?? "";
  const lastName = watch("lastName") ?? "";
  const birthMonth = watch("birthMonth") ?? "";
  const birthYear = watch("birthYear") ?? "";
  const pronouns = watch("pronouns");

  const canContinue =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    birthMonth !== "" &&
    birthYear !== "";

  const monthNames = tList("forms.monthNamesLong");

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{
            fontSize: "clamp(1.5rem, 2.1vw, 1.875rem)",
            lineHeight: 1.15,
          }}
        >
          {t("hostsRegister.profile.heading")}
        </h1>
      </div>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Input
          label={t("hostsRegister.profile.firstNameLabel")}
          placeholder={t("hostsRegister.profile.firstNamePlaceholder")}
          autoComplete="given-name"
          autoFocus
          error={errors.firstName?.message}
          {...register("firstName")}
        />
        <Input
          label={t("hostsRegister.profile.lastNameLabel")}
          placeholder={t("hostsRegister.profile.lastNamePlaceholder")}
          autoComplete="family-name"
          error={errors.lastName?.message}
          {...register("lastName")}
        />
      </div>

      <div className="mb-5 grid grid-cols-1 items-start gap-x-4 sm:grid-cols-2">
        <MonthYearPicker
          className="!mb-0"
          label={t("hostsRegister.profile.dateOfBirthLabel")}
          month={birthMonth}
          year={birthYear}
          onChange={(m, y) => {
            setValue("birthMonth", m, {
              shouldValidate: true,
              shouldDirty: true,
            });
            setValue("birthYear", y, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
          error={errors.birthMonth?.message ?? errors.birthYear?.message}
          hint={
            birthMonth !== "" && birthYear !== ""
              ? t("hostsRegister.profile.bornHint", {
                  month: monthNames[Number(birthMonth) - 1] ?? "",
                  year: birthYear,
                })
              : undefined
          }
        />

        <PronounPicker
          className="!mb-0"
          value={pronouns ?? ""}
          onChange={(v) =>
            setValue("pronouns", v, { shouldValidate: true, shouldDirty: true })
          }
          error={errors.pronouns?.message}
        />
      </div>

      <p className="mb-6 mt-0.5 font-body text-[12px] text-cb-gray-400">
        {t("hostsRegister.profile.pronounsHint")}
      </p>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={onBack}
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
          disabled={!canContinue}
          title={
            !canContinue
              ? t("hostsRegister.profile.continueDisabledTitle")
              : undefined
          }
          className="touch-manipulation"
        >
          {t("common.continue")}
        </Button>
      </div>
    </div>
  );
}
