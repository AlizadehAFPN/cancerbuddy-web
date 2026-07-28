/**
 * Presentation helpers shared by the discovery cards, request cards and the
 * profile page — ports of mobile's `RecommendeLayout.utils.ts`,
 * `layouts/Recommended/utils/index.ts` and `ValidateUserdData.ts`.
 *
 * The "match labels" here are the whole point of the list: under each name we
 * say *why* this person is being suggested ("similar diagnosis, medical
 * center"), computed by intersecting the viewer's own attributes with theirs.
 */

import { t } from "@/lib/i18n";
import type { BuddyProfile, CurrentUserData, NamedRef } from "@/lib/buddies/types";

/** First name, capitalised. Org accounts (HOST/SUPPORT) keep their full name. */
export function formatName(name?: string | null, userType?: string): string {
  if (!name) return " ";
  if (userType === "HOST" || userType === "SUPPORT") return name;
  const first = name.split(" ")[0] ?? "";
  if (!first) return " ";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** `"Brooklyn, NY"` — falls back gracefully when either half is missing. */
export function formatLocation(
  city?: string | null,
  stateAbbreviation?: string | null,
): string {
  if (!city) return stateAbbreviation ?? "";
  // Some city names carry a parenthetical county, e.g. "Springfield (Sangamon)".
  const cleaned = city.includes("(") ? city.split("(")[0].trim() : city;
  return stateAbbreviation ? `${cleaned}, ${stateAbbreviation}` : cleaned;
}

/* ── Role badges ────────────────────────────────────────────────────────── */

export const ROLE_LABELS: Record<string, string> = {
  PATIENT: t("app.buddies.rolePatient"),
  SURVIVOR: t("app.buddies.roleSurvivor"),
  CAREGIVER: t("app.buddies.roleCaregiver"),
  HOST: t("app.buddies.roleHost"),
  SUPPORT: t("app.buddies.roleSupport"),
};

/** Tailwind classes per role, matching the mobile badge colours. */
export const ROLE_BADGE_CLASS: Record<string, string> = {
  PATIENT: "bg-cb-yellow text-cb-black",
  SURVIVOR: "bg-cb-blue text-cb-black",
  CAREGIVER: "bg-cb-purple text-cb-black",
  HOST: "bg-cb-green text-cb-black",
  SUPPORT: "bg-cb-gray-200 text-cb-black",
};

/** `"Partner/spouse"` → `"Caring for partner/spouse"`. */
function formatRelationship(relationship?: string | null): string | undefined {
  if (!relationship) return undefined;
  return t("app.buddies.caringFor", {
    relationship: relationship.split(" ")[0].toLowerCase(),
  });
}

/**
 * What the badge on a card says. Caregivers viewing another caregiver see who
 * that person cares for instead of the generic role — it's the more useful
 * signal for them.
 */
export function badgeLabel(
  profile: Pick<BuddyProfile, "userType" | "relationshipName">,
  viewerUserType?: string,
): string {
  if (viewerUserType === "CAREGIVER" && profile.relationshipName) {
    return formatRelationship(profile.relationshipName) ?? "";
  }
  return ROLE_LABELS[profile.userType] ?? "";
}

/* ── Match labels ───────────────────────────────────────────────────────── */

const MATCH_LABELS = {
  interests: t("app.buddies.matchInterests"),
  hospitals: t("app.buddies.matchHospitals"),
  treatments: t("app.buddies.matchTreatments"),
  diagnosis: t("app.buddies.matchDiagnosis"),
  desabilities: t("app.buddies.matchSideEffects"),
  supportOrganizations: t("app.buddies.matchSupportOrgs"),
  university: t("app.buddies.matchUniversity"),
} as const;

function sharesAny(theirs: NamedRef[], mine: string[]): boolean {
  if (mine.length === 0 || theirs.length === 0) return false;
  const set = new Set(mine);
  return theirs.some((t) => set.has(t.id));
}

/**
 * The grey subtitle under a name: location first, then the categories this
 * person has in common with the viewer, in the same order mobile uses.
 */
export function matchSummary(
  profile: BuddyProfile,
  viewer: CurrentUserData | null,
): string {
  const location = profile.stateAbbreviation ?? "";
  if (!viewer) return location;

  const matched: string[] = [];
  if (sharesAny(profile.interests, viewer.interests))
    matched.push(MATCH_LABELS.interests);
  if (sharesAny(profile.hospitals, viewer.hospitals))
    matched.push(MATCH_LABELS.hospitals);
  if (sharesAny(profile.treatments, viewer.treatments))
    matched.push(MATCH_LABELS.treatments);
  if (sharesAny(profile.diagnosis, viewer.diagnosis))
    matched.push(MATCH_LABELS.diagnosis);
  if (sharesAny(profile.desabilities, viewer.desabilities))
    matched.push(MATCH_LABELS.desabilities);
  if (sharesAny(profile.supportOrganizations, viewer.supportOrganizations))
    matched.push(MATCH_LABELS.supportOrganizations);
  if (profile.collegeId && viewer.collegeId && profile.collegeId === viewer.collegeId)
    matched.push(MATCH_LABELS.university);

  if (matched.length === 0) return location;
  return location ? `${location}, ${matched.join(", ")}` : matched.join(", ");
}

/** Two-letter monogram for the avatar fallback. */
export function initials(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
