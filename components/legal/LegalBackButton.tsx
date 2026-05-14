"use client";

import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";

function ArrowLeftIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

/**
 * Browser-style back for legal pages — returns to the previous route in
 * history (e.g. signup, login, or another legal page).
 */
export function LegalBackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-cb-gray-200 bg-white px-3 text-sm font-medium text-cb-gray-700 shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-all hover:border-cb-gray-300 hover:bg-cb-gray-50 hover:text-cb-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      aria-label={t("legal.backButtonAria")}
    >
      <span className="transition-transform group-hover:-translate-x-0.5">
        <ArrowLeftIcon />
      </span>
      {t("common.back")}
    </button>
  );
}
