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
  badgeFor,
  buildCalendarMonths,
  fetchLiveCalendar,
  filterCalendarForPrivacy,
  formatEventWhen,
  type CalendarMonth,
} from "@/lib/groups/liveGroups";
import { hasSessionEnded } from "@/lib/live/session";
import type { LiveCalendarEvent } from "@/lib/groups/types";

function EventRow({
  event,
  isLive,
  isMember,
}: {
  event: LiveCalendarEvent;
  /**
   * Whether a session in this group is broadcasting *now* — drives the red pill
   * only. Whether the row can be entered is a separate question, answered below.
   */
  isLive: boolean;
  isMember: boolean;
}) {
  const when = formatEventWhen(event);

  /**
   * `isLive` folds in the group-level live set, so it is passed *as* `inLive`
   * rather than checked alongside it — the badge has one input.
   */
  const badge = badgeFor({
    status: event.status,
    archived: event.archived,
    inLive: isLive,
  });
  const live = badge === "LIVE";

  /**
   * A member may open any session that has not ended, live or not.
   *
   * Gating this on live state would lock a host out of starting their own
   * session, because `inLive` is only flipped once the first host joins. Mobile
   * makes the whole card pressable and navigates straight to the room
   * (`LiveGroupCalendar.tsx:166-173`) with no live check at all — the token
   * Lambda is the authority on who may enter, and it refuses early sessions and
   * non-members itself.
   */
  const enterEventId =
    isMember &&
    !hasSessionEnded({ status: event.status, archived: event.archived ?? null })
      ? event.id
      : null;

  return (
    <li className="rounded-2xl border border-cb-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-[16px] font-bold leading-tight text-cb-black">
              {event.title}
            </h3>
            <span
              data-badge={badge}
              className={[
                "rounded-full px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wide",
                badge === "LIVE"
                  ? "bg-cb-danger text-white"
                  : badge === "ENDED"
                    ? "bg-cb-gray-200 text-cb-gray-600"
                    : "bg-cb-gray-100 text-cb-gray-600",
              ].join(" ")}
            >
              {t(
                badge === "LIVE"
                  ? "app.groups.calendarLive"
                  : badge === "ENDED"
                    ? "app.groups.calendarEnded"
                    : "app.groups.calendarUpcoming",
              )}
            </span>
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

        {enterEventId ? (
          <Link
            href={`/live/${enterEventId}`}
            className={
              live
                ? "shrink-0 rounded-full bg-cb-danger px-4 py-1.5 font-body text-[12.5px] font-bold text-white transition-[filter] hover:brightness-110"
                : "shrink-0 rounded-full border-2 border-cb-black px-3.5 py-1.5 font-body text-[12.5px] font-bold text-cb-black transition-colors hover:bg-cb-gray-100"
            }
          >
            {live ? t("app.groups.joinLive") : t("app.groups.openSession")}
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
                          isLive={
                            event.inLive === true ||
                            liveGroupIds.has(event.groupId)
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
