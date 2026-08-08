/**
 * Reporting a post, a comment or a reply.
 *
 * Two separate defects lived here, and the second one is why this module exists
 * at all rather than a couple of extra fields at the call site:
 *
 *  1. **The payload was three fields.** Moderators received `{postId, userId,
 *     reason}` — no reported user, no content, no indication whether it was a
 *     post or a comment — so a report was barely actionable.
 *  2. **`userId` is not a field on `CreateReportPostInput`.** Introspected
 *     against the live schema on 2026-08-08: the input accepts
 *     `id, postId, reportedUser, reporterUser, post, reason, type, createdAt`.
 *     AppSync rejects an input object carrying an unknown field, so **every web
 *     report failed validation** and the member was told it had been sent.
 *
 * Mobile builds the same payload in
 * `cancerbuddyapp/src/components/layouts/Groups/post-fragment/modals/ReportPost.modal.tsx:86-92`
 * and submits it in `screens/feeds/report-post.tsx:16-18`.
 */

/** The AppSync `ReportTypes` enum, verified by introspection. */
export const ReportTargetType = {
  POST: "POST",
  COMMENT: "COMMENT",
  JOURNAL: "JOURNAL",
} as const;

export type ReportTargetTypeValue =
  (typeof ReportTargetType)[keyof typeof ReportTargetType];

/** Report reasons offered, in mobile's order (`ReportTemplate.tsx:33-42`). */
export const REPORT_REASONS = [
  "Inappropriate comments",
  "Spam",
  "Made me feel uncomfortable",
  "False profile",
  "Other",
] as const;

export const OTHER_REASON = "Other";
/** Mobile's `disabledButtonState()` gate and the textarea's own `maxLength`. */
export const OTHER_MIN_CHARS = 10;
export const OTHER_MAX_CHARS = 1000;

/**
 * Whether Submit stays disabled.
 *
 * Mobile: no reason at all, or *Other* with fewer than ten characters typed
 * (`ReportTemplate.tsx:44-52`). Web checked only the first half, so an "Other"
 * report reached moderators as the bare word "Other".
 */
export function reportSubmitDisabled(input: {
  reason: string;
  detail?: string;
}): boolean {
  if (!input.reason) return true;
  if (input.reason === OTHER_REASON) {
    return (input.detail ?? "").trim().length < OTHER_MIN_CHARS;
  }
  return false;
}

/**
 * What actually goes on the wire as `reason`.
 *
 * For *Other* it is the free text, not the word "Other" —
 * `onSubmit(state === 'Other' ? stateInput : state)` on mobile.
 */
export function reportReasonValue(input: {
  reason: string;
  detail?: string;
}): string {
  return input.reason === OTHER_REASON
    ? (input.detail ?? "").trim()
    : input.reason;
}
