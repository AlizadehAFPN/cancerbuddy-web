import { Auth } from "aws-amplify";
import { ensureAmplifyConfigured } from "@/lib/aws/amplifyConfigure";
import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";

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
    }
  }
`;

export async function fetchSignedInFirstName(): Promise<string | null> {
  ensureAmplifyConfigured();
  try {
    const user = await Auth.currentAuthenticatedUser({ bypassCache: false });
    const id = user?.getUsername?.()?.trim();
    if (!id) return null;

    const { data } = await executeAppSyncGraphql<{
      getUser: { id: string; name?: string | null } | null;
    }>({
      query: GET_USER_NAME,
      variables: { id },
      authWithUserPool: true,
    });

    const name = (data?.getUser?.name ?? "").trim();
    const first = name.split(/\s+/)[0] ?? "";
    return first || null;
  } catch {
    return null;
  }
}
