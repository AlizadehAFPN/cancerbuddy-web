/**
 * Changing your status — Patient ↔ Survivor ↔ Caregiver.
 *
 * Two genuinely different backends, split on the *target* type:
 *
 *  • **Path A** (→ SURVIVOR, or SURVIVOR → PATIENT) is one AppSync `updateUser`.
 *    Nothing else changes: the medical record a patient and a survivor keep is
 *    the same record.
 *  • **Path B** (Patient ↔ Caregiver) posts `changeStatus` to `USERS_LAMBDA`
 *    after re-collecting the medical information, because "my diagnosis" and
 *    "my patient's diagnosis" are different rows.
 *
 * Everything here is pure so the rules can be tested without a backend — and
 * because two of them are rules web must get right the first time: this flow
 * rewrites what mobile users see about themselves.
 */

import { displayAge, MAXAGE } from "@/lib/buddies/age";
import { UserType, type UserTypeValue } from "@/lib/profile/types";

export type ChangeStatusTarget = "PATIENT" | "SURVIVOR" | "CAREGIVER";

/** Mobile's `CHANGE_ROLE_PLATFORM_OPTIONS` order and copy keys. */
export const CHANGE_STATUS_OPTIONS: ChangeStatusTarget[] = [
  "PATIENT",
  "SURVIVOR",
  "CAREGIVER",
];

/**
 * Which statuses this account may switch to.
 *
 * Mobile's by-role rules (`change-status-select.tsx:50-68`):
 *
 *   PATIENT   → SURVIVOR, CAREGIVER
 *   CAREGIVER → PATIENT            (SURVIVOR filtered out)
 *   SURVIVOR  → PATIENT            (CAREGIVER filtered out)
 *
 * plus an under-18 rule that removes CAREGIVER for everyone
 * (`displayAge(birth) < 18`) — a minor cannot register as someone's caregiver.
 *
 * **The two rules disagree on mobile** for an under-18 CAREGIVER: the age path
 * offers SURVIVOR, the role path forbids it. The worklist's triage ruling is
 * that the by-role rule is the intended one, so that account is offered PATIENT
 * only. Reproducing the contradiction would let a minor caregiver become a
 * survivor on web and not on their phone.
 */
export function changeStatusOptionsFor(input: {
  currentUserType?: UserTypeValue | string | null;
  birth?: string | null;
}): ChangeStatusTarget[] {
  const current = input.currentUserType;

  const byRole: ChangeStatusTarget[] =
    current === UserType.PATIENT
      ? ["SURVIVOR", "CAREGIVER"]
      : current === UserType.CAREGIVER || current === UserType.SURVIVOR
        ? ["PATIENT"]
        : [];

  if (displayAge(input.birth) < MAXAGE) {
    return byRole.filter((option) => option !== "CAREGIVER");
  }
  return byRole;
}

/**
 * Which path a switch takes.
 *
 * `A` whenever the target is SURVIVOR, and for SURVIVOR → PATIENT. Everything
 * else — which in practice means anything involving CAREGIVER — is `B`.
 */
export function routeFor(
  next: ChangeStatusTarget,
  current?: UserTypeValue | string | null,
): "A" | "B" {
  if (next === "SURVIVOR") return "A";
  if (next === "PATIENT" && current === UserType.SURVIVOR) return "A";
  return "B";
}

/**
 * The remission date Path A stamps.
 *
 * **Today**, in `YYYY-MM-DD` — mobile's `getInRemisionDate()`
 * (`utils/dates.ts:167-170`) formats `new Date()`, it does not round to the end
 * of the month. (The worklist's acceptance text says last-day-of-month; the
 * source says otherwise, and the source wins because mobile renders this value
 * back to the member.) Null when the member is leaving remission.
 */
export function remissionStampFor(next: ChangeStatusTarget): string | null {
  if (next !== "SURVIVOR") return null;
  const now = new Date();
  const yyyy = String(now.getFullYear()).padStart(4, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ── Path B ─────────────────────────────────────────────────────────────── */

/**
 * How many form screens Path B shows.
 *
 * Four when becoming a CAREGIVER (relationship + patient birth + diagnosis +
 * medical centre), two otherwise — mobile's `getProgress()`
 * (`change-status-controls.tsx:136`). A caregiver becoming a patient also gets
 * two, because the navigator drops the caregiver-only screens.
 */
export function progressDenominator(next: ChangeStatusTarget): number {
  return next === "CAREGIVER" ? 4 : 2;
}

/**
 * The cross-field gate on the diagnosis screen.
 *
 * A treatment status of "Pre-treatment" means there is nothing to record yet;
 * any other status requires at least one treatment
 * (`change-status-controls.tsx:104-119`).
 */
export function canContinueFromDiagnosis(input: {
  treatmentStatusLabel?: string | null;
  treatmentIds: string[];
}): boolean {
  if ((input.treatmentStatusLabel ?? "").trim() === "Pre-treatment") return true;
  return input.treatmentIds.length > 0;
}

export interface ChangeStatusValues {
  userId: string;
  diagnosisIds: string[];
  treatmentStatusId: string;
  treatmentIds: string[];
  hospitalIds: string[];
  /** CAREGIVER only. */
  relationshipId?: string | null;
  /** CAREGIVER only — `MM/YYYY` as the member typed it. */
  patientBirth?: string | null;
}

export interface ChangeStatusPayload {
  patientTocaregivers?: Record<string, unknown>;
  caregiverTopatients?: Record<string, unknown>;
}

/**
 * The wire payload, key for key.
 *
 * The capitalisation is the backend's, not a style choice: `DiagnosisID`,
 * `TreatmentsID`, `HospitalsID` are plural-with-capital-ID, while `userId` and
 * `userTreatmentStatusId` are camelCase. The wrapper key names the direction of
 * the change, which is how the Lambda decides which rows to rewrite.
 */
export function buildChangeStatusPayload(
  values: ChangeStatusValues,
  nextUserType: ChangeStatusTarget,
): ChangeStatusPayload {
  const body: Record<string, unknown> = {
    userId: values.userId,
    DiagnosisID: values.diagnosisIds,
    userTreatmentStatusId: values.treatmentStatusId,
    TreatmentsID: values.treatmentIds,
    HospitalsID: values.hospitalIds,
  };

  if (nextUserType === "CAREGIVER") {
    body.userRelationshipId = values.relationshipId ?? "";
    body.patientBirth = values.patientBirth ?? "";
    return { patientTocaregivers: body };
  }

  return { caregiverTopatients: body };
}
