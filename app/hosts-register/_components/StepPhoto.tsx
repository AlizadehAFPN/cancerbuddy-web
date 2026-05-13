"use client";

import { Button } from "@/components/ui";
import { PhotoPicker } from "@/components/auth";

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
          Add a photo
        </h1>
        <p className="mt-1 font-body text-[14px] text-cb-gray-500">
          A clear, friendly photo of yourself helps buddies feel comfortable
          reaching out.
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
          Back
        </Button>
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          onClick={onContinue}
          disabled={!photo || submitting}
          title={!photo ? "Choose a photo to continue." : undefined}
          className="touch-manipulation"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
