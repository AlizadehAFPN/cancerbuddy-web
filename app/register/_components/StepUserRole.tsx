"use client";

import Image from "next/image";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui";
import type { UserRegisterFormValues } from "@/lib/user-signup/validation";
import { t } from "@/lib/i18n";
import { MIN_AGE } from "@/lib/user-signup/constants";

interface Props {
  onContinue: () => void;
}

type UserRole = "PATIENT" | "CAREGIVER" | "SURVIVOR";

/** Returns true if the user born in birthMonth/birthYear is under the minimum age. */
function isUnderAge(birthMonth: string, birthYear: string): boolean {
  if (!birthMonth || !birthYear) return false;
  const now = new Date();
  const bYear = Number(birthYear);
  const bMonth = Number(birthMonth);
  if (!Number.isFinite(bYear) || !Number.isFinite(bMonth)) return false;
  const birthDate = new Date(bYear, bMonth - 1, 1);
  const cutoff = new Date(
    now.getFullYear() - MIN_AGE,
    now.getMonth(),
    now.getDate(),
  );
  return birthDate > cutoff;
}

export function StepUserRole({ onContinue }: Props) {
  const { watch, setValue } = useFormContext<UserRegisterFormValues>();

  const userType = watch("userType") ?? "";
  const birthMonth = watch("birthMonth") ?? "";
  const birthYear = watch("birthYear") ?? "";

  const underAge = isUnderAge(birthMonth, birthYear);

  const canContinue =
    userType === "PATIENT" || userType === "CAREGIVER" || userType === "SURVIVOR";

  function select(role: UserRole) {
    setValue("userType", role, { shouldDirty: true, shouldValidate: false });
  }

  const roles: Array<{
    id: UserRole;
    imageSrc: string;
    imageBwSrc: string;
    title: string;
    body: string;
    hidden?: boolean;
  }> = [
    {
      id: "PATIENT",
      imageSrc: "/images/BMCF_Patient.png",
      imageBwSrc: "/images/BMCF_Patient-BW.png",
      title: t("register.userRole.patient.title"),
      body: t("register.userRole.patient.body"),
    },
    {
      id: "CAREGIVER",
      imageSrc: "/images/BMCF_Caregiver.png",
      imageBwSrc: "/images/BMCF_Caregiver-BW.png",
      title: t("register.userRole.caregiver.title"),
      body: t("register.userRole.caregiver.body"),
      hidden: underAge,
    },
    {
      id: "SURVIVOR",
      imageSrc: "/images/BMCF_Survivor.png",
      imageBwSrc: "/images/BMCF_Survivor-BW.png",
      title: t("register.userRole.survivor.title"),
      body: t("register.userRole.survivor.body"),
    },
  ];

  return (
    <div className="w-full">
      <div className="mb-2">
        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-cb-gray-500 mb-1">
          {t("register.userRole.eyebrow")}
        </p>
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.5rem, 2.1vw, 1.875rem)", lineHeight: 1.15 }}
        >
          {t("register.userRole.heading")}
        </h1>
        <p className="mt-1 font-body text-[14px] text-cb-gray-500">
          {t("register.userRole.sub")}
        </p>
      </div>

      {underAge ? (
        <p className="mb-3 font-body text-[13px] text-cb-gray-400">
          {t("register.userRole.caregiverHiddenHint")}
        </p>
      ) : null}

      <div className="mb-6 mt-4 flex flex-col gap-3">
        {roles.map((role) => {
          if (role.hidden) return null;
          const selected = userType === role.id;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => select(role.id)}
              className={[
                "flex items-center gap-4 rounded-2xl border-[1.5px] p-4 text-start transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black",
                selected
                  ? "border-cb-black bg-cb-black/[0.03] shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
                  : "border-cb-gray-200 hover:border-cb-gray-400 hover:bg-cb-gray-50",
              ].join(" ")}
              aria-pressed={selected}
            >
              {/* Avatar circle — yellow when selected, light gray when not */}
              <span
                className={[
                  "relative shrink-0 rounded-full overflow-hidden transition-colors duration-150",
                  "w-[72px] h-[72px] sm:w-20 sm:h-20",
                  selected ? "bg-cb-yellow" : "bg-cb-gray-100",
                ].join(" ")}
              >
                <Image
                  src={selected ? role.imageSrc : role.imageBwSrc}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="80px"
                  aria-hidden
                />
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={[
                    "block font-heading font-bold text-[16px] sm:text-[17px] leading-snug transition-colors duration-150",
                    selected ? "text-cb-black" : "text-cb-gray-700",
                  ].join(" ")}
                >
                  {role.title}
                </span>
                <span className="mt-1 block font-body text-[13px] sm:text-[14px] leading-snug text-cb-gray-500">
                  {role.body}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <Button
        type="button"
        variant="primary"
        size="lg"
        fullWidth
        onClick={onContinue}
        disabled={!canContinue}
        className="touch-manipulation"
      >
        {t("common.continue")}
      </Button>
    </div>
  );
}
