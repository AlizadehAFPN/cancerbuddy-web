/**
 * Server-side Contentful client.
 *
 * ⚠️  SERVER ONLY. This module reads `CONTENTFUL_ACCESS_TOKEN`, which has no
 * `NEXT_PUBLIC_` prefix and therefore does not exist in the browser bundle.
 * Import it from Route Handlers and Server Components only — never from a
 * `"use client"` file. Client code goes through `/api/contentful/*` instead
 * (see `lib/contentful/ads.ts`).
 *
 * Why a server route at all, when the mobile app calls Contentful directly
 * with the same read-only token: on web the bundle is readable by anyone, so
 * shipping the token would hand out our delivery quota and tie Contentful's
 * rate limit to visitors' IPs. Proxying also lets one server-side cache serve
 * every visitor — the ad list changes a few times a year.
 */

import {
  GET_ADS,
  GET_APP_STORE_LINK,
  GET_FUNDERS,
} from "@/lib/contentful/queries";
import { normalizeAds, type ContentfulAd, type RawAdCollection } from "@/lib/contentful/types";

/** Ads are marketing copy, not live data — an hour stale is fine. */
export const ADS_REVALIDATE_SECONDS = 3600;

interface ContentfulConfig {
  endpoint: string;
  token: string;
}

/**
 * Resolves the four env vars the mobile app also uses, and assembles the same
 * URL its axios client builds (`CONTENTFUL_URL` is a *prefix* ending in
 * `/spaces/`, not a complete endpoint).
 */
function readConfig(): ContentfulConfig {
  const base = process.env.CONTENTFUL_URL?.trim();
  const space = process.env.CONTENTFUL_SPACE?.trim();
  const environment = process.env.CONTENTFUL_ENV?.trim();
  const token = process.env.CONTENTFUL_ACCESS_TOKEN?.trim();

  const missing = [
    !base && "CONTENTFUL_URL",
    !space && "CONTENTFUL_SPACE",
    !environment && "CONTENTFUL_ENV",
    !token && "CONTENTFUL_ACCESS_TOKEN",
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`Contentful is not configured — missing ${missing.join(", ")}.`);
  }

  const prefix = base!.endsWith("/") ? base! : `${base!}/`;
  return {
    endpoint: `${prefix}${space}/environments/${environment}`,
    token: token!,
  };
}

/** True when the env vars are present, so callers can degrade instead of 500. */
export function isContentfulConfigured(): boolean {
  try {
    readConfig();
    return true;
  } catch {
    return false;
  }
}

async function runContentfulQuery<TData>(
  query: string,
  revalidateSeconds: number,
): Promise<TData> {
  const { endpoint, token } = readConfig();

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
    next: { revalidate: revalidateSeconds },
  });

  let body: { data?: TData; errors?: { message?: string }[] };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    throw new Error(`Contentful returned non-JSON (HTTP ${res.status}).`);
  }

  // Contentful answers 200 with an `errors` array for a bad query, so the
  // status alone is not enough to tell success from failure.
  if (body.errors?.length) {
    throw new Error(`Contentful: ${body.errors[0]?.message ?? "query failed"}`);
  }
  if (!res.ok) {
    throw new Error(`Contentful HTTP ${res.status}: ${res.statusText}`);
  }
  if (!body.data) {
    throw new Error("Contentful returned no data.");
  }

  return body.data;
}

/** Every published `ad` entry, normalised and ready to render. */
export async function fetchAds(): Promise<ContentfulAd[]> {
  const data = await runContentfulQuery<RawAdCollection>(GET_ADS, ADS_REVALIDATE_SECONDS);
  return normalizeAds(data);
}

/**
 * The app-store link, or null when the entry is missing.
 *
 * Cached for a day: this changes when a store listing moves, which is roughly
 * never, and a stale value here is a link to the right app either way.
 */
export const APP_LINK_REVALIDATE_SECONDS = 86_400;

interface RawAppStoreLink {
  appStoreLinkCollection?: { items?: ({ appLink?: string | null } | null)[] | null } | null;
}

export async function fetchAppStoreLink(): Promise<string | null> {
  const data = await runContentfulQuery<RawAppStoreLink>(
    GET_APP_STORE_LINK,
    APP_LINK_REVALIDATE_SECONDS,
  );
  const link = data.appStoreLinkCollection?.items?.[0]?.appLink?.trim();
  return link || null;
}

/* ── Funders ────────────────────────────────────────────────────────────── */

export interface Funder {
  name: string;
  description: string;
}

interface RawFunders {
  fundersCollection?: {
    items?: ({ name?: string | null; description?: string | null } | null)[] | null;
  } | null;
}

/** Alphabetical, case-insensitively — mobile sorts the same way. */
export function sortFunders(funders: ReadonlyArray<Funder>): Funder[] {
  return [...funders].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
}

/**
 * The funder list, sorted, or `[]` when Contentful is unreachable.
 *
 * Never throws: a funding credit failing to load should not take the page down,
 * and an empty list is also the signal that hides the menu row.
 */
export async function fetchFunders(): Promise<Funder[]> {
  try {
    const data = await runContentfulQuery<RawFunders>(
      GET_FUNDERS,
      ADS_REVALIDATE_SECONDS,
    );
    const funders = (data.fundersCollection?.items ?? [])
      .map((item) => ({
        name: item?.name?.trim() ?? "",
        description: item?.description?.trim() ?? "",
      }))
      .filter((f) => f.name);
    return sortFunders(funders);
  } catch (err) {
    console.error("[contentful] funders load failed:", err);
    return [];
  }
}
