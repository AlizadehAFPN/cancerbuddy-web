"use client";

import { useFormContext } from "react-hook-form";
import { Button, Input } from "@/components/ui";
import { MonthYearPicker, PronounPicker } from "@/components/auth";
import type { UserRegisterFormValues } from "@/lib/user-signup/validation";
import { t, tList } from "@/lib/i18n";

interface Props {
  onBack: () => void;
  onContinue: () => void;
}

/**
 * Step 2 — name, birth month/year, pronouns. Same rules as the host flow and
 * mobile `PrivacyTermsIntroduction` — combined name + birth + pronouns on a
 * single screen rather than three.
 */
export function StepProfile({ onBack, onContinue }: Props) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<UserRegisterFormValues>();

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
          style={{ fontSize: "clamp(1.5rem, 2.1vw, 1.875rem)", lineHeight: 1.15 }}
        >
          {t("register.profile.heading")}
        </h1>
        <p className="mt-1 font-body text-[14px] text-cb-gray-500">
          {t("register.profile.sub")}
        </p>
      </div>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Input
          label={t("register.profile.firstNameLabel")}
          placeholder={t("register.profile.firstNamePlaceholder")}
          autoComplete="given-name"
          autoFocus
          error={errors.firstName?.message}
          {...register("firstName")}
        />
        <Input
          label={t("register.profile.lastNameLabel")}
          placeholder={t("register.profile.lastNamePlaceholder")}
          autoComplete="family-name"
          error={errors.lastName?.message}
          {...register("lastName")}
        />
      </div>

      <div className="mb-5 grid grid-cols-1 items-start gap-x-4 sm:grid-cols-2">
        <MonthYearPicker
          className="!mb-0"
          label={t("register.profile.dateOfBirthLabel")}
          month={birthMonth}
          year={birthYear}
          overrideMaxYear={new Date().getFullYear()}
          onChange={(m, y) => {
            setValue("birthMonth", m, { shouldValidate: true, shouldDirty: true });
            setValue("birthYear", y, { shouldValidate: true, shouldDirty: true });
          }}
          error={errors.birthMonth?.message ?? errors.birthYear?.message}
          hint={
            birthMonth !== "" && birthYear !== ""
              ? t("register.profile.bornHint", {
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
        {t("register.profile.pronounsHint")}
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
              ? t("register.profile.continueDisabledTitle")
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
