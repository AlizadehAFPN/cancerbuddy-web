import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";

export type PicklistItem = { value: string; label: string };

export interface ZipCodeResult {
  value: string;     // CityZipCode record ID
  label: string;     // raw zipcode string (e.g. "10001")
  cityID: string;
  cityName: string;
  stateID: string;
  stateName: string; // state abbreviation (e.g. "NY")
}

const PICKLIST_PAGE_SIZE = 100;
/** Backstop against a resolver that keeps handing back a token. */
const PICKLIST_MAX_PAGES = 20;
/** Matches mobile's `size: 100` on `findHospitals` / `findDiagnosis`. */
const CATALOGUE_SEARCH_SIZE = 100;

/* ── GraphQL queries ──────────────────────────────────────────────────── */

const LIST_RELATIONSHIPS = /* GraphQL */ `
  query getRelationships {
    listRelationships(limit: 1000) {
      items { label: name, value: id }
    }
  }
`;

/**
 * The full diagnosis catalogue, paged.
 *
 * It used to be `listDiagnoses(limit: 1000)` with no token, which silently
 * truncated: a diagnosis outside that slice could not be selected on the medical
 * form, nor filtered on in buddy discovery. Typeaheads should prefer
 * {@link searchDiagnoses} — this exists for the places that genuinely render the
 * whole set, such as the buddy filter dropdowns.
 */
const LIST_DIAGNOSES = (nextToken?: string) => /* GraphQL */ `
  query getDiagnoses {
    listDiagnoses(limit: ${PICKLIST_PAGE_SIZE}${nextToken ? `, nextToken: "${nextToken}"` : ""}) {
      items { label: name, value: id }
      nextToken
    }
  }
`;

/** Server-side diagnosis search — mobile's `findDiagnosis`. Note: singular. */
const SEARCH_DIAGNOSES = (query: string, from: number, size: number) => /* GraphQL */ `
  query findDiagnosis {
    findDiagnosis(name: "${query}", from: ${from}, size: ${size}) {
      items { value: id, label: name }
    }
  }
`;

const LIST_TREATMENTS = /* GraphQL */ `
  query getTreatments {
    listTreatments(limit: 1000) {
      items { label: name, value: id }
    }
  }
`;

const LIST_TREATMENT_STATUSES = /* GraphQL */ `
  query getTreatmentStatuses {
    listTreatmentStatuses(limit: 1000) {
      items { label: name, value: id }
    }
  }
`;

const LIST_DISABILITIES = /* GraphQL */ `
  query getDisabilities {
    listDisabilities(limit: 1000) {
      items { label: name, value: id }
    }
  }
`;

/** The full hospital catalogue, paged. See {@link LIST_DIAGNOSES}. */
const LIST_HOSPITALS = (nextToken?: string) => /* GraphQL */ `
  query getHospitals {
    listHospitals(limit: ${PICKLIST_PAGE_SIZE}${nextToken ? `, nextToken: "${nextToken}"` : ""}) {
      items { label: name, value: id }
      nextToken
    }
  }
`;

/** Server-side hospital search — mobile's `findHospitals`. */
const SEARCH_HOSPITALS = (query: string, from: number, size: number) => /* GraphQL */ `
  query findHospitals {
    findHospitals(name: "${query}", from: ${from}, size: ${size}) {
      items { value: id, label: name }
    }
  }
`;

const LIST_SUPPORT_ORGANIZATIONS = /* GraphQL */ `
  query getSupportOrganizations {
    listSupportOrganizations(limit: 1000) {
      items { label: name, value: id }
    }
  }
`;

const LIST_STATES = /* GraphQL */ `
  query getStates {
    listStates(limit: 100) {
      items { label: name, value: id }
    }
  }
`;

const LIST_INTERESTS = /* GraphQL */ `
  query getInterests {
    listInterests(limit: 1000) {
      items { label: name, value: id }
    }
  }
`;

const LIST_LANGUAGES = /* GraphQL */ `
  query getLanguages {
    listLanguages(limit: 1000) {
      items { label: name, value: id }
    }
  }
`;

const LIST_PRONOUNS = /* GraphQL */ `
  query getPronouns {
    listPronouns(limit: 1000) {
      items { label: name, value: id }
    }
  }
`;

const LIST_COPING_WITH_CANCER_LOSS = /* GraphQL */ `
  query getCopingWithCancerLoss {
    listCopingWithCancerLosses(limit: 1000) {
      items { label: name, value: id }
    }
  }
`;

const LIST_ETHNICITIES = /* GraphQL */ `
  query getEthnicities {
    listEthnicities(limit: 1000) {
      items { label: name, value: id }
    }
  }
`;

const LIST_TRANSGENDERS = /* GraphQL */ `
  query getTransgenders {
    listTransgenders(limit: 1000) {
      items { label: name, value: id }
    }
  }
`;

const LIST_SEXUAL_ORIENTATIONS = /* GraphQL */ `
  query getSexualOrientations {
    listSexualOrientations(limit: 1000) {
      items { label: name, value: id }
    }
  }
`;

/**
 * Typeahead pages, and both of these select `nextToken` for that reason.
 *
 * `limit: 100` on its own silently truncated the result set: someone typing a
 * common city prefix got the first hundred matches OpenSearch happened to return
 * and no way to reach the rest, so a city outside that slice could not be
 * selected at all. {@link fetchAllPicklistPages} follows the token.
 */
const SEARCH_CITIES_IN_STATE = (stateId: string, query: string, nextToken?: string) => /* GraphQL */ `
  query searchCitiesInState {
    searchCities(
      filter: { stateID: { eq: "${stateId}" }, name: { matchPhrasePrefix: "${query}" } },
      limit: ${PICKLIST_PAGE_SIZE}${nextToken ? `,
      nextToken: "${nextToken}"` : ""}
    ) {
      items { value: id, label: name }
      nextToken
    }
  }
`;

const SEARCH_WORKPLACES = (query: string, nextToken?: string) => /* GraphQL */ `
  query searchWorkplaces {
    searchWorkplaces(
      filter: { name: { matchPhrasePrefix: "${query}" } },
      limit: ${PICKLIST_PAGE_SIZE}${nextToken ? `,
      nextToken: "${nextToken}"` : ""}
    ) {
      items { value: id, label: name }
      nextToken
    }
  }
`;

const SEARCH_BY_ZIPCODE = (zipcode: string) => /* GraphQL */ `
  query SearchCityZipCodes {
    searchCityZipCodes(filter: { zipcode: { match: "${zipcode}" }}, limit: 10000) {
      items {
        value: id
        label: zipcode
        cityID
        cityName
        stateID
        stateName: stateAbbreviation
      }
    }
  }
`;

const SEARCH_COLLEGES = (query: string) => /* GraphQL */ `
  query FindColleges {
    findColleges(name: "${query}", from: 0, size: 100) {
      items {
        value: id
        label: name
      }
    }
  }
`;

/* ── Helper ───────────────────────────────────────────────────────────── */

/**
 * One server-side catalogue search, for the `find*` resolvers that take
 * `(name, from, size)` rather than a filter + token.
 *
 * Returns `[]` for a blank term so a cleared input does not fire a request, and
 * drops rows without an id for the same reason {@link fetchAllPicklistPages} does.
 */
async function searchCatalogue(
  field: string,
  buildQuery: (query: string, from: number, size: number) => string,
  query: string,
  size: number,
): Promise<PicklistItem[]> {
  const term = sanitizeSearchTerm(query);
  if (!term) return [];
  try {
    const { data } = await executeAppSyncGraphql<
      Record<string, { items?: (PicklistItem | null)[] | null } | null>
    >({ query: buildQuery(term, 0, size), variables: {} });
    return (data?.[field]?.items ?? []).filter(
      (item): item is PicklistItem => !!item?.value,
    );
  } catch {
    return [];
  }
}

async function fetchList(query: string, listKey: string): Promise<PicklistItem[]> {
  try {
    const { data } = await executeAppSyncGraphql<
      Record<string, { items: PicklistItem[] } | null>
    >({ query, variables: {} });
    return data?.[listKey]?.items ?? [];
  } catch {
    return [];
  }
}

/* ── Public API ───────────────────────────────────────────────────────── */

export function fetchRelationships(): Promise<PicklistItem[]> {
  return fetchList(LIST_RELATIONSHIPS, "listRelationships");
}

export function fetchDiagnoses(): Promise<PicklistItem[]> {
  return fetchAllPicklistPages("listDiagnoses", LIST_DIAGNOSES);
}

/**
 * Search the diagnosis catalogue server-side, the way mobile does
 * (`cancerbuddyapp/src/graphql/queries/diagnosis.ts:10-19`).
 *
 * Prefer this over {@link fetchDiagnoses} wherever the user types: the catalogue
 * is larger than any client-side slice, so filtering a preloaded list cannot find
 * everything.
 */
export function searchDiagnoses(
  query: string,
  size = CATALOGUE_SEARCH_SIZE,
): Promise<PicklistItem[]> {
  return searchCatalogue("findDiagnosis", SEARCH_DIAGNOSES, query, size);
}

export function fetchTreatments(): Promise<PicklistItem[]> {
  return fetchList(LIST_TREATMENTS, "listTreatments");
}

export function fetchTreatmentStatuses(): Promise<PicklistItem[]> {
  return fetchList(LIST_TREATMENT_STATUSES, "listTreatmentStatuses");
}

export function fetchDisabilities(): Promise<PicklistItem[]> {
  return fetchList(LIST_DISABILITIES, "listDisabilities");
}

export function fetchHospitals(): Promise<PicklistItem[]> {
  return fetchAllPicklistPages("listHospitals", LIST_HOSPITALS);
}

/** Search the hospital / medical-centre catalogue server-side. See {@link searchDiagnoses}. */
export function searchHospitals(
  query: string,
  size = CATALOGUE_SEARCH_SIZE,
): Promise<PicklistItem[]> {
  return searchCatalogue("findHospitals", SEARCH_HOSPITALS, query, size);
}

export function fetchSupportOrganizations(): Promise<PicklistItem[]> {
  return fetchList(LIST_SUPPORT_ORGANIZATIONS, "listSupportOrganizations");
}

export function fetchStates(): Promise<PicklistItem[]> {
  return fetchList(LIST_STATES, "listStates");
}

/** Language display order matching the mobile app's sorted preference. */
const LANGUAGE_SORT_ORDER: string[] = [
  "English", "Spanish", "Chinese", "Tagalog", "Vietnamese", "Arabic",
  "French", "Korean", "Russian", "German", "Haitian Creole", "Hindi",
  "Portuguese", "Italian", "Polish", "Urdu", "Japanese", "Farsi",
  "Gujarati", "Greek", "Bengali", "Thai", "Hebrew", "Turkish",
  "Swahili", "Somali", "Ukrainian", "Navajo", "Punjabi", "Amharic",
];

export async function fetchInterests(): Promise<PicklistItem[]> {
  return fetchList(LIST_INTERESTS, "listInterests");
}

export async function fetchLanguages(): Promise<PicklistItem[]> {
  const items = await fetchList(LIST_LANGUAGES, "listLanguages");
  const orderMap = new Map(LANGUAGE_SORT_ORDER.map((n, i) => [n, i]));
  return [...items].sort((a, b) => {
    const ia = orderMap.get(a.label) ?? 999;
    const ib = orderMap.get(b.label) ?? 999;
    if (ia !== ib) return ia - ib;
    return a.label.localeCompare(b.label);
  });
}

export function fetchPronouns(): Promise<PicklistItem[]> {
  return fetchList(LIST_PRONOUNS, "listPronouns");
}

export function fetchCancerLossOptions(): Promise<PicklistItem[]> {
  return fetchList(LIST_COPING_WITH_CANCER_LOSS, "listCopingWithCancerLosses");
}

export async function fetchCitiesByZipCode(zipcode: string): Promise<ZipCodeResult[]> {
  try {
    const { data } = await executeAppSyncGraphql<{
      searchCityZipCodes: { items: ZipCodeResult[] } | null;
    }>({ query: SEARCH_BY_ZIPCODE(zipcode), variables: {} });
    return data?.searchCityZipCodes?.items ?? [];
  } catch {
    return [];
  }
}

export function fetchEthnicities(): Promise<PicklistItem[]> {
  return fetchList(LIST_ETHNICITIES, "listEthnicities");
}

export function fetchTransgenderOptions(): Promise<PicklistItem[]> {
  return fetchList(LIST_TRANSGENDERS, "listTransgenders");
}

export function fetchSexualOrientations(): Promise<PicklistItem[]> {
  return fetchList(LIST_SEXUAL_ORIENTATIONS, "listSexualOrientations");
}

interface PicklistPage {
  items?: (PicklistItem | null)[] | null;
  nextToken?: string | null;
}

/**
 * Follows `nextToken` to exhaustion, so a typeahead is never silently truncated.
 *
 * `field` is the response key to read. Rows without a `value` are dropped: they
 * cannot be selected, and letting them through means a picklist option that
 * resolves to nothing on save.
 */
export async function fetchAllPicklistPages(
  field: string,
  buildQuery: (nextToken?: string) => string,
): Promise<PicklistItem[]> {
  const rows: PicklistItem[] = [];
  let nextToken: string | undefined;
  let pages = 0;

  do {
    const { data } = await executeAppSyncGraphql<Record<string, PicklistPage | null>>({
      query: buildQuery(nextToken),
      variables: {},
    });

    const page = data?.[field];
    for (const item of page?.items ?? []) {
      if (item?.value) rows.push(item);
    }

    nextToken = page?.nextToken ?? undefined;
    pages += 1;
  } while (nextToken && pages < PICKLIST_MAX_PAGES);

  return rows;
}

/** Free-text city lookup scoped to one state — cities are far too many to list. */
export async function fetchCitiesInState(
  stateId: string,
  query: string,
): Promise<PicklistItem[]> {
  if (!stateId || !query.trim()) return [];
  try {
    const safeState = sanitizeSearchTerm(stateId);
    const safeQuery = sanitizeSearchTerm(query);
    return await fetchAllPicklistPages("searchCities", (nextToken) =>
      SEARCH_CITIES_IN_STATE(safeState, safeQuery, nextToken),
    );
  } catch {
    return [];
  }
}

export async function fetchWorkplacesByName(query: string): Promise<PicklistItem[]> {
  if (!query.trim()) return [];
  try {
    const safeQuery = sanitizeSearchTerm(query);
    return await fetchAllPicklistPages("searchWorkplaces", (nextToken) =>
      SEARCH_WORKPLACES(safeQuery, nextToken),
    );
  } catch {
    return [];
  }
}

/** These builders interpolate into query text, so strip anything quote-like. */
function sanitizeSearchTerm(value: string): string {
  return value.replace(/["\\\n\r]/g, "").trim();
}

export async function fetchCollegesByName(query: string): Promise<PicklistItem[]> {
  if (!query.trim()) return [];
  try {
    const { data } = await executeAppSyncGraphql<{
      findColleges: { items: PicklistItem[] } | null;
    }>({ query: SEARCH_COLLEGES(query.trim()), variables: {} });
    return data?.findColleges?.items ?? [];
  } catch {
    return [];
  }
}
