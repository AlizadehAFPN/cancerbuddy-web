"use client";

/**
 * The row of active filters under the quick-search bar. Each chip removes
 * exactly the value it represents; "Clear all" resets everything.
 *
 * Chip labels for cities, colleges and workplaces have to be looked up by id,
 * so the row keeps showing the previous chips until the new set resolves —
 * flashing an empty row on every filter change reads as a bug.
 */

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { XIcon } from "@/components/buddies/controls";
import {
  buildFilterChips,
  removeChip,
  type FilterChip,
} from "@/lib/buddies/filterChips";
import { hasAnyFilter, type FilterValues } from "@/lib/buddies/types";

export default function FilterChipsRow({
  filters,
  onChange,
  onClearAll,
}: {
  filters: FilterValues;
  onChange: (next: FilterValues) => void;
  onClearAll: () => void;
}) {
  const [chips, setChips] = useState<FilterChip[]>([]);
  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;
    buildFilterChips(JSON.parse(filtersKey) as FilterValues).then((next) => {
      if (!cancelled) setChips(next);
    });
    return () => {
      cancelled = true;
    };
  }, [filtersKey]);

  if (!hasAnyFilter(filters) || chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.chipId}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-cb-black py-1.5 pl-3.5 pr-1.5 font-body text-[13px] font-medium text-white"
        >
          <span className="min-w-0 truncate">{chip.label}</span>
          <button
            type="button"
            onClick={() => onChange(removeChip(filters, chip))}
            aria-label={t("app.buddies.removeFilter", { label: chip.label })}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          >
            <XIcon size={12} />
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={onClearAll}
        className="rounded-full border border-cb-gray-300 px-3.5 py-1.5 font-body text-[13px] font-semibold text-cb-gray-600 transition-colors hover:border-cb-black hover:text-cb-black"
      >
        {t("app.buddies.clearAll")}
      </button>
    </div>
  );
}
