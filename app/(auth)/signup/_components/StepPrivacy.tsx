"use client";

import Link from "next/link";
import { Button } from "@/components/ui";
import {
  CHILD_SAFETY,
  PRIVACY_POLICY,
  TERMS_OF_USE,
} from "@/lib/legal/content";

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconPrivacy() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconSafety() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function IconTerms() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      aria-hidden
    >
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-cb-gray-400"
      fill="none"
      aria-hidden
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface Props {
  accepted: boolean;
  error?: string;
  onAcceptedChange: (next: boolean) => void;
  onContinue: () => void;
}

const SECTIONS = [
  {
    href: "/privacy",
    title: PRIVACY_POLICY.title,
    summaryHint: PRIVACY_POLICY.summary[0]!,
    icon: IconPrivacy,
    accent: "bg-cb-blue/25 text-cb-gray-800 ring-1 ring-cb-blue/30",
  },
  {
    href: "/child-safety",
    title: CHILD_SAFETY.title,
    summaryHint: CHILD_SAFETY.summary[0]!,
    icon: IconSafety,
    accent: "bg-cb-yellow/40 text-cb-black ring-1 ring-cb-yellow-600/25",
  },
  {
    href: "/terms",
    title: TERMS_OF_USE.title,
    summaryHint: TERMS_OF_USE.summary[0]!,
    icon: IconTerms,
    accent: "bg-cb-gray-100 text-cb-gray-800 ring-1 ring-cb-gray-200",
  },
] as const;

export function StepPrivacy({
  accepted,
  error,
  onAcceptedChange,
  onContinue,
}: Props) {
  return (
    <div className="w-full shrink-0">
      <header className="mb-5 [@media(max-height:700px)]:mb-4">
        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-cb-gray-400">
          Policies
        </p>
        <h1 className="mt-2 font-heading text-[1.375rem] font-bold leading-[1.15] tracking-[-0.02em] text-cb-black sm:text-[1.625rem]">
          Before we begin
        </h1>
        <p className="mt-2 max-w-[42ch] font-body text-[14px] leading-relaxed text-cb-gray-600 sm:text-[15px]">
          Review each document, then confirm below to continue your account
          setup.
        </p>
      </header>

      <ul className="space-y-2.5 [@media(max-height:700px)]:space-y-2">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                title={section.summaryHint}
                className={[
                  "group flex items-center gap-3 rounded-2xl border border-cb-gray-200/90 bg-white p-3.5 shadow-[0_1px_2px_rgba(36,36,36,0.04)] transition-all duration-200",
                  "hover:border-cb-gray-300 hover:shadow-[0_4px_14px_rgba(36,36,36,0.07)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-offset-2",
                  "[@media(max-height:700px)]:p-3 [@media(max-height:700px)]:rounded-xl",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    section.accent,
                  ].join(" ")}
                  aria-hidden
                >
                  <Icon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-[15px] font-semibold leading-snug text-cb-black line-clamp-2 sm:text-[15.5px]">
                    {section.title}
                  </span>
                </span>
                <span
                  className="flex shrink-0 items-center gap-0.5 font-body text-[13px] font-semibold text-cb-gray-500 transition-colors group-hover:text-cb-black"
                  aria-hidden
                >
                  View
                  <ChevronRightIcon />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 [@media(max-height:700px)]:mt-4">
        <div className="grid gap-4 sm:grid-cols-2 sm:items-stretch sm:gap-4 md:gap-5">
          <label
            className={[
              "group flex min-h-[3.25rem] cursor-pointer items-center justify-center rounded-2xl border p-3.5 text-center transition-all duration-200 sm:min-h-[3.5rem] sm:p-4",
              "[@media(max-height:700px)]:min-h-0 [@media(max-height:700px)]:p-3 [@media(max-height:700px)]:rounded-xl",
              accepted
                ? "border-cb-black/80 bg-cb-bone-300/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                : "border-cb-gray-200/95 bg-cb-gray-100/40 hover:border-cb-gray-300 hover:bg-cb-gray-100/60",
            ].join(" ")}
          >
            <div className="flex w-full max-w-full flex-col items-center justify-center gap-2.5 sm:flex-row sm:justify-center sm:gap-3">
              <span
                aria-hidden
                className={[
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors",
                  accepted
                    ? "border-cb-black bg-cb-black text-white"
                    : "border-cb-gray-300 bg-white group-hover:border-cb-gray-400",
                ].join(" ")}
              >
                {accepted ? <CheckIcon className="h-3 w-3" /> : null}
              </span>
              <div className="min-w-0 max-w-full">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={accepted}
                  onChange={(e) => onAcceptedChange(e.target.checked)}
                />
                <span className="block text-center font-body text-[12px] font-medium leading-snug text-cb-black sm:text-[13px] sm:leading-relaxed md:text-[13.5px]">
                  I have read and accept.
                </span>
              </div>
            </div>
          </label>

          <div className="flex h-full min-h-[3.25rem] min-w-0">
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={onContinue}
              disabled={!accepted}
              className="h-full min-h-[3.25rem] w-full flex-1 text-[14px] shadow-[0_2px_8px_rgba(36,36,36,0.12)] transition-shadow hover:shadow-[0_4px_14px_rgba(36,36,36,0.15)] disabled:shadow-none sm:min-h-[3.5rem] sm:text-[15px]"
            >
              Continue
            </Button>
          </div>
        </div>

        {error ? (
          <p role="alert" className="mt-3 font-body text-sm text-cb-danger">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-5 [@media(max-height:700px)]:mt-4">
        <p className="text-center font-body text-xs leading-relaxed text-cb-gray-500">
          Need help?{" "}
          <a
            href="mailto:cancerbuddy@bonemarrow.org"
            className="font-medium text-cb-black underline decoration-cb-gray-300 underline-offset-[3px] transition-colors hover:decoration-cb-black"
          >
            cancerbuddy@bonemarrow.org
          </a>
        </p>
      </div>
    </div>
  );
}
