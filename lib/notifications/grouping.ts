/**
 * Time buckets and relative timestamps for the Updates feed.
 *
 * A direct port of mobile's `categorizarNotificaciones` + `ordenarCategorias`
 * in `HomeNotifications.tsx`, done arithmetically rather than with moment so
 * the web doesn't take on a date library for five branches.
 *
 * Every quirk below is mobile's, kept on purpose so the two apps label the same
 * notification the same way. They are quirks, not choices:
 *
 *  • **"Just Now" covers two minutes.** The check is `minutes > 1`, so both a
 *    0- and a 1-minute-old row read "Just Now"; "2m" is the first number shown.
 *  • **Hours never round.** 90 minutes is "1h", 23h59m is "23h" — `diff` in
 *    whole hours truncates.
 *  • **"Last 30 days" is the last bucket there is.** Mobile's final `return`
 *    repeats that category, so a six-month-old notification sits under it
 *    reading "26w". See `docs/UPDATES.md`; adding an "Older" bucket is a
 *    five-line change if that heading turns out to be misleading enough to fix.
 *
 * The one deliberate difference: a `createdAt` in the future is clamped to
 * zero. Mobile renders the negative numbers that come out of clock skew
 * ("-1h"); showing "Just Now" is the same information without the glitch.
 */

import type { AppNotification } from "@/lib/notifications/types";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Section headings, in the order mobile renders them. */
export const BUCKET_ORDER = [
  "new",
  "today",
  "yesterday",
  "last7",
  "last30",
] as const;

export type NotificationBucket = (typeof BUCKET_ORDER)[number];

/**
 * The short age shown beside a name — "Just Now", "2m", "5h", "3d", "9w".
 *
 * `now` is a parameter rather than `Date.now()` so this is testable and so a
 * list rendered in one pass can't drift between its first and last row.
 */
export function relativeTime(createdAt: string | Date, now: number): string {
  const elapsed = Math.max(0, now - new Date(createdAt).getTime());
  const hours = Math.floor(elapsed / HOUR);

  if (hours < 1) {
    const minutes = Math.floor((elapsed % HOUR) / MINUTE);
    return minutes > 1 ? `${minutes}m` : "Just Now";
  }
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(elapsed / DAY);
  if (hours < 168) return `${days}d`;

  return `${Math.floor(elapsed / WEEK)}w`;
}

export function bucketFor(createdAt: string | Date, now: number): NotificationBucket {
  const elapsed = Math.max(0, now - new Date(createdAt).getTime());
  const hours = Math.floor(elapsed / HOUR);

  if (hours < 1) return "new";
  if (hours < 24) return "today";
  if (hours < 48) return "yesterday";
  if (hours < 168) return "last7";
  return "last30";
}

export interface NotificationGroup {
  bucket: NotificationBucket;
  items: AppNotification[];
}

/**
 * Buckets a flat feed into the sections the screen renders.
 *
 * Empty buckets are dropped, and each bucket is sorted newest-first — the query
 * already returns that order, but a page merged in later could interleave.
 */
export function groupNotifications(
  items: AppNotification[],
  now: number,
): NotificationGroup[] {
  const buckets = new Map<NotificationBucket, AppNotification[]>();

  for (const item of items) {
    const bucket = bucketFor(item.createdAt, now);
    const existing = buckets.get(bucket);
    if (existing) existing.push(item);
    else buckets.set(bucket, [item]);
  }

  return BUCKET_ORDER.filter((bucket) => buckets.get(bucket)?.length).map(
    (bucket) => ({
      bucket,
      items: buckets
        .get(bucket)!
        .slice()
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    }),
  );
}
