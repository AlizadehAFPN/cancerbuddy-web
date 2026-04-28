"use client";

import { useFormContext } from "react-hook-form";
import { Button, Input } from "@/components/ui";
import { MonthYearPicker, PronounPicker } from "@/components/auth";
import { type PronounOption } from "@/lib/signup/constants";
import type { SignupFormValues } from "@/lib/signup/validation";

interface Props {
  onBack: () => void;
  onContinue: () => void;
}

/**
 * Step 2 — name, birth month/year, pronouns.
 *
 * Required: firstName, lastName, birthMonth, birthYear.
 * Optional: pronouns.
 * Continue is disabled until all required fields have a value.
 */
export function StepProfile({ onBack, onContinue }: Props) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<SignupFormValues>();

  const firstName = watch("firstName") ?? "";
  const lastName = watch("lastName") ?? "";
  const birthMonth = watch("birthMonth") ?? "";
  const birthYear = watch("birthYear") ?? "";
  const pronouns = watch("pronouns");

  /* Continue enabled only when all required fields are non-empty. */
  const canContinue =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    birthMonth !== "" &&
    birthYear !== "";

  return (
    <div>
      <div className="mb-8">
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.6rem, 2.2vw, 2rem)", lineHeight: 1.15 }}
        >
          Tell us a little about you
        </h1>
        <p className="mt-1 font-body text-cb-gray-500">
          Just enough to personalise your experience.
        </p>
      </div>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Input
          label="First name"
          placeholder="Your first name"
          autoComplete="given-name"
          autoFocus
          error={errors.firstName?.message}
          {...register("firstName")}
        />
        <Input
          label="Last name"
          placeholder="Your last name"
          autoComplete="family-name"
          error={errors.lastName?.message}
          {...register("lastName")}
        />
      </div>

      <div className="mb-5 grid grid-cols-1 items-start gap-x-4 sm:grid-cols-2">
        <MonthYearPicker
          className="!mb-0"
          label="Date of birth"
          month={birthMonth}
          year={birthYear}
          onChange={(m, y) => {
            setValue("birthMonth", m, { shouldValidate: true, shouldDirty: true });
            setValue("birthYear", y, { shouldValidate: true, shouldDirty: true });
          }}
          error={errors.birthMonth?.message ?? errors.birthYear?.message}
          hint={
            birthMonth !== "" && birthYear !== ""
              ? `Born ${
                  ["January","February","March","April","May","June",
                   "July","August","September","October","November","December"][Number(birthMonth) - 1]
                } ${birthYear}`
              : undefined
          }
        />

        <PronounPicker
          className="!mb-0"
          value={pronouns as PronounOption | ""}
          onChange={(v) =>
            setValue("pronouns", v, { shouldValidate: true, shouldDirty: true })
          }
          error={errors.pronouns?.message}
        />
      </div>

      <p className="mb-6 mt-0.5 font-body text-[12.5px] text-cb-gray-400">
        Pronouns are optional — you can always update this later.
      </p>

      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" size="lg" onClick={onBack}>
          Back
        </Button>
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          onClick={onContinue}
          disabled={!canContinue}
          title={!canContinue ? "Please fill in your name, last name, and date of birth." : undefined}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
