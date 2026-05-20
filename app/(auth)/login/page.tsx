"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormData } from "@/lib/validations";
import { Button, Input } from "@/components/ui";
import { t } from "@/lib/i18n";
import { defaultLoginService } from "@/lib/login/service";
import type { LoginResult } from "@/lib/login/types";
import { useUserSignupStore } from "@/lib/user-signup/store";

/* ─────────────────────────────────────────────────────────────────────────
   Inline icons
───────────────────────────────────────────────────────────────────────── */

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

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-[18px] h-[18px]"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-[18px] h-[18px]"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CheckCircleFilledIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-12 h-12" aria-hidden>
      <circle cx="24" cy="24" r="24" fill="#10b981" />
      <polyline
        points="13 25 20 32 35 16"
        fill="none"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5 shrink-0 text-amber-600"
      aria-hidden
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Registration-Complete modal
   Shown when sign-in confirms the user's onboarding is fully finished.
───────────────────────────────────────────────────────────────────────── */

interface RegistrationCompleteModalProps {
  onClose: () => void;
  onContinue: () => void;
}

function RegistrationCompleteModal({
  onClose,
  onContinue,
}: RegistrationCompleteModalProps) {
  const ctaRef = useRef<HTMLButtonElement>(null);

  /* Auto-focus primary CTA on open */
  useEffect(() => {
    ctaRef.current?.focus();
  }, []);

  /* Close on ESC */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-cb-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal
        aria-labelledby="reg-complete-heading"
        className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
        style={{ animation: "hero-fade-up 0.3s ease-out both" }}
      >
        {/* Colour strip at top */}
        <div className="h-1.5 w-full bg-emerald-500" />

        <div className="flex flex-col items-center text-center px-8 pt-8 pb-7">
          {/* Icon */}
          <div className="mb-5">
            <CheckCircleFilledIcon />
          </div>

          {/* Text */}
          <h2
            id="reg-complete-heading"
            className="font-heading font-bold text-cb-black text-[1.5rem] leading-tight mb-2.5"
          >
            {t("login.registrationCompleteHeading")}
          </h2>
          <p className="font-body text-cb-gray-500 text-sm leading-relaxed max-w-[320px]">
            {t("login.registrationCompleteSub")}
          </p>

          {/* CTAs */}
          <div className="mt-7 w-full flex flex-col gap-2.5">
            <Button
              ref={ctaRef}
              variant="primary"
              size="lg"
              fullWidth
              onClick={onContinue}
            >
              {t("login.registrationCompleteCta")}
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="text-sm font-body text-cb-gray-500 hover:text-cb-black transition-colors py-1"
            >
              {t("login.registrationCompleteClose")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Not-Confirmed inline banner
   Shown when Cognito's UserNotConfirmedException fires on sign-in.
───────────────────────────────────────────────────────────────────────── */

function NotConfirmedBanner() {
  return (
    <div
      role="alert"
      className="mb-[clamp(0.5rem,1.5vh,1.25rem)] rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5"
    >
      <div className="flex items-start gap-3">
        <WarningIcon />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-800 font-body leading-snug">
            {t("login.notConfirmedHeading")}
          </p>
          <p className="mt-0.5 text-sm text-amber-700 font-body leading-snug">
            {t("login.notConfirmedBody")}
          </p>
          <Link
            href="/register"
            className="mt-2 inline-block text-sm font-medium text-cb-black underline underline-offset-2 hover:text-cb-gray-700 transition-colors"
          >
            {t("login.notConfirmedCta")}
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Page
───────────────────────────────────────────────────────────────────────── */

export default function LoginPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showNotConfirmed, setShowNotConfirmed] = useState(false);
  const [doneResult, setDoneResult] = useState<LoginResult | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setServerError(null);
    setShowNotConfirmed(false);

    try {
      const result = await defaultLoginService.login({
        email: data.email,
        password: data.password,
      });

      switch (result.status) {
        /* ── Registration complete → show success modal ── */
        case "DONE":
          setDoneResult(result);
          setLoading(false);
          return;

        /* ── Phone not verified → resume phone-verification step ── */
        case "RESUME_PHONE":
          useUserSignupStore.getState().advanceFurthestStep("phone");
          router.push("/register?step=phone");
          // Keep loading=true; page unmounts as navigation completes.
          return;

        /* ── Phone verified but role not chosen → resume userRole step ── */
        case "RESUME_USER_ROLE":
          useUserSignupStore.getState().advanceFurthestStep("userRole");
          router.push("/register?step=userRole");
          return;

        /* ── Email OTP never completed → show inline notice with register link ── */
        case "NOT_CONFIRMED":
          setShowNotConfirmed(true);
          setLoading(false);
          return;

        /* ── Wrong email or password ── */
        case "WRONG_CREDENTIALS":
          setServerError(t("login.invalidCredentials"));
          setLoading(false);
          return;
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("errors.fallback");
      setServerError(msg);
      setLoading(false);
    }
  };

  const shellPad = "px-6 sm:px-8 lg:px-12";
  const blockGap = "gap-[clamp(0.75rem,min(2.8vh,3.5vw),2rem)]";
  const fieldMb = "!mb-[clamp(0.45rem,min(1.6vh,2vw),1.1rem)]";

  return (
    <>
      {/* ── Registration-complete overlay ── */}
      {doneResult?.status === "DONE" && (
        <RegistrationCompleteModal
          onClose={() => setDoneResult(null)}
          onContinue={() => router.push("/dashboard")}
        />
      )}

      <div className="fixed inset-0 z-0 flex h-dvh max-h-dvh min-h-0 w-full overflow-hidden overscroll-none">

        {/* ══════════════════════════════════════════════════════
            LEFT PANEL — brand + illustration
            Visible on large screens only.
        ══════════════════════════════════════════════════════ */}
        <aside className={`hidden lg:flex flex-col w-[46%] xl:w-[42%] shrink-0 bg-cb-yellow ${shellPad} min-h-0 overflow-hidden`}>

          {/* Header row */}
          <div className="h-14 sm:h-16 shrink-0 flex items-center">
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

          {/* Illustration */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-0 py-4">
            <div
              className="w-full max-w-[380px] min-h-0 flex flex-col justify-center"
              style={{ animation: "hero-fade-in 0.7s ease-out 0.1s both" }}
            >
              <Image
                src="/images/welcome.png"
                alt={t("common.cancerBuddyCommunityAlt")}
                width={460}
                height={500}
                className="w-full max-h-[min(52vh,500px)] object-contain"
                priority
              />
            </div>

            {/* Tagline */}
            <p
              className="mt-3 sm:mt-4 font-heading font-bold text-cb-black text-center leading-snug shrink-0"
              style={{
                fontSize: "clamp(1.35rem, 2vw, 1.75rem)",
                animation: "hero-fade-up 0.6s ease-out 0.25s both",
              }}
            >
              {t("login.tagline").split("\n").map((line, i, arr) => (
                <span key={i}>
                  {line}
                  {i < arr.length - 1 ? <br /> : null}
                </span>
              ))}
            </p>
          </div>

          {/* Footer row */}
          <div className="h-14 sm:h-16 shrink-0 flex items-center gap-3">
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
          </div>
        </aside>

        {/* ══════════════════════════════════════════════════════
            RIGHT PANEL — sign-in form
        ══════════════════════════════════════════════════════ */}
        <main className="flex min-h-0 flex-1 flex-col bg-white overflow-hidden">

          {/* Top bar */}
          <header className={`h-14 sm:h-16 shrink-0 flex items-center justify-between gap-3 ${shellPad} border-b border-cb-gray-100/80`}>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-cb-gray-600 hover:text-cb-black transition-colors shrink-0"
            >
              <ArrowLeftIcon />
              {t("common.back")}
            </Link>

            {/* Mobile-only logo */}
            <Link href="/" className="lg:hidden shrink-0" aria-label={t("common.cancerBuddyHome")}>
              <Image
                src="/images/trademark-logo.png"
                alt={t("common.cancerBuddyAlt")}
                width={155}
                height={21}
                className="object-contain"
              />
            </Link>

            {/* Sign-up nudge */}
            <p className="text-sm text-cb-gray-500 font-body min-w-0 text-end">
              {t("login.noAccount")}{" "}
              <Link
                href="/register"
                className="font-medium text-cb-black underline underline-offset-2 hover:text-cb-gray-700 transition-colors whitespace-nowrap"
              >
                {t("login.noAccountCta")}
              </Link>
            </p>
          </header>

          {/* Form — fills viewport between header & footer */}
          <div
            className={`flex min-h-0 flex-1 flex-col justify-center overflow-hidden ${shellPad}`}
            style={{
              paddingBlock: "clamp(0.35rem, min(2vh, 2.5vw), 1.1rem)",
            }}
          >
            <div
              className={`mx-auto flex w-full min-h-0 max-w-[440px] flex-col ${blockGap}`}
              style={{ animation: "hero-fade-up 0.55s ease-out both" }}
            >
              {/* Heading */}
              <div className="shrink-0">
                <h1
                  className="font-heading font-bold text-cb-black tracking-tight"
                  style={{
                    fontSize: "clamp(1.65rem, min(3.2vw, 4.2vh), 2.75rem)",
                    lineHeight: 1.1,
                  }}
                >
                  {t("login.heading")}
                </h1>
                <p className="mt-[clamp(0.25rem,0.8vh,0.5rem)] font-body text-cb-gray-500 text-[clamp(0.875rem, min(0.35vw + 0.8rem, 2.5vh), 1rem)] leading-snug">
                  {t("login.sub")}
                </p>
              </div>

              {/* Fields */}
              <form
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="flex min-h-0 shrink flex-col"
              >
                <Input
                  label={t("login.emailLabel")}
                  placeholder={t("login.emailPlaceholder")}
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  leftIcon={<MailIcon />}
                  error={errors.email?.message}
                  wrapperClassName={fieldMb}
                  {...register("email")}
                />

                <Input
                  label={t("login.passwordLabel")}
                  placeholder={t("login.passwordPlaceholder")}
                  type="password"
                  autoComplete="current-password"
                  leftIcon={<LockIcon />}
                  error={errors.password?.message}
                  wrapperClassName={fieldMb}
                  {...register("password")}
                />

                {/* Forgot password */}
                <Link
                  href="/forgot-password"
                  className="self-end -mt-1 mb-[clamp(0.65rem,min(2vh,2.5vw),1.75rem)] text-sm font-body text-cb-gray-600 underline underline-offset-2 hover:text-cb-black transition-colors"
                >
                  {t("login.forgotPassword")}
                </Link>

                {/* Server / root error */}
                {serverError && (
                  <div
                    role="alert"
                    className="mb-[clamp(0.5rem,1.5vh,1.25rem)] px-4 py-[clamp(0.5rem,1.2vh,0.75rem)] rounded-xl bg-cb-danger/10 border border-cb-danger/20 text-sm text-cb-danger font-body"
                  >
                    {serverError}
                  </div>
                )}

                {/* Not-confirmed banner */}
                {showNotConfirmed && <NotConfirmedBanner />}

                {/* Submit */}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={loading}
                >
                  {t("login.submit")}
                </Button>
              </form>

              {/* Divider */}
              <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                <span className="h-px min-w-0 flex-1 bg-cb-gray-200" />
                <span className="shrink-0 text-[11px] text-cb-gray-400 font-body tracking-wider uppercase sm:text-xs">
                  {t("login.or")}
                </span>
                <span className="h-px min-w-0 flex-1 bg-cb-gray-200" />
              </div>

              {/* Sign-up CTA */}
              <p className="shrink-0 text-center text-[clamp(0.8125rem,min(0.2vw + 0.78rem,2.2vh),0.875rem)] text-cb-gray-500 font-body leading-tight">
                {t("login.bottomCta")}{" "}
                <Link
                  href="/register"
                  className="font-medium text-cb-black underline underline-offset-2 hover:text-cb-gray-700 transition-colors"
                >
                  {t("login.bottomCtaLink")}
                </Link>
              </p>
            </div>
          </div>

          {/* Footer strip */}
          <footer className={`shrink-0 flex flex-wrap items-center gap-x-5 gap-y-1.5 py-3 sm:h-16 sm:py-0 ${shellPad} border-t border-cb-gray-100/80 text-xs text-cb-gray-400`}>
            <Link href="/privacy" className="hover:text-cb-gray-600 transition-colors">
              {t("common.privacyPolicy")}
            </Link>
            <Link href="/terms" className="hover:text-cb-gray-600 transition-colors">
              {t("common.termsOfService")}
            </Link>
            <span className="ms-auto text-cb-gray-300">
              {t("common.copyright", { year: new Date().getFullYear() })}
            </span>
          </footer>

        </main>
      </div>
    </>
  );
}
