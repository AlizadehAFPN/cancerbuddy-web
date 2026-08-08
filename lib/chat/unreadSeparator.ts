/**
 * Where the "unread messages" line goes in a thread.
 *
 * Opening a conversation marks it read immediately, so the separator has to be
 * computed from the last-read timestamp captured *before* that call — otherwise
 * it can never appear. Web had no marker at all: a member returning to a
 * conversation with twenty new messages had to guess where they had stopped.
 */

export interface SeparatorMessage {
  createdAt: string;
  userId: string;
}

/**
 * Index of the first message the member has not seen, or `-1`.
 *
 * Only incoming messages count: your own messages are never "unread", and a
 * thread whose only new messages are yours gets no separator.
 */
export function firstUnreadIndex(
  messages: SeparatorMessage[],
  myLastReadAt: number,
  myUserId: string | null | undefined,
): number {
  if (!myUserId || !myLastReadAt) return -1;

  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i]!;
    if (m.userId === myUserId) continue;
    const at = new Date(m.createdAt).getTime();
    if (Number.isFinite(at) && at > myLastReadAt) return i;
  }
  return -1;
}
