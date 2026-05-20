"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui";
import type { UserRegisterFormValues } from "@/lib/user-signup/validation";
import { finalizeUserEnrollment } from "@/lib/user-signup/userEnrollmentFinalize";
import { t } from "@/lib/i18n";

interface Props {
  onDone: () => void;
}

export function StepLoading({ onDone }: Props) {
  const { getValues } = useFormContext<UserRegisterFormValues>();

  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Prevent double-fire in React 18 strict mode
  const startedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function run() {
    if (startedRef.current && !retrying) return;
    startedRef.current = true;
    setError(null);
    setRetrying(false);
    try {
      await finalizeUserEnrollment(getValues());
      if (mountedRef.current) onDone();
    } catch (e) {
      if (mountedRef.current) {
        setError(
          e instanceof Error
            ? e.message
            : t("register.serverError.finalizeFailed"),
        );
      }
    }
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center w-full py-8 text-center">
        <div className="mb-4 rounded-2xl border border-cb-danger/30 bg-cb-danger/5 px-5 py-4 max-w-sm w-full text-start">
          <p className="font-body text-[14px] text-cb-danger font-medium mb-1">
            Something went wrong
          </p>
          <p className="font-body text-[13px] text-cb-danger/80">{error}</p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={() => {
            startedRef.current = false;
            setRetrying(true);
            run();
          }}
          className="touch-manipulation mt-2"
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center w-full py-8">
      <div
        className="mb-8 flex items-center justify-center rounded-full bg-cb-yellow/20"
        style={{ width: 80, height: 80 }}
        aria-hidden
      >
        <span className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-cb-gray-200 border-t-cb-black" />
      </div>
      <h1
        className="font-heading font-bold text-cb-black tracking-tight text-center mb-3"
        style={{ fontSize: "clamp(1.25rem, 2vw, 1.5rem)", lineHeight: 1.2 }}
      >
        {t("register.loading.heading")}
      </h1>
      <p className="font-body text-[14px] text-cb-gray-500 text-center max-w-xs">
        {t("register.loading.sub")}
      </p>
    </div>
  );
}
