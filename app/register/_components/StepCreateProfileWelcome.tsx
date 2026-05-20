"use client";

import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui";
import type { UserRegisterFormValues } from "@/lib/user-signup/validation";
import { t } from "@/lib/i18n";

interface Props {
  onContinue: () => void;
}

export function StepCreateProfileWelcome({ onContinue }: Props) {
  const { watch } = useFormContext<UserRegisterFormValues>();
  const firstName = watch("firstName") || "there";

  return (
    <div className="flex flex-1 flex-col items-center justify-between w-full py-4">
      {/* Illustration */}
      <div className="flex flex-1 items-center justify-center w-full max-w-[320px] mx-auto">
        <div
          className="relative flex items-center justify-center rounded-full bg-cb-yellow/20"
          style={{ width: "clamp(180px, 40vw, 280px)", height: "clamp(180px, 40vw, 280px)" }}
          aria-hidden
        >
          {/* Decorative SVG heart + people illustration */}
          <svg
            viewBox="0 0 160 160"
            fill="none"
            className="w-full h-full p-8"
            aria-hidden
          >
            <circle cx="80" cy="80" r="76" fill="#FDE68A" opacity="0.5" />
            {/* Person 1 */}
            <circle cx="55" cy="58" r="14" fill="#F59E0B" />
            <path d="M30 100c0-13.8 11.2-25 25-25s25 11.2 25 25" fill="#F59E0B" opacity="0.7" />
            {/* Person 2 */}
            <circle cx="105" cy="58" r="14" fill="#D97706" />
            <path d="M80 100c0-13.8 11.2-25 25-25s25 11.2 25 25" fill="#D97706" opacity="0.7" />
            {/* Heart */}
            <path
              d="M80 78 C80 78, 68 66, 68 58 C68 52, 73 48, 80 54 C87 48, 92 52, 92 58 C92 66, 80 78, 80 78Z"
              fill="#EF4444"
            />
          </svg>
        </div>
      </div>

      {/* Text */}
      <div className="w-full mt-6 mb-8">
        <h1
          className="font-heading font-bold text-cb-black tracking-tight mb-3"
          style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)", lineHeight: 1.15 }}
        >
          {t("register.createProfile.heading", { name: firstName })}
        </h1>
        <p className="font-body text-[15px] text-cb-gray-700 mb-2">
          {t("register.createProfile.body1")}
        </p>
        <p className="font-body text-[15px] text-cb-gray-500">
          {t("register.createProfile.body2")}
        </p>
      </div>

      <Button
        type="button"
        variant="primary"
        size="lg"
        fullWidth
        onClick={onContinue}
        className="touch-manipulation"
      >
        {t("register.createProfile.cta")}
      </Button>
    </div>
  );
}
