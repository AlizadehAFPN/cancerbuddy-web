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

/* ── GraphQL queries ──────────────────────────────────────────────────── */

const LIST_RELATIONSHIPS = /* GraphQL */ `
  query getRelationships {
    listRelationships(limit: 1000) {
      items { label: name, value: id }
    }
  }
`;

const LIST_DIAGNOSES = /* GraphQL */ `
  query getDiagnoses {
    listDiagnoses(limit: 1000) {
      items { label: name, value: id }
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

const LIST_HOSPITALS = /* GraphQL */ `
  query getHospitals {
    listHospitals(limit: 1000) {
      items { label: name, value: id }
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
  return fetchList(LIST_DIAGNOSES, "listDiagnoses");
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
  return fetchList(LIST_HOSPITALS, "listHospitals");
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
