/**
 * Find-or-create the 1:1 channel for a pair who may not be connected yet.
 *
 * Two Groups entry points need this and neither can exist without it: a host (or
 * SUPPORT account) replying privately to a post's author, and a member asking a
 * private group's host for the access code. In both cases the two people are
 * usually strangers, so unlike `resolveBuddyChannel.ts` — which resolves an
 * *existing* buddy's channel — this one may have to mint the connection first.
 *
 * Mobile's ladder, from `useSendMessageDirect.ts` and the identical copy inside
 * `usePostActions.ts:93-135`:
 *
 *   queryChannels({type:'messaging', members:{$eq:[me,them]}})
 *     → found?  use its id
 *     → none?   createConnection → AcceptConnection → channel(id).watch()
 *
 * The connection row's id becomes the channel id. That is a backend convention,
 * not a coincidence: `deleteConnection` on the same id is what "remove from my
 * buddies" deletes, and the chat list keys off it.
 *
 * Dependencies are injected so the ladder can be tested without a Stream client
 * or AppSync — the order of those three calls is the whole contract, and the
 * order is what a test has to be able to assert.
 */

export interface DirectChannelLike {
  id?: string;
  create: () => Promise<unknown>;
  watch: () => Promise<unknown>;
}

export interface DirectChatClient {
  queryChannels: (
    filter: Record<string, unknown>,
    sort?: unknown,
    options?: Record<string, unknown>,
  ) => Promise<{ id?: string }[]>;
  channel: (
    type: string,
    id: string,
    data: Record<string, unknown>,
  ) => DirectChannelLike;
}

export interface DirectChannelInput {
  client: DirectChatClient;
  me: string;
  them: string;
  /**
   * The channel's stored `name`, as mobile writes it. Mobile's two literals are
   * `"<author first name> Host"` for a private reply and `"<my name> Ambassador"`
   * for ask-the-host — see {@link replyPrivatelyChannelName} and
   * {@link askToHostChannelName}. Both clients read the member list for the
   * conversation title, so this is only ever seen in Stream's dashboard, but it
   * is shared data and web should write what mobile writes.
   */
  name: string;
  /** `createConnectionRequest` — returns the new connection (and channel) id. */
  createConnection: (input: { fromUserId: string; toUserId: string }) => Promise<string>;
  /** `acceptConnection` — a host DM opens accepted, with no request to approve. */
  acceptConnection: (connectionId: string) => Promise<void>;
}

/** `"{their first name} Host"` — `usePostActions.ts:131`. */
export function replyPrivatelyChannelName(
  authorName: string | null | undefined,
): string {
  const first = (authorName ?? "").trim().split(/\s+/)[0] ?? "";
  return `${first} Host`.trim();
}

/**
 * `"{my name} Ambassador"` — `useSendMessageDirect.ts:78`, reached from the
 * ask-the-host link. The "Ambassador" suffix looks like a copy-paste from the
 * ambassador flow, and it is; it is also what every mobile-created ask-the-host
 * channel is called, so web writes the same thing rather than a tidier name that
 * would make the two clients' rows disagree.
 */
export function askToHostChannelName(
  myName: string | null | undefined,
): string {
  return `${(myName ?? "").trim()} Ambassador`.trim();
}

/**
 * Returns the channel id to open, or null when one could not be resolved or
 * created — the caller then says so instead of navigating to a dead route.
 */
export async function resolveOrCreateDirectChannel(
  input: DirectChannelInput,
): Promise<string | null> {
  const { client, me, them } = input;
  if (!me || !them || me === them) return null;

  try {
    const existing = await client.queryChannels(
      { type: "messaging", members: { $eq: [me, them] } },
      [{ last_message_at: -1 }],
      { watch: true, state: true },
    );
    const found = existing?.[0]?.id;
    if (found) return found;
  } catch (err) {
    // A Stream outage must not create a second connection row for a pair who
    // already have one — that is the one failure this cannot recover from.
    console.error("[chat] channel lookup failed:", err);
    return null;
  }

  try {
    const connectionId = await input.createConnection({
      fromUserId: me,
      toUserId: them,
    });
    if (!connectionId) return null;

    await input.acceptConnection(connectionId);

    const channel = client.channel("messaging", connectionId, {
      members: [me, them],
      name: input.name,
    });
    await channel.create();
    await channel.watch();
    return connectionId;
  } catch (err) {
    console.error("[chat] direct channel creation failed:", err);
    return null;
  }
}
