/**
 * Live sessions: which groups are broadcasting now, and what's scheduled.
 *
 * Joining the video room itself is deliberately not implemented here — that's
 * Twilio and a separate piece of work. The web shows the same LIVE badges and
 * calendar the mobile app does so members know a session is happening.
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

export async function fetchLiveCalendar(): Promise<LiveCalendarEvent[]> {
  const raw = await raiseUserLambda(
    LambdaPayloadType.GET_LIVE_CALENDAR,
    usersLambdaName(),
    {},
  );
  return parseCalendarResponse(raw).filter((e) => e?.id && e?.scheduledAt);
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
