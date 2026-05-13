"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  SIGNUP_STEPS,
  STEP_TITLES,
  type SignupStep,
} from "@/lib/signup/constants";

/* ── Inline icon ── */

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
      className="w-4 h-4"
      aria-hidden
    >
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

/** Horizontal padding aligned across header, scroll region, and footer. */
const shellPad = "px-6 sm:px-8 lg:px-12";

interface Props {
  /** Current step — drives the progress strip and the right-panel heading. */
  step: SignupStep;
  /** Hide the progress strip (e.g. on the success state). */
  hideProgress?: boolean;
  /** Form content rendered inside the right panel. */
  children: ReactNode;
  /**
   * When set, header "Back" steps backward inside the signup wizard.
   * When unset, Back navigates home (`/`).
   */
  onFlowBack?: () => void;
}

/**
 * Two-panel layout: left brand panel, right form panel.
 * The document does not scroll — only the form column scrolls between header and footer.
 */
export function SignupShell({
  step,
  hideProgress,
  children,
  onFlowBack,
}: Props) {
  const visibleSteps = SIGNUP_STEPS;
  const stepIndex = visibleSteps.indexOf(
    step === "done" ? "otp" : (step as (typeof visibleSteps)[number]),
  );
  const safeIdx = stepIndex < 0 ? 0 : stepIndex;
  const total = visibleSteps.length;

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 w-full overflow-hidden">
      {/* ════════════════════════════════════════════════
          LEFT PANEL — brand + illustration
          ════════════════════════════════════════════════ */}
      <aside
        className={`hidden lg:flex flex-col w-[46%] xl:w-[42%] shrink-0 bg-cb-yellow ${shellPad} min-h-0 overflow-hidden`}
      >
        <div className="h-14 sm:h-16 shrink-0 flex items-center">
          <Link href="/" aria-label="Back to CancerBuddy home">
            <Image
              src="/images/trademark-logo.png"
              alt="CancerBuddy"
              width={195}
              height={26}
              className="object-contain"
              priority
            />
          </Link>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center min-h-0 py-4">
          <div
            className="w-full max-w-[380px] min-h-0 flex flex-col justify-center"
            style={{ animation: "hero-fade-in 0.7s ease-out 0.1s both" }}
          >
            <Image
              src="/images/welcome.png"
              alt="CancerBuddy community"
              width={460}
              height={500}
              className="w-full max-h-[min(52vh,500px)] object-contain"
              priority
            />
          </div>
          <p
            className="mt-3 sm:mt-4 font-heading font-bold text-cb-black text-center leading-snug shrink-0"
            style={{
              fontSize: "clamp(1.35rem, 2vw, 1.75rem)",
              animation: "hero-fade-up 0.6s ease-out 0.25s both",
            }}
          >
            Your support community<br />awaits.
          </p>
        </div>

        <div className="h-14 sm:h-16 shrink-0 flex items-center gap-3">
          <span className="text-[11px] font-medium text-cb-gray-600 tracking-[0.12em] uppercase">
            Powered by
          </span>
          <Image
            src="/images/bm-logo-transparent.png"
            alt="Bone Marrow Cancer Foundation"
            width={110}
            height={30}
            className="object-contain"
          />
        </div>
      </aside>

      {/* ════════════════════════════════════════════════
          RIGHT PANEL — header + scrollable form + footer
          ════════════════════════════════════════════════ */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <header
          className={`h-14 sm:h-16 shrink-0 flex items-center justify-between gap-3 ${shellPad} border-b border-cb-gray-100/80 bg-white`}
        >
          {onFlowBack ? (
            <button
              type="button"
              onClick={onFlowBack}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-cb-gray-600 hover:text-cb-black transition-colors shrink-0"
            >
              <ArrowLeftIcon />
              Back
            </button>
          ) : (
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-cb-gray-600 hover:text-cb-black transition-colors shrink-0"
            >
              <ArrowLeftIcon />
              Back
            </Link>
          )}

          <Link href="/" className="lg:hidden shrink-0" aria-label="CancerBuddy home">
            <Image
              src="/images/trademark-logo.png"
              alt="CancerBuddy"
              width={155}
              height={21}
              className="object-contain"
            />
          </Link>

          <p className="text-sm text-cb-gray-500 font-body min-w-0 text-end">
            Already a member?{" "}
            <Link
              href="/login"
              className="font-medium text-cb-black underline underline-offset-2 hover:text-cb-gray-700 transition-colors whitespace-nowrap"
            >
              Sign in
            </Link>
          </p>
        </header>

        <div
          className={[
            "flex-1 min-h-0",
            step === "privacy"
              ? "flex flex-col overflow-hidden"
              : "overflow-y-auto overscroll-y-contain",
            step === "privacy" ? "bg-[#F7F6F3]" : "",
            shellPad,
            step === "privacy" ? "py-4 sm:py-5" : "py-5 sm:py-6",
          ].join(" ")}
        >
          <div
            className="mx-auto w-full min-w-0 max-w-[480px]"
            style={{ animation: "hero-fade-up 0.55s ease-out both" }}
          >
            {!hideProgress ? (
              <div
                className={
                  step === "privacy" ? "mb-4 sm:mb-5" : "mb-6 sm:mb-8"
                }
              >
                <div className="mb-2 flex items-baseline justify-between gap-2 sm:mb-2.5">
                  <p className="font-body text-sm font-medium text-cb-gray-500">
                    <span className="sr-only">
                      Step {safeIdx + 1} of {total}.{" "}
                    </span>
                    <span aria-hidden className="tabular-nums text-cb-black">
                      {safeIdx + 1}
                    </span>
                    <span aria-hidden className="text-cb-gray-300">
                      {" "}
                      /{" "}
                    </span>
                    <span aria-hidden className="tabular-nums">
                      {total}
                    </span>
                  </p>
                  <p className="min-w-0 truncate text-right font-body text-sm text-cb-gray-600">
                    {STEP_TITLES[visibleSteps[safeIdx]] ?? ""}
                  </p>
                </div>
                <div className="flex h-1.5 gap-1.5" aria-hidden>
                  {visibleSteps.map((s, i) => {
                    const done = i < safeIdx;
                    const current = i === safeIdx;
                    return (
                      <div
                        key={s}
                        className={[
                          "h-full min-w-0 flex-1 rounded-full transition-all duration-300",
                          done
                            ? "bg-cb-black"
                            : current
                              ? "bg-cb-black shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
                              : "bg-cb-gray-200",
                        ].join(" ")}
                      />
                    );
                  })}
                </div>
              </div>
            ) : null}

            {children}
          </div>
        </div>

        <footer
          className={`shrink-0 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-cb-gray-100/80 bg-white py-3 text-xs text-cb-gray-400 sm:h-16 sm:py-0 ${shellPad}`}
        >
          <Link
            href="/privacy"
            className="hover:text-cb-gray-600 transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="hover:text-cb-gray-600 transition-colors"
          >
            Terms of Service
          </Link>
          <Link
            href="/support"
            className="hover:text-cb-gray-600 transition-colors"
          >
            Support
          </Link>
          <span className="ms-auto text-cb-gray-300">
            © {new Date().getFullYear()} CancerBuddy
          </span>
        </footer>
      </main>
    </div>
  );
}
