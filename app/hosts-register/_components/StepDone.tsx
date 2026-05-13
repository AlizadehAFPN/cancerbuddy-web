"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

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
        Welcome — you&apos;re registered as a Host
      </h1>
      <p className="mx-auto mt-2 max-w-[min(100%,56ch)] font-body text-cb-gray-500 leading-relaxed">
        Your host profile is created. Our support team will assign you as a host
        to a group and after that, you can work as host in the group.
      </p>
      <p className="mx-auto mt-3 max-w-[min(100%,56ch)] font-body text-cb-gray-500 leading-relaxed">
        You can now sign in to the{" "}
        <span className="font-medium text-cb-black">CancerBuddy mobile app as a Host</span>{" "}
        with the same email and password you used here.
      </p>

      <div className="mx-auto mt-6 flex max-w-full flex-col gap-3 rounded-2xl border border-cb-gray-200 bg-cb-gray-100/50 px-4 py-3 sm:flex-row sm:items-center">
        <div className="text-start min-w-0 flex-1">
          <p className="font-body text-[11px] font-semibold uppercase tracking-wider text-cb-gray-500">
            Buddy ID
          </p>
          {buddyId?.trim() ? (
            <p className="font-heading max-w-[min(100%,52ch)] break-all text-[13px] font-semibold text-cb-black">
              {buddyId.trim()}
            </p>
          ) : (
            <p className="font-body max-w-[min(100%,52ch)] text-[13px] leading-snug text-cb-gray-600">
              We couldn&apos;t load your Buddy ID in the browser. Open the
              CancerBuddy app, go to{" "}
              <span className="font-medium text-cb-black">Profile</span>, and
              you&apos;ll see your Buddy ID there (same account as here).
            </p>
          )}
        </div>
        {buddyId?.trim() ? (
          <button
            type="button"
            onClick={copy}
            aria-label="Copy Buddy ID"
            className="inline-flex h-9 shrink-0 touch-manipulation items-center gap-1.5 self-end rounded-lg border border-cb-gray-200 bg-white px-3 font-body text-[13px] font-medium text-cb-black transition-colors hover:bg-cb-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black sm:self-center"
          >
            <CopyIcon className="h-[14px] w-[14px]" />
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
      </div>

      <p className="mx-auto mt-6 max-w-[40ch] font-body text-[12.5px] text-cb-gray-500">
        Need help? Reach us at{" "}
        <span className="font-medium text-cb-black">hosts@cancerbuddy.com</span>
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
          Go to sign in
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          fullWidth
          onClick={() => router.push("/")}
          className="touch-manipulation sm:w-auto"
        >
          Back to home
        </Button>
      </div>
    </div>
  );
}
