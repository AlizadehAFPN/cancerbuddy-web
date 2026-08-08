/**
 * Snooze — putting the account to sleep, and waking it again.
 *
 * Two effects, and both are shared state that the *other* member sees, so this
 * does exactly what mobile does and nothing more:
 *
 *  1. `USERS_LAMBDA` `snooze` / `noSnooze` flips `isSnooze` on the user row,
 *     which is what removes the account from everyone's discovery results.
 *  2. Every Stream channel the member belongs to is frozen, which stops **both
 *     sides** posting. Mobile writes a system message with it so the other
 *     person sees why (`SnoozeProvider.tsx:62-80`).
 *
 * The unfreeze rule is the subtle one and the easy one to get wrong: a channel
 * is only unfrozen when the *other* member is not themselves snoozed. Unfreezing
 * unconditionally would wake up conversations belonging to someone who is still
 * asleep — a change mobile deliberately does not make.
 */

import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";

/** Mobile's `FROZE_CHANNEL_COPY` / `UNFROZE_CHANNEL_COPY`, verbatim. */
export const FROZEN_CHANNEL_MESSAGE = "Currently taking a break";
export const UNFROZEN_CHANNEL_MESSAGE =
  "Your buddy is back!  It's time to catch up.";

function usersLambdaName(): string {
  const v = process.env.NEXT_PUBLIC_USERS_LAMBDA?.trim();
  if (!v) throw new Error("NEXT_PUBLIC_USERS_LAMBDA is not set.");
  return v;
}

/**
 * Flips the flag on the account row.
 *
 * `snooze: true` → `type: "snooze"`, `false` → `type: "noSnooze"`. Mobile's
 * constant for the second is `UNSNOOZE`, whose *value* is `noSnooze` — naming
 * the constant after the wire string here removes that trap.
 */
export async function snoozeOrUnsnooze(
  userId: string,
  snooze: boolean,
): Promise<void> {
  const type = snooze ? LambdaPayloadType.SNOOZE : LambdaPayloadType.UNSNOOZE;
  await raiseUserLambda(type, usersLambdaName(), { userId });
}

/* ── Stream channel freezing ────────────────────────────────────────────── */

export interface FreezableChannel {
  id?: string;
  state?: { members?: Record<string, { user?: { id?: string } | null } | null> };
  update: (
    data: Record<string, unknown>,
    message?: Record<string, unknown>,
  ) => Promise<unknown>;
}

export interface SnoozeChatClient {
  queryChannels: (
    filter: Record<string, unknown>,
    sort?: unknown,
    options?: Record<string, unknown>,
  ) => Promise<FreezableChannel[]>;
}

export type ChannelMembers = Record<
  string,
  { user?: { id?: string } | null } | null
>;

/** The other member of a 1:1 channel, or null for a channel that has none. */
export function otherMemberId(
  members: ChannelMembers | undefined,
  myId: string,
): string | null {
  for (const entry of Object.values(members ?? {})) {
    const id = entry?.user?.id;
    if (id && id !== myId) return id;
  }
  return null;
}

/**
 * Whether a channel should be woken up.
 *
 * Mobile's `isSnoozeContactValidationUtil` inverted: it asks whether the contact
 * is snoozed and unfreezes when they are not. Expressed positively here so the
 * rule reads the way it is meant — and so the test can state it in one line.
 */
export function shouldUnfreeze(input: {
  otherMemberIsSnoozed: boolean;
}): boolean {
  return !input.otherMemberIsSnoozed;
}

const GET_IS_SNOOZE = /* GraphQL */ `
  query getContactSnooze($id: ID!) {
    getUser(id: $id) {
      id
      isSnooze
    }
  }
`;

async function isSnoozed(userId: string): Promise<boolean> {
  try {
    const { data } = await executeAppSyncGraphql<{
      getUser: { isSnooze?: boolean | null } | null;
    }>({ query: GET_IS_SNOOZE, variables: { id: userId }, authWithUserPool: true });
    return data?.getUser?.isSnooze === true;
  } catch {
    /*
     * Unknown counts as snoozed, so a failed read leaves the channel frozen.
     * The reverse — waking a conversation belonging to someone still asleep —
     * is the outcome that reaches another member.
     */
    return true;
  }
}

/**
 * Freezes (or unfreezes) every channel the member belongs to.
 *
 * Sequential rather than parallel on purpose: a member with fifty conversations
 * would otherwise fire fifty writes plus fifty snooze lookups at once, and
 * Stream rate-limits.
 */
export async function updateFrozenChannels(input: {
  client: SnoozeChatClient;
  userId: string;
  snooze: boolean;
  /** Injected for tests; defaults to the AppSync read. */
  readIsSnoozed?: (userId: string) => Promise<boolean>;
}): Promise<void> {
  const { client, userId, snooze } = input;
  const readIsSnoozed = input.readIsSnoozed ?? isSnoozed;

  let channels: FreezableChannel[];
  try {
    channels = await client.queryChannels({ members: { $in: [userId] } });
  } catch (err) {
    console.error("[snooze] could not list channels to freeze:", err);
    return;
  }

  for (const channel of channels) {
    try {
      if (snooze) {
        await channel.update({ frozen: true }, { text: FROZEN_CHANNEL_MESSAGE });
        continue;
      }

      const otherId = otherMemberId(channel.state?.members, userId);
      const otherIsSnoozed = otherId ? await readIsSnoozed(otherId) : false;
      if (shouldUnfreeze({ otherMemberIsSnoozed: otherIsSnoozed })) {
        await channel.update(
          { frozen: false },
          { text: UNFROZEN_CHANNEL_MESSAGE },
        );
      }
    } catch (err) {
      // One unreachable channel must not leave the rest in the wrong state.
      console.error("[snooze] could not update a channel:", channel.id, err);
    }
  }
}
