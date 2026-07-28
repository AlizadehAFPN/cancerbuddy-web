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

/**
 * Block & report a buddy — mirrors the mobile "Block & report" action, which
 * marks the AppSync Connection row (its id equals the Stream channel id) as
 * blocked with the chosen reason. Unlike "Remove", the row is kept (updated,
 * not deleted) so the block is recorded. Throws on failure so the caller can
 * surface it and avoid deleting the channel before the block is recorded.
 */
const REPORT_CONNECTION = /* GraphQL */ `
  mutation reportConnectionUser($input: UpdateConnectionInput!) {
    updateConnection(input: $input) {
      id
      blocked
      blockedUser
      blockingReason
    }
  }
`;

export async function reportConnection(params: {
  connectionId: string;
  blockedUserId: string;
  reason: string;
}): Promise<void> {
  await executeAppSyncGraphql({
    query: REPORT_CONNECTION,
    variables: {
      input: {
        id: params.connectionId,
        blocked: true,
        blockedUser: params.blockedUserId,
        blockingReason: params.reason,
      },
    },
    authWithUserPool: true,
  });
}
