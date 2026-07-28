"use client";

/**
 * The quick-search row: Diagnosis, Location, Custom and Buddy ID.
 *
 * Same four entry points as the mobile app (minus QR, which needs a camera),
 * with the same badge counts so a user switching devices sees the same numbers.
 * On desktop the buttons get labels and breathing room; on phones they collapse
 * to the compact icon+caption tiles mobile uses.
 */

import { useMemo } from "react";
import { t } from "@/lib/i18n";
import {
  IdCardIcon,
  MapPinIcon,
  NoteIcon,
  SlidersIcon,
} from "@/components/buddies/controls";
import type { FilterKey, FilterValues } from "@/lib/buddies/types";

export type QuickSearchTarget = "diagnosis" | "location" | "custom" | "buddyId";

/** Everything the Custom panel owns — i.e. not surfaced by its own button. */
const CUSTOM_KEYS: readonly FilterKey[] = [
  "status",
  "ageRangeMin",
  "ageRangeMax",
  "ageRangeMinPatient",
  "ageRangeMaxPatient",
  "userPronounId",
  "userTransgenderId",
  "userSexualOrientationId",
  "userEthnicitiesId",
  "languages",
  "userWorkplaceId",
  "relationshipPatient",
  "userTreatmentStatusId",
  "treatments",
  "inRemissionSince",
  "desabilities",
  "hospitals",
  "supportOrganizations",
  "cancerloss",
  "userCopingwithcancerlossId",
  "CurrentlyInCollege",
  "userCollegeId",
];

function countIds(value: string): number {
  return value.split(",").filter((v) => v.trim() !== "").length;
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cb-black px-1 font-body text-[11px] font-bold leading-none text-white"
      aria-hidden
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function QuickButton({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
}) {
  const badgeCount = count ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        badgeCount > 0
          ? t("app.buddies.filterWithCount", { label, count: badgeCount })
          : label
      }
      className={[
        "group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3",
        "border-[1.5px] transition-all sm:flex-row sm:gap-2.5 sm:px-4 sm:py-3",
        active || badgeCount > 0
          ? "border-cb-black bg-cb-yellow/25 shadow-[0_1px_0_rgba(36,36,36,0.06)]"
          : "border-cb-gray-200 bg-white hover:border-cb-black hover:bg-cb-gray-100/60",
      ].join(" ")}
    >
      <span className="relative shrink-0 text-cb-black">
        {icon}
        <Badge count={badgeCount} />
      </span>
      <span className="truncate font-body text-[10.5px] font-bold uppercase tracking-[0.1em] text-cb-black sm:text-[12px] sm:tracking-[0.06em]">
        {label}
      </span>
    </button>
  );
}

export default function QuickSearchBar({
  filters,
  onOpen,
}: {
  filters: FilterValues;
  onOpen: (target: QuickSearchTarget) => void;
}) {
  const diagnosisCount = useMemo(
    () => countIds(filters.diagnosis),
    [filters.diagnosis],
  );

  const locationCount = useMemo(
    () =>
      (filters.userStateId.trim() ? 1 : 0) + (filters.userCityId.trim() ? 1 : 0),
    [filters.userCityId, filters.userStateId],
  );

  const customCount = useMemo(
    () => CUSTOM_KEYS.reduce((n, key) => n + countIds(filters[key]), 0),
    [filters],
  );

  return (
    <div className="flex items-stretch gap-2 sm:gap-3">
      <QuickButton
        icon={<NoteIcon />}
        label={t("app.buddies.filterDiagnosis")}
        count={diagnosisCount}
        onClick={() => onOpen("diagnosis")}
      />
      <QuickButton
        icon={<MapPinIcon />}
        label={t("app.buddies.filterLocation")}
        count={locationCount}
        onClick={() => onOpen("location")}
      />
      <QuickButton
        icon={<SlidersIcon />}
        label={t("app.buddies.filterCustom")}
        count={customCount}
        onClick={() => onOpen("custom")}
      />
      <span
        aria-hidden
        className="my-1 w-px shrink-0 self-stretch bg-cb-gray-200"
      />
      <QuickButton
        icon={<IdCardIcon />}
        label={t("app.buddies.filterBuddyId")}
        onClick={() => onOpen("buddyId")}
      />
    </div>
  );
}
