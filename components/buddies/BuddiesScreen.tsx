"use client";

/**
 * The Buddies tab.
 *
 * Mobile splits this into two screens — pending requests, then a "Find new
 * buddies" button leading to discovery. The web has the room to do both at
 * once, so requests sit above a permanently-visible results list and the extra
 * navigation step disappears. Everything below the header is the same feature
 * set: the four quick filters, removable chips, and the recommended/more split.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import BuddyGrid from "@/components/buddies/BuddyGrid";
import BuddyIdSheet from "@/components/buddies/BuddyIdSheet";
import CustomFilterSheet from "@/components/buddies/CustomFilterSheet";
import DiscoveryEmptyState from "@/components/buddies/DiscoveryEmptyState";
import FilterChipsRow from "@/components/buddies/FilterChipsRow";
import QuickSearchBar, {
  type QuickSearchTarget,
} from "@/components/buddies/QuickSearchBar";
import {
  DiagnosisSheet,
  LocationSheet,
} from "@/components/buddies/QuickFilterSheets";
import RequestsSection from "@/components/buddies/RequestsSection";
import { BuddyCardSkeleton } from "@/components/buddies/BuddyCard";
import { RefreshIcon } from "@/components/buddies/controls";
import { toast } from "sonner";
import { useBuddies } from "@/lib/buddies/BuddiesProvider";
import { useDiscoveryFilters } from "@/lib/buddies/DiscoveryFiltersProvider";
import { hideUserFromDiscovery } from "@/lib/buddies/connections";
import { setDiscoveryOrder } from "@/lib/buddies/discoveryOrder";
import { useDiscovery } from "@/lib/buddies/useDiscovery";
import { useConnectAction } from "@/lib/buddies/useConnectAction";
import { hasAnyFilter, type FilterValues } from "@/lib/buddies/types";

function GridSkeleton() {
  return (
    <div
      aria-hidden
      className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <BuddyCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default function BuddiesScreen() {
  const {
    status,
    userId,
    currentUser,
    connectionMap,
    connectionsLoaded,
    connectionsRevision,
    blockedUserIds,
    addBlockedUser,
    retry,
  } = useBuddies();

  // Filters live at the layout, not here: this screen unmounts when a profile
  // is opened, and the selections have to still be there on the way back.
  const { filters, setFilters, clearFilters } = useDiscoveryFilters();

  const [openSheet, setOpenSheet] = useState<QuickSearchTarget | null>(null);
  /** Dismissed this session — filtered out locally so the list doesn't re-scan. */
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  const discovery = useDiscovery({
    currentUser,
    connectionMap,
    connectionsLoaded,
    connectionsRevision,
    blockedUserIds,
    filters,
  });

  const { connect, busyIds } = useConnectAction();

  /**
   * The pipeline already drops blocked ids, but it hands back the last completed
   * run while it re-scans — so anyone dismissed since would reappear for a beat
   * on the way back from a profile. Screening both lists here closes that.
   */
  const sections = useMemo(() => {
    if (hiddenIds.length === 0 && blockedUserIds.length === 0)
      return discovery.sections;
    const hidden = new Set([...hiddenIds, ...blockedUserIds]);
    return {
      recommended: discovery.sections.recommended.filter((id) => !hidden.has(id)),
      more: discovery.sections.more.filter((id) => !hidden.has(id)),
    };
  }, [discovery.sections, hiddenIds, blockedUserIds]);

  const total = sections.recommended.length + sections.more.length;

  const hideBuddy = useCallback(
    async (profile: { id: string; name?: string | null }) => {
      if (!userId) return;
      // Hide immediately; the write is what makes it stick across sessions.
      setHiddenIds((prev) => [...prev, profile.id]);
      addBlockedUser(profile.id);
      try {
        await hideUserFromDiscovery({
          currentUserId: userId,
          hiddenUserId: profile.id,
        });
      } catch (err) {
        console.error("[buddies] hide failed:", err);
        toast.error(t("app.buddies.hideError"));
        setHiddenIds((prev) => prev.filter((id) => id !== profile.id));
      }
    },
    [userId, addBlockedUser],
  );

  const applyFilters = useCallback(
    (next: FilterValues) => {
      setFilters(next);
      setOpenSheet(null);
    },
    [setFilters],
  );

  const filtersActive = hasAnyFilter(filters);
  const resultCountKey = filtersActive
    ? total === 1
      ? ("app.buddies.countMatchingOne" as const)
      : ("app.buddies.countMatching" as const)
    : total === 1
      ? ("app.buddies.countPerson" as const)
      : ("app.buddies.countPeople" as const);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  // Hand the current ordering to the profile page so it can offer Prev / Next.
  useEffect(() => {
    setDiscoveryOrder([...sections.recommended, ...sections.more]);
  }, [sections]);

  if (status === "error") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center">
        <h1 className="font-heading text-[20px] font-bold text-cb-black">
          {t("app.buddies.loadError")}
        </h1>
        <p className="font-body text-[14.5px] text-cb-gray-500">
          {t("app.buddies.loadErrorSub")}
        </p>
        <Button onClick={retry}>{t("app.buddies.tryAgain")}</Button>
      </div>
    );
  }

  const showEmptyState = !discovery.loading && !discovery.error && total === 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="font-heading text-[26px] font-bold leading-tight tracking-tight text-cb-black sm:text-[32px]">
          {t("app.buddies.heading")}
        </h1>
        <p className="mt-1.5 font-body text-[14.5px] text-cb-gray-500">
          {t("app.buddies.sub")}
        </p>
      </header>

      <div className="space-y-6">
        <RequestsSection />

        <section aria-labelledby="quick-search-heading" className="space-y-3">
          <h2
            id="quick-search-heading"
            className="font-heading text-[12px] font-bold uppercase tracking-[0.14em] text-cb-gray-500"
          >
            {t("app.buddies.quickSearch")}
          </h2>
          <QuickSearchBar filters={filters} onOpen={setOpenSheet} />
          <FilterChipsRow
            filters={filters}
            onChange={setFilters}
            onClearAll={clearFilters}
          />
        </section>

        <section aria-labelledby="results-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="results-heading" className="sr-only">
              {t("app.buddies.results")}
            </h2>
            <p
              aria-live="polite"
              className="font-body text-[13px] text-cb-gray-500"
            >
              {discovery.loading
                ? t("app.buddies.finding")
                : discovery.error
                  ? ""
                  : t(resultCountKey, { count: total.toLocaleString() })}
            </p>
            <button
              type="button"
              onClick={discovery.refresh}
              disabled={discovery.loading || discovery.refreshing}
              className="flex items-center gap-1.5 rounded-full border border-cb-gray-200 px-3 py-1.5 font-body text-[12.5px] font-semibold text-cb-gray-600 transition-colors hover:border-cb-black hover:text-cb-black disabled:opacity-50"
            >
              <RefreshIcon
                className={discovery.refreshing ? "animate-spin" : undefined}
              />
              {t("app.buddies.refresh")}
            </button>
          </div>

          {discovery.error ? (
            <div className="rounded-2xl border border-cb-danger/30 bg-cb-danger/10 px-5 py-6 text-center">
              <p className="font-body text-[14px] text-cb-black">
                {discovery.error}
              </p>
              <div className="mt-3">
                <Button size="sm" variant="secondary" onClick={discovery.refresh}>
                  {t("app.buddies.tryAgain")}
                </Button>
              </div>
            </div>
          ) : discovery.loading ? (
            <GridSkeleton />
          ) : showEmptyState ? (
            <DiscoveryEmptyState
              hasFilters={filtersActive}
              onClearFilters={clearFilters}
            />
          ) : (
            <div className={discovery.refreshing ? "opacity-60 transition-opacity" : undefined}>
              {/* Keyed on the filters so a new search starts from the top. */}
              <BuddyGrid
                key={filtersKey}
                sections={sections}
                viewer={currentUser}
                connectionMap={connectionMap}
                busyIds={busyIds}
                onConnect={(profile) =>
                  void connect({ id: profile.id, name: profile.name })
                }
                onHide={(profile) => void hideBuddy(profile)}
              />
            </div>
          )}
        </section>
      </div>

      {/* Mounted only while open so each sheet's draft starts from live state. */}
      {openSheet === "diagnosis" && (
        <DiagnosisSheet
          filters={filters}
          onApply={applyFilters}
          onClose={() => setOpenSheet(null)}
        />
      )}
      {openSheet === "location" && (
        <LocationSheet
          filters={filters}
          onApply={applyFilters}
          onClose={() => setOpenSheet(null)}
        />
      )}
      {openSheet === "custom" && (
        <CustomFilterSheet
          filters={filters}
          currentUser={currentUser}
          onApply={applyFilters}
          onClose={() => setOpenSheet(null)}
        />
      )}
      {openSheet === "buddyId" && (
        <BuddyIdSheet
          currentUser={currentUser}
          onClose={() => setOpenSheet(null)}
        />
      )}
    </div>
  );
}
