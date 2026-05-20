"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  USER_REGISTER_STEPS,
  type UserRegisterStep,
} from "@/lib/user-signup/constants";
import { t, type MessageKey } from "@/lib/i18n";
import { HelpDialog } from "@/components/auth";

const USER_STEP_TITLE_KEYS: Partial<Record<UserRegisterStep, MessageKey>> = {
  privacy: "register.stepTitles.privacy",
  profile: "register.stepTitles.profile",
  guardian: "register.stepTitles.guardian",
  guardianOtp: "register.stepTitles.guardianOtp",
  credentials: "register.stepTitles.credentials",
  emailOtp: "register.stepTitles.emailOtp",
  phone: "register.stepTitles.phone",
  verifiedSuccessfully: "register.stepTitles.verifiedSuccessfully",
  userRole: "register.stepTitles.userRole",
  cgRelationship: "register.stepTitles.cgRelationship",
  cgPatientAge: "register.stepTitles.cgPatientAge",
  diagnosis: "register.stepTitles.diagnosis",
  medicalCenter: "register.stepTitles.medicalCenter",
  address: "register.stepTitles.address",
  createProfile: "register.stepTitles.createProfile",
  profilePic: "register.stepTitles.profilePic",
  about: "register.stepTitles.about",
  interests: "register.stepTitles.interests",
  languages: "register.stepTitles.languages",
  photos: "register.stepTitles.photos",
  loading: "register.stepTitles.loading",
  allSet: "register.stepTitles.allSet",
};

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
  step: UserRegisterStep;
  /** Hide the progress strip (e.g. intro splash). */
  hideProgress?: boolean;
  /** Form content rendered inside the right panel. */
  children: ReactNode;
  /** When set, the header Back control steps backward inside the flow. */
  onFlowBack?: () => void;
}

/**
 * Two-panel layout for the regular-user `/register` flow.
 *
 * Visually parallels `HostRegisterShell` (yellow left panel + white right
 * panel) but with user-flow copy on the left so the brand context is right
 * from the first paint: "Find your support community" rather than the host
 * application eyebrow.
 *
 * Layout strategy (same as the host shell): mobile = natural document
 * scrolling, lg+ = fixed two-panel with only the right panel scrolling.
 * See `HostRegisterShell` for the full rationale around Android Chrome's
 * dynamic toolbar making `100vh` lie about the visible viewport.
 */
export function RegisterShell({
  step,
  hideProgress,
  children,
  onFlowBack,
}: Props) {
  const visibleSteps = USER_REGISTER_STEPS;
  const isVisibleStep = (visibleSteps as readonly string[]).includes(step);
  const stepIndex = isVisibleStep
    ? visibleSteps.indexOf(step as (typeof visibleSteps)[number])
    : 0;
  const total = visibleSteps.length;
  const titleKey = USER_STEP_TITLE_KEYS[step];
  const heading = isVisibleStep && titleKey ? t(titleKey) : "";

  return (
    <div className="flex min-h-dvh w-full flex-col bg-white lg:h-dvh lg:max-h-dvh lg:flex-row lg:overflow-hidden">
      {/* ═══════════ LEFT PANEL — brand context ═══════════ */}
      <aside
        className={`hidden lg:flex flex-col w-[46%] xl:w-[42%] shrink-0 bg-cb-yellow ${shellPad} min-h-0 overflow-hidden`}
      >
        <div className="h-16 shrink-0 flex items-center">
          <Link href="/" aria-label={t("common.backToCancerBuddyHome")}>
            <Image
              src="/images/trademark-logo.png"
              alt={t("common.cancerBuddyAlt")}
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
              alt={t("common.cancerBuddyCommunityIllustratedAlt")}
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
              {t("register.leftPanel.eyebrow")}
            </p>
            <p
              className="mt-1.5 font-heading font-bold text-cb-black leading-snug"
              style={{ fontSize: "clamp(1.25rem, 1.9vw, 1.6rem)" }}
            >
              {t("register.leftPanel.tagline")
                .split("\n")
                .map((line, i, arr) => (
                  <span key={i}>
                    {line}
                    {i < arr.length - 1 ? <br /> : null}
                  </span>
                ))}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-cb-black/10 py-3 min-h-[4rem]">
          <span className="text-[11px] font-medium text-cb-gray-600 tracking-[0.12em] uppercase">
            {t("common.poweredBy")}
          </span>
          <Image
            src="/images/BMCF_LOGO_WIDE.svg"
            alt={t("common.bmcfLogoAlt")}
            width={88}
            height={30}
            className="object-contain"
          />
          <div className="ms-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-cb-gray-600">
            <Link href="/privacy" className="hover:text-cb-black transition-colors">
              {t("common.privacyPolicy")}
            </Link>
            <Link href="/terms" className="hover:text-cb-black transition-colors">
              {t("common.termsOfService")}
            </Link>
            <Link href="/support" className="hover:text-cb-black transition-colors">
              {t("common.support")}
            </Link>
            <span className="text-cb-gray-500">
              {t("common.copyright", { year: new Date().getFullYear() })}
            </span>
          </div>
        </div>
      </aside>

      {/* ═══════════ RIGHT PANEL ═══════════ */}
      <main className="flex w-full min-w-0 flex-1 flex-col bg-white lg:min-h-0 lg:overflow-hidden">
        <header
          className={`sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-cb-gray-100/80 bg-white sm:h-16 lg:static ${shellPad}`}
        >
          <div className="flex min-w-0 shrink-0 items-center">
            {onFlowBack ? (
              <button
                type="button"
                onClick={onFlowBack}
                className="-ms-2 inline-flex h-10 min-w-10 touch-manipulation items-center gap-1.5 rounded-full px-2 text-sm font-medium text-cb-gray-700 transition-colors hover:text-cb-black active:bg-cb-gray-100"
                aria-label={t("common.back")}
              >
                <ArrowLeftIcon />
                <span className="hidden sm:inline">{t("common.back")}</span>
              </button>
            ) : (
              <Link
                href="/"
                className="-ms-2 inline-flex h-10 min-w-10 touch-manipulation items-center gap-1.5 rounded-full px-2 text-sm font-medium text-cb-gray-700 transition-colors hover:text-cb-black active:bg-cb-gray-100"
                aria-label={t("common.back")}
              >
                <ArrowLeftIcon />
                <span className="hidden sm:inline">{t("common.back")}</span>
              </Link>
            )}
          </div>

          <Link
            href="/"
            className="pointer-events-auto shrink-0 lg:hidden"
            aria-label={t("common.cancerBuddyHome")}
          >
            <Image
              src="/images/trademark-logo.png"
              alt={t("common.cancerBuddyAlt")}
              width={120}
              height={16}
              className="h-4 w-auto object-contain sm:h-5"
            />
          </Link>

          <div className="flex shrink-0 items-center gap-3">
            <HelpDialog />
            <p className="min-w-0 text-end font-body text-sm text-cb-gray-500">
              <span className="hidden sm:inline">{t("register.alreadyMember")}</span>{" "}
              <Link
                href="/login"
                className="font-medium text-cb-black underline-offset-2 transition-colors hover:text-cb-gray-700 hover:underline sm:underline"
              >
                {t("common.signIn")}
              </Link>
            </p>
          </div>
        </header>

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
                      {t("signup.stepOfTotal", {
                        current: stepIndex + 1,
                        total,
                      })}{" "}
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

        <footer
          className={`hidden shrink-0 flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-cb-gray-100/80 bg-white py-3 text-xs text-cb-gray-400 sm:flex lg:hidden sm:h-16 sm:py-0 ${shellPad}`}
        >
          <Link
            href="/privacy"
            className="hover:text-cb-gray-600 transition-colors"
          >
            {t("common.privacyPolicy")}
          </Link>
          <Link
            href="/terms"
            className="hover:text-cb-gray-600 transition-colors"
          >
            {t("common.termsOfService")}
          </Link>
          <Link
            href="/support"
            className="hover:text-cb-gray-600 transition-colors"
          >
            {t("common.support")}
          </Link>
          <span className="ms-auto text-cb-gray-300">
            {t("common.copyright", { year: new Date().getFullYear() })}
          </span>
        </footer>
      </main>
    </div>
  );
}
