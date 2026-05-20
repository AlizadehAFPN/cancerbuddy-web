"use client";

import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui";
import type { UserRegisterFormValues } from "@/lib/user-signup/validation";
import { t } from "@/lib/i18n";

interface Props {
  /**
   * Phase 1: sends the user to the landing page (no post-phone screens yet).
   * Phase 2 will swap this for the role-picker entry point.
   */
  onContinue: () => void;
}

function CheckCircleIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-16 w-16 text-cb-black"
      aria-hidden
    >
      <circle cx="32" cy="32" r="28" />
      <polyline points="20 32 28 40 44 24" />
    </svg>
  );
}

/**
 * Phone-verified celebration screen. Mirrors mobile's
 * `AccountSetupVerifiedSuccessfully` — congratulatory copy + a single primary
 * CTA. Reads first name from the in-flight form so the heading can address
 * the user directly.
 */
export function StepVerifiedSuccessfully({ onContinue }: Props) {
  const { getValues } = useFormContext<UserRegisterFormValues>();
  const firstName = (getValues("firstName") ?? "").trim();
  const heading = firstName
    ? t("register.verifiedSuccessfully.heading", { name: firstName })
    : t("register.verifiedSuccessfully.heading", { name: "there" });

  return (
    <div className="w-full">
      <div className="mx-auto flex max-w-[440px] flex-col items-center pt-6 sm:pt-10 text-center">
        <span
          className="flex h-20 w-20 items-center justify-center rounded-full bg-cb-yellow/40 ring-1 ring-cb-yellow"
          aria-hidden
        >
          <CheckCircleIcon />
        </span>

        <p className="mt-5 font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-cb-gray-500">
          {t("register.verifiedSuccessfully.eyebrow")}
        </p>
        <h1
          className="mt-2 font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.75rem, 2.4vw, 2.125rem)", lineHeight: 1.15 }}
        >
          {heading}
        </h1>
        <p className="mt-2 font-body text-[15px] leading-relaxed text-cb-gray-600">
          {t("register.verifiedSuccessfully.body")}
        </p>

        <div className="mt-8 w-full max-w-[320px]">
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            onClick={onContinue}
            className="touch-manipulation"
          >
            {t("register.verifiedSuccessfully.continueCta")}
          </Button>
        </div>
      </div>
    </div>
  );
}
