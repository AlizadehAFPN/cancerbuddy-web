"use client";

/**
 * Asks an account with no phone number to add one.
 *
 * Signup collects a number and verifies it over Twilio, but accounts created
 * before that step existed have none — and web offered no phone-capture surface
 * outside the registration wizard, so such an account could never gain one in a
 * browser. Mobile prompts.
 *
 * Reuses `cognitoUserSignupService`'s phone methods rather than reimplementing
 * the Twilio exchange: same Lambda verbs, same sid handling, same result codes.
 */

import { useCallback, useState } from "react";

import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import Input from "@/components/ui/Input";
import { PhoneInput } from "@/components/auth/PhoneInput";
import { Sheet } from "@/components/ui/Sheet";
import { cognitoUserSignupService } from "@/lib/user-signup/cognitoUserSignupService";
import { buildE164, phoneOtpSchema, phoneSchema } from "@/lib/user-signup/validation";
import { PHONE_PROMPT_DISMISSED_KEY } from "@/lib/profile/phoneStatus";

type Step = "number" | "code";

export default function PhoneCaptureDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("number");
  /** Split, because E.164 needs the country — the same control signup uses. */
  const [countryIso2, setCountryIso2] = useState("US");
  const [national, setNational] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dismiss = useCallback(() => {
    try {
      // Session-scoped: declining should not re-prompt on every navigation, but
      // it should ask again next time they sign in.
      window.sessionStorage.setItem(PHONE_PROMPT_DISMISSED_KEY, "true");
    } catch {
      /* private mode — the prompt simply reappears */
    }
    onClose();
  }, [onClose]);

  const e164 = buildE164(countryIso2, national);

  const submitNumber = useCallback(async () => {
    setError(null);
    const parsed = phoneSchema.safeParse({ countryIso2, national });
    if (!parsed.success || !e164) {
      setError(parsed.error?.issues[0]?.message ?? t("app.profile.phoneInvalid"));
      return;
    }

    setBusy(true);
    try {
      const result = await cognitoUserSignupService.startPhoneVerification({
        phoneE164: e164,
      });
      if (result.status === "OTP_SENT") {
        setStep("code");
        return;
      }
      setError(
        result.status === "ALREADY_IN_USE"
          ? t("app.profile.phoneInUse")
          : t("app.profile.phoneInvalid"),
      );
    } catch {
      setError(t("app.profile.phoneError"));
    } finally {
      setBusy(false);
    }
  }, [countryIso2, national, e164]);

  const submitCode = useCallback(async () => {
    setError(null);
    const parsed = phoneOtpSchema.safeParse({ otp: code });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("app.profile.codeInvalid"));
      return;
    }

    setBusy(true);
    try {
      const result = await cognitoUserSignupService.confirmPhone({
        phoneE164: e164 ?? "",
        code,
      });
      if (result.status === "CONFIRMED") {
        try {
          window.sessionStorage.removeItem(PHONE_PROMPT_DISMISSED_KEY);
        } catch {
          /* nothing to clear */
        }
        onClose();
        return;
      }
      setError(
        result.status === "CODE_EXPIRED"
          ? t("app.profile.codeExpired")
          : t("app.profile.codeInvalid"),
      );
    } catch {
      setError(t("app.profile.phoneError"));
    } finally {
      setBusy(false);
    }
  }, [e164, code, onClose]);

  return (
    <Sheet
      open
      title={t("app.profile.phoneHeading")}
      onClose={dismiss}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={dismiss} disabled={busy}>
            {t("app.profile.phoneLater")}
          </Button>
          <Button
            fullWidth
            loading={busy}
            onClick={() => void (step === "number" ? submitNumber() : submitCode())}
          >
            {t(step === "number" ? "app.profile.phoneSend" : "app.profile.phoneVerify")}
          </Button>
        </div>
      }
    >
      <div className="px-5 pb-2">
        <p className="mb-4 font-body text-[14px] leading-snug text-cb-gray-700">
          {t(step === "number" ? "app.profile.phoneBody" : "app.profile.codeBody")}
        </p>

        {step === "number" ? (
          <PhoneInput
            countryIso2={countryIso2}
            national={national}
            onCountryChange={setCountryIso2}
            onNationalChange={setNational}
            autoFocus
          />
        ) : (
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("app.profile.codePlaceholder")}
            aria-label={t("app.profile.codeBody")}
          />
        )}

        {error && (
          <p role="alert" className="mt-2 font-body text-[13px] text-cb-danger">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
