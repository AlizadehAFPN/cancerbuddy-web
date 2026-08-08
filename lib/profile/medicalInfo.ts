/**
 * Reading and saving medical information.
 *
 * Five of the six fields are join tables (diagnoses, treatments, hospitals,
 * disabilities, support organisations); only treatment status and the remission
 * date live on the user row. Mobile saves the user row **first** and only
 * touches the join tables if that succeeded, so the same order is kept here.
 *
 * For a caregiver this record describes their **patient**, not themselves —
 * mobile hides the caregiver's own medical card and points the patient's card
 * at this same screen. Only the wording changes; the data is one record either
 * way.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import {
  syncJoinTable,
  type JoinRow,
  type JoinTableConfig,
} from "@/lib/profile/manyToMany";
import { UserType } from "@/lib/profile/types";
import {
  monthYearToStoredDate,
  storedDateToMonthYear,
} from "@/lib/profile/monthYear";

/* ── Join table configs, from `graphql/mutations/user.ts` ───────────────── */

const DIAGNOSIS_JOIN: JoinTableConfig = {
  createMutation: "createDiagnosisUser",
  deleteMutation: "deleteDiagnosisUser",
  createInputType: "CreateDiagnosisUserInput",
  deleteInputType: "DeleteDiagnosisUserInput",
  targetKey: "diagnosisID",
};

const TREATMENTS_JOIN: JoinTableConfig = {
  createMutation: "createTreatmentUser",
  deleteMutation: "deleteTreatmentUser",
  createInputType: "CreateTreatmentUserInput",
  deleteInputType: "DeleteTreatmentUserInput",
  targetKey: "treatmentID",
};

const HOSPITALS_JOIN: JoinTableConfig = {
  createMutation: "createHospitalUser",
  deleteMutation: "deleteHospitalUser",
  createInputType: "CreateHospitalUserInput",
  deleteInputType: "DeleteHospitalUserInput",
  targetKey: "hospitalID",
};

const DISABILITIES_JOIN: JoinTableConfig = {
  createMutation: "createDisabilitiesUser",
  deleteMutation: "deleteDisabilitiesUser",
  createInputType: "CreateDisabilitiesUserInput",
  deleteInputType: "DeleteDisabilitiesUserInput",
  targetKey: "disabilitiesID",
};

const SUPPORT_ORGS_JOIN: JoinTableConfig = {
  createMutation: "createSupportOrgUser",
  deleteMutation: "deleteSupportOrgUser",
  createInputType: "CreateSupportOrgUserInput",
  deleteInputType: "DeleteSupportOrgUserInput",
  targetKey: "supportOrganizationsID",
};

/* ── Shape ──────────────────────────────────────────────────────────────── */

export interface MedicalInfoValues {
  diagnosisIds: string[];
  treatmentIds: string[];
  hospitalIds: string[];
  disabilityIds: string[];
  supportOrgIds: string[];
  /** Catalogue id of the current treatment status. */
  userTreatmentStatusId: string;
  /** `MM/YYYY` as typed; converted on save. */
  inRemissionSince: string;
}

export interface MedicalInfoRows {
  diagnosis: JoinRow[];
  treatments: JoinRow[];
  hospitals: JoinRow[];
  disabilities: JoinRow[];
  supportOrgs: JoinRow[];
}

export interface MedicalInfoLoad {
  values: MedicalInfoValues;
  rows: MedicalInfoRows;
}

const GET_MEDICAL_INFO = /* GraphQL */ `
  query getMedicalInformation($id: ID!) {
    getUser(id: $id) {
      id
      userTreatmentStatusId
      inRemissionSince
      diagnosis: Diagnosis {
        items {
          id
          diagnosis {
            id
          }
        }
      }
      treatments: Treatments {
        items {
          id
          treatment {
            id
          }
        }
      }
      hospitals: Hospitals {
        items {
          id
          hospital {
            id
          }
        }
      }
      desabilities {
        items {
          id
          disabilities {
            id
          }
        }
      }
      supportOrganizations: supportOrganizations {
        items {
          id
          supportOrganizations {
            id
          }
        }
      }
    }
  }
`;

const UPDATE_USER = /* GraphQL */ `
  mutation updateMedicalInformation($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
    }
  }
`;

interface RawJoinItem {
  id: string;
  [key: string]: unknown;
}

/** Pulls `{ id, targetId }` out of a join row whose target sits under `key`. */
function toRows(items: RawJoinItem[] | undefined, key: string): JoinRow[] {
  return (items ?? [])
    .filter((item) => item?.id)
    .map((item) => {
      const target = item[key] as { id?: string } | null | undefined;
      return target?.id ? { id: item.id, targetId: target.id } : null;
    })
    .filter((row): row is JoinRow => row !== null);
}

interface RawMedical {
  userTreatmentStatusId?: string | null;
  inRemissionSince?: string | null;
  diagnosis?: { items?: RawJoinItem[] } | null;
  treatments?: { items?: RawJoinItem[] } | null;
  hospitals?: { items?: RawJoinItem[] } | null;
  desabilities?: { items?: RawJoinItem[] } | null;
  supportOrganizations?: { items?: RawJoinItem[] } | null;
}

export async function fetchMedicalInfo(userId: string): Promise<MedicalInfoLoad> {
  const { data } = await executeAppSyncGraphql<{ getUser: RawMedical | null }>({
    query: GET_MEDICAL_INFO,
    variables: { id: userId },
    authWithUserPool: true,
  });

  const raw = data?.getUser ?? {};

  const rows: MedicalInfoRows = {
    diagnosis: toRows(raw.diagnosis?.items, "diagnosis"),
    treatments: toRows(raw.treatments?.items, "treatment"),
    hospitals: toRows(raw.hospitals?.items, "hospital"),
    disabilities: toRows(raw.desabilities?.items, "disabilities"),
    supportOrgs: toRows(raw.supportOrganizations?.items, "supportOrganizations"),
  };

  return {
    rows,
    values: {
      diagnosisIds: rows.diagnosis.map((r) => r.targetId),
      treatmentIds: rows.treatments.map((r) => r.targetId),
      hospitalIds: rows.hospitals.map((r) => r.targetId),
      disabilityIds: rows.disabilities.map((r) => r.targetId),
      supportOrgIds: rows.supportOrgs.map((r) => r.targetId),
      userTreatmentStatusId: raw.userTreatmentStatusId ?? "",
      inRemissionSince: storedDateToMonthYear(raw.inRemissionSince),
    },
  };
}

export async function saveMedicalInfo(params: {
  userId: string;
  values: MedicalInfoValues;
  rows: MedicalInfoRows;
}): Promise<{ ok: boolean; partial: boolean }> {
  const { userId, values, rows } = params;

  const { data } = await executeAppSyncGraphql<{ updateUser: { id: string } | null }>({
    query: UPDATE_USER,
    variables: {
      input: {
        id: userId,
        userTreatmentStatusId: values.userTreatmentStatusId || null,
        inRemissionSince: monthYearToStoredDate(values.inRemissionSince),
      },
    },
    authWithUserPool: true,
  });

  if (!data?.updateUser?.id) return { ok: false, partial: false };

  const results = await Promise.all([
    syncJoinTable({
      userId,
      existing: rows.diagnosis,
      selectedIds: values.diagnosisIds,
      config: DIAGNOSIS_JOIN,
    }),
    syncJoinTable({
      userId,
      existing: rows.treatments,
      selectedIds: values.treatmentIds,
      config: TREATMENTS_JOIN,
    }),
    syncJoinTable({
      userId,
      existing: rows.hospitals,
      selectedIds: values.hospitalIds,
      config: HOSPITALS_JOIN,
    }),
    syncJoinTable({
      userId,
      existing: rows.disabilities,
      selectedIds: values.disabilityIds,
      config: DISABILITIES_JOIN,
    }),
    syncJoinTable({
      userId,
      existing: rows.supportOrgs,
      selectedIds: values.supportOrgIds,
      config: SUPPORT_ORGS_JOIN,
    }),
  ]);

  return {
    ok: true,
    partial: results.some((r) => r.failures > 0),
  };
}

/* ── Per-UserType rules ─────────────────────────────────────────────────── */

export interface MedicalFieldRules {
  /** Survivors are asked when they went into remission, not their status. */
  showTreatmentStatus: boolean;
  showRemissionDate: boolean;
  /** Treatments stay locked until a status is chosen — survivors excepted. */
  treatmentsEnabled: boolean;
  /** Diagnosis is required for everyone. */
  requireDiagnosis: boolean;
  requireTreatmentStatus: boolean;
  requireRemissionDate: boolean;
  /** Caregivers are answering about the person they care for. */
  aboutPatient: boolean;
}

/**
 * The visibility and validation rules, keyed on user type.
 *
 * Derived from `PatientDiagnosisLayout` (which fields render) and the three
 * `Profile*DiagnosisScheme` validators (which are required). They are stated
 * once here so the form can't drift from the mobile behaviour field by field.
 */
export function medicalRulesFor(
  userType: string | null | undefined,
  hasTreatmentStatus: boolean,
): MedicalFieldRules {
  const isSurvivor = userType === UserType.SURVIVOR;
  const isPatient = userType === UserType.PATIENT;
  const isCaregiver = userType === UserType.CAREGIVER;

  return {
    showTreatmentStatus: !isSurvivor,
    showRemissionDate: isSurvivor,
    treatmentsEnabled: isSurvivor || hasTreatmentStatus,
    requireDiagnosis: true,
    requireTreatmentStatus: isPatient,
    requireRemissionDate: isSurvivor,
    aboutPatient: isCaregiver,
  };
}

/* ── Data rules web dropped ─────────────────────────────────────────────── */

/** Mobile's `limit: 3` on the support-organisation picker (`dropdown-multiple.tsx:30`). */
export const MAX_SUPPORT_ORGANIZATIONS = 3;

/**
 * Choosing a treatment status also decides which treatments may stand.
 *
 * Mobile's `updateTreatment` (`PatientDiagnosisLayout.tsx:132-148`) empties the
 * treatments **and deletes their join rows** in two cases: the status is
 * cleared, and the status is "Pre-treatment". Web left them in place and merely
 * greyed the field, so a member who cleared their status was holding treatments
 * they could no longer edit — and which still described them to everyone else.
 *
 * Returns the treatment ids that should survive. The caller's save then deletes
 * whatever is no longer in the list, which the existing join-table diff already
 * does for free.
 */
export function applyTreatmentStatus(
  values: Pick<MedicalInfoValues, "treatmentIds">,
  nextStatusId: string,
  statuses: ReadonlyArray<{ value: string; label: string }> = [],
): { treatmentStatusId: string; treatmentIds: string[] } {
  const label = statuses.find((s) => s.value === nextStatusId)?.label ?? "";
  const clears = !nextStatusId || label === "Pre-treatment";
  return {
    treatmentStatusId: nextStatusId,
    treatmentIds: clears ? [] : values.treatmentIds,
  };
}

/**
 * A remission date cannot predate the member's own birth.
 *
 * Mobile cross-checks the two (`validateRemissionDate`, `utils/dates.ts:172-203`)
 * and web validated only format, future and 130-years — so "03/1985" on an
 * account born in 1990 saved happily and then displayed as a fact about them.
 *
 * Returns an error key, or null when the pair is coherent. Missing or
 * unparseable values return null: the format validator owns those.
 */
export function validateRemissionAgainstBirth(
  birth: string | null | undefined,
  remission: string | null | undefined,
): "remissionBeforeBirth" | null {
  const parse = (value: string | null | undefined): Date | null => {
    const raw = (value ?? "").trim();
    if (!raw) return null;
    const mmYyyy = /^(\d{1,2})\/(\d{4})$/.exec(raw);
    if (mmYyyy) return new Date(Number(mmYyyy[2]), Number(mmYyyy[1]) - 1, 1);
    const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  };

  const birthDate = parse(birth);
  const remissionDate = parse(remission);
  if (!birthDate || !remissionDate) return null;

  /*
   * Month granularity: a birth of `1990-05-31` and a remission of `05/1990`
   * parse to the 31st and the 1st, and mobile compares the raw dates — which
   * would reject a member who went into remission the month they were born.
   * That case cannot occur in practice; comparing months keeps the two clients
   * agreeing on every case that can.
   */
  const birthMonth = birthDate.getFullYear() * 12 + birthDate.getMonth();
  const remissionMonth = remissionDate.getFullYear() * 12 + remissionDate.getMonth();
  return remissionMonth < birthMonth ? "remissionBeforeBirth" : null;
}
