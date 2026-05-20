/**
 * Finalises a regular-user registration after all profile data has been
 * collected. Mirrors mobile's `LoadingPersonalInformation` →
 * `UpdateRegisterUserUtil` + `InsertManyToManyUtils` + `SignUpUtil` pipeline.
 *
 * Operations (in order):
 *  1. UPDATE_USER — all collected profile fields
 *  2. Many-to-many INSERT mutations (diagnosis, treatments, hospitals,
 *     support orgs, disabilities, interests, languages)
 *  3. Gallery photo wiring (UPDATE_PICTURE_AS_GALLERY for each gallery ID)
 *  4. GetStream LOGIN lambda
 *  5. Users LOGIN lambda
 *  6. Support-channel bootstrap (non-blocking — same as host flow)
 *  7. Analytics seed in localStorage
 */

import { Auth } from "aws-amplify";
import { ensureAmplifyConfigured } from "@/lib/aws/amplifyConfigure";
import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import { fetchUserBuddyId } from "@/lib/aws/appsyncUserQueries";
import { bootstrapSupportChannelAfterEnrollment } from "@/lib/host-signup/bootstrapSupportChannel";
import { buildE164 } from "@/lib/host-signup/validation";
import { peekGuardianId } from "./storage";
import type { UserRegisterFormValues } from "./validation";

/* ── GraphQL mutations ──────────────────────────────────────────────────── */

const UPDATE_USER = /* GraphQL */ `
  mutation updateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
    }
  }
`;

const CREATE_DIAGNOSIS_USER = /* GraphQL */ `
  mutation createUserDiagnosis($input: CreateDiagnosisUserInput!) {
    createDiagnosisUser(input: $input) { id }
  }
`;

const CREATE_TREATMENT_USER = /* GraphQL */ `
  mutation createUserTreatment($input: CreateTreatmentUserInput!) {
    createTreatmentUser(input: $input) { id }
  }
`;

const CREATE_HOSPITAL_USER = /* GraphQL */ `
  mutation createUserHospital($input: CreateHospitalUserInput!) {
    createHospitalUser(input: $input) { id }
  }
`;

const CREATE_DISABILITIES_USER = /* GraphQL */ `
  mutation createDisabilitiesUser($input: CreateDisabilitiesUserInput!) {
    createDisabilitiesUser(input: $input) { id }
  }
`;

const CREATE_SUPPORT_ORG_USER = /* GraphQL */ `
  mutation createSupportOrgUser($input: CreateSupportOrgUserInput!) {
    createSupportOrgUser(input: $input) { id }
  }
`;

const CREATE_INTEREST_USER = /* GraphQL */ `
  mutation createUserInterest($input: CreateInterestUserInput!) {
    createInterestUser(input: $input) { id }
  }
`;

const CREATE_LANGUAGE_USER = /* GraphQL */ `
  mutation createLanguageUser($input: CreateLanguageUserInput!) {
    createLanguageUser(input: $input) { id }
  }
`;

const UPDATE_PICTURE_AS_GALLERY = /* GraphQL */ `
  mutation setPictureAsGallery($input: UpdatePictureInput!) {
    updatePicture(input: $input) { id }
  }
`;

/* ── Helpers ────────────────────────────────────────────────────────────── */

const PENDING_SUPPORT_CHANNEL_KEY = "pendingSupportChannel";

const ENROLLMENT_ANALYTICS_KEYS = [
  "chatWithFirstBuddy",
  "connectWithFirstBuddy",
  "joinFirstGroup",
  "comment",
  "post",
] as const;

function usersLambdaName(): string {
  const v = process.env.NEXT_PUBLIC_USERS_LAMBDA?.trim();
  if (!v) throw new Error("NEXT_PUBLIC_USERS_LAMBDA is not set.");
  return v;
}

function getStreamLambdaName(): string {
  const v = process.env.NEXT_PUBLIC_GETSTREAM_LAMBDA?.trim();
  if (!v) throw new Error("NEXT_PUBLIC_GETSTREAM_LAMBDA is not set.");
  return v;
}

/** Converts "MM/YYYY" remission date to AWSDate end-of-month string (yyyy-MM-dd), or null. */
function remissionToIso(value: string): string | null {
  if (!value || value.length < 7) return null;
  const [mm, yyyy] = value.split("/");
  const month = Number(mm);
  const year = Number(yyyy);
  if (!Number.isFinite(month) || !Number.isFinite(year)) return null;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/** Converts birthMonth + birthYear to AWSDate end-of-month string (yyyy-MM-dd), or null. */
function birthMonthYearToIso(month: string, year: string): string | null {
  if (!month || !year) return null;
  const m = Number(month);
  const y = Number(year);
  if (!Number.isFinite(m) || !Number.isFinite(y) || m < 1 || m > 12 || y < 1000) return null;
  const lastDay = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/** Splits a comma-separated ID string into a trimmed, non-empty array. */
function splitIds(csv: string | undefined): string[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Runs one INSERT mutation per ID in the array, concurrently, best-effort. */
async function insertManyToMany(
  mutation: string,
  userId: string,
  ids: string[],
  foreignKey: string,
): Promise<void> {
  if (ids.length === 0) return;
  await Promise.allSettled(
    ids.map((id) =>
      executeAppSyncGraphql({
        query: mutation,
        variables: { input: { userID: userId, [foreignKey]: id } },
        authWithUserPool: true,
      }),
    ),
  );
}

/** Sets gallery photos' `userGalleryId` on existing Picture records. */
async function wireGalleryPhotos(
  userId: string,
  pictureIds: string[],
): Promise<void> {
  if (pictureIds.length === 0) return;
  await Promise.allSettled(
    pictureIds.map((id) =>
      executeAppSyncGraphql({
        query: UPDATE_PICTURE_AS_GALLERY,
        variables: { input: { id, userGalleryId: userId } },
        authWithUserPool: true,
      }),
    ),
  );
}

/* ── Public API ──────────────────────────────────────────────────────────── */

export interface UserEnrollmentFinalizeResult {
  cognitoUserId: string;
  buddyId: string | null;
  supportChannelReady: boolean;
  supportChannelDeferredToApp: boolean;
}

export async function finalizeUserEnrollment(
  values: UserRegisterFormValues,
): Promise<UserEnrollmentFinalizeResult> {
  ensureAmplifyConfigured();

  const user = await Auth.currentAuthenticatedUser({ bypassCache: true });
  const cognitoUserId = user.getUsername()?.trim();
  if (!cognitoUserId) {
    throw new Error("Could not read your account id. Please sign in again.");
  }

  const fullName = `${values.firstName} ${values.lastName}`.trim();
  const birth = birthMonthYearToIso(values.birthMonth, values.birthYear);

  /* ── 1. UPDATE_USER ──────────────────────────────────────────────────── */

  const updateInput: Record<string, unknown> = {
    id: cognitoUserId,
    name: fullName,
    birth,
    bio: values.bio?.trim() || null,
    userType: values.userType || null,
    zipcode: values.zipcode?.trim() || null,
    userCityId: values.city || null,
    userStateId: values.state || null,
    userPronounId: values.pronouns || null,
    userTreatmentStatusId: values.treatmentStatus || null,
    userProfilePicId: values.profilePicId || null,
    cancerloss: values.cancerloss || false,
    userCopingwithcancerlossId: values.copingWithCancerLoss || null,
    CurrentlyInCollege: values.isUniversityStudent || false,
    userCollegeId: values.universityId || null,
    phone: buildE164(values.phoneCountryIso2, values.phoneNational) || null,
  };

  if (values.userType === "CAREGIVER") {
    updateInput.userRelationshipId = values.relationship || null;
    const patientBirth = birthMonthYearToIso(
      values.patientBirthMonth,
      values.patientBirthYear,
    );
    if (patientBirth) updateInput.patientBirth = patientBirth;
  }

  if (values.userType === "SURVIVOR") {
    const remission = remissionToIso(values.inRemissionSince);
    if (remission) updateInput.inRemissionSince = remission;
  }

  // Guardian data for minor users (age 8–12)
  if (values.guardianFullName?.trim()) {
    updateInput.guardianFullName = values.guardianFullName.trim();
    updateInput.guardianConsent = values.guardianConsent || false;
    updateInput.guardianConsentSupervision = values.guardianConsentSupervision || false;
  }
  if (values.guardianEmail?.trim()) {
    const guardianId = peekGuardianId();
    if (guardianId) updateInput.userGuardianId = guardianId;
  }

  // Strip null values to avoid overwriting existing data with nulls
  const cleanInput = Object.fromEntries(
    Object.entries(updateInput).filter(([, v]) => v !== null && v !== undefined && v !== ""),
  );

  await executeAppSyncGraphql<{ updateUser: { id: string } }>({
    query: UPDATE_USER,
    variables: { input: cleanInput },
    authWithUserPool: true,
  });

  /* ── 2. Many-to-many inserts ─────────────────────────────────────────── */

  await Promise.all([
    insertManyToMany(
      CREATE_DIAGNOSIS_USER,
      cognitoUserId,
      splitIds(values.diagnosis),
      "diagnosisID",
    ),
    insertManyToMany(
      CREATE_TREATMENT_USER,
      cognitoUserId,
      splitIds(values.treatments),
      "treatmentID",
    ),
    insertManyToMany(
      CREATE_HOSPITAL_USER,
      cognitoUserId,
      splitIds(values.hospitals),
      "hospitalID",
    ),
    insertManyToMany(
      CREATE_SUPPORT_ORG_USER,
      cognitoUserId,
      splitIds(values.supportOrganizations),
      "supportOrganizationsID",
    ),
    insertManyToMany(
      CREATE_DISABILITIES_USER,
      cognitoUserId,
      splitIds(values.disabilities),
      "disabilitiesID",
    ),
    insertManyToMany(
      CREATE_INTEREST_USER,
      cognitoUserId,
      splitIds(values.interests),
      "interestID",
    ),
    insertManyToMany(
      CREATE_LANGUAGE_USER,
      cognitoUserId,
      splitIds(values.languages),
      "languageID",
    ),
  ]);

  /* ── 3. Gallery photos ───────────────────────────────────────────────── */

  await wireGalleryPhotos(cognitoUserId, splitIds(values.galleryPhotoIds));

  /* ── 4. GetStream login ──────────────────────────────────────────────── */

  const firstName = values.firstName?.trim() || fullName.split(" ")[0] || "User";

  const getStreamRaw = await raiseUserLambda(
    LambdaPayloadType.LOGIN,
    getStreamLambdaName(),
    {
      cognitoId: cognitoUserId,
      name: firstName,
    },
  );

  let getStreamParsed: { statusCode?: number; body?: unknown };
  try {
    getStreamParsed = JSON.parse(getStreamRaw) as { statusCode?: number; body?: unknown };
  } catch {
    throw new Error("GetStream setup returned an unexpected response.");
  }

  if (getStreamParsed.statusCode !== 200) {
    throw new Error(
      "GetStream user setup did not complete. Please try again or contact support.",
    );
  }

  /* ── 5. Users login lambda ───────────────────────────────────────────── */

  await raiseUserLambda(LambdaPayloadType.LOGIN, usersLambdaName(), {
    userId: cognitoUserId,
    token: undefined,
  });

  /* ── 6. Support-channel bootstrap (non-blocking) ──────────────────────── */

  let supportWired = false;
  let bootstrapThrew = false;
  try {
    supportWired = await bootstrapSupportChannelAfterEnrollment({ cognitoUserId });
  } catch {
    bootstrapThrew = true;
    supportWired = false;
  }

  /* ── 7. Analytics seed + localStorage flags ──────────────────────────── */

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      if (supportWired) {
        window.localStorage.removeItem(PENDING_SUPPORT_CHANNEL_KEY);
      } else if (bootstrapThrew) {
        window.localStorage.setItem(PENDING_SUPPORT_CHANNEL_KEY, "true");
      } else {
        window.localStorage.removeItem(PENDING_SUPPORT_CHANNEL_KEY);
      }
      for (const k of ENROLLMENT_ANALYTICS_KEYS) {
        window.localStorage.setItem(k, "false");
      }
    }
  } catch {
    /* quota / private mode — best-effort */
  }

  /* ── 8. Fetch buddyId ────────────────────────────────────────────────── */

  const buddyId = await fetchUserBuddyId(cognitoUserId);

  return {
    cognitoUserId,
    buddyId,
    supportChannelReady: supportWired,
    supportChannelDeferredToApp: bootstrapThrew,
  };
}
