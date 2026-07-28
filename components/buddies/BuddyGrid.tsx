"use client";

/**
 * The discovery results: "Recommended for you" (people who share a diagnosis)
 * followed by "More options", exactly like the two sections mobile shows.
 *
 * Discovery hands us thousands of ids; three things keep that fast:
 *  • only `visibleCount` cards are mounted, grown by an IntersectionObserver
 *    sentinel rather than a "load more" button,
 *  • profiles are fetched for the mounted slice plus a look-ahead margin, in
 *    batched requests (see `useBuddyProfiles`),
 *  • mounted-but-offscreen cards skip layout/paint via `content-visibility`.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import BuddyCard, { BuddyCardSkeleton } from "@/components/buddies/BuddyCard";
import { useBuddyProfiles } from "@/lib/buddies/useBuddyProfiles";
import type {
  BuddyProfile,
  ConnectionMap,
  CurrentUserData,
  DiscoverySections,
} from "@/lib/buddies/types";

/** Cards added per scroll step. A multiple of the widest column count (3). */
const PAGE_SIZE = 24;
/** Extra profiles fetched ahead of the fold so scrolling stays smooth. */
const PREFETCH_AHEAD = 12;

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="col-span-full flex items-baseline gap-2.5 pt-2">
      <h2 className="font-heading text-[12px] font-bold uppercase tracking-[0.14em] text-cb-black">
        {title}
      </h2>
      <span className="font-body text-[12px] text-cb-gray-400">{count}</span>
    </div>
  );
}

export default function BuddyGrid({
  sections,
  viewer,
  connectionMap,
  busyIds,
  onConnect,
  onHide,
}: {
  sections: DiscoverySections;
  viewer: CurrentUserData | null;
  connectionMap: ConnectionMap;
  busyIds: string[];
  onConnect: (profile: BuddyProfile) => void;
  onHide: (profile: BuddyProfile) => void;
}) {
  // Paging state is per-search: the caller keys this component on the active
  // filters, so a new search remounts here and starts from the first page.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const allIds = useMemo(
    () => [...sections.recommended, ...sections.more],
    [sections],
  );

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || visibleCount >= allIds.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((n) => Math.min(n + PAGE_SIZE, allIds.length));
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visibleCount, allIds.length]);

  const mountedIds = useMemo(
    () => allIds.slice(0, visibleCount),
    [allIds, visibleCount],
  );

  const profiles = useBuddyProfiles(
    useMemo(
      () => allIds.slice(0, visibleCount + PREFETCH_AHEAD),
      [allIds, visibleCount],
    ),
  );

  // `allIds` is recommended-then-more, so the mounted slice splits at that seam.
  const seam = sections.recommended.length;
  const recommendedShown = mountedIds.slice(0, seam);
  const moreShown = mountedIds.slice(seam);

  const busy = useMemo(() => new Set(busyIds), [busyIds]);

  const renderCard = (id: string) => {
    if (profiles.isMissing(id)) return null;
    const profile = profiles.get(id);
    if (!profile) return <BuddyCardSkeleton key={id} />;
    return (
      <BuddyCard
        key={id}
        profile={profile}
        viewer={viewer}
        connection={connectionMap[id]}
        busy={busy.has(id)}
        onConnect={onConnect}
        onHide={onHide}
      />
    );
  };

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
        {recommendedShown.length > 0 && (
          <>
            <SectionHeader
              title={t("app.buddies.recommended")}
              count={sections.recommended.length}
            />
            {recommendedShown.map(renderCard)}
          </>
        )}

        {moreShown.length > 0 && (
          <>
            <SectionHeader
              title={t("app.buddies.moreOptions")}
              count={sections.more.length}
            />
            {moreShown.map(renderCard)}
          </>
        )}
      </div>

      {visibleCount < allIds.length && (
        <div ref={sentinelRef} className="pt-4">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            <BuddyCardSkeleton />
            <BuddyCardSkeleton />
            <BuddyCardSkeleton />
          </div>
        </div>
      )}
    </div>
  );
}
