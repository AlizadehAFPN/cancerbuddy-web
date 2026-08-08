/**
 * The event contract, transcribed from mobile.
 *
 * Every name here is a **string literal matching mobile's exactly** — the whole
 * value of this file is that a typo fails `tsc --noEmit` rather than producing
 * an event nobody notices is missing until someone asks why the funnel has a
 * hole. Names come from `cancerbuddyapp/src/analytics/events.ts`; parameter
 * shapes from `src/types/analytics/analitycsTypes.ts` and the call sites.
 *
 * Two things about mobile's own types are deliberately *not* copied:
 *
 *  - Its `AnalyticsActionType` declares `event: 'joinGroup'`, for which
 *    `emitEvent` has no case — it can never fire. The event mobile actually
 *    emits when someone joins is `joinFirstGroup`.
 *  - Its unused `EventName` type lists `commentOrPost`, which appears nowhere
 *    else in either codebase.
 *
 * Neither is carried here; adding a name nothing emits is how a contract stops
 * meaning anything.
 */

/** Milliseconds since the account was created, which is how mobile times these. */
export interface Timestamped {
  timestamp: number;
}

export type AnalyticsEvent =
  /* ── Once per account (see ONCE_ONLY_EVENTS) ── */
  | { name: "connectWithFirstBuddy"; params: Timestamped }
  | { name: "joinFirstGroup"; params: Timestamped }
  | { name: "chatWithFirstBuddy"; params: Timestamped }
  | { name: "comment"; params: Timestamped }
  | { name: "post"; params: Timestamped }
  /* ── Every time ── */
  | { name: "timeToSendMessage"; params: Timestamped }
  | { name: "bmcf_enrollment"; params: Timestamped }
  | { name: "openEnrollment"; params: Timestamped }
  | { name: "openApp"; params?: undefined }
  /**
   * Fans out to one event per word of the post body — mobile's own shape, where
   * `search` is the whole body on the way in and a single word on the way out.
   */
  | { name: "new_post"; params: { search: string } }
  | {
      name: "filtersToSearch";
      params: {
        Status: "PATIENT" | "SURVIVOR" | "CAREGIVER";
        Age: number | string;
        payload: Record<string, unknown>;
      };
    }
  | {
      name: "searchTerms";
      params: {
        type: SearchTermType;
        payload: { terms: string[] };
      };
    };

export type AnalyticsEventName = AnalyticsEvent["name"];

export type SearchTermType =
  | "diagnosis"
  | "condition"
  | "treatment"
  | "sideEffects"
  | "medicalCenter"
  | "mySupportOrganizations"
  | "cancerLoss"
  | "WhoLose"
  | "currentlyInUniversity"
  | "universityName"
  | "gender"
  | "location"
  | "status"
  | "interests"
  | "ageMin"
  | "ageMax";

/**
 * Milestones that describe a *first*, so a second one is not a fact about the
 * member. Mobile latches exactly these five.
 *
 * A `Set` typed to the event names, so removing an event from the union without
 * removing it here fails the build.
 */
export const ONCE_ONLY_EVENTS: ReadonlySet<AnalyticsEventName> = new Set<
  AnalyticsEventName
>([
  "connectWithFirstBuddy",
  "joinFirstGroup",
  "chatWithFirstBuddy",
  "comment",
  "post",
]);

/**
 * Declared in the contract, not emitted by web yet.
 *
 * `openApp` and `openEnrollment` are lifecycle markers whose web equivalents
 * (a page load, opening `/register`) fire on navigations mobile does not have,
 * and counting them wrongly is worse than not counting them. `filtersToSearch`
 * and `searchTerms` belong to the buddies filter sheet and were not in this
 * phase's scope. They are in the union so their names cannot drift; a consumer
 * added later needs no change here.
 */
export const NOT_YET_EMITTED: readonly AnalyticsEventName[] = [
  "openApp",
  "openEnrollment",
  "filtersToSearch",
  "searchTerms",
];
