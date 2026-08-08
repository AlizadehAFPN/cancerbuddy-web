"use client";

/**
 * `/partners` — the partner-resource catalogue, grouped by organisation.
 *
 * The data and the starring both already existed: `loadAds()` feeds the
 * interstitial, and `favoriteAds.ts` reads and writes the rows a star produces.
 * What was missing was the screen that shows them, so a member could star a
 * resource and never see their starred list again.
 *
 * Favourites are pinned in a first section, as on mobile.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

import { t } from "@/lib/i18n";
import { loadAds } from "@/lib/contentful/ads";
import {
  FAVORITES_SECTION,
  groupAdsByOrganization,
  type PartnerSection,
} from "@/lib/contentful/partnerSections";
import { fetchFavoriteAds } from "@/lib/buddies/favoriteAds";
import { getSignedInUserId } from "@/lib/buddies/currentUser";
import { DEFAULT_AD_BG } from "@/lib/contentful/types";

export default function PartnersScreen() {
  const [sections, setSections] = useState<PartnerSection[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ads = await loadAds();
        /* A failed favourites read must not cost the member the catalogue —
           they simply see it ungrouped by favourite. */
        let favourites = new Set<string>();
        try {
          const userId = await getSignedInUserId();
          if (userId) favourites = new Set((await fetchFavoriteAds(userId)).keys());
        } catch (err) {
          console.error("[partners] favourites read failed:", err);
        }
        if (!cancelled) setSections(groupAdsByOrganization(ads, favourites));
      } catch (err) {
        console.error("[partners] catalogue load failed:", err);
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <h1 className="font-heading text-2xl font-bold text-cb-black">
        {t("app.screens.partnersTitle")}
      </h1>
      <p className="mt-1 font-body text-cb-gray-500">
        {t("app.screens.partnersBody")}
      </p>

      {error ? (
        <p className="mt-6 rounded-2xl border border-cb-gray-200 bg-white p-5 font-body text-[14.5px] text-cb-gray-600">
          {t("app.partners.loadError")}
        </p>
      ) : !sections ? (
        <div aria-hidden className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-cb-gray-200 bg-cb-gray-100"
            />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-cb-gray-200 bg-white p-5 font-body text-[14.5px] text-cb-gray-600">
          {t("app.partners.empty")}
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {sections.map((section) => (
            <section
              key={section.title}
              data-testid="partner-section"
              data-org={section.title}
            >
              <h2 className="font-heading text-[13px] font-bold uppercase tracking-[0.12em] text-cb-black">
                {section.title === FAVORITES_SECTION
                  ? t("app.partners.favorites")
                  : section.title}
              </h2>
              <ul className="mt-3 space-y-3">
                {section.ads.map((ad) => (
                  <li key={ad.id}>
                    <Link
                      href={`/buddies/ad/${ad.id}`}
                      className="flex items-center gap-4 rounded-2xl border border-cb-gray-200 bg-white p-4 transition-shadow hover:shadow-[0_6px_24px_-10px_rgba(36,36,36,0.2)]"
                    >
                      <span
                        aria-hidden
                        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                        style={{ backgroundColor: ad.bgColor || DEFAULT_AD_BG }}
                      >
                        {ad.logoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ad.logoUrl}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-heading text-[15.5px] font-bold text-cb-black">
                          {ad.title}
                        </span>
                        {ad.organization && (
                          <span className="mt-0.5 block font-body text-[13px] text-cb-gray-500">
                            {ad.organization}
                          </span>
                        )}
                      </span>
                      <span aria-hidden className="shrink-0 text-cb-gray-400">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
