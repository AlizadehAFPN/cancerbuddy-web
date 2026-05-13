import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";

/**
 * Same family as mobile `GET_MAIN_USER_DATA` / `GET_USER_PHONE` — enough to resume
 * the host wizard or detect a finished web host application (`userType` + bio + pic).
 */
const GET_USER_RESUME = /* GraphQL */ `
  query getUserForResume($id: ID!) {
    getUser(id: $id) {
      id
      phone
      userType
      bio
      userProfilePicId
    }
  }
`;

/** Same `buddyId` field as mobile `GET_MAIN_USER_DATA` (`user-auth.ts`). */
const GET_USER_BUDDY_ID = /* GraphQL */ `
  query getUserBuddyId($id: ID!) {
    getUser(id: $id) {
      id
      buddyId
    }
  }
`;

export type AppSyncUserResumeRow = {
  id: string;
  phone?: string | null;
  userType?: string | null;
  bio?: string | null;
  userProfilePicId?: string | null;
};

/**
 * Loads the AppSync `User` row by primary key (`id` = Cognito username / sub-style id).
 * Returns `null` when the API responds with no row (new signup path).
 */
export async function fetchUserRowForResume(
  id: string,
  options?: { authWithUserPool?: boolean },
): Promise<AppSyncUserResumeRow | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;

  const { data } = await executeAppSyncGraphql<{
    getUser: AppSyncUserResumeRow | null;
  }>({
    query: GET_USER_RESUME,
    variables: { id: trimmed },
    ...(options?.authWithUserPool ? { authWithUserPool: true } : {}),
  });

  const row = data?.getUser;
  if (!row?.id) return null;
  return row;
}

export function userRowHasVerifiedPhone(row: AppSyncUserResumeRow | null): boolean {
  if (!row) return false;
  const p = row.phone;
  if (p == null) return false;
  return String(p).trim().length > 0;
}

/** Matches web `finalizeHostEnrollmentAfterBio`: phone + HOST + bio + profile picture. */
export function isHostWebRegistrationComplete(
  row: AppSyncUserResumeRow | null,
): boolean {
  if (!row || !userRowHasVerifiedPhone(row)) return false;
  if ((row.userType ?? "").trim().toUpperCase() !== "HOST") return false;
  if (!(row.bio ?? "").trim()) return false;
  if (!(row.userProfilePicId ?? "").trim()) return false;
  return true;
}

export type AppSyncUserBuddyRow = {
  id: string;
  buddyId?: string | null;
};

/**
 * Loads public `buddyId` for the signed-in user (Cognito `sub` / pool username as `id`).
 * Returns `null` when the row is missing or the field is empty.
 */
export async function fetchUserBuddyId(
  cognitoUserId: string,
): Promise<string | null> {
  const trimmed = cognitoUserId.trim();
  if (!trimmed) return null;

  try {
    const { data } = await executeAppSyncGraphql<{
      getUser: AppSyncUserBuddyRow | null;
    }>({
      query: GET_USER_BUDDY_ID,
      variables: { id: trimmed },
      authWithUserPool: true,
    });

    const row = data?.getUser;
    const buddy = row?.buddyId;
    if (buddy == null) return null;
    const s = String(buddy).trim();
    return s.length ? s : null;
  } catch {
    return null;
  }
}
