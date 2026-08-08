/**
 * Live sessions: which groups are broadcasting now, and what's scheduled.
 *
 * The room itself is `/live/[eventId]` (`docs/LIVE.md`); this file only decides
 * what the calendar advertises — which sessions a member may see at all, and
 * what state each one is in.
 */

import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import { fetchGroupById } from "@/lib/groups/groupQueries";
import type { LiveCalendarEvent } from "@/lib/groups/types";

function usersLambdaName(): string {
  const v = process.env.NEXT_PUBLIC_USERS_LAMBDA?.trim();
  if (!v) throw new Error("NEXT_PUBLIC_USERS_LAMBDA is not set.");
  return v;
}

/** The Lambda may double-encode and may wrap rows in `Items`/`items`. */
function parseCalendarResponse(raw: unknown): LiveCalendarEvent[] {
  let value: unknown = raw;
  for (let i = 0; i < 3 && typeof value === "string"; i += 1) {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) return value as LiveCalendarEvent[];
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const rows = obj.Items ?? obj.items;
    if (Array.isArray(rows)) return rows as LiveCalendarEvent[];
  }
  return [];
}

/**
 * Whether a session should be advertised at all.
 *
 * A host who unticks "Visible to members" sets `active: false`, and an archived
 * row is a session that is over and put away. Mobile drops both before it does
 * anything else (`LiveGroupCalendar.tsx:192-194`); web was keeping them,
 * because the two fields were not even declared on `LiveCalendarEvent` and so
 * never survived the type boundary.
 */
export function isCalendarEventVisible(
  event: Pick<LiveCalendarEvent, "active" | "archived">,
): boolean {
  return event.active !== false && event.archived !== true;
}

export type CalendarBadge = "ENDED" | "LIVE" | "UPCOMING";

/**
 * The state pill for a calendar row.
 *
 * Mobile shows LIVE and ENDED and nothing at all otherwise
 * (`LiveGroupCalendar.tsx:119-135`); web keeps its UPCOMING pill, which is the
 * one divergence here. `ENDED` wins over `LIVE`: a session whose row still
 * carries a stale `inLive` is finished, not running.
 */
export function badgeFor(
  event: Pick<LiveCalendarEvent, "status" | "inLive" | "archived">,
): CalendarBadge {
  if (event.status === "ended" || event.archived === true) return "ENDED";
  if (event.inLive === true || event.status === "live") return "LIVE";
  return "UPCOMING";
}

export async function fetchLiveCalendar(): Promise<LiveCalendarEvent[]> {
  const raw = await raiseUserLambda(
    LambdaPayloadType.GET_LIVE_CALENDAR,
    usersLambdaName(),
    {},
  );
  return parseCalendarResponse(raw).filter(
    (e) => e?.id && e?.scheduledAt && isCalendarEventVisible(e),
  );
}

/**
 * Hides sessions belonging to private groups the user isn't in.
 *
 * The calendar Lambda returns every scheduled session platform-wide, so this
 * filter is the privacy boundary: members always see their own groups, and
 * non-members only see groups that are open to discovery.
 */
export async function filterCalendarForPrivacy(
  events: LiveCalendarEvent[],
  memberGroupIds: string[],
): Promise<LiveCalendarEvent[]> {
  const members = new Set(memberGroupIds.filter(Boolean));
  const foreignGroupIds = [
    ...new Set(
      events.filter((e) => e.groupId && !members.has(e.groupId)).map((e) => e.groupId),
    ),
  ];

  if (foreignGroupIds.length === 0) return events;

  const discoverable = new Set<string>();
  await Promise.all(
    foreignGroupIds.map(async (groupId) => {
      try {
        const group = await fetchGroupById(groupId);
        if (group?.isPublic === true) discoverable.add(groupId);
      } catch {
        /* unreadable group — treat as private */
      }
    }),
  );

  return events.filter(
    (e) => !e.groupId || members.has(e.groupId) || discoverable.has(e.groupId),
  );
}

/* ── Calendar grouping ──────────────────────────────────────────────────── */

export interface CalendarSection {
  title: string;
  events: LiveCalendarEvent[];
}

export interface CalendarMonth {
  monthLabel: string;
  sections: CalendarSection[];
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/**
 * Groups events by month, then splits each month into the user's own groups
 * and everything else. Only this month and next are shown — the same two-month
 * window the mobile calendar uses.
 */
export function buildCalendarMonths(
  events: LiveCalendarEvent[],
  memberGroupIds: string[],
): CalendarMonth[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const nextMonthIndex = (currentMonth + 1) % 12;
  const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;

  const allowed = new Set([
    `${currentYear}-${currentMonth}`,
    `${nextMonthYear}-${nextMonthIndex}`,
  ]);
  const members = new Set(memberGroupIds);

  const sorted = events
    .filter((e) => allowed.has(monthKey(e.scheduledAt)))
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );

  const byMonth = new Map<
    string,
    { label: string; mine: LiveCalendarEvent[]; other: LiveCalendarEvent[] }
  >();

  for (const event of sorted) {
    const key = monthKey(event.scheduledAt);
    if (!byMonth.has(key)) {
      const d = new Date(event.scheduledAt);
      byMonth.set(key, {
        label: `${MONTHS[d.getMonth()].toUpperCase()} ${d.getFullYear()}`,
        mine: [],
        other: [],
      });
    }
    const bucket = byMonth.get(key)!;
    if (members.has(event.groupId)) bucket.mine.push(event);
    else bucket.other.push(event);
  }

  const months: CalendarMonth[] = [];
  byMonth.forEach(({ label, mine, other }) => {
    const sections: CalendarSection[] = [];
    if (mine.length > 0) sections.push({ title: "Your groups", events: mine });
    if (other.length > 0) {
      sections.push({ title: "More group options", events: other });
    }
    if (sections.length > 0) months.push({ monthLabel: label, sections });
  });

  return months;
}

/** `"March 4, 2026"` + `"6:00 pm - 7:00 pm"`. */
export function formatEventWhen(event: LiveCalendarEvent): {
  date: string;
  timeRange: string;
} {
  const start = new Date(event.scheduledAt);
  const end = new Date(start.getTime() + (event.duration || 60) * 60_000);

  const time = (d: Date) => {
    const hours = d.getHours();
    const suffix = hours >= 12 ? "pm" : "am";
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(d.getMinutes()).padStart(2, "0")} ${suffix}`;
  };

  return {
    date: `${MONTHS[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`,
    timeRange: `${time(start)} - ${time(end)}`,
  };
}
