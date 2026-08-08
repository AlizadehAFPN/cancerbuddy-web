/**
 * Chat attachments: what may be sent, how images are shrunk, and the metadata
 * that goes on the Stream attachment.
 *
 * Chat uses Stream's own CDN rather than S3, so unlike feed media the URL *is*
 * the stored value. Everything else mirrors mobile's picker
 * (`cancerbuddyapp/src/hooks/photo/useChatMediaPicker.ts`).
 */

/** `MAX_DOCUMENT_SIZE_MB` on mobile. */
export const MAX_CHAT_FILE_MB = 20;
export const MAX_CHAT_FILE_BYTES = MAX_CHAT_FILE_MB * 1024 * 1024;

/** Mobile's `compressImageMaxWidth` / `compressImageMaxHeight`. */
export const IMAGE_MAX_SIDE = 1280;
/** Mobile's `compressImageQuality`. */
export const IMAGE_QUALITY = 0.8;

export interface ChatFileVerdict {
  ok: boolean;
  /** Mobile's exact wording, so the two apps say the same thing. */
  message?: string;
}

export function validateChatFile(file: { size: number }): ChatFileVerdict {
  if (file.size > MAX_CHAT_FILE_BYTES) {
    return {
      ok: false,
      message: `The file is too large. Maximum size is ${MAX_CHAT_FILE_MB} MB.`,
    };
  }
  return { ok: true };
}

/** Longest side after shrinking, preserving aspect ratio. Never scales *up*. */
export function scaledDimensions(
  width: number,
  height: number,
  maxSide = IMAGE_MAX_SIDE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const ratio = maxSide / longest;
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

/**
 * Shrinks an image before upload, as mobile does.
 *
 * Sending a 12 MP phone photo untouched is slow on a poor connection and pushes
 * a conversation over its storage budget for no visible gain. Returns the
 * original when it is already small enough, or when the browser cannot decode it
 * — a failure here must not stop the message.
 */
export async function compressChatImage(file: File): Promise<File> {
  if (typeof document === "undefined" || !file.type.startsWith("image/")) return file;
  // Animated GIFs lose their animation through a canvas round trip.
  if (file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = scaledDimensions(bitmap.width, bitmap.height);
    if (width === bitmap.width && height === bitmap.height) {
      bitmap.close?.();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", IMAGE_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

export interface ChatAttachmentInput {
  url: string;
  file: { name: string; type: string; size: number };
  width?: number;
  height?: number;
}

/**
 * The Stream attachment to send.
 *
 * `original_width` / `original_height` are what let the thread reserve space
 * before the image loads; without them every incoming photo makes the list jump.
 * `file_size` is what the document card shows.
 */
export function buildChatAttachment(input: ChatAttachmentInput): Record<string, unknown> {
  const { url, file, width, height } = input;

  if (file.type.startsWith("image/")) {
    return {
      type: "image",
      image_url: url,
      fallback: file.name,
      ...(width ? { original_width: width } : {}),
      ...(height ? { original_height: height } : {}),
    };
  }

  return {
    type: file.type.startsWith("video/") ? "video" : "file",
    asset_url: url,
    title: file.name,
    mime_type: file.type,
    file_size: file.size,
  };
}
