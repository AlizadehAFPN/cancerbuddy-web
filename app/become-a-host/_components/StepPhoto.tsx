"use client";

import { Button } from "@/components/ui";
import { PhotoPicker } from "@/components/auth";
import { t } from "@/lib/i18n";

interface Props {
  photo: File | null;
  onPhotoChange: (file: File | null) => void;
  error: string | null;
  submitting: boolean;
  onBack: () => void;
  onContinue: () => void;
}

export function StepPhoto({
  photo,
  onPhotoChange,
  error,
  submitting,
  onBack,
  onContinue,
}: Props) {
  return (
    <div className="w-full">
      <div className="mb-5">
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.5rem, 2.1vw, 1.875rem)", lineHeight: 1.15 }}
        >
          {t("hostsRegister.photo.heading")}
        </h1>
        <p className="mt-1 font-body text-[14px] text-cb-gray-500">
          {t("hostsRegister.photo.sub")}
        </p>
      </div>

      <PhotoPicker
        file={photo}
        onChange={onPhotoChange}
        error={error ?? undefined}
        id="host-photo"
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
          onClick={onContinue}
          disabled={!photo || submitting}
          title={!photo ? t("hostsRegister.photo.continueDisabledTitle") : undefined}
          className="touch-manipulation"
        >
          {t("common.continue")}
        </Button>
      </div>
    </div>
  );
}
