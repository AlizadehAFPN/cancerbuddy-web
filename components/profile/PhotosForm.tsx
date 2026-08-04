"use client";

/**
 * `/profile/photos` — the six-slot profile gallery.
 *
 * Mobile stages changes and commits them with a Save button because a phone
 * picker is modal and batching is cheaper. On the web each photo is uploaded or
 * removed as soon as it's chosen: there's no picker to leave, and a half-saved
 * gallery after a refresh is worse than a slightly chattier upload.
 *
 * Slots are always rendered, filled or not, so the six-photo limit is visible
 * rather than something you discover by hitting it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { ArrowLeftIcon, XIcon } from "@/components/ui/icons";
import { useProfile } from "@/lib/profile/ProfileProvider";
import {
  MAX_GALLERY_PHOTOS,
  deleteGalleryPhoto,
  uploadGalleryPhoto,
} from "@/lib/profile/photos";
import type { GalleryPicture } from "@/lib/profile/types";

export default function PhotosForm() {
  const router = useRouter();
  const { userId, gallery, refreshGallery, status } = useProfile();

  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const photos: (GalleryPicture | null)[] = [
    ...gallery.slice(0, MAX_GALLERY_PHOTOS),
    ...Array.from(
      { length: Math.max(0, MAX_GALLERY_PHOTOS - gallery.length) },
      () => null,
    ),
  ];

  const pick = useCallback(() => {
    if (gallery.length >= MAX_GALLERY_PHOTOS) {
      toast.error(t("app.profile.photosFull", { max: MAX_GALLERY_PHOTOS }));
      return;
    }
    fileInputRef.current?.click();
  }, [gallery.length]);

  const onFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || !userId) return;

      const room = MAX_GALLERY_PHOTOS - gallery.length;
      const chosen = Array.from(files).slice(0, Math.max(0, room));
      if (chosen.length < files.length) {
        toast.warning(t("app.profile.photosFull", { max: MAX_GALLERY_PHOTOS }));
      }

      for (const [i, file] of chosen.entries()) {
        setBusySlot(gallery.length + i);
        try {
          await uploadGalleryPhoto({ userId, file });
        } catch (err) {
          console.error("[profile] photo upload failed:", err);
          toast.error(
            err instanceof Error ? err.message : t("app.profile.photoUploadError"),
          );
          break;
        }
      }

      await refreshGallery();
      if (mountedRef.current) setBusySlot(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [userId, gallery.length, refreshGallery],
  );

  const remove = useCallback(
    async (photo: GalleryPicture) => {
      setRemoving(photo.id);
      try {
        await deleteGalleryPhoto(photo.id);
        await refreshGallery();
        toast.success(t("app.profile.photoRemoved"));
      } catch (err) {
        console.error("[profile] photo delete failed:", err);
        toast.error(t("app.profile.photoRemoveError"));
      } finally {
        if (mountedRef.current) setRemoving(null);
      }
    },
    [refreshGallery],
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/profile")}
          aria-label={t("app.profile.back")}
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-cb-gray-600 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
        >
          <ArrowLeftIcon />
        </button>
        <h1 className="font-heading text-[22px] font-bold tracking-tight text-cb-black">
          {t("app.profile.photosTitle")}
        </h1>
      </header>

      <p className="mb-5 font-body text-[14.5px] leading-relaxed text-cb-gray-600">
        {t("app.profile.photosIntro", { max: MAX_GALLERY_PHOTOS })}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => void onFiles(e.target.files)}
      />

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo, index) => {
          const uploading = busySlot === index;

          if (!photo) {
            return (
              <li key={`empty-${index}`}>
                <button
                  type="button"
                  onClick={pick}
                  disabled={uploading || status !== "ready"}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-cb-gray-300 bg-white text-cb-gray-500 transition-all hover:border-cb-black hover:bg-cb-gray-100/60 hover:text-cb-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading ? (
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-cb-gray-300 border-t-cb-black" />
                  ) : (
                    <>
                      <svg
                        width={26}
                        height={26}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      <span className="font-body text-[13px] font-semibold">
                        {t("app.profile.addPhoto")}
                      </span>
                    </>
                  )}
                </button>
              </li>
            );
          }

          return (
            <li key={photo.id} className="group relative">
              <div className="aspect-square w-full overflow-hidden rounded-2xl bg-cb-gray-100">
                {photo.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(photo)}
                disabled={removing === photo.id}
                aria-label={t("app.profile.removePhoto")}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-60"
              >
                {removing === photo.id ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <XIcon size={13} />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="font-body text-[13px] text-cb-gray-500">
          {t("app.profile.photosCount", {
            count: gallery.length,
            max: MAX_GALLERY_PHOTOS,
          })}
        </p>
        <Button
          variant="secondary"
          onClick={pick}
          disabled={gallery.length >= MAX_GALLERY_PHOTOS}
        >
          {t("app.profile.addPhoto")}
        </Button>
      </div>
    </div>
  );
}
