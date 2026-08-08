"use client";

/**
 * A member's photo, opened large.
 *
 * Mobile gives the PHOTOS block its own screen (`GalleryScreen`); web's grid was
 * not clickable at all, so the photos were thumbnails and nothing more. A
 * dialog is the web equivalent of pushing that screen — and it keeps the
 * profile behind it, which is where the member was.
 *
 * Deliberately small: Escape and the backdrop close it, arrow keys walk the
 * gallery. No pinch-zoom, no download button — neither exists on mobile either.
 */

import { useCallback, useEffect } from "react";

import { t } from "@/lib/i18n";
import { XIcon } from "@/components/buddies/controls";
import type { GalleryPhoto } from "@/lib/buddies/profileDetail";

export default function PhotoViewer({
  photos,
  index,
  name,
  onClose,
  onIndexChange,
}: {
  photos: GalleryPhoto[];
  index: number;
  /** Whose photos these are — the only description available for alt text. */
  name: string;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}) {
  const photo = photos[index];

  const step = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= 0 && next < photos.length) onIndexChange(next);
    },
    [index, photos.length, onIndexChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, step]);

  // The page behind must not scroll under the photo.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!photo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("app.buddies.photoViewer")}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("app.buddies.closeProfile")}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <XIcon size={20} />
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={t("app.buddies.photoOf", { name })}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-2xl object-contain"
      />

      {photos.length > 1 && (
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 font-body text-[13px] text-white">
          {index + 1} / {photos.length}
        </p>
      )}
    </div>
  );
}
