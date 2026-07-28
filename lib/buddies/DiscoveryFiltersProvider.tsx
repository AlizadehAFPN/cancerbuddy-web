"use client";

/**
 * The discovery filter selections, held for the whole /buddies section.
 *
 * The list and a person's profile are two routes, so opening a profile unmounts
 * the list: filters kept in the list's own state were gone by the time the user
 * pressed Back. Mounted at the layout, they survive that trip — and only that
 * trip. Leaving /buddies entirely unmounts this and clears them, which is the
 * intent: these values spell out someone's diagnosis, location and treatment,
 * so they stay in memory and never reach the URL or storage.
 *
 * Kept apart from `BuddiesProvider` deliberately. Filters change on every tap
 * inside a sheet, and folding them into that context would re-render the
 * requests list and the profile screen along with them for nothing.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { EMPTY_FILTERS, type FilterValues } from "@/lib/buddies/types";

interface DiscoveryFiltersValue {
  filters: FilterValues;
  setFilters: Dispatch<SetStateAction<FilterValues>>;
  clearFilters: () => void;
}

const DiscoveryFiltersContext = createContext<DiscoveryFiltersValue | null>(
  null,
);

export function useDiscoveryFilters(): DiscoveryFiltersValue {
  const value = useContext(DiscoveryFiltersContext);
  if (!value) {
    throw new Error(
      "useDiscoveryFilters must be used inside DiscoveryFiltersProvider",
    );
  }
  return value;
}

export default function DiscoveryFiltersProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [filters, setFilters] = useState<FilterValues>(() => ({
    ...EMPTY_FILTERS,
  }));

  const clearFilters = useCallback(() => setFilters({ ...EMPTY_FILTERS }), []);

  const value = useMemo<DiscoveryFiltersValue>(
    () => ({ filters, setFilters, clearFilters }),
    [filters, clearFilters],
  );

  return (
    <DiscoveryFiltersContext.Provider value={value}>
      {children}
    </DiscoveryFiltersContext.Provider>
  );
}
