"use client";

/**
 * `/forgot-password` — recovering an account from the browser.
 *
 * The login screen has linked here since it was built; the route did not exist,
 * so the link rendered `app/not-found.tsx` and the only way back into an account
 * was to install the mobile app.
 *
 * Mobile's `RecoveryPassword` is one screen holding both halves: it fires
 * `sendForgotPasswordCode` on focus, then takes the code and the new password
 * together, and signs the member in on success. Web splits it in two, because a
 * browser has no "on focus" moment — arriving at a URL must not send mail, or a
 * refresh sends another. Asking for the email first is also what makes the flow
 * survive a reload.
 *
 * Everything after the reset is mobile's: sign in with the new password and land
 * wherever the account's onboarding state says, which is the same routing the
 * login page does.
 */

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { t } from "@/lib/i18n";
import { Button, Input } from "@/components/ui";
import { OtpInput, PasswordStrengthMeter } from "@/components/auth";
import { OTP_LENGTH, OTP_RESEND_COOLDOWN_SEC } from "@/lib/signup";
import {
  resetEmailSchema,
  resetPasswordSchema,
  type ResetEmailFormData,
  type ResetPasswordFormData,
} from "@/lib/password-reset/validation";
import {
  sendResetCode,
  submitNewPassword,
} from "@/lib/password-reset/service";
import { defaultLoginService } from "@/lib/login/service";
import { useUserSignupStore } from "@/lib/user-signup/store";

function ArrowLeftIcon() {
  return (
    <svg
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

type Stage = "email" | "reset" | "unconfirmed";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendLeft, setResendLeft] = useState(0);

  const emailForm = useForm<ResetEmailFormData>({
    resolver: zodResolver(resetEmailSchema),
    mode: "onBlur",
  });

  const resetForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onBlur",
  });

  const password = resetForm.watch("password") ?? "";

  /* Resend cooldown, same 60 s the signup OTP steps use. */
  useEffect(() => {
    if (resendLeft <= 0) return;
    const id = window.setInterval(
      () => setResendLeft((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => window.clearInterval(id);
  }, [resendLeft]);

  /** Shared by the first submit and Resend. */
  const requestCode = useCallback(async (address: string) => {
    setServerError(null);
    setNotice(null);
    setBusy(true);
    try {
      const result = await sendResetCode(address);

      if (result.status === "RATE_LIMITED") {
        setServerError(t("passwordReset.rateLimited"));
        return false;
      }
      if (result.status === "UNCONFIRMED") {
        setStage("unconfirmed");
        return false;
      }

      /**
       * `UNKNOWN_EMAIL` deliberately falls through to the code screen. Telling a
       * stranger which addresses have accounts turns this form into a way to
       * enumerate the membership of a cancer-support community.
       */
      setEmail(address);
      setResendLeft(OTP_RESEND_COOLDOWN_SEC);
      setStage("reset");
      return true;
    } catch (err) {
      console.error("[password-reset] send failed:", err);
      setServerError(t("errors.fallback"));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const onRequest = emailForm.handleSubmit(async (data) => {
    await requestCode(data.email.trim().toLowerCase());
  });

  const onResend = useCallback(async () => {
    if (resendLeft > 0 || busy) return;
    const sent = await requestCode(email);
    if (sent) setNotice(t("passwordReset.resent"));
  }, [resendLeft, busy, email, requestCode]);

  const onReset = resetForm.handleSubmit(async (data) => {
    setServerError(null);
    setNotice(null);
    setBusy(true);

    try {
      const result = await submitNewPassword({
        email,
        code: data.code,
        password: data.password,
      });

      if (result.status !== "OK") {
        setServerError(
          result.status === "CODE_MISMATCH"
            ? t("passwordReset.codeMismatch")
            : result.status === "CODE_EXPIRED"
              ? t("passwordReset.codeExpired")
              : result.status === "RATE_LIMITED"
                ? t("passwordReset.rateLimited")
                : result.message,
        );
        setBusy(false);
        return;
      }

      /**
       * Mobile signs in immediately (`RecoveryPassword.tsx:67`), which is also
       * what makes the resume branches below reachable: the same classification
       * the login page acts on.
       */
      setNotice(t("passwordReset.done"));
      const login = await defaultLoginService.login({
        email,
        password: data.password,
      });

      switch (login.status) {
        case "DONE":
          router.push("/groups");
          return;
        case "RESUME_PHONE":
          useUserSignupStore.getState().advanceFurthestStep("phone");
          router.push("/register?step=phone&resumed=1");
          return;
        case "RESUME_USER_ROLE":
          useUserSignupStore.getState().advanceFurthestStep("userRole");
          router.push("/register?step=userRole&resumed=1");
          return;
        default:
          /* The password did change — say so, and let them sign in by hand. */
          setNotice(null);
          setServerError(t("passwordReset.signInFailed"));
          setBusy(false);
          return;
      }
    } catch (err) {
      console.error("[password-reset] submit failed:", err);
      setServerError(t("errors.fallback"));
      setBusy(false);
    }
  });

  const shellPad = "px-6 sm:px-8 lg:px-12";

  return (
    <div className="flex min-h-dvh w-full flex-col bg-white">
      <header
        className={`flex h-14 shrink-0 items-center justify-between gap-3 border-b border-cb-gray-100/80 sm:h-16 ${shellPad}`}
      >
        <Link
          href="/login"
          className="inline-flex shrink-0 items-center gap-1.5 font-body text-sm font-medium text-cb-gray-600 transition-colors hover:text-cb-black"
        >
          <ArrowLeftIcon />
          {t("passwordReset.backToLogin")}
        </Link>
        <Link href="/" aria-label={t("common.cancerBuddyHome")} className="shrink-0">
          <Image
            src="/images/trademark-logo.png"
            alt={t("common.cancerBuddyAlt")}
            width={155}
            height={21}
            className="object-contain"
          />
        </Link>
      </header>

      <main
        className={`flex flex-1 flex-col justify-center py-10 ${shellPad}`}
      >
        <div className="mx-auto w-full max-w-[440px]">
          {stage === "unconfirmed" ? (
            <>
              <h1 className="font-heading text-[26px] font-bold tracking-tight text-cb-black">
                {t("passwordReset.unconfirmedTitle")}
              </h1>
              <p className="mt-2 font-body text-[15px] leading-relaxed text-cb-gray-600">
                {t("passwordReset.unconfirmedBody")}
              </p>
              <div className="mt-6">
                <Button onClick={() => router.push("/register")} fullWidth>
                  {t("passwordReset.unconfirmedCta")}
                </Button>
              </div>
            </>
          ) : stage === "email" ? (
            <form onSubmit={onRequest} noValidate>
              <h1 className="font-heading text-[26px] font-bold tracking-tight text-cb-black">
                {t("passwordReset.requestHeading")}
              </h1>
              <p className="mt-2 font-body text-[15px] leading-relaxed text-cb-gray-600">
                {t("passwordReset.requestSub")}
              </p>

              {serverError && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-cb-danger/30 bg-cb-danger/10 px-4 py-3 font-body text-[13.5px] text-cb-black"
                >
                  {serverError}
                </p>
              )}

              <div className="mt-6">
                <Input
                  label={t("passwordReset.emailLabel")}
                  placeholder={t("passwordReset.emailPlaceholder")}
                  type="email"
                  autoComplete="email"
                  autoFocus
                  error={emailForm.formState.errors.email?.message}
                  {...emailForm.register("email")}
                />
              </div>

              <Button type="submit" fullWidth loading={busy} className="mt-2">
                {t("passwordReset.requestSubmit")}
              </Button>
            </form>
          ) : (
            <form onSubmit={onReset} noValidate>
              <h1 className="font-heading text-[26px] font-bold tracking-tight text-cb-black">
                {t("passwordReset.resetHeading")}
              </h1>
              <p className="mt-2 font-body text-[15px] leading-relaxed text-cb-gray-600">
                {t("passwordReset.resetSub", { length: OTP_LENGTH, email })}
              </p>

              {serverError && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-cb-danger/30 bg-cb-danger/10 px-4 py-3 font-body text-[13.5px] text-cb-black"
                >
                  {serverError}
                </p>
              )}
              {notice && (
                <p
                  role="status"
                  className="mt-4 rounded-xl border border-cb-gray-200 bg-cb-bone px-4 py-3 font-body text-[13.5px] text-cb-black"
                >
                  {notice}
                </p>
              )}

              <div className="mt-6">
                <p className="mb-2 font-body text-sm font-semibold text-cb-black">
                  {t("passwordReset.codeLabel")}
                </p>
                <OtpInput
                  value={code}
                  onChange={(v) => {
                    setCode(v);
                    resetForm.setValue("code", v, { shouldValidate: v.length === OTP_LENGTH });
                  }}
                  disabled={busy}
                  hasError={Boolean(resetForm.formState.errors.code)}
                  autoFocus
                />
                {resetForm.formState.errors.code && (
                  <p className="mt-1.5 font-body text-[13px] text-cb-danger">
                    {resetForm.formState.errors.code.message}
                  </p>
                )}

                <div className="mt-2.5">
                  <button
                    type="button"
                    onClick={onResend}
                    disabled={resendLeft > 0 || busy}
                    className="font-body text-[13.5px] font-semibold text-cb-black underline-offset-2 hover:underline disabled:cursor-default disabled:text-cb-gray-400 disabled:no-underline"
                  >
                    {resendLeft > 0
                      ? t("passwordReset.resendIn", { seconds: resendLeft })
                      : t("passwordReset.resendCode")}
                  </button>
                </div>
              </div>

              <div className="mt-5">
                <Input
                  label={t("passwordReset.passwordLabel")}
                  placeholder={t("passwordReset.passwordPlaceholder")}
                  type="password"
                  autoComplete="new-password"
                  error={resetForm.formState.errors.password?.message}
                  {...resetForm.register("password")}
                />
                <PasswordStrengthMeter value={password} />
              </div>

              <div className="mt-4">
                <Input
                  label={t("passwordReset.confirmLabel")}
                  placeholder={t("passwordReset.confirmPlaceholder")}
                  type="password"
                  autoComplete="new-password"
                  error={resetForm.formState.errors.confirmPassword?.message}
                  {...resetForm.register("confirmPassword")}
                />
              </div>

              <Button type="submit" fullWidth loading={busy} className="mt-5">
                {t("passwordReset.resetSubmit")}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStage("email");
                  setCode("");
                  setServerError(null);
                  setNotice(null);
                }}
                className="mt-3 w-full font-body text-[13.5px] font-medium text-cb-gray-600 transition-colors hover:text-cb-black"
              >
                {t("passwordReset.changeEmail")}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
