/**
 * The once-per-lifetime latch for milestone events.
 *
 * **Keyed by account, which is the one deliberate improvement over mobile.**
 * Mobile writes bare keys into `AsyncStorage` — `joinFirstGroup`, `post` — with
 * no account in them (`analitycsTypes.ts:localStorageAnalytics`). On a phone
 * that is nearly always the same thing, because one person owns the device. A
 * browser is not: a shared laptop, a clinic machine, or simply two accounts in
 * one profile, and the second member's first group join is silently swallowed
 * because the first member's flag is still there. Every key here carries the
 * Cognito sub.
 *
 * This is **not** the onboarding-draft storage the project forbids. What is
 * written is a boolean per account per milestone — no name, no diagnosis, no
 * form answer — and the account id it is keyed by is already in localStorage,
 * inside the Amplify token Cognito puts there.
 *
 * Every access is wrapped: Safari in private mode throws on `localStorage`
 * access, and an analytics flag is never worth an exception on a code path the
 * member is standing in. A throw is read as "not fired yet", which at worst
 * counts a milestone twice — the harmless direction.
 */

import type { AnalyticsEventName } from "./types";

const PREFIX = "cb:analytics";

export function latchKey(accountId: string, name: AnalyticsEventName): string {
  return `${PREFIX}:${accountId}:${name}`;
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function hasFired(accountId: string, name: AnalyticsEventName): boolean {
  try {
    return storage()?.getItem(latchKey(accountId, name)) === "true";
  } catch {
    return false;
  }
}

export function markFired(accountId: string, name: AnalyticsEventName): void {
  try {
    storage()?.setItem(latchKey(accountId, name), "true");
  } catch {
    /* Nothing to do — the event has already been sent. */
  }
}

/**
 * Mark every milestone as already reached.
 *
 * Called on a returning member's sign-in, because "first group joined" is a
 * fact about a *new* account and someone signing in has, by definition, been
 * here before. Mobile does the same thing in `Login.tsx:41-57`, writing all five
 * flags before it navigates.
 */
export function markAllFired(
  accountId: string,
  names: Iterable<AnalyticsEventName>,
): void {
  for (const name of names) markFired(accountId, name);
}
