/**
 * The partner catalogue, grouped the way mobile's Partners screen groups it.
 *
 * One section per organisation, in the order the organisations first appear, and
 * a **Favorites** section pinned at the top holding whatever the member has
 * starred. Starring already worked on web — `lib/buddies/favoriteAds.ts` reads
 * and writes the rows — but there was nowhere to see the result, because
 * `/partners` was a placeholder.
 *
 * Pure, so the grouping rules can be stated as assertions: every ad appears
 * exactly once, Favorites is first, and an unstarred catalogue produces no
 * Favorites section at all.
 */

import type { ContentfulAd } from "@/lib/contentful/types";

/** The pinned section's title. Mobile's literal. */
export const FAVORITES_SECTION = "Favorites";

export interface PartnerSection {
  /** Organisation name, or {@link FAVORITES_SECTION}. */
  title: string;
  ads: ContentfulAd[];
}

export function groupAdsByOrganization(
  ads: ReadonlyArray<ContentfulAd>,
  favouriteIds: ReadonlySet<string> | ReadonlyArray<string> = [],
): PartnerSection[] {
  const favourites =
    favouriteIds instanceof Set ? favouriteIds : new Set(favouriteIds);

  const starred = ads.filter((ad) => favourites.has(ad.id));
  const rest = ads.filter((ad) => !favourites.has(ad.id));

  const byOrg = new Map<string, ContentfulAd[]>();
  for (const ad of rest) {
    // An ad with no organisation still has to appear somewhere; its own title
    // is the most useful heading available and keeps the "every ad exactly
    // once" property true.
    const key = ad.organization?.trim() || ad.title;
    const bucket = byOrg.get(key);
    if (bucket) bucket.push(ad);
    else byOrg.set(key, [ad]);
  }

  const sections: PartnerSection[] = [];
  if (starred.length > 0) {
    sections.push({ title: FAVORITES_SECTION, ads: starred });
  }
  for (const [title, group] of byOrg) sections.push({ title, ads: group });
  return sections;
}
