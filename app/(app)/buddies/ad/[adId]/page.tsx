"use client";

/**
 * `/buddies/ad/[adId]?next=<userId>` — the partner-resource interstitial.
 *
 * Sits under the `/buddies` layout on purpose: it needs the same
 * `BuddiesProvider` the profile page uses (the favourite star writes against
 * the signed-in user), and keeping it in the same subtree means navigating in
 * and out doesn't remount the provider.
 *
 * `useSearchParams` lives behind a Suspense boundary so the route can still be
 * prerendered — without it Next deopts the whole page to client rendering.
 */

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import AdScreen from "@/components/buddies/AdScreen";

function AdRoute() {
  const params = useParams<{ adId: string }>();
  const searchParams = useSearchParams();

  const adId = params?.adId;
  if (!adId) return null;

  return <AdScreen adId={adId} nextUserId={searchParams.get("next") ?? undefined} />;
}

export default function AdPage() {
  return (
    <Suspense fallback={<div className="min-h-full bg-white" />}>
      <AdRoute />
    </Suspense>
  );
}
