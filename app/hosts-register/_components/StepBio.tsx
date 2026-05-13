"use client";

import { useFormContext } from "react-hook-form";
import { Button, Textarea, ServerAlert } from "@/components/ui";
import { BIO_MAX_LENGTH } from "@/lib/host-signup/constants";
import type { HostRegisterFormValues } from "@/lib/host-signup/validation";

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
          Share your story
        </h1>
        <p className="mt-1 font-body text-[14px] text-cb-gray-500">
          Optional — a short personal statement helps us match you with the
          right buddies.
        </p>
      </div>

      {serverError ? (
        <ServerAlert message={serverError} className="mb-4" />
      ) : null}

      <Textarea
        label="Your story"
        placeholder="Tell us a little about you — your background, why you'd like to host, and what kind of support you can offer."
        rows={7}
        maxLength={BIO_MAX_LENGTH}
        autoFocus
        labelHint={
          <span className={counterTone}>
            {length} / {BIO_MAX_LENGTH}
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
          Back
        </Button>
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!canApply}
          onClick={onApply}
          title={!withinMax ? "Please shorten your story below the limit." : undefined}
          className="touch-manipulation"
        >
          {submitting ? "Submitting…" : "Apply"}
        </Button>
      </div>
    </div>
  );
}
