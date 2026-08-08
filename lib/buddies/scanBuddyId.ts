"use client";

/**
 * Reading a Buddy ID out of a camera frame.
 *
 * Mobile's scanner hands its raw string to `handleReadScanner`
 * (`QrIdentification.tsx:37-58`), which does exactly two things: if the value
 * looks like one of the app's deep links, take the last path segment; otherwise
 * treat the whole value as the id. Either way the result then goes through
 * `validationRules` — **the same guard ladder a typed id goes through**. That
 * last part is the important one, and the reason this file decodes only: a
 * scanned id must not be a second, laxer route into a profile.
 *
 * ## The decoder is the browser's own
 *
 * `BarcodeDetector` is native in Chrome, Edge and Android WebView. Using it
 * costs nothing — no library, no bundle weight, no worker — and it is hardware
 * accelerated. Safari and Firefox do not implement it, so there the scan entry
 * simply does not appear and the typed field beside it does the same job, which
 * is what `BuddyIdScreen` has always offered.
 *
 * Shipping a ~40 kB WASM decoder to every member so that a minority of browsers
 * can avoid typing ten characters is the wrong trade for this screen. If that
 * changes, only this file does.
 */

import { formatBuddyId } from "@/lib/buddies/useBuddyIdLookup";

/** Must match `UNIVERSAL_DEEP_LINK` in `components/profile/BuddyIdScreen.tsx`. */
const DEEP_LINK_HOSTS = [
  "cancerbuddy.bonemarrow.org",
  "cancerbuddy://",
];

/**
 * The id inside whatever the camera read.
 *
 * Accepts the full shared link, a bare id, or a `cancerbuddy://` scheme link —
 * mobile's three cases. Returns the canonical `BI-0000-0000` form, or `null`
 * when the payload is not a Buddy ID at all, which is the common case while the
 * camera is pointed at anything else.
 */
export function extractBuddyIdFromScan(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  let candidate: string;

  if (DEEP_LINK_HOSTS.some((host) => value.includes(host))) {
    /* One of ours — the id is the last path segment, as on mobile. */
    candidate = value.split("/").pop() ?? "";
  } else if (/[/:]/.test(value)) {
    /**
     * Some other URL, or a structured payload like `WIFI:S=cafe;…`.
     *
     * Mobile passes this through as though it were an id and lets the lookup
     * fail (`QrIdentification.tsx:41-46`). A scanner cannot: it decodes seven
     * times a second, so anything it accepts becomes seven lookups a second.
     * Refusing here is the difference between a scanner and a request loop.
     */
    return null;
  } else {
    candidate = value;
  }

  /**
   * Deliberately stricter than the typed field, which accepts a bare
   * eight-character body without the `BI` prefix. Every code this product
   * generates encodes the full link, so requiring the prefix costs nothing real
   * and stops the camera reading an eight-character coupon as a member.
   */
  const clean = candidate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!clean.startsWith("BI") || clean.length !== 10) return null;

  const formatted = formatBuddyId(clean);
  return /^BI-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(formatted) ? formatted : null;
}

/* ── The native decoder ─────────────────────────────────────────────────── */

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

function detectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector;
  return typeof ctor === "function" ? ctor : null;
}

/** Whether this browser can scan at all. Drives whether the entry is offered. */
export function qrScanningSupported(): boolean {
  return Boolean(
    detectorCtor() &&
      typeof navigator !== "undefined" &&
      navigator.mediaDevices?.getUserMedia,
  );
}

export function createQrDetector(): BarcodeDetectorLike | null {
  const Ctor = detectorCtor();
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ["qr_code"] });
  } catch {
    /* A browser that has the constructor but not the QR format. */
    return null;
  }
}

/**
 * One decode pass over a video frame.
 *
 * Returns the first payload that is a Buddy ID, ignoring anything else in
 * frame — a poster with a URL on it should not stop the scan.
 */
export async function scanFrame(
  detector: BarcodeDetectorLike,
  source: CanvasImageSource,
): Promise<string | null> {
  let found: DetectedBarcode[];
  try {
    found = await detector.detect(source);
  } catch {
    /* Detection throws while the video has no frame yet — nothing to report. */
    return null;
  }

  for (const barcode of found) {
    const id = extractBuddyIdFromScan(barcode.rawValue ?? "");
    if (id) return id;
  }
  return null;
}
