/**
 * Id-collecting queries for buddy discovery.
 *
 * Every function here answers one question — "which user ids match X?" — and
 * pages through AppSync until there is no `nextToken` left. They are ports of
 * the mobile app's `screens/buddies/recommended/paginatedFetch.ts`, and the
 * queries are deliberately kept byte-for-byte equivalent so web and mobile
 * return the same candidate set for the same filters.
 *
 * Note the `limit: 1000000`: these are DynamoDB scans with a post-read filter,
 * where `limit` caps *scanned* rows, not returned ones. A small limit here
 * would silently truncate results, which is why mobile uses a huge one. Ids are
 * cheap; the expensive part (full profiles) is batched separately in
 * `profiles.ts`.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { birthRules } from "@/lib/buddies/age";
import { USER_TYPES, type CurrentUserData, type ListUserId } from "@/lib/buddies/types";

/** Matches mobile's `resultLimit` — see the module note above. */
const RESULT_LIMIT = 1000000;

/** Hard stops so one pathological account can't page forever. */
const MAX_PAGES = 200;
const MAX_DIAGNOSIS_USERS = 10000;

/**
 * Ids reach these builders from picklists and AppSync rows, but they are still
 * interpolated into query text, so restrict them to the id alphabet rather than
 * trusting the source.
 */
function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_:-]/g, "");
}

function orIdFilter(field: string, ids: string[]): string {
  return ids
    .map((id) => `{${field}: {eq: "${safeId(id)}"}}`)
    .join("");
}

/** `{userType: {eq: PATIENT}}{userType: {eq: SURVIVOR}}…` */
function allSearchableUserTypes(): string {
  return USER_TYPES.map((t) => `{userType: {eq: ${t}}}`).join("");
}

interface PagedResponse {
  items?: ListUserId[] | null;
  nextToken?: string | null;
}

/**
 * Runs `buildQuery(nextToken)` until the API stops handing back a token, and
 * concatenates `items` from `dataKey`. Returns `[]` on any error — a failed
 * facet must not take the whole page down, and the caller treats "no ids" as
 * "no matches" exactly like mobile does.
 */
async function collectPages(
  buildQuery: (nextToken?: string) => string,
  dataKey: string,
  options?: { stopAfter?: number },
): Promise<string[]> {
  const ids: string[] = [];
  let nextToken: string | undefined;
  let pages = 0;

  try {
    do {
      const { data } = await executeAppSyncGraphql<
        Record<string, PagedResponse | null>
      >({
        query: buildQuery(nextToken),
        variables: {},
        authWithUserPool: true,
      });

      const page = data?.[dataKey];
      const items = page?.items;
      if (!Array.isArray(items)) break;

      for (const item of items) {
        if (item?.userID) ids.push(item.userID);
      }

      nextToken = page?.nextToken ?? undefined;
      pages += 1;
      if (options?.stopAfter && ids.length >= options.stopAfter) break;
    } while (nextToken && pages < MAX_PAGES);
  } catch (err) {
    console.error(`[buddies] ${dataKey} query failed:`, err);
    return ids;
  }

  return ids;
}

function tokenArg(nextToken?: string): string {
  return nextToken ? `, nextToken: "${nextToken}"` : "";
}

/* ── Entity → user join tables ──────────────────────────────────────────── */

/**
 * The `listXUsers` join tables all share one shape, so one builder covers
 * hospitals, treatments, languages, disabilities and support organizations.
 */
function fetchJoinTableUsers(
  listName: string,
  filterField: string,
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return collectPages(
    (nextToken) => `
      query ${listName}Filtered {
        ${listName}(filter: { or: [${orIdFilter(filterField, ids)}] }, limit: ${RESULT_LIMIT}${tokenArg(nextToken)}) {
          items { userID }
          nextToken
        }
      }
    `,
    listName,
  );
}

export const fetchHospitalUsers = (ids: string[]) =>
  fetchJoinTableUsers("listHospitalUsers", "hospitalID", ids);

export const fetchTreatmentUsers = (ids: string[]) =>
  fetchJoinTableUsers("listTreatmentUsers", "treatmentID", ids);

export const fetchLanguageUsers = (ids: string[]) =>
  fetchJoinTableUsers("listLanguageUsers", "languageID", ids);

export const fetchDisabilitiesUsers = (ids: string[]) =>
  fetchJoinTableUsers("listDisabilitiesUsers", "disabilitiesID", ids);

export const fetchSupportOrgUsers = (ids: string[]) =>
  fetchJoinTableUsers("listSupportOrgUsers", "supportOrganizationsID", ids);

/** Diagnosis is the hottest join table, so it gets an extra result ceiling. */
export function fetchDiagnosisUsers(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return collectPages(
    (nextToken) => `
      query diagnosisUsers {
        listDiagnosisUsers(filter: { or: [${orIdFilter("diagnosisID", ids)}] }, limit: ${RESULT_LIMIT}${tokenArg(nextToken)}) {
          items { userID }
          nextToken
        }
      }
    `,
    "listDiagnosisUsers",
    { stopAfter: MAX_DIAGNOSIS_USERS },
  );
}

/* ── listUsers-based queries ────────────────────────────────────────────── */

/** Caregivers filtered by who they care for — lives on `User`, not a join table. */
export function fetchRelationshipUsers(
  relationshipIds: string[],
  currentUserId: string,
): Promise<string[]> {
  if (relationshipIds.length === 0) return Promise.resolve([]);
  return collectPages(
    (nextToken) => `
      query listUsersRelationshipFiltered {
        listUsers(filter: {
          id: {ne: "${safeId(currentUserId)}"}
          or: [${orIdFilter("userRelationshipId", relationshipIds)}]
        }, limit: ${RESULT_LIMIT}${tokenArg(nextToken)}) {
          items { userID: id }
          nextToken
        }
      }
    `,
    "listUsers",
  );
}

/**
 * The age guard: every user the current user is *allowed* to browse, before any
 * filter is applied. Also excludes snoozed accounts and the user themselves.
 */
export function fetchAgeGuardedUsers(
  user: Pick<CurrentUserData, "id" | "userType" | "birth">,
): Promise<string[]> {
  if (!user?.id || !user?.userType || !user?.birth) {
    console.warn("[buddies] age guard skipped — incomplete user data");
    return Promise.resolve([]);
  }

  const window = birthRules(user.birth);
  if (!window) return Promise.resolve([]);

  return collectPages(
    (nextToken) => `
      query ageGuardedUsers {
        rangeUsers: listUsers(filter: {
          id: {ne: "${safeId(user.id)}"},
          or: [${allSearchableUserTypes()}]
          isSnooze: { ne: true }
          birth: {between: ${window}}
        }, limit: ${RESULT_LIMIT}${tokenArg(nextToken)}) {
          items { userID: id }
          nextToken
        }
      }
    `,
    "rangeUsers",
  );
}

/** Users matching the direct `User`-table conditions built by `filterConditions`. */
export function fetchUsersByDirectFields(
  conditions: string,
  currentUserId: string,
): Promise<string[]> {
  if (!conditions) return Promise.resolve([]);
  return collectPages(
    (nextToken) => `
      query listUsersFiltered {
        listUsers(filter: {
          id: {ne: "${safeId(currentUserId)}"}
          ${conditions}
        }, limit: ${RESULT_LIMIT}${tokenArg(nextToken)}) {
          items { userID: id }
          nextToken
        }
      }
    `,
    "listUsers",
  );
}
