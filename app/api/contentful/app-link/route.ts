/**
 * `GET /api/contentful/app-link` — the app-store link, proxied.
 *
 * Same reasoning as the ads route: `CONTENTFUL_ACCESS_TOKEN` stays on the
 * server. Answers `{ appLink: string | null }` and never fails the caller — a
 * missing link falls back to the foundation's website, which is a better place
 * to send a friend than an error.
 */

import { NextResponse } from "next/server";
import { fetchAppStoreLink } from "@/lib/contentful/server";

export async function GET() {
  try {
    const appLink = await fetchAppStoreLink();
    return NextResponse.json(
      { appLink },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (err) {
    // Never echo the upstream message: it can carry the endpoint and space id.
    console.error("[contentful] app link request failed:", err);
    return NextResponse.json({ appLink: null }, { status: 200 });
  }
}
