/**
 * The guard rails behind the live-session scheduler.
 *
 * Mobile keeps all of this inside one element component,
 * `src/components/elements/live-schedule-field/LiveScheduleField.tsx`: the
 * pickers are bounded to `[now, +1 year]`, the time picker moves in 15-minute
 * steps (`minuteInterval={15}`), and an "Ends at …" caption sits under the
 * duration chips. Web replaced all four with a bare `<input
 * type="datetime-local">`, so a host could schedule a session in the past, or
 * at 7:07 PM — a time the mobile app can never produce and therefore never
 * round-trips cleanly.
 *
 * The rules live here, as pure functions, so the same three answers drive the
 * input's attributes, the Save button, and the acceptance checks.
 */

import { t } from "@/lib/i18n";

/**
 * `step` for the datetime-local input, in seconds. 900 = mobile's
 * `minuteInterval={15}` (`LiveScheduleField.tsx:346,384`).
 */
export const SCHEDULE_STEP_SECONDS = 900;

/** Minutes between selectable times — the same rule, expressed for validation. */
export const SCHEDULE_STEP_MINUTES = SCHEDULE_STEP_SECONDS / 60;

/** A new session starts at 60 minutes on mobile (`ManageLivesCreate.tsx:39`). */
export const DEFAULT_DURATION_CREATE = 60;

/**
 * An existing session with no duration falls back to 30
 * (`ManageLivesDetail.tsx:103`). Deliberately *not* the same number as the
 * create default — mobile differs here too.
 */
export const DEFAULT_DURATION_EDIT = 30;

/** The chip values, in mobile's order (`DEFAULT_DURATION_OPTIONS:34-41`). */
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A `Date` as the `YYYY-MM-DDTHH:mm` that `<input type="datetime-local">`
 * expects — local time, never UTC.
 */
export function toLocalInput(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export interface ScheduleBounds {
  /** `min` attribute — now. */
  min: string;
  /** `max` attribute — the end of the calendar day one year out. */
  max: string;
  /** `step` attribute, in seconds. */
  step: number;
}

/**
 * The three attributes the picker is bounded by, derived from a caller-supplied
 * clock so the result is testable and so nothing computes `new Date()` during a
 * server render.
 */
export function scheduleBounds(now: Date): ScheduleBounds {
  return {
    min: toLocalInput(now),
    max: toLocalInput(maxScheduleDate(now)),
    step: SCHEDULE_STEP_SECONDS,
  };
}

/** Mobile's `buildDefaultMaximumScheduleDate` (`LiveScheduleField.tsx:56-62`). */
function maxScheduleDate(now: Date): Date {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() + 1);
  d.setHours(23, 59, 59, 999);
  return d;
}

export type ScheduleProblem = "past" | "tooFar" | "offGrid";

/**
 * Why a chosen time is not schedulable, or `null` if it is.
 *
 * `min`, `max` and `step` on the input are advisory outside a submitted form —
 * a keyboard entry or a paste walks straight past them — so the Save button
 * asks this as well. An empty or half-typed value is not a problem yet; the
 * required-field check owns that.
 */
export function scheduleProblem(
  value: string,
  now: Date,
): ScheduleProblem | null {
  if (!value) return null;
  const picked = new Date(value);
  if (Number.isNaN(picked.getTime())) return null;

  /* Floored to the minute: a slot at the current minute is still ahead. */
  const floor = new Date(now);
  floor.setSeconds(0, 0);

  if (picked.getTime() < floor.getTime()) return "past";
  if (picked.getTime() > maxScheduleDate(now).getTime()) return "tooFar";
  if (picked.getMinutes() % SCHEDULE_STEP_MINUTES !== 0) return "offGrid";
  return null;
}

/** `7:05 PM`. Built by hand: ICU 72+ puts U+202F before the meridiem. */
function timeLabel(date: Date): string {
  const hours = date.getHours();
  return `${hours % 12 || 12}:${pad(date.getMinutes())} ${hours >= 12 ? "PM" : "AM"}`;
}

/**
 * `Ends at 8:30 PM`, or `Ends Mar 18 at 12:15 AM` once it rolls past midnight —
 * mobile's `endsAtLabel` (`LiveScheduleField.tsx:174-185`). Empty until both a
 * time and a duration are set, which is also when mobile hides the caption.
 */
export function endsAtLabel(value: string, durationMinutes: number): string {
  if (!value || !durationMinutes) return "";
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return "";

  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const time = timeLabel(end);

  if (end.toDateString() === start.toDateString()) {
    return t("app.profile.liveEndsAt", { time });
  }
  return t("app.profile.liveEndsOn", {
    date: `${SHORT_MONTHS[end.getMonth()]} ${end.getDate()}`,
    time,
  });
}

/**
 * Chip label: `45 min`, `1h`, `1.5h`, `2h` — mobile's
 * `DEFAULT_DURATION_OPTIONS`. Halves survive because params stringify numbers
 * verbatim.
 */
export function durationChipLabel(minutes: number): string {
  if (minutes < 60) return t("app.profile.liveMinutes", { count: minutes });
  return t("app.profile.liveHours", { count: minutes / 60 });
}

/**
 * Card label: `30 min`, `1h`, `1h 30m`, `2h` — mobile's `formatDuration`
 * (`ManageLives.tsx:61-68`). Deliberately a different set from the chips: an
 * hour and a half reads `1.5h` while you are picking it and `1h 30m` once it is
 * scheduled, on both platforms.
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return "";
  if (minutes < 60) return t("app.profile.liveMinutes", { count: minutes });

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? t("app.profile.liveHours", { count: hours })
    : t("app.profile.liveHoursMinutes", { hours, minutes: rest });
}
