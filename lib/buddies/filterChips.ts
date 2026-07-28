/**
 * The removable chips shown under the quick-search bar.
 *
 * Mobile derives these by string-matching label text back onto filter values,
 * which misfires whenever two catalogues share a name. Here each chip carries
 * the exact keys (and, for multi-selects, the exact id) it came from, so
 * removing one is an unambiguous edit of the filter state.
 */

import { EMPTY_FILTERS, type FilterKey, type FilterValues } from "@/lib/buddies/types";
import {
  getCachedCatalog,
  resolveEntityName,
  type CatalogName,
} from "@/lib/buddies/picklists";
import { t, type MessageKey } from "@/lib/i18n";
import { ROLE_LABELS } from "@/lib/buddies/display";

export interface FilterChip {
  /** Stable identity for React keys and de-duplication. */
  chipId: string;
  label: string;
  /** Filter fields cleared when this chip is dismissed. */
  keys: FilterKey[];
  /** For comma-list fields: the single id to drop, leaving siblings intact. */
  valueId?: string;
}

/** Multi-select fields and the catalogue that names their ids. */
const MULTI_SELECT: ReadonlyArray<{ key: FilterKey; catalog: CatalogName }> = [
  { key: "diagnosis", catalog: "diagnoses" },
  { key: "treatments", catalog: "treatments" },
  { key: "hospitals", catalog: "hospitals" },
  { key: "desabilities", catalog: "disabilities" },
  { key: "supportOrganizations", catalog: "supportOrganizations" },
  { key: "languages", catalog: "languages" },
  { key: "relationshipPatient", catalog: "relationships" },
];

/** Single-select fields and the catalogue that names their id. */
const SINGLE_SELECT: ReadonlyArray<{ key: FilterKey; catalog: CatalogName }> = [
  { key: "userPronounId", catalog: "pronouns" },
  { key: "userTransgenderId", catalog: "transgender" },
  { key: "userSexualOrientationId", catalog: "sexualOrientations" },
  { key: "userEthnicitiesId", catalog: "ethnicities" },
  { key: "userTreatmentStatusId", catalog: "treatmentStatuses" },
  { key: "userStateId", catalog: "states" },
  { key: "userCopingwithcancerlossId", catalog: "copingWithCancerLoss" },
];

/** Searchable fields whose label must be fetched by id. */
const SEARCHABLE: ReadonlyArray<{
  key: FilterKey;
  kind: "city" | "college" | "workplace";
}> = [
  { key: "userCityId", kind: "city" },
  { key: "userCollegeId", kind: "college" },
  { key: "userWorkplaceId", kind: "workplace" },
];

function labelFor(catalog: CatalogName, id: string): string | null {
  const items = getCachedCatalog(catalog);
  return items?.find((i) => i.value === id)?.label ?? null;
}

/** Age chips read as a range, an open-ended minimum, or a ceiling. */
function ageChipLabel(
  keys: { range: MessageKey; min: MessageKey; max: MessageKey },
  min: string,
  max: string,
): string {
  if (min && max) return t(keys.range, { min, max });
  if (min) return t(keys.min, { min });
  return t(keys.max, { max });
}

/**
 * Builds the chip list. Catalogues already in cache resolve synchronously;
 * city / college / workplace names are fetched, so this is async and callers
 * should render the previous chips until it settles.
 */
export async function buildFilterChips(
  filters: FilterValues,
): Promise<FilterChip[]> {
  const chips: FilterChip[] = [];

  if (filters.status) {
    chips.push({
      chipId: `status:${filters.status}`,
      label: ROLE_LABELS[filters.status] ?? filters.status,
      keys: ["status"],
    });
  }

  if (filters.ageRangeMin || filters.ageRangeMax) {
    chips.push({
      chipId: "age",
      label: ageChipLabel(
        {
          range: "app.buddies.chipAgeRange",
          min: "app.buddies.chipAgeMin",
          max: "app.buddies.chipAgeMax",
        },
        filters.ageRangeMin,
        filters.ageRangeMax,
      ),
      keys: ["ageRangeMin", "ageRangeMax"],
    });
  }

  if (filters.ageRangeMinPatient || filters.ageRangeMaxPatient) {
    chips.push({
      chipId: "patientAge",
      label: ageChipLabel(
        {
          range: "app.buddies.chipPatientAgeRange",
          min: "app.buddies.chipPatientAgeMin",
          max: "app.buddies.chipPatientAgeMax",
        },
        filters.ageRangeMinPatient,
        filters.ageRangeMaxPatient,
      ),
      keys: ["ageRangeMinPatient", "ageRangeMaxPatient"],
    });
  }

  for (const { key, catalog } of SINGLE_SELECT) {
    const id = filters[key];
    if (!id) continue;
    chips.push({
      chipId: `${key}:${id}`,
      label: labelFor(catalog, id) ?? t("app.buddies.selected"),
      keys: [key],
    });
  }

  for (const { key, catalog } of MULTI_SELECT) {
    const ids = filters[key].split(",").filter((v) => v.trim() !== "");
    for (const id of ids) {
      chips.push({
        chipId: `${key}:${id}`,
        label: labelFor(catalog, id) ?? t("app.buddies.selected"),
        keys: [key],
        valueId: id,
      });
    }
  }

  if (filters.inRemissionSince) {
    chips.push({
      chipId: "inRemissionSince",
      label: t("app.buddies.chipRemission", { date: filters.inRemissionSince }),
      keys: ["inRemissionSince"],
    });
  }

  // The boolean toggles own their dependent dropdown, so clearing one clears both.
  if (filters.cancerloss) {
    chips.push({
      chipId: "cancerloss",
      label: t("app.buddies.cancerLoss"),
      keys: ["cancerloss", "userCopingwithcancerlossId"],
    });
  }

  if (filters.CurrentlyInCollege) {
    chips.push({
      chipId: "CurrentlyInCollege",
      label: t("app.buddies.inCollege"),
      keys: ["CurrentlyInCollege", "userCollegeId"],
    });
  }

  const searchable = await Promise.all(
    SEARCHABLE.map(async ({ key, kind }) => {
      const id = filters[key];
      if (!id) return null;
      const name = await resolveEntityName(kind, id);
      const chip: FilterChip = {
        chipId: `${key}:${id}`,
        label: name ?? t("app.buddies.selected"),
        keys: [key],
      };
      return chip;
    }),
  );

  for (const chip of searchable) {
    if (chip) chips.push(chip);
  }

  return chips;
}

/** Applies a chip dismissal, returning the updated filter state. */
export function removeChip(
  filters: FilterValues,
  chip: FilterChip,
): FilterValues {
  const next = { ...filters };
  for (const key of chip.keys) {
    if (chip.valueId) {
      next[key] = next[key]
        .split(",")
        .filter((v) => v.trim() !== "" && v !== chip.valueId)
        .join(",");
    } else {
      next[key] = "";
    }
  }

  // Clearing the state also clears the city, which is only meaningful within it.
  if (chip.keys.includes("userStateId")) next.userCityId = "";

  return next;
}

export function clearAllFilters(): FilterValues {
  return { ...EMPTY_FILTERS };
}
