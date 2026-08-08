/**
 * The one way an event leaves this app.
 *
 * A port of `cancerbuddyapp/src/analytics/events.ts`, with the same names, the
 * same parameters and the same once-only milestones. Three things differ, each
 * on purpose:
 *
 *  1. **The latch is per account**, not per device — see `latch.ts`.
 *  2. **A caller passes the account id.** Mobile reads a module-scope `user`;
 *     an explicit argument cannot be stale, cannot be the previous member's
 *     after a sign-out, and makes every one of these testable without a
 *     provider.
 *  3. **Mobile's `post` bug is not carried.** Its `case 'post'` reads the
 *     *comment* flag and writes the *post* flag
 *     (`events.ts` — `AsyncStorage.getItem(localStorageAnalytics.comment)`
 *     inside the post branch), so a member who comments before posting can
 *     never emit `post` at all. Each milestone reads and writes its own key.
 *
 * Nothing here throws, and nothing here is awaited by a caller that is doing
 * something for the member. Measuring an action must not be able to break it.
 */

import { htmlToPlainText } from "@/lib/groups/richText";
import { getAnalyticsTransport } from "./transport";
import { hasFired, markFired } from "./latch";
import { ONCE_ONLY_EVENTS, type AnalyticsEvent } from "./types";

/**
 * @param accountId The signed-in member's Cognito sub. Without it the latch
 * cannot be honoured, so a milestone is **dropped** rather than sent unlatched:
 * an unlatched milestone is counted again on the next visit, and a funnel that
 * over-counts firsts is worse than one missing an event that should not have
 * been reachable anyway. Every call site has the id.
 */
export function emitEvent(
  event: AnalyticsEvent,
  accountId: string | null | undefined,
): void {
  try {
    const id = accountId?.trim();
    const once = ONCE_ONLY_EVENTS.has(event.name);

    if (once) {
      if (!id) {
        console.warn(
          `[analytics] ${event.name} needs an account id to stay once-only — dropped`,
        );
        return;
      }
      if (hasFired(id, event.name)) return;
    }

    const transport = getAnalyticsTransport();

    if (event.name === "new_post") {
      /**
       * One event per word, exactly as mobile fans it out. The body arrives as
       * rich text, so the tags come off first — mobile's `changeHTMLEntities`,
       * which `htmlToPlainText` already does here — and empty fragments are
       * dropped so double spaces do not produce empty `search` values.
       */
      for (const word of splitSearchWords(event.params.search)) {
        transport.track("new_post", { search: word });
      }
    } else {
      /* The union's parameter shapes are interfaces, which carry no index
         signature; the transport takes a bag of values by design. */
      transport.track(
        event.name,
        event.params as Record<string, unknown> | undefined,
      );
    }

    /**
     * Marked after the transport call, as mobile does (it latches inside the
     * `.then()`). The call is synchronous and cannot report delivery, so this
     * means "we handed it over" — the alternative, latching first, would lose
     * the event outright if the transport threw.
     */
    if (once && id) markFired(id, event.name);
  } catch (err) {
    console.error("[analytics] emit failed:", err);
  }
}

/**
 * Words for the `new_post` fan-out.
 *
 * Split on any whitespace rather than mobile's bare `' '`: its version turns a
 * newline-separated body into words like `"first\nsecond"`, which is a term
 * nobody will ever search for. Same output for the single-line case that makes
 * up nearly every post.
 */
export function splitSearchWords(text: string): string[] {
  return htmlToPlainText(text)
    .split(/\s+/)
    .filter(Boolean);
}
