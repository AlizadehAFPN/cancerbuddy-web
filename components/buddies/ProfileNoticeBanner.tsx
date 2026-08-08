"use client";

/**
 * The persistent explanation under a profile's name — mobile's `FeedbackCard`.
 *
 * It answers a question the action bar cannot: *why* there is no Connect
 * button, or why this one says Pending. Web used toasts, which is the wrong
 * shape for the answer twice over — a toast is gone before the profile has
 * finished loading, and it never fires at all when the profile is opened from a
 * link rather than from the action that caused the state.
 *
 * `role="status"` rather than `alert`: this is context, not an interruption.
 */

import { t } from "@/lib/i18n";
import type { ProfileNotice } from "@/lib/buddies/connectContext";

/**
 * Mobile's `TOAST_COPY_MESSAGES_SCANNER` keys, mapped to ours. `as const` so the
 * values stay literal — `t()` only accepts keys it can see in the catalogue, and
 * a widened `string` here would give up that check for every notice.
 */
const NOTICE_KEYS = {
  sentInvite: "app.buddies.noticeSentInvite",
  alreadyBuddies: "app.buddies.noticeAlreadyBuddies",
  ageRule: "app.buddies.noticeAgeRule",
  snoozeAccount: "app.buddies.noticeSnoozeAccount",
} as const satisfies Record<ProfileNotice, string>;

export default function ProfileNoticeBanner({
  notice,
  name,
}: {
  notice: ProfileNotice;
  /** Already `formatName`d — two of the four sentences name the person. */
  name: string;
}) {
  return (
    <p
      role="status"
      data-notice={notice}
      className="rounded-2xl border border-cb-info/30 bg-cb-info/10 px-4 py-3 font-body text-[14px] leading-relaxed text-cb-black"
    >
      {t(NOTICE_KEYS[notice], { name })}
    </p>
  );
}
