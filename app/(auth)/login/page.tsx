"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormData } from "@/lib/validations";
import { Button, Input } from "@/components/ui";

/* ── Inline icons ── */

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

/* ── Page ── */

export default function LoginPage() {
  const [loading,     setLoading]     = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

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
    try {
      // TODO: Wire up auth provider (AWS Cognito / Supabase / etc.)
      // const result = await loginAction(data);
      // if (!result.success) throw new Error(result.rootError);
      // router.push('/dashboard');
      void data;
    } catch {
      setServerError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const shellPad = "px-6 sm:px-8 lg:px-12";
  /** Fluid vertical gaps so the form column fits between header + footer without scrolling */
  const blockGap = "gap-[clamp(0.75rem,min(2.8vh,3.5vw),2rem)]";
  const fieldMb = "!mb-[clamp(0.45rem,min(1.6vh,2vw),1.1rem)]";

  return (
    <div className="fixed inset-0 z-0 flex h-dvh max-h-dvh min-h-0 w-full overflow-hidden overscroll-none">

      {/* ════════════════════════════════════════════════
          LEFT PANEL — brand + illustration
          Visible on large screens only.
      ════════════════════════════════════════════════ */}
      <aside className={`hidden lg:flex flex-col w-[46%] xl:w-[42%] shrink-0 bg-cb-yellow ${shellPad} min-h-0 overflow-hidden`}>

        {/* ── Header row — matches the right panel's top bar ── */}
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

        {/* Illustration */}
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

          {/* Tagline */}
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

        {/* ── Footer row ── */}
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
          RIGHT PANEL — sign-in form
      ════════════════════════════════════════════════ */}
      <main className="flex min-h-0 flex-1 flex-col bg-white overflow-hidden">

        {/* ── Top bar ── */}
        <header className={`h-14 sm:h-16 shrink-0 flex items-center justify-between gap-3 ${shellPad} border-b border-cb-gray-100/80`}>
          {/* Back link — visible on mobile + as a subtle link on desktop */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-cb-gray-600 hover:text-cb-black transition-colors shrink-0"
          >
            <ArrowLeftIcon />
            Back
          </Link>

          {/* Mobile-only logo */}
          <Link href="/" className="lg:hidden shrink-0" aria-label="CancerBuddy home">
            <Image
              src="/images/trademark-logo.png"
              alt="CancerBuddy"
              width={155}
              height={21}
              className="object-contain"
            />
          </Link>

          {/* Sign-up nudge */}
          <p className="text-sm text-cb-gray-500 font-body min-w-0 text-end">
            No account?{" "}
            <Link
              href="/signup"
              className="font-medium text-cb-black underline underline-offset-2 hover:text-cb-gray-700 transition-colors whitespace-nowrap"
            >
              Get started
            </Link>
          </p>
        </header>

        {/* ── Form — fills viewport between header & footer; no internal scroll ── */}
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
                Welcome back
              </h1>
              <p
                className="mt-[clamp(0.25rem,0.8vh,0.5rem)] font-body text-cb-gray-500 text-[clamp(0.875rem, min(0.35vw + 0.8rem, 2.5vh), 1rem)] leading-snug"
              >
                Sign in to your CancerBuddy account
              </p>
            </div>

            {/* Fields */}
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="flex min-h-0 shrink flex-col"
            >
              <Input
                label="Email address"
                placeholder="you@example.com"
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
                label="Password"
                placeholder="Your password"
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
                Forgot password?
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

              {/* Submit */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
              >
                Sign in
              </Button>
            </form>

            {/* Divider */}
            <div className="flex shrink-0 items-center gap-3 sm:gap-4">
              <span className="h-px min-w-0 flex-1 bg-cb-gray-200" />
              <span className="shrink-0 text-[11px] text-cb-gray-400 font-body tracking-wider uppercase sm:text-xs">
                or
              </span>
              <span className="h-px min-w-0 flex-1 bg-cb-gray-200" />
            </div>

            {/* Sign-up CTA */}
            <p className="shrink-0 text-center text-[clamp(0.8125rem,min(0.2vw + 0.78rem,2.2vh),0.875rem)] text-cb-gray-500 font-body leading-tight">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-medium text-cb-black underline underline-offset-2 hover:text-cb-gray-700 transition-colors"
              >
                Create a free account →
              </Link>
            </p>
          </div>
        </div>

        {/* ── Footer strip ── */}
        <footer className={`shrink-0 flex flex-wrap items-center gap-x-5 gap-y-1.5 py-3 sm:h-16 sm:py-0 ${shellPad} border-t border-cb-gray-100/80 text-xs text-cb-gray-400`}>
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
          <span className="ms-auto text-cb-gray-300">
            © {new Date().getFullYear()} CancerBuddy
          </span>
        </footer>

      </main>
    </div>
  );
}
