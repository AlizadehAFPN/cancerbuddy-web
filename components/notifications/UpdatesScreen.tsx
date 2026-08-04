"use client";

/**
 * `/notifications` — mobile's Updates tab.
 *
 * Two tabs, same as mobile: everything that happened, and the buddy requests
 * waiting for an answer. The requests count sits on its tab exactly as it does
 * there, because it's the one number worth acting on.
 *
 * The feed groups into New / Today / Yesterday / Last 7 days / Last 30 days,
 * with mobile's headings and mobile's boundaries — see `grouping.ts`, which is
 * checked against a transcription of mobile's own arithmetic.
 *
 * Two divergences, both recorded in `docs/UPDATES.md`:
 *  • rows are de-duplicated by id, not by `createdAt`, which on a real account
 *    recovers roughly 2% of the feed mobile drops;
 *  • the `read` filter is left off the query. It's a no-op today — nothing ever
 *    sets the flag — so the same rows appear, but the history survives if the
 *    Lambda that should set it is ever fixed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { RefreshIcon } from "@/components/buddies/controls";
import NotificationRow from "@/components/notifications/NotificationRow";
import RequestsPanel from "@/components/notifications/RequestsPanel";
import { useBuddies } from "@/lib/buddies/BuddiesProvider";
import { useRequests } from "@/lib/buddies/useRequests";
import { groupNotifications, type NotificationBucket } from "@/lib/notifications/grouping";
import { useNotifications } from "@/lib/notifications/useNotifications";
import type { MessageKey } from "@/lib/i18n";

type Tab = "all" | "requests";

const BUCKET_LABEL: Record<NotificationBucket, MessageKey> = {
  new: "app.updates.sectionNew",
  today: "app.updates.sectionToday",
  yesterday: "app.updates.sectionYesterday",
  last7: "app.updates.sectionLast7",
  last30: "app.updates.sectionLast30",
};

function FeedSkeleton() {
  return (
    <div aria-hidden className="space-y-2 pt-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3.5 px-3 py-3">
          <div className="h-[46px] w-[46px] animate-pulse rounded-full bg-cb-gray-100" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3.5 w-1/3 animate-pulse rounded bg-cb-gray-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-cb-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "relative flex items-center gap-2 rounded-full px-4 py-2 font-body text-[14.5px] transition-colors",
        active
          ? "bg-cb-black font-bold text-white"
          : "font-medium text-cb-gray-600 hover:bg-cb-gray-100 hover:text-cb-black",
      ].join(" ")}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={[
            "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-body text-[11.5px] font-bold",
            active ? "bg-cb-yellow text-cb-black" : "bg-cb-gray-200 text-cb-black",
          ].join(" ")}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export default function UpdatesScreen() {
  const { userId } = useBuddies();
  const feed = useNotifications(userId);
  const requests = useRequests();

  const [tab, setTab] = useState<Tab>("all");

  // Ages are measured from when the rows were read, not from the clock, so a
  // list can't say "1h" at the top and "2h" further down for two notifications
  // a second apart — and an unrelated re-render can't shift them either.
  const now = feed.fetchedAt;

  const groups = useMemo(
    () => groupNotifications(feed.items, now),
    [feed.items, now],
  );

  // Infinite scroll, same sentinel pattern the group feed uses.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMore = feed.loadMore;
  const hasMore = feed.hasMore;
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || tab !== "all") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, tab]);

  const openRequests = useCallback(() => setTab("requests"), []);

  const showEmpty =
    !feed.loading && !feed.error && feed.items.length === 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-[26px] font-bold leading-tight tracking-tight text-cb-black sm:text-[32px]">
              {t("app.updates.heading")}
            </h1>
            <p className="mt-1.5 font-body text-[14.5px] text-cb-gray-500">
              {t("app.updates.sub")}
            </p>
          </div>

          {tab === "all" && (
            <button
              type="button"
              onClick={() => void feed.refresh()}
              disabled={feed.refreshing}
              aria-label={t("app.updates.refresh")}
              className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-cb-gray-500 transition-colors hover:bg-cb-gray-100 hover:text-cb-black disabled:opacity-40"
            >
              <span className={feed.refreshing ? "animate-spin" : undefined}>
                <RefreshIcon />
              </span>
            </button>
          )}
        </div>
      </header>

      <div role="tablist" className="mb-2 flex flex-wrap gap-2">
        <TabButton
          active={tab === "all"}
          label={t("app.updates.tabAll")}
          onClick={() => setTab("all")}
        />
        <TabButton
          active={tab === "requests"}
          label={t("app.updates.tabRequests")}
          count={requests.requests.length}
          onClick={openRequests}
        />
      </div>

      {tab === "requests" ? (
        <RequestsPanel requests={requests} />
      ) : feed.loading ? (
        <FeedSkeleton />
      ) : feed.error ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <h2 className="font-heading text-[19px] font-bold text-cb-black">
            {t("app.updates.loadError")}
          </h2>
          <p className="font-body text-[14.5px] text-cb-gray-500">
            {t("app.updates.loadErrorSub")}
          </p>
          <Button onClick={feed.retry}>{t("app.updates.tryAgain")}</Button>
        </div>
      ) : showEmpty ? (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <h2 className="font-heading text-[19px] font-bold text-cb-black">
            {t("app.updates.empty")}
          </h2>
          <p className="max-w-sm font-body text-[14.5px] text-cb-gray-500">
            {t("app.updates.emptySub")}
          </p>
        </div>
      ) : (
        <>
          {groups.map((group) => (
            <section key={group.bucket} className="mb-2">
              <h2 className="px-3 pb-1 pt-5 font-heading text-[12px] font-bold uppercase tracking-[0.14em] text-cb-gray-500">
                {t(BUCKET_LABEL[group.bucket])}
              </h2>
              <ul className="divide-y divide-cb-gray-200/70">
                {group.items.map((notification) => (
                  <li key={notification.id}>
                    <NotificationRow
                      notification={notification}
                      now={now}
                      onOpenRequests={openRequests}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <div ref={sentinelRef} aria-hidden className="h-px" />

          {feed.loadingMore && (
            <p className="py-6 text-center font-body text-[13px] text-cb-gray-500">
              {t("app.updates.loadingMore")}
            </p>
          )}
          {!feed.hasMore && feed.items.length > 0 && (
            <p className="py-8 text-center font-body text-[13px] text-cb-gray-400">
              {t("app.updates.endOfList")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
