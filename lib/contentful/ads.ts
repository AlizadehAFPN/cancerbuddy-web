"use client";

/**
 * Client-side access to the partner resources.
 *
 * The list is ~39 entries that change a few times a year, so it's fetched once
 * per page load and held in module scope — the same trick
 * `lib/buddies/discoveryOrder.ts` uses. Mobile does the equivalent by fetching
 * on the profile screen and then threading the array through navigation params
 * (`useUserInfoShared.ts`), which is what stops it re-fetching on every Next.
 *
 * `loadAds()` is safe to call from anywhere, any number of times: concurrent
 * callers share one in-flight request, and a failure clears the cache so the
 * next call retries rather than caching an empty list forever.
 */

import type { ContentfulAd } from "@/lib/contentful/types";

let cache: ContentfulAd[] | null = null;
let inFlight: Promise<ContentfulAd[]> | null = null;

/** Whatever has already been loaded, without triggering a fetch. */
export function getCachedAds(): ContentfulAd[] | null {
  return cache;
}

export async function loadAds(): Promise<ContentfulAd[]> {
  if (cache) return cache;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const res = await fetch("/api/contentful/ads", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Resources request failed (HTTP ${res.status}).`);

    const body = (await res.json()) as { ads?: ContentfulAd[] };
    const ads = Array.isArray(body.ads) ? body.ads : [];
    cache = ads;
    return ads;
  })();

  try {
    return await inFlight;
  } catch (err) {
    // Don't poison the cache — a transient network blip shouldn't disable ads
    // for the rest of the session.
    cache = null;
    throw err;
  } finally {
    inFlight = null;
  }
}

/**
 * Warms the cache without making the caller deal with failure. Used on the
 * profile screen so the list is already there by the time someone has paged
 * through five buddies.
 */
export function prefetchAds(): void {
  void loadAds().catch((err) => {
    console.error("[contentful] could not preload resources:", err);
  });
}

/** Looks an entry up by its Contentful `sys.id`, fetching the list if needed. */
export async function findAdById(adId: string): Promise<ContentfulAd | null> {
  const ads = cache ?? (await loadAds());
  return ads.find((ad) => ad.id === adId) ?? null;
}
