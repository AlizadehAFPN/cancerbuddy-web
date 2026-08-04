"use client";

/**
 * One row of the Updates feed — mobile's `ListNotification`.
 *
 * Same four pieces in the same order: avatar, the sender's name with their
 * verification badges and the age of the notification, the server-composed
 * sentence, and the group it happened in. The sentence is never assembled
 * here; `typeNotification` arrives ready-made and both apps print it verbatim,
 * which is why "Posted in" reads as a fragment until the group name lands
 * underneath it.
 *
 * A row with nothing to open renders as a plain block rather than a button, so
 * the pointer never promises a destination that doesn't exist.
 */

import Link from "next/link";
import { t } from "@/lib/i18n";
import BuddyAvatar from "@/components/buddies/BuddyAvatar";
import { formatName } from "@/lib/buddies/display";
import { relativeTime } from "@/lib/notifications/grouping";
import { notificationTarget } from "@/lib/notifications/routing";
import type { AppNotification } from "@/lib/notifications/types";

function VerifiedBadge({ title }: { title: string }) {
  return (
    <span
      title={title}
      aria-label={title}
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cb-blue text-[9px] font-bold text-cb-black"
    >
      ✓
    </span>
  );
}

function RowBody({ notification, now }: { notification: AppNotification; now: number }) {
  const { remitent } = notification;

  return (
    <div className="flex w-full items-start gap-3.5">
      <BuddyAvatar
        name={remitent.name}
        photoUrl={remitent.profilePicUrl}
        goalUrl={remitent.goalImageUrl}
        size={46}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-heading text-[15px] font-bold leading-tight text-cb-black">
            {formatName(remitent.name)}
          </span>

          {remitent.userType === "SUPPORT" && (
            <VerifiedBadge title={t("app.chat.verified")} />
          )}
          {remitent.ambassador === true && (
            <VerifiedBadge title={t("app.chat.ambassador")} />
          )}

          <span className="font-body text-[12.5px] font-medium text-cb-gray-500">
            {relativeTime(notification.createdAt, now)}
          </span>
        </div>

        {notification.typeNotification && (
          <p className="mt-0.5 font-body text-[14px] leading-snug text-cb-gray-600">
            {notification.typeNotification}
          </p>
        )}

        {notification.group?.name && (
          <p className="mt-0.5 font-body text-[14px] font-medium leading-snug text-cb-black">
            {notification.group.name}
          </p>
        )}
      </div>
    </div>
  );
}

export default function NotificationRow({
  notification,
  now,
  onOpenRequests,
}: {
  notification: AppNotification;
  /** Passed in so every row in a render measures against the same instant. */
  now: number;
  /** Mobile's `setActiveTab('Tab2')` for buddy requests — no navigation. */
  onOpenRequests: () => void;
}) {
  const target = notificationTarget(notification);

  const shared =
    "block w-full rounded-2xl px-3 py-3 text-left transition-colors hover:bg-cb-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black";

  if (target.kind === "href") {
    return (
      <Link href={target.href} className={shared} aria-label={t("app.updates.openNotification")}>
        <RowBody notification={notification} now={now} />
      </Link>
    );
  }

  if (target.kind === "requests") {
    return (
      <button type="button" onClick={onOpenRequests} className={shared}>
        <RowBody notification={notification} now={now} />
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl px-3 py-3" title={t("app.updates.unopenable")}>
      <RowBody notification={notification} now={now} />
    </div>
  );
}
