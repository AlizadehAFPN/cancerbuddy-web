/**
 * The two id sets every discovery run needs, regardless of filters:
 *
 *  • **age-guarded ids** — everyone this user is permitted to browse.
 *  • **diagnosis peers** — everyone sharing one of their diagnoses, which
 *    decides the "Recommended for you" section.
 *
 * Both are full table scans, so they're cached for five minutes (the same TTL
 * mobile uses) and refreshed in the background on a cache hit — the user gets
 * instant results and the next run picks up new sign-ups.
 */

import {
  fetchAgeGuardedUsers,
  fetchDiagnosisUsers,
} from "@/lib/buddies/discoveryFetch";
import type { CurrentUserData } from "@/lib/buddies/types";

export interface AudienceBase {
  ageGuardedIds: string[];
  diagnosisPeerIds: string[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: (AudienceBase & { key: string; at: number }) | null = null;
let refreshing = false;

/** Cache identity: the inputs that change who is eligible. */
function cacheKey(user: CurrentUserData): string {
  return `${user.id}|${user.birth}|${user.userType}|${[...user.diagnosis].sort().join(",")}`;
}

async function load(user: CurrentUserData): Promise<AudienceBase> {
  const [ageGuardedIds, diagnosisPeerIds] = await Promise.all([
    fetchAgeGuardedUsers(user),
    fetchDiagnosisUsers(user.diagnosis),
  ]);
  return { ageGuardedIds, diagnosisPeerIds };
}

export async function getAudienceBase(
  user: CurrentUserData,
): Promise<AudienceBase> {
  const key = cacheKey(user);
  const fresh = cache && cache.key === key && Date.now() - cache.at < CACHE_TTL_MS;

  if (fresh && cache) {
    // Serve instantly, then quietly bring the cache up to date.
    if (!refreshing) {
      refreshing = true;
      load(user)
        .then((next) => {
          cache = { ...next, key, at: Date.now() };
        })
        .catch(() => {
          /* keep the stale-but-usable cache */
        })
        .finally(() => {
          refreshing = false;
        });
    }
    return { ageGuardedIds: cache.ageGuardedIds, diagnosisPeerIds: cache.diagnosisPeerIds };
  }

  const next = await load(user);
  cache = { ...next, key, at: Date.now() };
  return next;
}

export function invalidateAudienceBase(): void {
  cache = null;
}
