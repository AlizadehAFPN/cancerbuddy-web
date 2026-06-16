/**
 * Remove a buddy connection — mirrors the mobile "Remove from my buddies"
 * action, which deletes the AppSync Connection row (its id equals the Stream
 * channel id) in addition to deleting the channel itself.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";

const REMOVE_CONNECTION = /* GraphQL */ `
  mutation removeConnectionUser($input: DeleteConnectionInput!) {
    deleteConnection(input: $input) {
      id
    }
  }
`;

export async function removeConnection(connectionId: string): Promise<void> {
  try {
    await executeAppSyncGraphql({
      query: REMOVE_CONNECTION,
      variables: { input: { id: connectionId } },
      authWithUserPool: true,
    });
  } catch {
    /* best-effort — the channel delete is the primary effect */
  }
}
