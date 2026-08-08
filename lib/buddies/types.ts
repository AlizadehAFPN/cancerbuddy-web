/**
 * Shared types for the Buddies tab.
 *
 * The filter keys are **not** invented here — every key is the exact field name
 * the AppSync schema expects, and matches the mobile app's `FilterValues`
 * (`cancerbuddyapp/src/screens/buddies/filter/Filter.utils.ts`) one-for-one.
 * Renaming any of them silently breaks the filter queries, so treat this file
 * as a contract with the backend rather than a local view-model.
 */

export const USER_TYPES = ["PATIENT", "SURVIVOR", "CAREGIVER"] as const;
export type SearchableUserType = (typeof USER_TYPES)[number];

/** All user types the schema knows about (SUPPORT/HOST are never searchable). */
export type UserTypeName =
  | SearchableUserType
  | "HOST"
  | "SUPPORT"
  | "AMBASSADOR";

/**
 * One filter form value set. Every value is a string because multi-selects are
 * stored as comma-joined id lists (`"id1,id2"`) — again matching mobile, whose
 * query builders `split(',')` these fields.
 */
export interface FilterValues {
  /** One of `USER_TYPES`, or "" for "any". */
  status: string;
  ageRangeMin: string;
  ageRangeMax: string;
  /** Caregiver-only: age of the patient they care for. */
  ageRangeMinPatient: string;
  ageRangeMaxPatient: string;

  userPronounId: string;
  userTransgenderId: string;
  userSexualOrientationId: string;
  userEthnicitiesId: string;
  /** Comma-joined language ids. */
  languages: string;

  userStateId: string;
  userCityId: string;
  userWorkplaceId: string;

  /** Caregiver-only: comma-joined relationship ids. */
  relationshipPatient: string;

  /** Comma-joined diagnosis ids. */
  diagnosis: string;
  userTreatmentStatusId: string;
  /** Comma-joined treatment ids. */
  treatments: string;
  /** `MM/YYYY` — survivors only. */
  inRemissionSince: string;
  /** Comma-joined disability ids. Spelled "desabilities" in the schema. */
  desabilities: string;
  /** Comma-joined hospital ids. */
  hospitals: string;
  /** Comma-joined support-organization ids. */
  supportOrganizations: string;

  /** Truthy string ("cancerloss") toggles the boolean field. */
  cancerloss: string;
  userCopingwithcancerlossId: string;
  /** Truthy string ("college") toggles the boolean field. */
  CurrentlyInCollege: string;
  userCollegeId: string;
}

export type FilterKey = keyof FilterValues;

export const EMPTY_FILTERS: FilterValues = {
  status: "",
  ageRangeMin: "",
  ageRangeMax: "",
  ageRangeMinPatient: "",
  ageRangeMaxPatient: "",
  userPronounId: "",
  userTransgenderId: "",
  userSexualOrientationId: "",
  userEthnicitiesId: "",
  languages: "",
  userStateId: "",
  userCityId: "",
  userWorkplaceId: "",
  relationshipPatient: "",
  diagnosis: "",
  userTreatmentStatusId: "",
  treatments: "",
  inRemissionSince: "",
  desabilities: "",
  hospitals: "",
  supportOrganizations: "",
  cancerloss: "",
  userCopingwithcancerlossId: "",
  CurrentlyInCollege: "",
  userCollegeId: "",
};

export function hasAnyFilter(f: FilterValues): boolean {
  return Object.values(f).some((v) => v !== "");
}

export function countActiveFilters(
  f: FilterValues,
  keys: readonly FilterKey[],
): number {
  return keys.reduce((n, k) => {
    const v = f[k];
    if (!v) return n;
    return n + v.split(",").filter((s) => s.trim() !== "").length;
  }, 0);
}

/* ── Current user's own profile data (drives recommendations) ───────────── */

/**
 * The logged-in user's own attributes, used to compute the age guard, the
 * "recommended for you" split (shared diagnosis) and the match labels shown
 * under each result. Mirrors mobile's `MainDataUser`.
 */
export interface CurrentUserData {
  id: string;
  /** Display name; the first word of it names a 1:1 chat channel. */
  name?: string | null;
  userType: UserTypeName;
  /**
   * Non-null on a host account. Distinct from `userType`: it marks someone who
   * hosts a group whatever their type, and it suppresses the profile action bar
   * because a host browses members to moderate, not to make buddies.
   */
  groupHostId?: string | null;
  birth: string;
  patientBirth?: string | null;
  isSnooze?: boolean | null;
  buddyId?: string | null;
  cancerloss?: boolean | null;
  copingWithCancerLossId?: string | null;
  currentlyInCollege?: boolean | null;
  collegeId?: string | null;
  cityId?: string | null;
  interests: string[];
  hospitals: string[];
  treatments: string[];
  diagnosis: string[];
  desabilities: string[];
  supportOrganizations: string[];
}

/* ── Discovery results ──────────────────────────────────────────────────── */

/** A `{ userID }` row as returned by every id-collecting query. */
export interface ListUserId {
  userID: string;
}

export interface DiscoverySections {
  /** Users sharing at least one diagnosis with the current user. */
  recommended: string[];
  /** Everyone else that passed the filters. */
  more: string[];
}

/* ── Profile card data ──────────────────────────────────────────────────── */

export interface NamedRef {
  id: string;
  name: string;
}

/**
 * The per-user payload rendered in a discovery card. Fetched in batches (see
 * `lib/buddies/profiles.ts`) rather than one request per row.
 */
export interface BuddyProfile {
  id: string;
  name: string;
  birth?: string | null;
  bio?: string | null;
  userType: UserTypeName;
  ambassador: boolean;
  isSnooze: boolean;
  relationshipName?: string | null;
  stateAbbreviation?: string | null;
  cityName?: string | null;
  profilePicUrl?: string;
  goalImageUrl?: string;
  collegeId?: string | null;
  interests: NamedRef[];
  hospitals: NamedRef[];
  treatments: NamedRef[];
  diagnosis: NamedRef[];
  desabilities: NamedRef[];
  supportOrganizations: NamedRef[];
}

/* ── Connections ────────────────────────────────────────────────────────── */

export type ConnectionStatus = "pending" | "connected";

export interface ConnectionEntry {
  status: ConnectionStatus;
  connectionId: string;
}

/** Map of other-user-id → connection state. */
export type ConnectionMap = Record<string, ConnectionEntry>;

/** An incoming buddy request awaiting the user's Connect / Maybe later. */
export interface PendingRequest {
  /** Connection row id — also the Stream channel id once accepted. */
  id: string;
  createdAt: string;
  remitent: {
    id: string;
    name: string;
    bio?: string | null;
    birth?: string | null;
    userType: UserTypeName;
    ambassador: boolean;
    /**
     * The card's subtitle is what you have **in common** with the sender, not
     * their bio — so these four are required, not optional. Mobile computes the
     * same four categories in `utils/coincidences.ts`, and a card that quietly
     * fell back to nothing would look like two people with nothing in common.
     */
    stateAbbreviation?: string | null;
    interests: NamedRef[];
    hospitals: NamedRef[];
    treatments: NamedRef[];
    diagnosis: NamedRef[];
    profilePicUrl?: string;
    goalImageUrl?: string;
  };
}
