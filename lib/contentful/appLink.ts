"use client";

/**
 * Where "share the app" points.
 *
 * Web shared `window.location.origin` — the web app's own front page — where
 * mobile shares the store listing held in Contentful
 * (`elements/qr-share/qr-share.tsx:26-30`). A friend who scanned the QR landed
 * on a sign-up form rather than the app they were told to install.
 *
 * Falls back to the foundation's website exactly as mobile's Copy Link does
 * (`url || BONE_MARROW_WEBSITE`), so the control is never a dead end.
 */

import { BMCF_WEBSITE_URL } from "@/lib/constants/contact";

let cache: string | null = null;

export async function getShareUrl(): Promise<string> {
  if (cache) return cache;
  try {
    const res = await fetch("/api/contentful/app-link", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return BMCF_WEBSITE_URL;

    const body = (await res.json()) as { appLink?: string | null };
    const link = body.appLink?.trim();
    if (!link) return BMCF_WEBSITE_URL;

    cache = link;
    return link;
  } catch (err) {
    console.error("[contentful] app link unavailable:", err);
    return BMCF_WEBSITE_URL;
  }
}

/** Test seam. */
export function resetShareUrlCache(): void {
  cache = null;
}
