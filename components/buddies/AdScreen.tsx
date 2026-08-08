"use client";

/**
 * The partner-resource interstitial — mobile's `AddsScreen` + `AdLayout`.
 *
 * Reached from the profile page's Next button once five buddies have gone by
 * (see `lib/buddies/adRotation.ts`). The whole screen takes the entry's
 * `bgColor`, exactly as mobile does, so each partner keeps its own colour.
 *
 * Two deliberate differences from mobile, both forced by web scope:
 *
 *  1. The primary button is **More resources**, opening the Partners list, as
 *     on mobile. It pointed at the partner's own site while `/partners` was a
 *     placeholder; that site is now the secondary action.
 *  2. "Read more" opens a new tab instead of an in-app WebView — mobile has no
 *     browser to hand off to, web does.
 *
 * The buddy to continue to travels in `?next=`, not in module state, so a
 * refresh or a shared link still knows where Skip goes.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import Link from "next/link";
import { Button } from "@/components/ui";
import { ArrowLeftIcon, ExternalLinkIcon, StarIcon } from "@/components/ui/icons";
import RichText from "@/components/contentful/RichText";
import { useBuddies } from "@/lib/buddies/BuddiesProvider";
import { countAdSkip } from "@/lib/buddies/adRotation";
import {
  addFavoriteAd,
  fetchFavoriteAds,
  removeFavoriteAd,
} from "@/lib/buddies/favoriteAds";
import { findAdById } from "@/lib/contentful/ads";
import type { ContentfulAd } from "@/lib/contentful/types";

/* ── Skeleton ───────────────────────────────────────────────────────────── */

function AdSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-2xl space-y-5 px-4 pt-10 sm:px-6">
      <div className="h-7 w-3/4 animate-pulse rounded bg-black/5" />
      <div className="aspect-square w-full animate-pulse rounded-2xl bg-black/5" />
      <div className="h-4 w-full animate-pulse rounded bg-black/5" />
      <div className="h-4 w-5/6 animate-pulse rounded bg-black/5" />
    </div>
  );
}

/* ── Favourite star ─────────────────────────────────────────────────────── */

function FavouriteToggle({ adId }: { adId: string }) {
  const { userId } = useBuddies();
  const [isFavourite, setIsFavourite] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    fetchFavoriteAds(userId)
      .then((rows) => {
        if (cancelled) return;
        setIsFavourite(rows.has(adId));
        setReady(true);
      })
      .catch((err) => {
        // A favourites read failing shouldn't hide the ad — leave the star off.
        console.error("[ads] could not read favourites:", err);
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, adId]);

  const toggle = useCallback(async () => {
    if (!userId || busy) return;
    const next = !isFavourite;

    setBusy(true);
    setIsFavourite(next); // optimistic — the star is the only feedback there is
    try {
      if (next) await addFavoriteAd(userId, adId);
      else await removeFavoriteAd(userId, adId);
    } catch (err) {
      console.error("[ads] favourite toggle failed:", err);
      setIsFavourite(!next);
      toast.error(t("app.ads.favoriteError"));
    } finally {
      setBusy(false);
    }
  }, [userId, adId, isFavourite, busy]);

  if (!userId || !ready) return <span className="h-9 w-9" />;

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={isFavourite}
      aria-label={
        isFavourite ? t("app.ads.removeFromFavorites") : t("app.ads.addToFavorites")
      }
      title={isFavourite ? t("app.ads.removeFromFavorites") : t("app.ads.addToFavorites")}
      className={[
        "flex h-9 items-center gap-1.5 rounded-full px-3 font-body text-[13px] font-bold",
        "transition-colors disabled:opacity-50",
        isFavourite
          ? "text-cb-yellow-800 hover:bg-black/5"
          : "border-2 border-cb-black text-cb-black hover:bg-black/5",
      ].join(" ")}
    >
      <StarIcon size={18} filled={isFavourite} />
      {!isFavourite && <span>{t("app.ads.addToFavorites")}</span>}
    </button>
  );
}

/* ── Screen ─────────────────────────────────────────────────────────────── */

export default function AdScreen({
  adId,
  nextUserId,
}: {
  adId: string;
  nextUserId?: string;
}) {
  const router = useRouter();

  /**
   * The resolved entry is stored *with* the id it was resolved for, so
   * `loading` is derived rather than a second piece of state that has to be
   * flipped back on when `adId` changes. A failed lookup resolves to `null`,
   * which renders the same "unavailable" branch as a missing entry.
   */
  const [result, setResult] = useState<{ adId: string; ad: ContentfulAd | null } | null>(
    null,
  );

  // Not read during render: the ad list is client-only module state, and
  // touching it while rendering would diverge from the server output.
  useEffect(() => {
    let cancelled = false;

    findAdById(adId)
      .then((found) => {
        if (!cancelled) setResult({ adId, ad: found });
      })
      .catch((err) => {
        console.error("[ads] could not load resource:", err);
        if (!cancelled) setResult({ adId, ad: null });
      });

    return () => {
      cancelled = true;
    };
  }, [adId]);

  const loading = result?.adId !== adId;
  const ad = loading ? null : (result?.ad ?? null);

  /** Mobile's `handleSkip`: bump the counter, then replace this screen. */
  const skip = useCallback(() => {
    countAdSkip();
    router.replace(nextUserId ? `/buddies/${nextUserId}` : "/buddies");
  }, [router, nextUserId]);

  const background = ad?.bgColor ?? "#ffffff";

  if (loading) {
    return (
      <div className="min-h-full bg-white">
        <AdSkeleton />
      </div>
    );
  }

  if (!ad) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <h1 className="font-heading text-[20px] font-bold text-cb-black">
          {t("app.ads.unavailable")}
        </h1>
        <Button variant="secondary" onClick={skip}>
          {t("app.ads.continue")}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-full" style={{ backgroundColor: background }}>
      <div className="mx-auto w-full max-w-2xl px-4 pb-40 pt-4 sm:px-6">
        {/* Top bar */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-2 rounded-full px-2 py-2 font-body text-[14px] font-semibold text-cb-black/70 transition-colors hover:bg-black/5 hover:text-cb-black"
          >
            <ArrowLeftIcon />
            {t("app.ads.back")}
          </button>
          <FavouriteToggle adId={ad.id} />
        </div>

        <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-cb-black/50">
          {t("app.ads.sponsored")}
        </p>

        <h1 className="mt-2 font-heading text-[24px] font-bold leading-tight tracking-tight text-cb-black sm:text-[26px]">
          {ad.title}
        </h1>

        {ad.imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={ad.imageUrl}
            alt=""
            loading="eager"
            decoding="async"
            className="mt-5 w-full rounded-2xl object-cover"
          />
        )}

        {ad.description && (
          <RichText
            document={ad.description}
            className="mt-6 font-body text-[16px] leading-relaxed text-cb-black"
          />
        )}

        {ad.url && (
          <a
            href={ad.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 font-body text-[13px] font-bold text-cb-black underline underline-offset-4 hover:opacity-70"
          >
            {t("app.ads.readMore")}
            <ExternalLinkIcon size={14} />
            <span className="sr-only">{t("app.ads.opensNewTab")}</span>
          </a>
        )}

        {ad.logoUrl && (
          <div className="mt-8">
            <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-cb-black">
              {t("app.ads.sponsoredBy")}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ad.logoUrl}
              alt={ad.organization}
              loading="lazy"
              decoding="async"
              className="mt-3 max-h-16 w-auto max-w-[220px] object-contain"
            />
          </div>
        )}
      </div>

      {/* Action bar — same geometry as the profile page's, tinted to match. */}
      <div
        className="fixed inset-x-0 bottom-16 z-30 border-t border-black/10 px-4 pb-3 pt-3 lg:bottom-0 lg:left-64 lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        style={{ backgroundColor: background }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {/*
            Primary is **More resources** → the Partners list, which is what
            mobile's interstitial does. Web pointed it at the partner's own site
            because `/partners` was a placeholder; now that the list is real, the
            member gets the whole catalogue from here and the single partner's
            site stays reachable as a secondary action.

            An anchor, not <Button> in an <a> — a button inside a link is invalid
            HTML and breaks keyboard activation. Styled to match Button's
            primary / md variant.
          */}
          <Link
            href="/partners"
            className="inline-flex h-11 flex-1 select-none items-center justify-center gap-2 rounded-full border-2 border-cb-black bg-cb-black px-5 font-heading text-sm font-medium text-white transition-colors duration-150 ease-in-out hover:bg-cb-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-offset-2 active:bg-cb-gray-700"
          >
            {t("app.partners.moreResources")}
          </Link>
          {ad.url && (
            <a
              href={ad.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 shrink-0 select-none items-center justify-center gap-2 rounded-full border-2 border-cb-black px-5 font-heading text-sm font-medium text-cb-black transition-colors duration-150 ease-in-out hover:bg-cb-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-offset-2"
            >
              {t("app.ads.readMore")}
            </a>
          )}
          <div className="shrink-0">
            <Button variant="secondary" onClick={skip}>
              {t("app.ads.skip")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
