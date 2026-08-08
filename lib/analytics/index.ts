/**
 * Analytics, as the rest of the app sees it.
 *
 * Call sites get one line and no `await`. Everything here is fire-and-forget by
 * construction: measuring an action must never delay it, fail it, or change
 * what the member sees if the transport is missing.
 *
 * ```ts
 * trackMilestone("joinFirstGroup", userId);   // timed against account age
 * trackNewPost(html, userId);                 // fans out per word
 * ```
 */

import { accountAgeMs } from "./accountAge";
import { emitEvent } from "./emitEvent";
import type { AnalyticsEventName } from "./types";

export { emitEvent, splitSearchWords } from "./emitEvent";
export { accountAgeMs, clearAccountAgeCache } from "./accountAge";
export {
  hasFired,
  markFired,
  markAllFired,
  latchKey,
} from "./latch";
export {
  setAnalyticsTransport,
  getAnalyticsTransport,
  analyticsConfigured,
  resetAnalyticsTransportForTests,
  type AnalyticsTransport,
} from "./transport";
export {
  ONCE_ONLY_EVENTS,
  NOT_YET_EMITTED,
  type AnalyticsEvent,
  type AnalyticsEventName,
} from "./types";

/**
 * The events whose `timestamp` is the account's **age**, not a clock reading.
 *
 * Mobile is not consistent about this and the difference matters: the five
 * milestones pass `diffMillisecondsDateToNow(getCreatedAt(user.id))`, while
 * `timeToSendMessage` and `bmcf_enrollment` pass `new Date().getTime()`. Mixing
 * the two would put epoch milliseconds into a field the reports read as a
 * duration, so the two kinds have separate entry points here.
 */
type MilestoneEventName = Extract<
  AnalyticsEventName,
  | "connectWithFirstBuddy"
  | "joinFirstGroup"
  | "chatWithFirstBuddy"
  | "comment"
  | "post"
>;

/**
 * Record a milestone, timed the way mobile times it.
 *
 * Deliberately not awaited by callers, and deliberately not blocking: the
 * account-age lookup is cached after the first call, and if it cannot be
 * resolved the event is skipped rather than sent with a misleading zero.
 */
export function trackMilestone(
  name: MilestoneEventName,
  accountId: string | null | undefined,
): void {
  void (async () => {
    const timestamp = await accountAgeMs(accountId);
    if (timestamp === null) return;
    emitEvent({ name, params: { timestamp } } as never, accountId);
  })();
}

/**
 * `timeToSendMessage` is the exception: mobile sends a wall-clock reading here
 * (`new Date().getTime()`), not an age, so this one is not routed through
 * {@link trackMilestone}.
 */
export function trackTimeToSendMessage(
  accountId: string | null | undefined,
  now: number = Date.now(),
): void {
  emitEvent({ name: "timeToSendMessage", params: { timestamp: now } }, accountId);
}

/**
 * The member has at least one 1:1 conversation.
 *
 * Timed differently from every other milestone, and mobile's arithmetic is
 * copied exactly (`events.ts`, the `connectWithFirstBuddy` branch): the gap
 * between the account being created and the **earliest** of their channels
 * being created. Not the age right now — a member who made a buddy on day one
 * and opens the app a year later still reports one day.
 *
 * @param channelCreatedAt ISO timestamps, `channel.data?.created_at` per
 * channel. An empty list emits nothing, as on mobile.
 */
export function trackConnectWithFirstBuddy(
  channelCreatedAt: readonly (string | undefined | null)[],
  accountId: string | null | undefined,
): void {
  const stamps = channelCreatedAt
    .map((iso) => (iso ? new Date(iso).getTime() : Number.NaN))
    .filter((ms) => !Number.isNaN(ms));
  if (stamps.length === 0) return;

  void (async () => {
    /* `accountAgeMs(id, created)` returns `created - accountCreatedAt`, which is
       precisely the gap wanted here — measured to the channel, not to now. */
    const gaps = await Promise.all(
      stamps.map((ms) => accountAgeMs(accountId, ms)),
    );
    const valid = gaps.filter((g): g is number => g !== null);
    if (valid.length === 0) return;

    emitEvent(
      { name: "connectWithFirstBuddy", params: { timestamp: Math.min(...valid) } },
      accountId,
    );
  })();
}

/**
 * A registration that finished.
 *
 * Wall-clock, not an age — mobile sends `new Date().getTime()` from
 * `LoadingPersonalInformation.tsx:141-144`. Not latched: an account can only
 * enrol once, so there is nothing to latch against, and a latch would need
 * storage written at the exact moment the account first exists.
 */
export function trackEnrollmentComplete(
  accountId: string | null | undefined,
  now: number = Date.now(),
): void {
  emitEvent({ name: "bmcf_enrollment", params: { timestamp: now } }, accountId);
}

/** The per-word fan-out for a published post body. */
export function trackNewPost(
  html: string,
  accountId: string | null | undefined,
): void {
  emitEvent({ name: "new_post", params: { search: html } }, accountId);
}
