"use client";

import { useCallback, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui";
import { PhotoCropper } from "@/components/auth/PhotoCropper";
import type { UserRegisterFormValues } from "@/lib/user-signup/validation";
import { uploadPhotoAndCreatePicture } from "@/lib/user-signup/uploadPhoto";
import { validatePhotoFile } from "@/lib/host-signup/validation";
import { t } from "@/lib/i18n";

const MAX_PHOTOS = 6;

interface GallerySlot {
  pictureId: string;
  previewUrl: string;
}

interface Props {
  onContinue: () => void;
  onSkip: () => void;
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6"
      aria-hidden
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3.5 h-3.5"
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function StepPhotos({ onContinue, onSkip }: Props) {
  const { setValue, getValues } = useFormContext<UserRegisterFormValues>();

  const [slots, setSlots] = useState<GallerySlot[]>([]);
  const [rawForCrop, setRawForCrop] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function appendGalleryId(pictureId: string) {
    const current = getValues("galleryPhotoIds");
    const next = current ? `${current},${pictureId}` : pictureId;
    setValue("galleryPhotoIds", next, { shouldDirty: true });
  }

  function removeGalleryId(pictureId: string) {
    const current = getValues("galleryPhotoIds");
    const next = current
      .split(",")
      .filter((id) => id.trim() !== pictureId)
      .join(",");
    setValue("galleryPhotoIds", next, { shouldDirty: true });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validatePhotoFile(file);
    if (err) {
      setUploadError(err);
      return;
    }
    setUploadError(null);
    setRawForCrop(file);
  }

  const handleCropped = useCallback(
    async (croppedFile: File) => {
      setRawForCrop(null);
      setUploading(true);
      setUploadError(null);
      try {
        const pictureId = await uploadPhotoAndCreatePicture(croppedFile);
        const previewUrl = URL.createObjectURL(croppedFile);
        appendGalleryId(pictureId);
        setSlots((prev) => [...prev, { pictureId, previewUrl }].slice(0, MAX_PHOTOS));
      } catch (e) {
        setUploadError(
          e instanceof Error ? e.message : t("register.serverError.photoUploadFailed"),
        );
      } finally {
        setUploading(false);
      }
    },
    // appendGalleryId is stable (uses getValues/setValue which are stable)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function removeSlot(index: number) {
    const slot = slots[index];
    if (!slot) return;
    URL.revokeObjectURL(slot.previewUrl);
    removeGalleryId(slot.pictureId);
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }

  const canAddMore = slots.length < MAX_PHOTOS && !uploading;

  return (
    <div className="w-full">
      {rawForCrop && (
        <PhotoCropper
          source={rawForCrop}
          onApply={handleCropped}
          onCancel={() => setRawForCrop(null)}
        />
      )}

      <div className="mb-5">
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.5rem, 2.1vw, 1.875rem)", lineHeight: 1.15 }}
        >
          {t("register.photos.heading")}
        </h1>
        <p className="mt-1 font-body text-[14px] text-cb-gray-500">
          {t("register.photos.sub")}
        </p>
      </div>

      {/* Photo grid — 3 columns */}
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
          const slot = slots[i];
          if (slot) {
            return (
              <div
                key={slot.pictureId}
                className="relative aspect-square overflow-hidden rounded-2xl bg-cb-gray-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slot.previewUrl}
                  alt={`Photo ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeSlot(i)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-cb-black/70 text-white transition-opacity hover:bg-cb-black touch-manipulation"
                  aria-label={t("register.photos.removePhoto")}
                >
                  <TrashIcon />
                </button>
              </div>
            );
          }
          // Empty slot
          const isNextSlot = i === slots.length;
          return (
            <button
              key={`empty-${i}`}
              type="button"
              onClick={() => {
                if (canAddMore && isNextSlot) fileInputRef.current?.click();
              }}
              disabled={!canAddMore || !isNextSlot || uploading}
              className={[
                "aspect-square rounded-2xl border-[1.5px] border-dashed transition-all duration-150",
                "flex items-center justify-center",
                canAddMore && isNextSlot
                  ? "border-cb-gray-300 text-cb-gray-400 hover:border-cb-black hover:text-cb-black cursor-pointer"
                  : "border-cb-gray-150 text-cb-gray-200 cursor-default",
              ].join(" ")}
              aria-label={isNextSlot ? t("register.photos.addPhoto") : undefined}
            >
              {uploading && isNextSlot ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-cb-gray-400 border-t-transparent" />
              ) : (
                <PlusIcon />
              )}
            </button>
          );
        })}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={handleFileChange}
      />

      {uploadError && (
        <p className="mb-4 rounded-xl border border-cb-danger/30 bg-cb-danger/5 px-4 py-3 font-body text-[13px] text-cb-danger">
          {uploadError}
        </p>
      )}

      <Button
        type="button"
        variant="primary"
        size="lg"
        fullWidth
        onClick={onContinue}
        disabled={uploading}
        className="touch-manipulation"
      >
        {t("common.continue")}
      </Button>

      <button
        type="button"
        onClick={onSkip}
        disabled={uploading}
        className="mt-4 w-full text-center font-body text-[14px] text-cb-gray-500 underline-offset-2 hover:text-cb-gray-700 hover:underline transition-colors touch-manipulation"
      >
        {t("register.photos.mayLater")}
      </button>
    </div>
  );
}
