/**
 * Picklist loading + id→label resolution for the filter UI.
 *
 * Two kinds of catalogue exist:
 *  • **Listable** (pronouns, diagnoses, hospitals, …) — small enough to fetch
 *    whole once and reuse for both the pickers and the filter chips.
 *  • **Searchable** (cities, colleges, workplaces) — far too large to list, so
 *    they're queried by prefix while typing and looked up by id when we need to
 *    render a chip for an already-chosen value.
 *
 * Everything is cached at module scope: a user opens the filter panel several
 * times per session and these lists never change mid-session.
 */

import {
  fetchCancerLossOptions,
  fetchCitiesInState,
  fetchCollegesByName,
  fetchDiagnoses,
  fetchDisabilities,
  fetchEthnicities,
  fetchHospitals,
  fetchLanguages,
  fetchPronouns,
  fetchRelationships,
  fetchSexualOrientations,
  fetchStates,
  fetchSupportOrganizations,
  fetchTransgenderOptions,
  fetchTreatmentStatuses,
  fetchTreatments,
  fetchWorkplacesByName,
  type PicklistItem,
} from "@/lib/aws/appsyncPicklistQueries";
import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";

export type CatalogName =
  | "pronouns"
  | "transgender"
  | "sexualOrientations"
  | "ethnicities"
  | "languages"
  | "states"
  | "relationships"
  | "diagnoses"
  | "treatmentStatuses"
  | "treatments"
  | "disabilities"
  | "hospitals"
  | "supportOrganizations"
  | "copingWithCancerLoss";

export type Catalogs = Partial<Record<CatalogName, PicklistItem[]>>;

const LOADERS: Record<CatalogName, () => Promise<PicklistItem[]>> = {
  pronouns: fetchPronouns,
  transgender: fetchTransgenderOptions,
  sexualOrientations: fetchSexualOrientations,
  ethnicities: fetchEthnicities,
  languages: fetchLanguages,
  states: fetchStates,
  relationships: fetchRelationships,
  diagnoses: fetchDiagnoses,
  treatmentStatuses: fetchTreatmentStatuses,
  treatments: fetchTreatments,
  disabilities: fetchDisabilities,
  hospitals: fetchHospitals,
  supportOrganizations: fetchSupportOrganizations,
  copingWithCancerLoss: fetchCancerLossOptions,
};

const cache = new Map<CatalogName, PicklistItem[]>();
const inflight = new Map<CatalogName, Promise<PicklistItem[]>>();

export function getCachedCatalog(name: CatalogName): PicklistItem[] | undefined {
  return cache.get(name);
}

export function loadCatalog(name: CatalogName): Promise<PicklistItem[]> {
  const cached = cache.get(name);
  if (cached) return Promise.resolve(cached);

  const pending = inflight.get(name);
  if (pending) return pending;

  const run = LOADERS[name]()
    .then((items) => {
      cache.set(name, items);
      return items;
    })
    .finally(() => inflight.delete(name));

  inflight.set(name, run);
  return run;
}

export async function loadCatalogs(names: CatalogName[]): Promise<Catalogs> {
  const loaded = await Promise.all(names.map((n) => loadCatalog(n)));
  const out: Catalogs = {};
  names.forEach((n, i) => {
    out[n] = loaded[i];
  });
  return out;
}

/* ── Display-order preferences (mirrors the mobile forms) ───────────────── */

const ORDERS: Partial<Record<CatalogName, string[]>> = {
  pronouns: ["She/her", "He/him", "They/them", "I rather not disclose"],
  transgender: ["Yes", "No", "I rather not disclose"],
  sexualOrientations: [
    "Heterosexual",
    "Gay/lesbian",
    "Bisexual",
    "Queer",
    "Other",
    "I rather not disclose",
  ],
  ethnicities: [
    "African / African American / Black",
    "Asian / Asian American",
    "Hispanic / Latino / Latina / Latinx",
    "Middle Eastern / North African",
    "Native American / First Nations / Indigenous",
    "Pacific Islander",
    "White / Caucasian / European",
    "Multi-racial / Multi-ethnic",
    "Prefer not to say",
  ],
  relationships: [
    "Friend",
    "Relative",
    "Sibling (brother/sister)",
    "Kid (daughter/son)",
    "Partner/spouse",
    "Parent (mom/dad)",
  ],
  copingWithCancerLoss: [
    "Spouse / Partner",
    "Parent",
    "Child",
    "Sibling",
    "Grandparent",
    "Friend / Colleague",
    "Other relative",
  ],
};

/**
 * Sorts a catalogue for display: curated order first (matching mobile), then
 * anything unlisted alphabetically. Catalogues without a curated order are
 * simply alphabetised.
 */
export function orderCatalog(
  name: CatalogName,
  items: PicklistItem[],
): PicklistItem[] {
  const order = ORDERS[name];
  const rank = new Map((order ?? []).map((label, i) => [label, i]));
  return [...items].sort((a, b) => {
    const ra = rank.get(a.label) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.label) ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return a.label.localeCompare(b.label, "en", { sensitivity: "base" });
  });
}

/* ── Searchable catalogues ──────────────────────────────────────────────── */

export const searchCities = fetchCitiesInState;
export const searchColleges = fetchCollegesByName;
export const searchWorkplaces = fetchWorkplacesByName;

const BY_ID_QUERIES: Record<"city" | "college" | "workplace", (id: string) => string> = {
  city: (id) => /* GraphQL */ `query getCity { entity: getCity(id: "${id}") { id name } }`,
  college: (id) => /* GraphQL */ `query getCollege { entity: getCollege(id: "${id}") { id name } }`,
  workplace: (id) => /* GraphQL */ `query getWorkplace { entity: getWorkplace(id: "${id}") { id name } }`,
};

const nameCache = new Map<string, string>();

/**
 * Resolves a single searchable entity's display name. Used for filter chips:
 * we only hold the id once a value is chosen, and the containing catalogue is
 * too large to have on hand.
 */
export async function resolveEntityName(
  kind: "city" | "college" | "workplace",
  id: string,
): Promise<string | null> {
  const key = `${kind}:${id}`;
  const cached = nameCache.get(key);
  if (cached) return cached;

  const safe = id.replace(/[^A-Za-z0-9_:-]/g, "");
  if (!safe) return null;

  try {
    const { data } = await executeAppSyncGraphql<{
      entity: { id: string; name?: string | null } | null;
    }>({ query: BY_ID_QUERIES[kind](safe), variables: {} });
    const name = data?.entity?.name;
    if (!name) return null;
    nameCache.set(key, name);
    return name;
  } catch {
    return null;
  }
}
