"use client";

/**
 * The camera half of `/profile/buddy-id` — mobile's `BuddyIdScanner`.
 *
 * A scanned id is handed straight to the caller's lookup, which is the same
 * `useBuddyIdLookup` ladder the typed field uses. That is deliberate and is the
 * point of the whole item: a QR code must not be a laxer route into a profile
 * than typing the id would be.
 *
 * The camera is released on every exit path — unmount, a successful read, an
 * error, the member closing it. A live camera left running behind a closed
 * sheet is the failure people notice, because the browser keeps the indicator
 * on and the laptop light stays lit.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { createQrDetector, scanFrame } from "@/lib/buddies/scanBuddyId";

/** ~7 fps. Fast enough to feel instant, far cheaper than every frame. */
const SCAN_INTERVAL_MS = 140;

export default function BuddyIdScanner({
  onScan,
  onClose,
}: {
  /** Called once, with the canonical `BI-0000-0000` id. */
  onScan: (buddyId: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  /** Guards against a second read while the first is still navigating. */
  const doneRef = useRef(false);

  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  const close = useCallback(() => {
    stop();
    onClose();
  }, [stop, onClose]);

  useEffect(() => {
    let cancelled = false;
    const detector = createQrDetector();

    (async () => {
      if (!detector) {
        setError(t("app.profile.scanUnsupported"));
        return;
      }

      try {
        /* `environment` asks for the rear camera on a phone and is ignored on a
           laptop, which has only one. */
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        video.srcObject = stream;
        /* iOS Safari refuses to play an un-muted inline video without a
           gesture; both attributes are also set on the element itself. */
        await video.play().catch(() => {});

        timerRef.current = window.setInterval(() => {
          void (async () => {
            if (doneRef.current || !videoRef.current) return;
            const id = await scanFrame(detector, videoRef.current);
            if (!id || doneRef.current) return;
            doneRef.current = true;
            stop();
            onScan(id);
          })();
        }, SCAN_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        const denied =
          err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "SecurityError");
        setError(
          denied
            ? t("app.profile.scanDenied")
            : t("app.profile.scanUnavailable"),
        );
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [onScan, stop]);

  return (
    <div className="rounded-2xl border border-cb-gray-200 bg-white p-4">
      {error ? (
        <div className="px-2 py-8 text-center">
          <p className="font-body text-[14px] leading-relaxed text-cb-gray-600">
            {error}
          </p>
          <div className="mt-4">
            <Button size="sm" variant="secondary" onClick={close}>
              {t("app.profile.scanClose")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-xl bg-cb-black">
            <video
              ref={videoRef}
              data-testid="buddy-id-scanner-video"
              playsInline
              muted
              autoPlay
              className="h-full w-full object-cover"
            />
            {/* A frame to aim with — the detector reads the whole image. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/80"
            />
          </div>

          <p className="mt-3 text-center font-body text-[13.5px] text-cb-gray-600">
            {t("app.profile.scanHint")}
          </p>

          <div className="mt-3 flex justify-center">
            <Button size="sm" variant="secondary" onClick={close}>
              {t("app.profile.scanClose")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
