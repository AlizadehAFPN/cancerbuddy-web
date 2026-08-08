"use client";

/**
 * `/profile/buddy-id` — your Buddy ID, and finding someone by theirs.
 *
 * The QR encodes the same universal link the mobile app writes
 * (`https://cancerbuddy.bonemarrow.org/buddyId/<id>`), so a code shown here
 * scans correctly in the phone app.
 *
 * Scanning is offered where the browser can do it natively — `BarcodeDetector`
 * is built into Chrome, Edge and Android WebView, so it costs no bundle weight.
 * Safari and Firefox do not implement it; there the entry is simply absent and
 * the field below does the same job. Shipping a WASM decoder to everyone so a
 * minority can avoid typing ten characters is the wrong trade for this screen.
 *
 * A scanned id goes through the same `useBuddyIdLookup` ladder a typed one does.
 * A QR code must not be a laxer route into a profile.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import QRCode from "qrcode";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { FieldLabel } from "@/components/ui/form";
import { useProfile } from "@/lib/profile/ProfileProvider";
import { useBuddyIdLookup } from "@/lib/buddies/useBuddyIdLookup";
import { qrScanningSupported } from "@/lib/buddies/scanBuddyId";
import BuddyIdScanner from "@/components/profile/BuddyIdScanner";

/** Must match mobile's `formatBuddyIdURL`. */
const UNIVERSAL_DEEP_LINK = "https://cancerbuddy.bonemarrow.org";

function buddyIdUrl(buddyId: string): string {
  return `${UNIVERSAL_DEEP_LINK}/buddyId/${buddyId}`;
}

export default function BuddyIdScreen() {
  const router = useRouter();
  const { user, status } = useProfile();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lookup, setLookup] = useState("");
  const buddyIdLookup = useBuddyIdLookup(
    user?.id ? { id: user.id, birth: user.birth ?? null } : null,
  );

  const buddyId = user?.buddyId ?? "";

  useEffect(() => {
    if (!buddyId || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, buddyIdUrl(buddyId), {
      width: 232,
      margin: 1,
      color: { dark: "#242424", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).catch((err) => console.error("[profile] QR render failed:", err));
  }, [buddyId]);

  const copy = useCallback(async () => {
    if (!buddyId) return;
    try {
      await navigator.clipboard.writeText(buddyId);
      toast.success(t("app.profile.buddyIdCopied"));
    } catch {
      toast.error(t("app.profile.copyFailed"));
    }
  }, [buddyId]);

  const share = useCallback(async () => {
    if (!buddyId) return;
    const url = buddyIdUrl(buddyId);
    // `navigator.share` is mobile-web and Safari; elsewhere copying the link is
    // the equivalent action rather than a dead button.
    if (navigator.share) {
      try {
        await navigator.share({ title: t("app.profile.buddyId"), text: buddyId, url });
        return;
      } catch {
        /* user dismissed the sheet */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("app.profile.linkCopied"));
    } catch {
      toast.error(t("app.profile.copyFailed"));
    }
  }, [buddyId]);

  /**
   * The full guard ladder, shared with the Buddies sheet.
   *
   * This screen used to run a bare not-found check, so pasting an id opened the
   * profile of someone snoozed or outside the permitted age bracket — a profile
   * you must not connect with, presented as though you could.
   */
  const search = useCallback(async () => {
    const value = lookup.trim();
    if (!value || buddyIdLookup.searching) return;
    const userId = await buddyIdLookup.lookup(value);
    if (userId) router.push(`/buddies/${userId}`);
  }, [lookup, buddyIdLookup, router]);

  const [scanning, setScanning] = useState(false);
  /**
   * Read once on mount rather than during render: `BarcodeDetector` does not
   * exist on the server, so a render-time check would disagree between the
   * server's HTML and the client's first paint.
   */
  const [canScan, setCanScan] = useState(false);
  // Feature detection is exactly what this rule exempts in spirit: there is no
  // render-time value to derive it from without breaking hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setCanScan(qrScanningSupported()), []);

  /**
   * The same ladder the typed field runs — the scanner decodes, it does not
   * decide. The id is shown in the field too, so a refusal ("that account is
   * paused") is attached to something the member can see.
   */
  const handleScan = useCallback(
    async (scanned: string) => {
      setScanning(false);
      setLookup(scanned);
      const userId = await buddyIdLookup.lookup(scanned);
      if (userId) router.push(`/buddies/${userId}`);
    },
    [buddyIdLookup, router],
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/profile")}
          aria-label={t("app.profile.back")}
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-cb-gray-600 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
        >
          <ArrowLeftIcon />
        </button>
        <h1 className="font-heading text-[22px] font-bold tracking-tight text-cb-black">
          {t("app.profile.buddyId")}
        </h1>
      </header>

      <section className="rounded-2xl border border-cb-gray-200 bg-white p-6 text-center">
        {status === "loading" ? (
          <div aria-hidden className="mx-auto h-[232px] w-[232px] animate-pulse rounded-2xl bg-cb-gray-100" />
        ) : buddyId ? (
          <>
            <p className="mb-4 font-body text-[14.5px] leading-relaxed text-cb-gray-600">
              {t("app.profile.buddyIdShare")}
            </p>
            <div className="mx-auto inline-flex rounded-2xl border border-cb-gray-200 p-3">
              <canvas ref={canvasRef} width={232} height={232} />
            </div>
            <p className="mt-4 select-all break-all font-heading text-[18px] font-bold text-cb-black">
              {buddyId}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2.5">
              <Button size="sm" variant="secondary" onClick={copy}>
                {t("app.profile.copyId")}
              </Button>
              <Button size="sm" onClick={share}>
                {t("app.profile.shareId")}
              </Button>
            </div>
          </>
        ) : (
          <p className="py-10 font-body text-[14.5px] text-cb-gray-500">
            {t("app.profile.noBuddyId")}
          </p>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-cb-gray-200 bg-white p-5">
        <h2 className="font-heading text-[13px] font-bold uppercase tracking-[0.12em] text-cb-black">
          {t("app.profile.findByIdTitle")}
        </h2>
        <p className="mt-1.5 font-body text-[13.5px] leading-snug text-cb-gray-500">
          {t("app.profile.findByIdHint")}
        </p>

        {canScan && (
          <div className="mt-4">
            {scanning ? (
              <BuddyIdScanner
                onScan={handleScan}
                onClose={() => setScanning(false)}
              />
            ) : (
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setScanning(true)}
              >
                {t("app.profile.scanCta")}
              </Button>
            )}
          </div>
        )}

        <div className="mt-4">
          <FieldLabel>{t("app.profile.buddyId")}</FieldLabel>
          <div className="flex gap-2.5">
            <input
              value={lookup}
              onChange={(e) => {
                setLookup(e.target.value);
                buddyIdLookup.clearError();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void search();
              }}
              placeholder={t("app.profile.buddyIdPlaceholder")}
              autoComplete="off"
              className="h-12 min-w-0 flex-1 rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-4 font-body text-[15px] text-cb-black outline-none transition-colors placeholder:text-cb-gray-400 hover:border-cb-gray-400 focus:border-cb-black"
            />
            <Button onClick={search} disabled={!lookup.trim()} loading={buddyIdLookup.searching}>
              {t("app.profile.findBuddy")}
            </Button>
          </div>
          {buddyIdLookup.error && (
            <p role="alert" className="mt-2 font-body text-[13px] text-cb-danger">
              {buddyIdLookup.error}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
