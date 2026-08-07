"use client";

/**
 * `/groups/calendar` — scheduled live sessions for this month and next.
 *
 * Each month splits into the user's own groups and everything else, matching
 * the mobile calendar. Sessions belonging to private groups the user isn't in
 * are filtered out before rendering — see `filterCalendarForPrivacy`.
 *
 * A session that is running now leads into `/live/[eventId]`; one that isn't
 * leads to its group. Mobile makes every calendar row open the Twilio room and
 * lets the token Lambda reject early arrivals, which is a confusing way to
 * learn a session hasn't started.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { useGroups } from "@/lib/groups/GroupsProvider";
import {
  buildCalendarMonths,
  fetchLiveCalendar,
  filterCalendarForPrivacy,
  formatEventWhen,
  type CalendarMonth,
} from "@/lib/groups/liveGroups";
import type { LiveCalendarEvent } from "@/lib/groups/types";

function EventRow({
  event,
  liveEventId,
  isMember,
}: {
  event: LiveCalendarEvent;
  /**
   * The session to join, when one in this group is running. Usually this row,
   * but a group can have a session live while a *different* row is the one
   * broadcasting — the badge follows the group, the link must follow the id.
   */
  liveEventId: string | null;
  isMember: boolean;
}) {
  const when = formatEventWhen(event);
  const live = liveEventId !== null;

  return (
    <li className="rounded-2xl border border-cb-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-[16px] font-bold leading-tight text-cb-black">
              {event.title}
            </h3>
            {live ? (
              <span className="rounded-full bg-cb-danger px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wide text-white">
                {t("app.groups.calendarLive")}
              </span>
            ) : (
              <span className="rounded-full bg-cb-gray-100 px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wide text-cb-gray-600">
                {t("app.groups.calendarUpcoming")}
              </span>
            )}
          </div>

          {event.groupName && (
            <p className="mt-0.5 font-body text-[13px] text-cb-gray-500">
              {event.groupName}
            </p>
          )}

          <p className="mt-2 font-body text-[13.5px] font-semibold text-cb-black">
            {when.date}
          </p>
          <p className="font-body text-[13px] text-cb-gray-600">{when.timeRange}</p>

          {event.description && (
            <p className="mt-2 font-body text-[13.5px] leading-snug text-cb-gray-600">
              {event.description}
            </p>
          )}
        </div>

        {liveEventId ? (
          <Link
            href={`/live/${liveEventId}`}
            className="shrink-0 rounded-full bg-cb-danger px-4 py-1.5 font-body text-[12.5px] font-bold text-white transition-[filter] hover:brightness-110"
          >
            {t("app.groups.joinLive")}
          </Link>
        ) : (
          event.groupId && (
            <Link
              href={`/groups/${event.groupId}`}
              className="shrink-0 rounded-full border-2 border-cb-black px-3.5 py-1.5 font-body text-[12.5px] font-bold text-cb-black transition-colors hover:bg-cb-gray-100"
            >
              {isMember ? t("app.groups.groupInfo") : t("app.groups.join")}
            </Link>
          )
        )}
      </div>

      {live && (
        <p className="mt-3 rounded-xl bg-cb-bone px-3 py-2 font-body text-[12.5px] leading-snug text-cb-black">
          {t("app.groups.liveHappeningNow")}
        </p>
      )}
    </li>
  );
}

export default function LiveCalendar() {
  const { joinedGroups, liveGroupIds, liveEventIdFor, isMember } = useGroups();

  const [months, setMonths] = useState<CalendarMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const memberGroupIds = useMemo(
    () => joinedGroups.map((g) => g.id),
    [joinedGroups],
  );
  const memberKey = memberGroupIds.join(",");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const ids = memberKey ? memberKey.split(",") : [];
        const events = await fetchLiveCalendar();
        const visible = await filterCalendarForPrivacy(events, ids);
        if (cancelled) return;
        setMonths(buildCalendarMonths(visible, ids));
        setError(null);
      } catch (err) {
        console.error("[groups] calendar load failed:", err);
        if (!cancelled) setError(t("app.groups.calendarError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [memberKey]);

  const hasEvents = months.some((m) => m.sections.length > 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="font-heading text-[24px] font-bold leading-tight tracking-tight text-cb-black">
          {t("app.groups.tabCalendar")}
        </h1>
      </header>

      {loading ? (
        <div aria-hidden className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-cb-gray-200 bg-white"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-cb-danger/30 bg-cb-danger/10 px-5 py-6 text-center">
          <p className="font-body text-[14px] text-cb-black">{error}</p>
          <div className="mt-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => window.location.reload()}
            >
              {t("app.groups.retry")}
            </Button>
          </div>
        </div>
      ) : !hasEvents ? (
        <div className="rounded-2xl border border-cb-gray-200 bg-white px-6 py-16 text-center">
          <p className="font-heading text-[17px] font-bold text-cb-black">
            {t("app.groups.calendarEmpty")}
          </p>
          <p className="mt-1.5 font-body text-[14px] text-cb-gray-500">
            {t("app.groups.calendarEmptySub")}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {months.map((month) => (
            <section key={month.monthLabel}>
              <h2 className="mb-3 font-heading text-[13px] font-bold uppercase tracking-[0.14em] text-cb-black">
                {month.monthLabel}
              </h2>
              <div className="space-y-5">
                {month.sections.map((section) => (
                  <div key={section.title}>
                    <h3 className="mb-2 font-body text-[11px] font-bold uppercase tracking-[0.12em] text-cb-gray-500">
                      {section.title}
                    </h3>
                    <ul className="space-y-3">
                      {section.events.map((event) => (
                        <EventRow
                          key={event.id}
                          event={event}
                          liveEventId={
                            event.inLive === true
                              ? event.id
                              : liveGroupIds.has(event.groupId)
                                ? liveEventIdFor(event.groupId)
                                : null
                          }
                          isMember={isMember(event.groupId)}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
