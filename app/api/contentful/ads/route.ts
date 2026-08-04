/**
 * `GET /api/contentful/ads` — the partner resources, proxied.
 *
 * Exists so `CONTENTFUL_ACCESS_TOKEN` stays on the server (see
 * `lib/contentful/server.ts` for the reasoning). The response is the same
 * public marketing content the mobile app fetches directly, so this route is
 * intentionally not gated on a session — the web app has no server-readable
 * session to gate on today (see `proxy.ts`), and gating it would only stop the
 * ad interstitial from rendering.
 *
 * Caching happens twice: `next.revalidate` on the upstream fetch means one
 * Contentful call per hour per server, and `Cache-Control` lets the browser
 * reuse the payload for five minutes so paging through profiles doesn't
 * re-request it.
 */

import { NextResponse } from "next/server";
import { fetchAds } from "@/lib/contentful/server";

export async function GET() {
  try {
    const ads = await fetchAds();
    return NextResponse.json(
      { ads },
      {
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        },
      },
    );
  } catch (err) {
    // Never surface the upstream message: it can echo the endpoint (and with
    // it the space id) back to the browser.
    console.error("[contentful] ads request failed:", err);
    return NextResponse.json({ error: "Unable to load resources." }, { status: 502 });
  }
}
