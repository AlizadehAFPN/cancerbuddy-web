import { getS3FileUrl } from "@/lib/aws/s3Image";
import { uploadToUserFiles } from "@/lib/aws/s3Upload";

/**
 * A media attachment stored on a post or comment.
 *
 * Mirrors `cancerbuddyapp/src/utils/feedMedia.ts:12-24` exactly, because this is
 * a wire format written by the mobile app: the Feed SDK has no CDN, so the client
 * uploads to S3 and persists the *object reference*. There is no `url` field —
 * the presigned URL is resolved at render time.
 *
 * That absence is why every mobile attachment used to vanish on web: the old
 * normaliser required `url` and dropped everything else on the floor.
 */
export interface FeedMediaAttachment {
  type: "image" | "video" | "file";
  bucket: string;
  region: string;
  key: string;
  mime?: string;
  width?: number;
  height?: number;
  duration?: number;
  /** Original filename and byte size, shown on document cards. */
  name?: string;
  size?: number;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/**
 * Which renderer an attachment gets.
 *
 * `type` is authoritative when present — mobile always writes it. The mime
 * fallback covers rows written by anything that did not, so an image still
 * renders as an image rather than as a download link.
 */
function classify(type: unknown, mime: unknown): FeedMediaAttachment["type"] {
  const t = str(type);
  if (t === "image" || t === "video" || t === "file") return t;
  const m = str(mime) ?? "";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  return "file";
}

/**
 * Normalises one raw attachment, or returns null if it is unusable.
 *
 * `bucket` and `key` are both required: without them no URL can be signed, and a
 * card with no source is worse than no card.
 */
export function normaliseAttachment(raw: unknown): FeedMediaAttachment | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;

  const bucket = str(a.bucket);
  const key = str(a.key);
  if (!bucket || !key) return null;

  return {
    type: classify(a.type, a.mime ?? a.mimeType),
    bucket,
    region: str(a.region) ?? "",
    key,
    mime: str(a.mime) ?? str(a.mimeType),
    width: num(a.width),
    height: num(a.height),
    duration: num(a.duration),
    name: str(a.name),
    size: num(a.size),
  };
}

export function normaliseAttachments(raw: unknown): FeedMediaAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normaliseAttachment)
    .filter((a): a is FeedMediaAttachment => a !== null);
}

/** Signs a URL for one attachment. Returns undefined rather than throwing. */
export function resolveFeedMediaUrl(
  attachment: FeedMediaAttachment,
): Promise<string | undefined> {
  return getS3FileUrl({
    bucket: attachment.bucket,
    key: attachment.key,
    region: attachment.region,
    mime: attachment.mime,
  });
}

/** `1.4 MB` — for document cards, which is the only place mobile shows a size. */
export function formatFileSize(bytes?: number): string | undefined {
  if (!bytes || bytes <= 0) return undefined;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** `1:04` — mobile shows a duration badge on video thumbnails. */
export function formatDuration(seconds?: number): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ── Uploading ──────────────────────────────────────────────────────────── */

/** Mobile's cap on a feed attachment. */
export const FEED_MEDIA_MAX_BYTES = 20 * 1024 * 1024;

export type FeedMediaRejection = "too-large" | "unsupported";

export interface ValidationResult {
  ok: boolean;
  reason?: FeedMediaRejection;
}

/**
 * Whether a picked file may be attached.
 *
 * Exactly 20 MB passes; a byte over does not. Mobile enforces the same ceiling,
 * and letting a larger file through means an upload that succeeds on web and a
 * post the phone refuses to render.
 */
export function validateDocument(file: { size: number; type?: string }): ValidationResult {
  if (file.size > FEED_MEDIA_MAX_BYTES) return { ok: false, reason: "too-large" };
  return { ok: true };
}

/**
 * The extension to store under.
 *
 * `quicktime → mov` is mobile's one special case
 * (`cancerbuddyapp/src/utils/feedMedia.ts:26-30`): iOS reports `video/quicktime`,
 * and a key ending `.quicktime` is not playable in a browser.
 */
export function extFromMime(
  mime: string | undefined,
  kind: FeedMediaAttachment["type"],
): string {
  const fromMime = mime?.split("/")?.[1];
  if (fromMime) return fromMime === "quicktime" ? "mov" : fromMime;
  return kind === "image" ? "jpg" : kind === "video" ? "mp4" : "pdf";
}

/** Which renderer a picked file will get, from its mime type. */
export function kindOfFile(mime: string | undefined): FeedMediaAttachment["type"] {
  const m = mime ?? "";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  return "file";
}

/**
 * Uploads a picked file and returns the reference to store on the activity.
 *
 * Image dimensions and video duration are read first where the browser can, so
 * the feed can reserve the right space and show a duration badge — mobile
 * persists the same fields.
 */
export async function uploadFeedMedia(file: File): Promise<FeedMediaAttachment> {
  const type = kindOfFile(file.type);
  const { bucket, region, key } = await uploadToUserFiles(file, {
    extension: extFromMime(file.type, type),
    contentType: file.type || undefined,
  });

  const measured = await measure(file, type).catch(() => ({}));

  return {
    type,
    bucket,
    region,
    key,
    mime: file.type || undefined,
    name: file.name || undefined,
    size: file.size || undefined,
    ...measured,
  };
}

/** Best-effort dimensions / duration. A failure here must not fail the upload. */
async function measure(
  file: File,
  type: FeedMediaAttachment["type"],
): Promise<{ width?: number; height?: number; duration?: number }> {
  if (typeof window === "undefined") return {};
  const url = URL.createObjectURL(file);
  try {
    if (type === "image") {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("decode failed"));
        img.src = url;
      });
      return { width: img.naturalWidth, height: img.naturalHeight };
    }
    if (type === "video") {
      const video = document.createElement("video");
      video.preload = "metadata";
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("metadata failed"));
        video.src = url;
      });
      return {
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
        duration: Number.isFinite(video.duration) ? video.duration : undefined,
      };
    }
    return {};
  } finally {
    URL.revokeObjectURL(url);
  }
}
