/**
 * Which Stream channel is *this pair's* conversation.
 *
 * A connection row's id doubles as the channel id, so "chat with this buddy"
 * looks like it should just be `/chat/<connectionId>`. It is not: a pair who
 * connected, disconnected and reconnected has a newer connection row than the
 * channel their history lives in, and older pairs predate the convention
 * entirely. Sending them to `/chat/<current connection id>` opens an empty
 * conversation next to the one they were actually having.
 *
 * Mobile resolves it by asking Stream for the pair's channel first and only
 * falling back to the connection id (`UserInfo.tsx:341-376`), and this is that
 * algorithm with its dependencies injected so it can be tested without a client.
 */

export interface ChannelLike {
  id?: string;
  create: () => Promise<unknown>;
  watch: () => Promise<unknown>;
}

export interface ChatClientLike {
  queryChannels: (
    filter: Record<string, unknown>,
    sort?: unknown,
    options?: Record<string, unknown>,
  ) => Promise<{ id?: string }[]>;
  channel: (
    type: string,
    id: string,
    data: Record<string, unknown>,
  ) => ChannelLike;
}

/** First names only, target's first — the order mobile builds it in. */
export function buddyChannelName(
  theirName: string | null | undefined,
  myName: string | null | undefined,
): string {
  const first = (n: string | null | undefined) => (n ?? "").trim().split(/\s+/)[0] ?? "";
  return `${first(theirName)} ${first(myName)}`.trim();
}

export interface ResolveInput {
  client: ChatClientLike;
  me: string;
  them: string;
  /** The accepted connection's id, when there is one. */
  connectionId?: string | null;
  myName?: string | null;
  theirName?: string | null;
}

/**
 * Returns the channel id to open, or null when there is nothing to open.
 *
 * Null means the caller should say so rather than navigate — landing on a
 * `/chat/<id>` that does not exist shows an error page where the answer is
 * "you two aren't connected yet".
 */
export async function resolveBuddyChannelId(
  input: ResolveInput,
): Promise<string | null> {
  const { client, me, them, connectionId } = input;
  if (!me || !them) return null;

  // Newest first: a pair with more than one channel should land in the live one.
  try {
    const existing = await client.queryChannels(
      { type: "messaging", members: { $eq: [me, them] } },
      [{ last_message_at: -1 }],
      { watch: false, state: false },
    );
    const found = existing?.[0]?.id;
    if (found) return found;
  } catch {
    // Fall through to the connection id — an unreachable Stream must not block
    // a pair who are demonstrably connected.
  }

  if (!connectionId) return null;

  try {
    const channel = client.channel("messaging", connectionId, {
      members: [me, them],
      name: buddyChannelName(input.theirName, input.myName),
    });
    await channel.create();
    await channel.watch();
  } catch {
    // The id is still correct even if provisioning failed; the chat screen will
    // surface its own error rather than this one.
  }

  return connectionId;
}
