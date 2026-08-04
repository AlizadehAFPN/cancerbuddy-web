/**
 * Reading and saving the user's personal information.
 *
 * Two things happen on save, and both must land: scalar fields go to
 * `updateUser` in one mutation, while languages are a join table that has to be
 * diffed row by row. Mobile saves languages *first* and then the user record;
 * the same order is kept so a failure leaves the same partial state on both
 * clients rather than a new one.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import {
  LANGUAGES_JOIN,
  syncJoinTable,
  type JoinRow,
} from "@/lib/profile/manyToMany";

/** The subset of the user record this form owns. */
export interface PersonalInfoValues {
  bio: string;
  zipcode: string;
  userCityId: string;
  userStateId: string;
  userPronounId: string;
  userEthnicitiesId: string;
  userSexualOrientationId: string;
  userTransgenderId: string;
  userWorkplaceId: string;
  /** Checkbox: "Coping with cancer loss". */
  cancerloss: boolean;
  /** Who they lost — only meaningful when `cancerloss` is true. */
  userCopingwithcancerlossId: string;
  /** Checkbox: "Currently in college or university". */
  CurrentlyInCollege: boolean;
  userCollegeId: string;
  /** Catalogue ids of the languages they speak. */
  languageIds: string[];
}

const GET_PERSONAL_INFO = /* GraphQL */ `
  query getPersonalInformation($id: ID!) {
    getUser(id: $id) {
      birth
      bio
      zipcode
      userCityId
      userStateId
      userPronounId
      userEthnicitiesId
      userSexualOrientationId
      userTransgenderId
      userWorkplaceId
      cancerloss
      userCopingwithcancerlossId
      CurrentlyInCollege
      userCollegeId
      languages: Language {
        items {
          id
          language {
            id
            name
          }
        }
      }
    }
  }
`;

const UPDATE_USER = /* GraphQL */ `
  mutation updateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
    }
  }
`;

interface RawPersonalInfo {
  birth?: string | null;
  bio?: string | null;
  zipcode?: string | null;
  userCityId?: string | null;
  userStateId?: string | null;
  userPronounId?: string | null;
  userEthnicitiesId?: string | null;
  userSexualOrientationId?: string | null;
  userTransgenderId?: string | null;
  userWorkplaceId?: string | null;
  cancerloss?: boolean | null;
  userCopingwithcancerlossId?: string | null;
  CurrentlyInCollege?: boolean | null;
  userCollegeId?: string | null;
  languages?: {
    items?: { id: string; language?: { id: string; name?: string | null } | null }[];
  } | null;
}

export interface PersonalInfoLoad {
  values: PersonalInfoValues;
  /** Existing join rows, needed to diff languages on save. */
  languageRows: JoinRow[];
  /** Drives whether the college questions are shown. */
  birth: string | null;
}

const str = (v: string | null | undefined): string => v ?? "";

export async function fetchPersonalInfo(userId: string): Promise<PersonalInfoLoad> {
  const { data } = await executeAppSyncGraphql<{ getUser: RawPersonalInfo | null }>({
    query: GET_PERSONAL_INFO,
    variables: { id: userId },
    authWithUserPool: true,
  });

  const raw = data?.getUser ?? {};
  const rows: JoinRow[] = (raw.languages?.items ?? [])
    .filter((row) => row?.id && row.language?.id)
    .map((row) => ({ id: row.id, targetId: row.language!.id }));

  return {
    birth: raw.birth ?? null,
    languageRows: rows,
    values: {
      bio: str(raw.bio),
      zipcode: str(raw.zipcode),
      userCityId: str(raw.userCityId),
      userStateId: str(raw.userStateId),
      userPronounId: str(raw.userPronounId),
      userEthnicitiesId: str(raw.userEthnicitiesId),
      userSexualOrientationId: str(raw.userSexualOrientationId),
      userTransgenderId: str(raw.userTransgenderId),
      userWorkplaceId: str(raw.userWorkplaceId),
      cancerloss: raw.cancerloss === true,
      userCopingwithcancerlossId: str(raw.userCopingwithcancerlossId),
      CurrentlyInCollege: raw.CurrentlyInCollege === true,
      userCollegeId: str(raw.userCollegeId),
      languageIds: rows.map((row) => row.targetId),
    },
  };
}

export interface SaveOutcome {
  ok: boolean;
  /** True when the user record saved but some language rows didn't. */
  partial: boolean;
}

/**
 * Persists the form.
 *
 * Empty strings are sent as `null` so clearing a dropdown actually clears the
 * foreign key — AppSync treats `""` as a value and would reject it as an
 * invalid id. Dependent fields are cleared here too: unchecking "coping with
 * cancer loss" drops whom they lost, and leaving college drops the college,
 * matching the effects mobile achieves through form-level side effects.
 */
export async function savePersonalInfo(params: {
  userId: string;
  values: PersonalInfoValues;
  languageRows: JoinRow[];
}): Promise<SaveOutcome> {
  const { userId, values, languageRows } = params;

  const languageResult = await syncJoinTable({
    userId,
    existing: languageRows,
    selectedIds: values.languageIds,
    config: LANGUAGES_JOIN,
  });

  const idOrNull = (v: string) => (v.trim() === "" ? null : v);

  const input: Record<string, unknown> = {
    id: userId,
    bio: values.bio.trim() === "" ? null : values.bio.trim(),
    zipcode: idOrNull(values.zipcode),
    userCityId: idOrNull(values.userCityId),
    userStateId: idOrNull(values.userStateId),
    userPronounId: idOrNull(values.userPronounId),
    userEthnicitiesId: idOrNull(values.userEthnicitiesId),
    userSexualOrientationId: idOrNull(values.userSexualOrientationId),
    userTransgenderId: idOrNull(values.userTransgenderId),
    userWorkplaceId: idOrNull(values.userWorkplaceId),
    cancerloss: values.cancerloss,
    userCopingwithcancerlossId: values.cancerloss
      ? idOrNull(values.userCopingwithcancerlossId)
      : null,
    CurrentlyInCollege: values.CurrentlyInCollege,
    userCollegeId: values.CurrentlyInCollege
      ? idOrNull(values.userCollegeId)
      : null,
  };

  const { data } = await executeAppSyncGraphql<{ updateUser: { id: string } | null }>({
    query: UPDATE_USER,
    variables: { input },
    authWithUserPool: true,
  });

  return {
    ok: !!data?.updateUser?.id,
    partial: languageResult.failures > 0,
  };
}
