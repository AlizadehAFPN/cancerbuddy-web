"use client";

/**
 * Starring a partner resource.
 *
 * The only part of this feature that isn't Contentful: favourites are per-user,
 * so they live in AppSync's `FavoritesAds` model as `{ id, userID, adsUUID }`,
 * where `adsUUID` is the Contentful entry's `sys.id`. Mobile does exactly this
 * in `AdLayout.tsx` — the star there writes the same rows.
 *
 * Deleting needs the *row* id, not the entry id, so the current favourites are
 * read once and cached; the cache is kept in step locally after each write
 * instead of re-reading.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";

export interface FavoriteAdRow {
  /** AppSync row id — what a delete needs. */
  id: string;
  /** Contentful entry `sys.id`. */
  adsUUID: string;
}

const GET_FAVORITE_ADS = `
  query GetFavoriteAds($id: ID!) {
    getUser(id: $id) {
      favoritesAds {
        items {
          id
          userID
          adsUUID
        }
      }
    }
  }
`;

const CREATE_FAVORITE_AD = `
  mutation CreateFavoriteAds($input: CreateFavoritesAdsInput!) {
    createFavoritesAds(input: $input) {
      id
    }
  }
`;

const DELETE_FAVORITE_AD = `
  mutation DeleteFavoriteAds($input: DeleteFavoritesAdsInput!) {
    deleteFavoritesAds(input: $input) {
      id
    }
  }
`;

/** adsUUID → row id, for the signed-in user. Cleared when the user changes. */
let cache: { userId: string; rows: Map<string, string> } | null = null;

function cacheFor(userId: string): Map<string, string> {
  if (cache?.userId !== userId) cache = { userId, rows: new Map() };
  return cache.rows;
}

export async function fetchFavoriteAds(userId: string): Promise<Map<string, string>> {
  if (cache?.userId === userId && cache.rows.size) return cache.rows;

  const { data } = await executeAppSyncGraphql<{
    getUser?: { favoritesAds?: { items?: (FavoriteAdRow | null)[] | null } | null } | null;
  }>({
    query: GET_FAVORITE_ADS,
    variables: { id: userId },
    authWithUserPool: true,
  });

  const rows = cacheFor(userId);
  rows.clear();
  for (const item of data?.getUser?.favoritesAds?.items ?? []) {
    if (item?.id && item?.adsUUID) rows.set(item.adsUUID, item.id);
  }
  return rows;
}

/** Returns the new row id. */
export async function addFavoriteAd(userId: string, adsUUID: string): Promise<string> {
  const { data } = await executeAppSyncGraphql<{ createFavoritesAds?: { id?: string } }>({
    query: CREATE_FAVORITE_AD,
    variables: { input: { userID: userId, adsUUID } },
    authWithUserPool: true,
  });

  const id = data?.createFavoritesAds?.id;
  if (!id) throw new Error("Favourite was not saved.");

  cacheFor(userId).set(adsUUID, id);
  return id;
}

export async function removeFavoriteAd(userId: string, adsUUID: string): Promise<void> {
  const rowId = cacheFor(userId).get(adsUUID);
  if (!rowId) return;

  await executeAppSyncGraphql({
    query: DELETE_FAVORITE_AD,
    variables: { input: { id: rowId } },
    authWithUserPool: true,
  });

  cacheFor(userId).delete(adsUUID);
}
