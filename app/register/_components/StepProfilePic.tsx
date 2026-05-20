"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui";
import { PhotoPicker } from "@/components/auth/PhotoPicker";
import type { UserRegisterFormValues } from "@/lib/user-signup/validation";
import { uploadPhotoAndCreatePicture } from "@/lib/user-signup/uploadPhoto";
import { t } from "@/lib/i18n";

interface Props {
  onContinue: () => void;
  onSkip: () => void;
}

export function StepProfilePic({ onContinue, onSkip }: Props) {
  const { setValue } = useFormContext<UserRegisterFormValues>();

  const [photo, setPhoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleContinue() {
    if (!photo) {
      onContinue();
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const pictureId = await uploadPhotoAndCreatePicture(photo);
      setValue("profilePicId", pictureId, { shouldDirty: true });
      onContinue();
    } catch (e) {
      setUploadError(
        e instanceof Error ? e.message : t("register.serverError.photoUploadFailed"),
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.5rem, 2.1vw, 1.875rem)", lineHeight: 1.15 }}
        >
          {t("register.profilePic.heading")}
        </h1>
        <p className="mt-1 font-body text-[14px] text-cb-gray-500">
          {t("register.profilePic.sub")}
        </p>
      </div>

      <div className="mb-6">
        <PhotoPicker
          file={photo}
          onChange={setPhoto}
          error={uploadError ?? undefined}
        />
      </div>

      <Button
        type="button"
        variant="primary"
        size="lg"
        fullWidth
        onClick={handleContinue}
        disabled={uploading}
        className="touch-manipulation"
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Uploading…
          </span>
        ) : (
          t("common.continue")
        )}
      </Button>

      <button
        type="button"
        onClick={onSkip}
        disabled={uploading}
        className="mt-4 w-full text-center font-body text-[14px] text-cb-gray-500 underline-offset-2 hover:text-cb-gray-700 hover:underline transition-colors touch-manipulation"
      >
        {t("register.profilePic.mayLater")}
      </button>
    </div>
  );
}
