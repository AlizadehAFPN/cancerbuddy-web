"use client";

import { useFormContext } from "react-hook-form";
import { Button, Textarea, ServerAlert } from "@/components/ui";
import { BIO_MAX_LENGTH } from "@/lib/host-signup/constants";
import type { HostRegisterFormValues } from "@/lib/host-signup/validation";
import { t } from "@/lib/i18n";

interface Props {
  submitting: boolean;
  serverError: string | null;
  onBack: () => void;
  onApply: () => void;
}

export function StepBio({ submitting, serverError, onBack, onApply }: Props) {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<HostRegisterFormValues>();

  const bio = watch("bio") ?? "";
  const length = bio.length;
  const withinMax = length <= BIO_MAX_LENGTH;
  const canApply = withinMax && !submitting;

  const counterTone =
    length > BIO_MAX_LENGTH
      ? "text-cb-danger"
      : length > BIO_MAX_LENGTH - 80
        ? "text-cb-warning"
        : "text-cb-gray-500";

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.5rem, 2.1vw, 1.875rem)", lineHeight: 1.15 }}
        >
          {t("hostsRegister.bio.heading")}
        </h1>
        <p className="mt-1 font-body text-[14px] text-cb-gray-500">
          {t("hostsRegister.bio.sub")}
        </p>
      </div>

      {serverError ? (
        <ServerAlert message={serverError} className="mb-4" />
      ) : null}

      <Textarea
        label={t("hostsRegister.bio.label")}
        placeholder={t("hostsRegister.bio.placeholder")}
        rows={7}
        maxLength={BIO_MAX_LENGTH}
        autoFocus
        labelHint={
          <span className={counterTone}>
            {t("hostsRegister.bio.counter", { length, max: BIO_MAX_LENGTH })}
          </span>
        }
        error={errors.bio?.message}
        {...register("bio")}
      />

      <div className="mt-6 flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={onBack}
          disabled={submitting}
          className="touch-manipulation"
        >
          {t("common.back")}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!canApply}
          onClick={onApply}
          title={!withinMax ? t("hostsRegister.bio.tooLongTitle") : undefined}
          className="touch-manipulation"
        >
          {submitting
            ? t("hostsRegister.bio.submitting")
            : t("hostsRegister.bio.apply")}
        </Button>
      </div>
    </div>
  );
}
