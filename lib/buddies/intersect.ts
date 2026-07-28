/**
 * Combines the per-facet id lists into the final, ordered discovery result.
 *
 * The rules (ported from mobile's `userIntersection.ts`):
 *  • Facets are ANDed — a user must appear in *every* requested facet.
 *  • A requested facet that matched nobody means the whole result is empty;
 *    "hospital X" with no members must not silently widen the search.
 *  • The age-bracket guard is applied unless the user set an explicit age range
 *    (in which case the range query already enforced it).
 *  • Existing connections, blocked users and the user themselves are removed.
 *  • What's left is split into "recommended" (shares a diagnosis) and "more".
 */

import type { DiscoverySections } from "@/lib/buddies/types";
import type { FilterFacet, FilterFacets } from "@/lib/buddies/filterConditions";

function intersectAll(lists: string[][]): string[] {
  if (lists.length === 0) return [];
  if (lists.length === 1) return [...new Set(lists[0])];

  // Start from the smallest list so the membership checks stay cheap.
  const ordered = [...lists].sort((a, b) => a.length - b.length);
  const sets = ordered.slice(1).map((l) => new Set(l));

  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ordered[0]) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (sets.every((s) => s.has(id))) result.push(id);
  }
  return result;
}

function without(ids: string[], excluded: Iterable<string>): string[] {
  const drop = new Set(excluded);
  return ids.filter((id) => !drop.has(id));
}

/**
 * Splits `userIds` into people sharing a diagnosis with the current user and
 * everyone else, preserving the incoming order within each group.
 */
function splitByDiagnosis(
  userIds: string[],
  diagnosisPeerIds: string[],
): DiscoverySections {
  const peers = new Set(diagnosisPeerIds);
  const recommended: string[] = [];
  const more: string[] = [];
  for (const id of userIds) {
    if (peers.has(id)) recommended.push(id);
    else more.push(id);
  }
  return { recommended, more };
}

export interface AudienceContext {
  /** Ids the age guard allows this user to see at all. */
  ageGuardedIds: string[];
  /** Ids of people who share a diagnosis with the current user. */
  diagnosisPeerIds: string[];
  /** Users already connected to or invited by the current user. */
  connectedUserIds: string[];
  /** Users the current user has blocked. */
  blockedUserIds: string[];
  currentUserId: string;
}

/** Result set when at least one filter is active. */
export function resolveFilteredAudience(
  facets: FilterFacets,
  context: AudienceContext,
): DiscoverySections {
  const requested: string[][] = [];

  const facetList: readonly FilterFacet[] = [
    facets.directFields,
    facets.hospitals,
    facets.treatments,
    facets.languages,
    facets.diagnosis,
    facets.desabilities,
    facets.supportOrganizations,
    facets.relationship,
  ];

  for (const f of facetList) {
    if (!f.requested) continue;
    // A requested facet with no members can never be satisfied.
    if (f.userIds.length === 0) return { recommended: [], more: [] };
    requested.push(f.userIds);
  }

  if (requested.length === 0 && !facets.hasAgeFilter) {
    return { recommended: [], more: [] };
  }

  let ids =
    requested.length === 0 ? [...context.ageGuardedIds] : intersectAll(requested);

  // The explicit age range already encodes the bracket clamp; applying the
  // guard on top would drop legitimate results at the bracket edges.
  if (!facets.hasAgeFilter) {
    ids = intersectAll([ids, context.ageGuardedIds]);
  }

  ids = without(ids, [
    ...context.blockedUserIds,
    ...context.connectedUserIds,
    context.currentUserId,
  ]);

  return splitByDiagnosis(ids, context.diagnosisPeerIds);
}

/** Result set when no filter is active: everyone the age guard allows. */
export function resolveUnfilteredAudience(
  context: AudienceContext,
): DiscoverySections {
  const ids = without([...new Set(context.ageGuardedIds)], [
    ...context.blockedUserIds,
    ...context.connectedUserIds,
    context.currentUserId,
  ]);

  return splitByDiagnosis(ids, context.diagnosisPeerIds);
}
