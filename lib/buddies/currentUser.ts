/**
 * The signed-in user's own filter-relevant profile.
 *
 * Discovery needs this before it can run anything: the age bracket comes from
 * `birth`, the "recommended for you" split comes from `diagnosis`, and the
 * match labels under each card come from comparing the viewer's interests /
 * hospitals / treatments against each result's. Mirrors mobile's
 * `GET_MAIN_DATA_FILTERS`.
 */

import { Auth } from "aws-amplify";
import { ensureAmplifyConfigured } from "@/lib/aws/amplifyConfigure";
import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import type { CurrentUserData, UserTypeName } from "@/lib/buddies/types";

const GET_MAIN_DATA_FILTERS = /* GraphQL */ `
  query getMainDataFilters($id: ID!) {
    getUser(id: $id) {
      id
      userType
      birth
      patientBirth
      isSnooze
      cancerloss
      buddyId
      CurrentlyInCollege
      Copingwithcancerloss: copingwithcancerloss {
        id
      }
      College {
        id
      }
      City {
        id
      }
      Interests {
        items {
          interestID
        }
      }
      Diagnosis {
        items {
          diagnosisID
        }
      }
      Hospitals {
        items {
          hospitalID
        }
      }
      Treatments {
        items {
          treatmentID
        }
      }
      SupportOrganizations: supportOrganizations {
        items {
          supportOrganizationsID
        }
      }
      Desabilities: desabilities {
        items {
          disabilitiesID
        }
      }
    }
  }
`;

interface JoinRow {
  interestID?: string | null;
  diagnosisID?: string | null;
  hospitalID?: string | null;
  treatmentID?: string | null;
  supportOrganizationsID?: string | null;
  disabilitiesID?: string | null;
}

interface RawMainData {
  id: string;
  userType?: string | null;
  birth?: string | null;
  patientBirth?: string | null;
  isSnooze?: boolean | null;
  cancerloss?: boolean | null;
  buddyId?: string | null;
  CurrentlyInCollege?: boolean | null;
  Copingwithcancerloss?: { id?: string | null } | null;
  College?: { id?: string | null } | null;
  City?: { id?: string | null } | null;
  Interests?: { items?: JoinRow[] | null } | null;
  Diagnosis?: { items?: JoinRow[] | null } | null;
  Hospitals?: { items?: JoinRow[] | null } | null;
  Treatments?: { items?: JoinRow[] | null } | null;
  SupportOrganizations?: { items?: JoinRow[] | null } | null;
  Desabilities?: { items?: JoinRow[] | null } | null;
}

function ids(
  rows: { items?: JoinRow[] | null } | null | undefined,
  key: keyof JoinRow,
): string[] {
  return (rows?.items ?? [])
    .map((row) => row?.[key] ?? "")
    .filter((v): v is string => !!v);
}

/** Cognito username — the same value used as the AppSync `User.id`. */
export async function getSignedInUserId(): Promise<string> {
  ensureAmplifyConfigured();
  const cognito = await Auth.currentAuthenticatedUser();
  return cognito.getUsername() as string;
}

export async function fetchCurrentUserData(
  userId: string,
): Promise<CurrentUserData | null> {
  const { data } = await executeAppSyncGraphql<{ getUser: RawMainData | null }>({
    query: GET_MAIN_DATA_FILTERS,
    variables: { id: userId },
    authWithUserPool: true,
  });

  const row = data?.getUser;
  if (!row?.id) return null;

  return {
    id: row.id,
    userType: (row.userType ?? "PATIENT") as UserTypeName,
    birth: row.birth ?? "",
    patientBirth: row.patientBirth ?? null,
    isSnooze: row.isSnooze ?? false,
    buddyId: row.buddyId ?? null,
    cancerloss: row.cancerloss ?? false,
    copingWithCancerLossId: row.Copingwithcancerloss?.id ?? null,
    currentlyInCollege: row.CurrentlyInCollege ?? false,
    collegeId: row.College?.id ?? null,
    cityId: row.City?.id ?? null,
    interests: ids(row.Interests, "interestID"),
    diagnosis: ids(row.Diagnosis, "diagnosisID"),
    hospitals: ids(row.Hospitals, "hospitalID"),
    treatments: ids(row.Treatments, "treatmentID"),
    supportOrganizations: ids(row.SupportOrganizations, "supportOrganizationsID"),
    desabilities: ids(row.Desabilities, "disabilitiesID"),
  };
}
