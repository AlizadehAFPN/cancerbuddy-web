/**
 * How long the account has existed, in milliseconds.
 *
 * Every milestone mobile records carries this as `timestamp` — not a clock
 * reading, but the age of the account at the moment the thing happened
 * (`diffMillisecondsDateToNow(getCreatedAt(user.id))` at each call site). That
 * is what makes the numbers comparable: "joined their first group 40 minutes
 * after signing up" is the metric, and a wall-clock stamp would not answer it.
 *
 * Mobile re-queries `getUser { createdAt }` on every single emit. Here it is
 * fetched once per account and kept for the life of the tab: the value cannot
 * change, and an analytics call has no business adding a round-trip to the path
 * a member is standing in.
 *
 * A failure resolves to `null` rather than throwing, and callers skip the event.
 * Sending `timestamp: 0` — the obvious fallback — would look like "did this the
 * instant they signed up" and quietly poison the average.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";

const GET_USER_CREATED_AT = /* GraphQL */ `
  query getUserCreatedAt($id: ID!) {
    getUser(id: $id) {
      id
      createdAt
    }
  }
`;

/** `accountId → createdAt` in ms, or `null` once a lookup has failed. */
const cache = new Map<string, number | null>();
const inflight = new Map<string, Promise<number | null>>();

async function fetchCreatedAt(accountId: string): Promise<number | null> {
  try {
    const { data } = await executeAppSyncGraphql<{
      getUser: { createdAt?: string | null } | null;
    }>({
      query: GET_USER_CREATED_AT,
      variables: { id: accountId },
      authWithUserPool: true,
    });

    const raw = data?.getUser?.createdAt;
    if (!raw) return null;
    const ms = new Date(raw).getTime();
    return Number.isNaN(ms) ? null : ms;
  } catch (err) {
    console.error("[analytics] could not read account createdAt:", err);
    return null;
  }
}

/**
 * @returns milliseconds since the account was created, or `null` when the
 * account's creation time is unknown — in which case the caller emits nothing.
 */
export async function accountAgeMs(
  accountId: string | null | undefined,
  now: number = Date.now(),
): Promise<number | null> {
  const id = accountId?.trim();
  if (!id) return null;

  if (cache.has(id)) {
    const created = cache.get(id) ?? null;
    return created === null ? null : now - created;
  }

  /* Two milestones can fire in the same tick — a first post is also a first
     comment-able moment — and both would otherwise issue the same query. */
  let pending = inflight.get(id);
  if (!pending) {
    pending = fetchCreatedAt(id).then((value) => {
      cache.set(id, value);
      inflight.delete(id);
      return value;
    });
    inflight.set(id, pending);
  }

  const created = await pending;
  return created === null ? null : now - created;
}

/** Test hook, and the right thing to call on sign-out. */
export function clearAccountAgeCache(): void {
  cache.clear();
  inflight.clear();
}
