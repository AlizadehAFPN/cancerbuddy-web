import { Auth } from "aws-amplify";
import { ensureAmplifyConfigured } from "@/lib/aws/amplifyConfigure";
import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import type { UserTypeValue } from "@/lib/profile/types";

/**
 * Loads the signed-in user's first name.
 *
 * The name is NOT a Cognito attribute — the signup flow only writes `email`
 * and `phone_number` to Cognito. The display name lives in the AppSync `User`
 * row as a combined `name` field (`"firstName lastName"` — see
 * `userEnrollmentFinalize.ts`), keyed by the Cognito pool username.
 *
 * Used to recover `firstName` into the in-memory signup store after the draft
 * is lost (e.g. a refresh, or resuming via login). No localStorage involved.
 * Returns `null` when no one is signed in or the row has no name.
 */
const GET_USER_NAME = /* GraphQL */ `
  query getUserName($id: ID!) {
    getUser(id: $id) {
      id
      name
      birth
      userType
      groupHostId
    }
  }
`;

/**
 * The signed-in user, as the rules that depend on it need it.
 *
 * `userType` decides whether the account may moderate any group's posts
 * (`SUPPORT` may — see `lib/groups/moderation.ts`). `groupHostId` is the
 * *host-account* marker and is not the same question: mobile treats anyone with a
 * non-null `groupHostId` as a host regardless of `userType`, so a `PATIENT` who
 * hosts a group still gets the Host pill and still cannot be reported or removed.
 *
 * `birth` is the viewer's half of the age-bracket rules — a post author's link
 * carries the connect decision, and that decision compares the two birth dates
 * (`lib/groups/authorLink.ts`). `name` is the full name, which the ask-the-host
 * channel is named after on mobile.
 *
 * Every field is selectable on `User` — verified against the live schema.
 */
export interface SignedInRole {
  userType: UserTypeValue | null;
  groupHostId: string | null;
  /** Full name, as stored (`"first last"`). */
  name: string | null;
  birth: string | null;
}

/**
 * The signed-in user's email address, read from Cognito.
 *
 * Unlike the display name this *is* a Cognito attribute — signup writes it
 * there — so it needs no AppSync round trip. The profile form shows it
 * read-only, matching mobile, because changing it would mean re-verifying the
 * account.
 */
export async function fetchSignedInEmail(): Promise<string | null> {
  ensureAmplifyConfigured();
  try {
    const user = await Auth.currentAuthenticatedUser({ bypassCache: false });
    const email = user?.attributes?.email;
    return typeof email === "string" && email.trim() ? email.trim() : null;
  } catch {
    return null;
  }
}

interface SignedInUserRow {
  id: string;
  name?: string | null;
  birth?: string | null;
  userType?: UserTypeValue | null;
  groupHostId?: string | null;
}

/** One round trip, shared by the name and role readers below. */
async function fetchSignedInUserRow(): Promise<SignedInUserRow | null> {
  ensureAmplifyConfigured();
  try {
    const user = await Auth.currentAuthenticatedUser({ bypassCache: false });
    const id = user?.getUsername?.()?.trim();
    if (!id) return null;

    const { data } = await executeAppSyncGraphql<{
      getUser: SignedInUserRow | null;
    }>({
      query: GET_USER_NAME,
      variables: { id },
      authWithUserPool: true,
    });

    return data?.getUser ?? null;
  } catch {
    return null;
  }
}

export async function fetchSignedInFirstName(): Promise<string | null> {
  const row = await fetchSignedInUserRow();
  const name = (row?.name ?? "").trim();
  const first = name.split(/\s+/)[0] ?? "";
  return first || null;
}

/**
 * Reads {@link SignedInRole}. Returns nulls rather than throwing when no one is
 * signed in, so callers fall back to the least-privileged behaviour.
 */
export async function fetchSignedInRole(): Promise<SignedInRole> {
  const row = await fetchSignedInUserRow();
  return {
    userType: row?.userType ?? null,
    groupHostId: row?.groupHostId?.trim() || null,
    name: row?.name?.trim() || null,
    birth: row?.birth ?? null,
  };
}
