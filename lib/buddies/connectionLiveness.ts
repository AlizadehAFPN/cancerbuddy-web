"use client";

/**
 * Live connection state: accepts, declines and removals arriving from the other
 * side without a reload.
 *
 * Web only ever subscribed to `onCreateConnectionByRecipientId`, so an incoming
 * *new* request appeared live but nothing else did — a request the other person
 * accepted stayed "Pending" until a hard refresh, and one they withdrew stayed
 * on screen indefinitely. Mobile subscribes to update and delete as well
 * (`cancerbuddyapp/src/context/connection-map/ConnectionMapProvider.tsx:303-331`).
 *
 * **The filter is evaluated against the fields the mutation returned**, not
 * against the stored row, which is why every connection mutation in
 * `connections.ts` selects both participant ids. Dropping one of those selections
 * makes these subscriptions silently stop firing.
 */

import { API, graphqlOperation } from "aws-amplify";

/** Matches `OnConnectionUpdatedSuscription` in the mobile repo. */
export const ON_UPDATE_CONNECTION = /* GraphQL */ `
  subscription OnConnectionUpdated($userId: ID!) {
    onUpdateConnection(
      filter: {
        or: [
          {connectionRemitentId: {eq: $userId}},
          {connectionRecipientId: {eq: $userId}}
        ]
      }
    ) {
      id
      connectionRecipientId
      connectionRemitentId
      accepted
      ignored
    }
  }
`;

/** Matches `OnConnectionDeletedSuscription` in the mobile repo. */
export const ON_DELETE_CONNECTION = /* GraphQL */ `
  subscription OnConnectionDeleted($userId: ID!) {
    onDeleteConnection(
      filter: {
        or: [
          {connectionRemitentId: {eq: $userId}},
          {connectionRecipientId: {eq: $userId}}
        ]
      }
    ) {
      id
      connectionRecipientId
      connectionRemitentId
    }
  }
`;

export interface ConnectionFrame {
  id: string;
  connectionRecipientId?: string | null;
  connectionRemitentId?: string | null;
  accepted?: boolean | null;
  ignored?: boolean | null;
}

export type ConnectionEvent =
  | { kind: "updated"; frame: ConnectionFrame; otherUserId: string }
  | { kind: "deleted"; frame: ConnectionFrame; otherUserId: string };

/**
 * Which party is *not* the viewer — the id every consumer keys its map on.
 * Returns null for a frame that names neither, which should not happen but would
 * otherwise write an entry under `undefined`.
 */
export function otherPartyOf(
  frame: ConnectionFrame,
  userId: string,
): string | null {
  const { connectionRemitentId: from, connectionRecipientId: to } = frame;
  if (from && from !== userId) return from;
  if (to && to !== userId) return to;
  return null;
}

type Handler = (event: ConnectionEvent) => void;

interface Subscription {
  unsubscribe: () => void;
}

function subscribeTo(
  document: string,
  userId: string,
  field: "onUpdateConnection" | "onDeleteConnection",
  kind: ConnectionEvent["kind"],
  handler: Handler,
): Subscription | undefined {
  try {
    const observable = API.graphql(graphqlOperation(document, { userId })) as {
      subscribe: (handlers: {
        next: (msg: { value?: { data?: Record<string, ConnectionFrame | null> } }) => void;
        error: (e: unknown) => void;
      }) => Subscription;
    };

    return observable.subscribe({
      next: (msg) => {
        const frame = msg?.value?.data?.[field];
        if (!frame?.id) return;
        const otherUserId = otherPartyOf(frame, userId);
        if (!otherUserId) return;
        handler({ kind, frame, otherUserId } as ConnectionEvent);
      },
      error: () => {
        /* The screen falls back to its focus-triggered refresh. */
      },
    });
  } catch (err) {
    console.error(`[buddies] ${field} subscription failed:`, err);
    return undefined;
  }
}

/**
 * Subscribes to both, returning one unsubscribe.
 *
 * Deliberately not a hook: several surfaces need these events and each mounting
 * its own pair would open duplicate websockets for the same user.
 */
export function subscribeToConnectionLiveness(
  userId: string,
  handler: Handler,
): () => void {
  if (!userId) return () => {};

  const subs = [
    subscribeTo(ON_UPDATE_CONNECTION, userId, "onUpdateConnection", "updated", handler),
    subscribeTo(ON_DELETE_CONNECTION, userId, "onDeleteConnection", "deleted", handler),
  ];

  return () => {
    for (const s of subs) s?.unsubscribe();
  };
}

/**
 * What a frame means for the connection map.
 *
 * `ignored` is a decline, which removes the relationship rather than marking it
 * — the same treatment as a delete, so a declined request stops showing.
 */
export function reduceConnectionEvent(
  event: ConnectionEvent,
): { userId: string; status: "connected" | "pending" } | { userId: string; status: null } {
  if (event.kind === "deleted" || event.frame.ignored === true) {
    return { userId: event.otherUserId, status: null };
  }
  return {
    userId: event.otherUserId,
    status: event.frame.accepted === true ? "connected" : "pending",
  };
}
