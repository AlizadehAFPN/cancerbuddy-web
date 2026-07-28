/**
 * Turns a `FilterValues` form state into the set of user ids that match it.
 *
 * Discovery filters live in two different places in the schema:
 *
 *  1. **Direct `User` columns** (pronoun, city, treatment status, age, …) — one
 *     `listUsers` query with all conditions ANDed together.
 *  2. **Join tables** (diagnosis, hospitals, treatments, languages,
 *     disabilities, support orgs) plus caregiver relationship — each needs its
 *     own query returning the users attached to the chosen ids.
 *
 * All of them are fired in parallel here; `intersect.ts` then ANDs the results.
 * This mirrors the mobile app's `filterConditions.ts` so both clients resolve
 * the same filters to the same people.
 */

import {
  birthRules,
  displayAge,
  patientBirthRules,
  remissionSinceToIsoDate,
} from "@/lib/buddies/age";
import {
  fetchDiagnosisUsers,
  fetchDisabilitiesUsers,
  fetchHospitalUsers,
  fetchLanguageUsers,
  fetchRelationshipUsers,
  fetchSupportOrgUsers,
  fetchTreatmentUsers,
  fetchUsersByDirectFields,
} from "@/lib/buddies/discoveryFetch";
import {
  USER_TYPES,
  type CurrentUserData,
  type FilterValues,
} from "@/lib/buddies/types";

/** One facet of the filter: the ids it matched, and whether it was requested. */
export interface FilterFacet {
  requested: boolean;
  userIds: string[];
}

export interface FilterFacets {
  directFields: FilterFacet;
  hospitals: FilterFacet;
  treatments: FilterFacet;
  languages: FilterFacet;
  diagnosis: FilterFacet;
  desabilities: FilterFacet;
  supportOrganizations: FilterFacet;
  relationship: FilterFacet;
  /**
   * True when the user set an explicit age range. The bracket guard is then
   * skipped, because the age condition already encodes (and clamps to) it.
   */
  hasAgeFilter: boolean;
}

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_:-]/g, "");
}

export function parseIdList(value: string | undefined): string[] {
  return value ? value.split(",").filter((v) => v.trim() !== "") : [];
}

/* ── Direct `User` column conditions ────────────────────────────────────── */

/** Simple `field: { eq: … }` filters, keyed by the form field that drives them. */
const DIRECT_FIELDS: ReadonlyArray<{ key: keyof FilterValues; boolean?: true }> = [
  { key: "userPronounId" },
  { key: "userCityId" },
  { key: "userStateId" },
  { key: "userEthnicitiesId" },
  { key: "userTransgenderId" },
  { key: "userSexualOrientationId" },
  { key: "userTreatmentStatusId" },
  { key: "userWorkplaceId" },
  { key: "CurrentlyInCollege", boolean: true },
  { key: "userCollegeId" },
  { key: "cancerloss", boolean: true },
  { key: "userCopingwithcancerlossId" },
];

/**
 * Filter fields that require the `listUsers` query to run at all. When none are
 * set we skip it entirely and let the join-table facets (plus the age guard)
 * define the result — otherwise a user filtering only by, say, diagnosis would
 * be needlessly intersected against the whole user table.
 */
const DIRECT_FIELD_KEYS: ReadonlyArray<keyof FilterValues> = [
  ...DIRECT_FIELDS.map((f) => f.key),
  "status",
  "ageRangeMin",
  "ageRangeMax",
  "ageRangeMinPatient",
  "ageRangeMaxPatient",
  "inRemissionSince",
];

function needsDirectFieldQuery(filters: FilterValues): boolean {
  return DIRECT_FIELD_KEYS.some((k) => !!filters[k]);
}

/**
 * The requested range is only honoured when it overlaps the searcher's own age
 * bracket; otherwise we emit an impossible window so the query returns nothing.
 * Without this, a 30-year-old could type "13–17" and reach minors.
 */
function buildAgeCondition(
  filters: FilterValues,
  user: Pick<CurrentUserData, "birth">,
): string | null {
  const minAge = filters.ageRangeMin ? Number(filters.ageRangeMin) : 0;
  const maxAge = filters.ageRangeMax ? Number(filters.ageRangeMax) : 130;
  const userAge = displayAge(user.birth);

  let overlapsOwnBracket: boolean;
  if (userAge >= 18) overlapsOwnBracket = maxAge >= 18;
  else if (userAge >= 13) overlapsOwnBracket = minAge <= 17 && maxAge >= 13;
  else if (userAge >= 7) overlapsOwnBracket = minAge <= 12 && maxAge >= 7;
  else overlapsOwnBracket = minAge <= 6 && maxAge >= 0;

  if (!overlapsOwnBracket) {
    return `birth: {between: ["9999-01-01", "9999-01-02"]}`;
  }

  const window = birthRules(user.birth, {
    min: filters.ageRangeMin || "0",
    max: filters.ageRangeMax || "130",
  });
  return window ? `birth: {between: ${window}}` : null;
}

function buildDirectFieldConditions(
  filters: FilterValues,
  user: Pick<CurrentUserData, "birth">,
): string {
  const conditions: string[] = [];

  // Status narrows to a single role; otherwise allow every searchable role.
  if (filters.status) {
    conditions.push(`userType: {eq: ${safeId(filters.status)}}`);
  } else {
    conditions.push(
      `or: [${USER_TYPES.map((t) => `{userType: {eq: ${t}}}`).join("")}]`,
    );
  }

  for (const { key, boolean } of DIRECT_FIELDS) {
    const value = filters[key];
    if (!value) continue;
    conditions.push(
      boolean ? `${key}: {eq: true}` : `${key}: {eq: "${safeId(value)}"}`,
    );
  }

  if (filters.ageRangeMin || filters.ageRangeMax) {
    const age = buildAgeCondition(filters, user);
    if (age) conditions.push(age);
  }

  // Caregiver-only: the age of the person they care for.
  if (filters.ageRangeMinPatient || filters.ageRangeMaxPatient) {
    conditions.push(
      `patientBirth: {between: ${patientBirthRules({
        min: filters.ageRangeMinPatient,
        max: filters.ageRangeMaxPatient,
      })}}`,
    );
  }

  // Survivors: "in remission since at least this date".
  if (filters.inRemissionSince) {
    const iso = remissionSinceToIsoDate(filters.inRemissionSince);
    if (iso) conditions.push(`inRemissionSince: {ge: "${iso}"}`);
  }

  return conditions.join("\n");
}

/* ── Orchestration ──────────────────────────────────────────────────────── */

function facet(requested: boolean, userIds: string[]): FilterFacet {
  return { requested, userIds };
}

/** Runs every facet of the filter in parallel and reports what each matched. */
export async function fetchFilterFacets(
  filters: FilterValues,
  currentUserId: string,
  user: CurrentUserData,
): Promise<FilterFacets> {
  const hospitals = parseIdList(filters.hospitals);
  const treatments = parseIdList(filters.treatments);
  const languages = parseIdList(filters.languages);
  const diagnosis = parseIdList(filters.diagnosis);
  const desabilities = parseIdList(filters.desabilities);
  const supportOrganizations = parseIdList(filters.supportOrganizations);
  const relationship = parseIdList(filters.relationshipPatient);

  const needsDirect = needsDirectFieldQuery(filters);
  const directConditions = needsDirect
    ? buildDirectFieldConditions(filters, user)
    : "";

  const [
    directIds,
    hospitalIds,
    treatmentIds,
    languageIds,
    diagnosisIds,
    desabilitiesIds,
    supportOrgIds,
    relationshipIds,
  ] = await Promise.all([
    needsDirect
      ? fetchUsersByDirectFields(directConditions, currentUserId)
      : Promise.resolve([]),
    fetchHospitalUsers(hospitals),
    fetchTreatmentUsers(treatments),
    fetchLanguageUsers(languages),
    fetchDiagnosisUsers(diagnosis),
    fetchDisabilitiesUsers(desabilities),
    fetchSupportOrgUsers(supportOrganizations),
    fetchRelationshipUsers(relationship, currentUserId),
  ]);

  return {
    directFields: facet(needsDirect, directIds),
    hospitals: facet(hospitals.length > 0, hospitalIds),
    treatments: facet(treatments.length > 0, treatmentIds),
    languages: facet(languages.length > 0, languageIds),
    diagnosis: facet(diagnosis.length > 0, diagnosisIds),
    desabilities: facet(desabilities.length > 0, desabilitiesIds),
    supportOrganizations: facet(supportOrganizations.length > 0, supportOrgIds),
    relationship: facet(relationship.length > 0, relationshipIds),
    hasAgeFilter: !!(filters.ageRangeMin || filters.ageRangeMax),
  };
}
