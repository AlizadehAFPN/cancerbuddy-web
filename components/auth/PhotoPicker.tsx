"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  PHOTO_MAX_BYTES,
  PHOTO_MIME_TYPES,
} from "@/lib/host-signup/constants";
import { validatePhotoFile } from "@/lib/host-signup/validation";
import { PhotoCropper } from "./PhotoCropper";
import { t } from "@/lib/i18n";

/* ── Icons ─────────────────────────────────────────────────────────────── */

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ReplaceIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
    </svg>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_MB = Math.round(PHOTO_MAX_BYTES / (1024 * 1024));
const ACCEPT_ATTR = PHOTO_MIME_TYPES.join(",");

/* ── Props ─────────────────────────────────────────────────────────────── */

interface Props {
  /** Current selected file, or null when empty. */
  file: File | null;
  /** Fired when a new file is selected (after validation). */
  onChange: (file: File | null) => void;
  /** External error (e.g. server-side rejection). */
  error?: string;
  /** Optional id for label association. */
  id?: string;
}

/* ── Component ─────────────────────────────────────────────────────────── */

/**
 * Photo picker with drag-and-drop, click-to-browse, and a live thumbnail
 * preview. Object URLs are created lazily and revoked on cleanup so the
 * page doesn't leak blobs as the user replaces the file.
 */
export function PhotoPicker({ file, onChange, error, id }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  /* The raw, pre-crop file the user just picked. While non-null, the cropper
     is shown in place of the picker / preview. */
  const [rawForCrop, setRawForCrop] = useState<File | null>(null);

  /* Build the preview URL from the (cropped) file. We sync the URL through
     state inside an effect (not useMemo) so Strict Mode's simulated unmount
     can't revoke a URL whose value is still cached and read on remount —
     the symptom of that bug is a broken-image flash on mount in dev. */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const next = files?.[0];
      if (!next) return;
      setInternalError(null);
      const validationError = validatePhotoFile(next);
      if (validationError) {
        setInternalError(validationError);
        return;
      }
      /* Stage the file for cropping instead of committing it. The parent
         only learns about the file after the user applies the crop. */
      setRawForCrop(next);
    },
    [],
  );

  const handleCropApply = useCallback(
    (cropped: File) => {
      setRawForCrop(null);
      setInternalError(null);
      onChange(cropped);
      if (inputRef.current) inputRef.current.value = "";
    },
    [onChange],
  );

  const handleCropCancel = useCallback(() => {
    setRawForCrop(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }
  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }
  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function openPicker() {
    inputRef.current?.click();
  }

  function clearPhoto() {
    onChange(null);
    setInternalError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const displayError = error ?? internalError;

  /* ── Cropping state ── */
  if (rawForCrop) {
    return (
      <PhotoCropper
        source={rawForCrop}
        onApply={handleCropApply}
        onCancel={handleCropCancel}
      />
    );
  }

  /* ── Empty state ── */
  if (!file || !previewUrl) {
    return (
      <div className="flex flex-col items-center">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
          role="button"
          tabIndex={0}
          aria-describedby={id ? `${id}-desc` : undefined}
          className={[
            "group relative flex h-44 w-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-full border-[1.5px] border-dashed text-center transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-offset-2",
            dragOver
              ? "border-cb-black bg-cb-bone-300/40"
              : displayError
                ? "border-cb-danger/60 bg-cb-danger/5 hover:border-cb-danger"
                : "border-cb-gray-300 bg-cb-gray-100/40 hover:border-cb-gray-400 hover:bg-cb-gray-100/70",
          ].join(" ")}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cb-yellow text-cb-black ring-1 ring-cb-yellow-600/20">
            <CameraIcon className="h-5 w-5" />
          </span>
          <p className="font-heading text-[13.5px] font-semibold leading-snug text-cb-black">
            {dragOver ? t("forms.dropToUpload") : t("forms.choosePhoto")}
          </p>
          <p
            id={id ? `${id}-desc` : undefined}
            className="px-4 font-body text-[11px] leading-snug text-cb-gray-500"
          >
            {t("forms.photoPickerHint", { max: MAX_MB })}
          </p>
        </div>

        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {displayError ? (
          <p
            role="alert"
            className="mt-3 text-center font-body text-[13px] text-cb-danger"
          >
            {displayError}
          </p>
        ) : null}
      </div>
    );
  }

  /* ── Selected state ── */
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-44 w-44 overflow-hidden rounded-full bg-cb-gray-100 ring-2 ring-cb-black/5 shadow-[0_4px_14px_rgba(36,36,36,0.08)]">
        {/* Plain <img>; preview is a blob URL, not a static asset. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={t("forms.selectedPhotoAlt")}
          className="h-full w-full object-cover"
        />
      </div>

      <p className="mt-2.5 max-w-[260px] truncate text-center font-body text-[12px] text-cb-gray-500">
        {file.name} · {formatBytes(file.size)}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={openPicker}
          className="inline-flex items-center gap-1.5 rounded-full border border-cb-gray-200 bg-white px-3.5 py-1.5 font-body text-[13px] font-medium text-cb-black transition-colors hover:bg-cb-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-offset-2"
        >
          <ReplaceIcon className="h-[14px] w-[14px]" />
          {t("forms.replace")}
        </button>
        <button
          type="button"
          onClick={clearPhoto}
          className="inline-flex items-center gap-1.5 rounded-full border border-cb-gray-200 bg-white px-3.5 py-1.5 font-body text-[13px] font-medium text-cb-danger transition-colors hover:bg-cb-danger/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-offset-2"
        >
          <TrashIcon className="h-[14px] w-[14px]" />
          {t("forms.remove")}
        </button>
      </div>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {displayError ? (
        <p role="alert" className="mt-2.5 font-body text-[13px] text-cb-danger">
          {displayError}
        </p>
      ) : null}
    </div>
  );
}
