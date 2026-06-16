/**
 * Stream Chat client lifecycle, decoupled from React.
 *
 * The Stream JS client is a singleton per API key (`StreamChat.getInstance`),
 * so connecting/disconnecting must be coordinated in one place to avoid races
 * (React strict-mode double mounts, fast route changes, logout). Everything
 * here is browser-only.
 */

import { StreamChat } from "stream-chat";
import { fetchStreamCredentials } from "./streamToken";

let activeClient: StreamChat | null = null;
let connectPromise: Promise<StreamChat> | null = null;

/**
 * Connect (or reuse) the Stream client for the given user. Idempotent: calling
 * it again for the same user returns the already-connected client; an in-flight
 * connection is shared rather than duplicated.
 */
export async function connectStream(
  id: string,
  name?: string,
): Promise<StreamChat> {
  if (activeClient?.userID === id) return activeClient;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    const { apiKey, token } = await fetchStreamCredentials(id, name || "User");
    const client = StreamChat.getInstance(apiKey);

    if (client.userID && client.userID !== id) {
      try {
        await client.disconnectUser();
      } catch {
        /* ignore */
      }
    }
    if (client.userID !== id) {
      await client.connectUser({ id, ...(name ? { name } : {}) }, token);
    }

    activeClient = client;
    return client;
  })();

  try {
    return await connectPromise;
  } finally {
    connectPromise = null;
  }
}

export function getActiveStreamClient(): StreamChat | null {
  return activeClient;
}

/** Disconnect on logout. Safe to call when nothing is connected. */
export async function disconnectStream(): Promise<void> {
  const client = activeClient;
  activeClient = null;
  connectPromise = null;
  if (client) {
    try {
      await client.disconnectUser();
    } catch {
      /* ignore */
    }
  }
}
