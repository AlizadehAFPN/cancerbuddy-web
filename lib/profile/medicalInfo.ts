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
