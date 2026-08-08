"use client";

/**
 * "Invite a friend" — a scannable code for the app, and the link behind it.
 *
 * Mobile's `QrShare` (`elements/qr-share/qr-share.tsx`), which appears when
 * discovery has nobody left to suggest. Two things were wrong with web's
 * version: there was no QR at all, and the link it copied was
 * `window.location.origin` — the web app's front page — rather than the store
 * listing mobile shares. Someone handed that link installed nothing.
 *
 * The QR renders into a canvas with the same library `/profile/buddy-id` uses,
 * so there is one QR implementation on the web side.
 */

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";

import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { getShareUrl } from "@/lib/contentful/appLink";

export default function ShareAppPanel({ size = 200 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getShareUrl().then((value) => {
      if (!cancelled) setUrl(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: size,
      margin: 1,
      color: { dark: "#242424", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).catch((err) => console.error("[buddies] share QR render failed:", err));
  }, [url, size]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("app.buddies.linkCopied"));
    } catch (err) {
      console.error("[buddies] clipboard write failed:", err);
      toast.error(t("app.groups.copyMailError"));
    }
  };

  const share = async () => {
    if (!url) return;
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({ title: t("common.appName"), url });
    } catch {
      /* The share sheet was dismissed — not a failure worth reporting. */
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="max-w-sm font-body text-[14.5px] leading-relaxed text-cb-gray-600">
        {t("app.buddies.shareQrSub")}
      </p>

      <canvas
        ref={canvasRef}
        aria-label={t("app.buddies.shareQrAlt")}
        role="img"
        className="rounded-xl bg-white"
        style={{ width: size, height: size }}
      />

      {url && (
        <p className="max-w-full break-all font-body text-[12.5px] text-cb-gray-500">
          {url}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-2.5">
        <Button variant="secondary" onClick={copy} disabled={!url}>
          {t("app.buddies.copyLink")}
        </Button>
        {/* `navigator.share` is mobile-web and Safari; elsewhere copy is the
            whole affordance and this button simply does the same thing. */}
        <Button onClick={share} disabled={!url}>
          {t("app.buddies.shareWithFriend")}
        </Button>
      </div>
    </div>
  );
}
