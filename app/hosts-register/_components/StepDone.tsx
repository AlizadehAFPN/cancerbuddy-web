"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { t } from "@/lib/i18n";

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-7 h-7"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

interface Props {
  /** AppSync `User.buddyId` — public id shown in the mobile app. */
  buddyId: string | null;
}

export function StepDone({ buddyId }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!buddyId?.trim()) return;
    try {
      await navigator.clipboard.writeText(buddyId.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* Clipboard API unavailable — silently no-op; the id is plainly visible. */
    }
  }

  return (
    <div className="w-full text-center">
      <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cb-success/15 text-cb-success">
        <CheckIcon />
      </div>
      <h1
        className="font-heading font-bold text-cb-black tracking-tight"
        style={{ fontSize: "clamp(1.75rem, 2.4vw, 2.25rem)", lineHeight: 1.15 }}
      >
        {t("hostsRegister.done.heading")}
      </h1>
      <p className="mx-auto mt-2 max-w-[min(100%,56ch)] font-body text-cb-gray-500 leading-relaxed">
        {t("hostsRegister.done.bodyAssignment")}
      </p>
      <p className="mx-auto mt-3 max-w-[min(100%,56ch)] font-body text-cb-gray-500 leading-relaxed">
        {t("hostsRegister.done.bodySignInLead")}{" "}
        <span className="font-medium text-cb-black">
          {t("hostsRegister.done.bodySignInBold")}
        </span>{" "}
        {t("hostsRegister.done.bodySignInTrail")}
      </p>

      <div className="mx-auto mt-6 flex max-w-full flex-col gap-3 rounded-2xl border border-cb-gray-200 bg-cb-gray-100/50 px-4 py-3 sm:flex-row sm:items-center">
        <div className="text-start min-w-0 flex-1">
          <p className="font-body text-[11px] font-semibold uppercase tracking-wider text-cb-gray-500">
            {t("hostsRegister.done.buddyIdLabel")}
          </p>
          {buddyId?.trim() ? (
            <p className="font-heading max-w-[min(100%,52ch)] break-all text-[13px] font-semibold text-cb-black">
              {buddyId.trim()}
            </p>
          ) : (
            <p className="font-body max-w-[min(100%,52ch)] text-[13px] leading-snug text-cb-gray-600">
              {t("hostsRegister.done.buddyIdMissingLead")}{" "}
              {t("hostsRegister.done.buddyIdMissingMid")}{" "}
              <span className="font-medium text-cb-black">
                {t("hostsRegister.done.buddyIdMissingBold")}
              </span>
              {t("hostsRegister.done.buddyIdMissingTrail")}
            </p>
          )}
        </div>
        {buddyId?.trim() ? (
          <button
            type="button"
            onClick={copy}
            aria-label={t("hostsRegister.done.copyAriaLabel")}
            className="inline-flex h-9 shrink-0 touch-manipulation items-center gap-1.5 self-end rounded-lg border border-cb-gray-200 bg-white px-3 font-body text-[13px] font-medium text-cb-black transition-colors hover:bg-cb-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black sm:self-center"
          >
            <CopyIcon className="h-[14px] w-[14px]" />
            {copied ? t("hostsRegister.done.copied") : t("hostsRegister.done.copy")}
          </button>
        ) : null}
      </div>

      <p className="mx-auto mt-6 max-w-[40ch] font-body text-[12.5px] text-cb-gray-500">
        {t("hostsRegister.done.needHelpLead")}{" "}
        <span className="font-medium text-cb-black">
          {t("hostsRegister.done.hostsEmail")}
        </span>
        .
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => router.push("/login")}
          className="touch-manipulation sm:w-auto"
        >
          {t("hostsRegister.done.goToSignIn")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          fullWidth
          onClick={() => router.push("/")}
          className="touch-manipulation sm:w-auto"
        >
          {t("hostsRegister.done.backToHome")}
        </Button>
      </div>
    </div>
  );
}
