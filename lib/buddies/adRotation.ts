"use client";

/**
 * Decides when paging through buddies is interrupted by a partner resource.
 *
 * Ported 1:1 from mobile, where the rule lives in `UserInfo.tsx` /
 * `UserInfoConnect.tsx`:
 *
 *   PROFILES_VISITED = 5
 *   handleNext():
 *     if (profilesViewed === 5) { profilesViewed = 0; show a random ad }
 *     else                      { profilesViewed++;   go to the next profile }
 *
 * and `AddsScreen`'s Skip does `profilesViewed++` on the way out. Starting
 * from zero that puts the first ad on the **sixth** Next, and every **fifth**
 * one after that (Skip already consumes one of the five). Reproducing the
 * off-by-one rather than "fixing" it keeps the two apps in step.
 *
 * Module scope, like `discoveryOrder.ts`: the counter has to survive
 * navigating between `/buddies/[userId]` routes, and losing it on a hard
 * refresh is the correct outcome — nothing here is worth persisting.
 *
 * One mobile behaviour is deliberately not ported: `ConnectionRequest.tsx`
 * resets the counter to zero when a buddy request is accepted or dismissed.
 * Nothing about answering a request has to do with ad pacing, so that reads as
 * incidental rather than intended. Wire a reset in here if it turns out to be
 * on purpose.
 */

import { getCachedAds } from "@/lib/contentful/ads";
import type { ContentfulAd } from "@/lib/contentful/types";

/** Mobile's `PROFILES_VISITED`. */
export const PROFILES_BETWEEN_ADS = 5;

let profilesViewed = 0;

/** Called by the ad screen's Skip, which is mobile's `handleSkip`. */
export function countAdSkip(): void {
  profilesViewed += 1;
}

/**
 * Picks the ad to interrupt with, or `null` to just go to the next profile.
 *
 * Mobile selects with `ads[Math.floor(Math.random() * ads.length)]` — uniform,
 * with no guard against showing the same entry twice in a row. Kept as-is; with
 * 39 entries a repeat is rare and diverging would make the two apps feel
 * different for no clear gain.
 *
 * Only the already-cached list is consulted. If the resources haven't loaded
 * yet (slow network, first profile of the session) the counter still advances
 * and the user simply goes to the next buddy — never a spinner between
 * profiles.
 */
export function nextAdOrNull(): ContentfulAd | null {
  if (profilesViewed < PROFILES_BETWEEN_ADS) {
    profilesViewed += 1;
    return null;
  }

  const ads = getCachedAds();
  if (!ads?.length) {
    // Due an ad but there's nothing to show — hold the counter at the
    // threshold so the next press tries again instead of waiting five more.
    return null;
  }

  profilesViewed = 0;
  return ads[Math.floor(Math.random() * ads.length)];
}
