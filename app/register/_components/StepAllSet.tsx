"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { clearUserDraft } from "@/lib/user-signup/storage";
import { t } from "@/lib/i18n";

export function StepAllSet() {
  const router = useRouter();

  function goToDashboard() {
    clearUserDraft();
    router.push("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-between w-full py-4">
      {/* Illustration */}
      <div className="flex flex-1 items-center justify-center w-full max-w-[320px] mx-auto">
        <div
          className="relative flex items-center justify-center rounded-full bg-cb-yellow/20"
          style={{ width: "clamp(180px, 40vw, 280px)", height: "clamp(180px, 40vw, 280px)" }}
          aria-hidden
        >
          <svg
            viewBox="0 0 160 160"
            fill="none"
            className="w-full h-full p-6"
            aria-hidden
          >
            <circle cx="80" cy="80" r="76" fill="#FDE68A" opacity="0.4" />
            {/* Stars */}
            <circle cx="40" cy="40" r="5" fill="#F59E0B" />
            <circle cx="120" cy="35" r="4" fill="#F59E0B" opacity="0.7" />
            <circle cx="130" cy="110" r="6" fill="#F59E0B" opacity="0.6" />
            <circle cx="25" cy="110" r="4" fill="#F59E0B" opacity="0.8" />
            {/* Big checkmark circle */}
            <circle cx="80" cy="80" r="36" fill="#F59E0B" opacity="0.3" />
            <circle cx="80" cy="80" r="28" fill="#F59E0B" opacity="0.5" />
            <polyline
              points="64,80 76,92 98,68"
              stroke="#78350F"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
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
          {t("register.allSet.heading")}
        </h1>
        <p className="font-body text-[15px] text-cb-gray-500">
          {t("register.allSet.sub")}
        </p>
      </div>

      {/* CTAs */}
      <div className="w-full flex flex-col gap-3">
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          onClick={goToDashboard}
          className="touch-manipulation"
        >
          {t("register.allSet.findBuddies")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          fullWidth
          onClick={goToDashboard}
          className="touch-manipulation"
        >
          {t("register.allSet.exploreGroups")}
        </Button>
      </div>
    </div>
  );
}
