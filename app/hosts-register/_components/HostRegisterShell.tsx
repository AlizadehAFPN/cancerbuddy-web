"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  HOST_REGISTER_STEPS,
  HOST_STEP_TITLES,
  type HostRegisterStep,
} from "@/lib/host-signup/constants";

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

/** Horizontal padding aligned across header, content, and footer. */
const shellPad = "px-5 sm:px-8 lg:px-12";

interface Props {
  /** Current step — drives the progress strip and the right-panel heading. */
  step: HostRegisterStep;
  /** Hide the progress strip (e.g. on the intro and success states). */
  hideProgress?: boolean;
  /** Form content rendered inside the right panel. */
  children: ReactNode;
  /**
   * When set, the header "Back" control steps backward inside this flow
   * (same semantics as each step's Back button). When unset, Back goes home (`/`).
   */
  onFlowBack?: () => void;
}

/**
 * Two-panel layout for the host-application flow.
 *
 * Layout strategy:
 *  - Mobile (< lg): single column, **natural document scrolling**.
 *    The browser viewport — and not a nested `overflow-y-auto` region —
 *    owns the scroll. This is what makes the layout robust against
 *    Android Chrome's dynamic toolbar (where `100vh` ≠ visible viewport
 *    and inner-scroll patterns push the action row off-screen).
 *  - Desktop (lg+): fixed two-panel layout; only the right panel scrolls.
 *
 * Each step component is responsible for its own action buttons (placed
 * inline at the end of its content) — there is no global sticky footer
 * for action buttons, because sticky-bottom action rows are precisely
 * what breaks on Android.
 */
export function HostRegisterShell({
  step,
  hideProgress,
  children,
  onFlowBack,
}: Props) {
  const visibleSteps = HOST_REGISTER_STEPS;
  const isVisibleStep = (visibleSteps as readonly string[]).includes(step);
  const stepIndex = isVisibleStep
    ? visibleSteps.indexOf(step as (typeof visibleSteps)[number])
    : 0;
  const total = visibleSteps.length;
  const heading = isVisibleStep
    ? HOST_STEP_TITLES[step as (typeof visibleSteps)[number]]
    : "";

  return (
    <div className="flex min-h-dvh w-full flex-col bg-white lg:h-dvh lg:max-h-dvh lg:flex-row lg:overflow-hidden">
      {/* ════════════════════════════════════════════════
          LEFT PANEL — host-specific brand panel (lg+ only)
          ════════════════════════════════════════════════ */}
      <aside
        className={`hidden lg:flex flex-col w-[46%] xl:w-[42%] shrink-0 bg-cb-yellow ${shellPad} min-h-0 overflow-hidden`}
      >
        <div className="h-16 shrink-0 flex items-center">
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
              alt="Become a CancerBuddy host"
              width={460}
              height={500}
              className="w-full max-h-[min(50vh,480px)] object-contain"
              priority
            />
          </div>
          <div
            className="mt-3 sm:mt-4 text-center shrink-0"
            style={{ animation: "hero-fade-up 0.6s ease-out 0.25s both" }}
          >
            <p className="font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-cb-gray-700">
              Host Application
            </p>
            <p
              className="mt-1.5 font-heading font-bold text-cb-black leading-snug"
              style={{ fontSize: "clamp(1.25rem, 1.9vw, 1.6rem)" }}
            >
              Lead with empathy.
              <br />
              Help someone feel less alone.
            </p>
          </div>
        </div>

        <div className="h-16 shrink-0 flex items-center gap-3">
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
          RIGHT PANEL — header + content + footer
          ════════════════════════════════════════════════ */}
      <main className="flex w-full min-w-0 flex-1 flex-col bg-white lg:min-h-0 lg:overflow-hidden">
        {/* Header — sticky on mobile so Back / Sign-in stay reachable
            while the user scrolls; static on lg+ (the panel is locked). */}
        <header
          className={`sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-cb-gray-100/80 bg-white sm:h-16 lg:static ${shellPad}`}
        >
          <div className="flex min-w-0 shrink-0 items-center">
            {onFlowBack ? (
              <button
                type="button"
                onClick={onFlowBack}
                className="-ms-2 inline-flex h-10 min-w-10 touch-manipulation items-center gap-1.5 rounded-full px-2 text-sm font-medium text-cb-gray-700 transition-colors hover:text-cb-black active:bg-cb-gray-100"
                aria-label="Back"
              >
                <ArrowLeftIcon />
                <span className="hidden sm:inline">Back</span>
              </button>
            ) : (
              <Link
                href="/"
                className="-ms-2 inline-flex h-10 min-w-10 touch-manipulation items-center gap-1.5 rounded-full px-2 text-sm font-medium text-cb-gray-700 transition-colors hover:text-cb-black active:bg-cb-gray-100"
                aria-label="Back"
              >
                <ArrowLeftIcon />
                <span className="hidden sm:inline">Back</span>
              </Link>
            )}
          </div>

          <Link
            href="/"
            className="pointer-events-auto shrink-0 lg:hidden"
            aria-label="CancerBuddy home"
          >
            <Image
              src="/images/trademark-logo.png"
              alt="CancerBuddy"
              width={120}
              height={16}
              className="h-4 w-auto object-contain sm:h-5"
            />
          </Link>

          <p className="min-w-0 shrink-0 text-end font-body text-sm text-cb-gray-500">
            <span className="hidden sm:inline">Already a member?</span>{" "}
            <Link
              href="/login"
              className="font-medium text-cb-black underline-offset-2 transition-colors hover:text-cb-gray-700 hover:underline sm:underline"
            >
              Sign in
            </Link>
          </p>
        </header>

        {/* Content region.
            Mobile: grows with content; the document scrolls.
            Desktop: own scroll container so the panel header / footer stay fixed. */}
        <div
          className={[
            "flex flex-1 flex-col",
            shellPad,
            "pt-4 sm:pt-5 pb-6 sm:pb-5",
            "lg:min-h-0 lg:overflow-y-auto",
          ].join(" ")}
        >
          <div className="mx-auto flex w-full min-w-0 max-w-[520px] flex-1 flex-col">
            {!hideProgress && isVisibleStep ? (
              <div className="mb-4 sm:mb-5">
                <div className="mb-1.5 flex items-baseline justify-between gap-2 sm:mb-2">
                  <p className="font-body text-sm font-medium text-cb-gray-500">
                    <span className="sr-only">
                      Step {stepIndex + 1} of {total}.{" "}
                    </span>
                    <span aria-hidden className="tabular-nums text-cb-black">
                      {stepIndex + 1}
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
                    {heading}
                  </p>
                </div>
                <div className="flex h-1.5 gap-1" aria-hidden>
                  {visibleSteps.map((s, i) => {
                    const done = i < stepIndex;
                    const current = i === stepIndex;
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

        {/* Footer — hidden on mobile to keep the action row visible
            without a fixed footer eating vertical space. */}
        <footer
          className={`hidden shrink-0 flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-cb-gray-100/80 bg-white py-3 text-xs text-cb-gray-400 sm:flex sm:h-16 sm:py-0 ${shellPad}`}
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
