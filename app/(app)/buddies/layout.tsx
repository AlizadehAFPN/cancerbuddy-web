"use client";

import BuddiesProvider from "@/lib/buddies/BuddiesProvider";
import DiscoveryFiltersProvider from "@/lib/buddies/DiscoveryFiltersProvider";

/**
 * Everything under /buddies shares one provider: the viewer's own profile, the
 * connection map and the blocked list are read by the discovery list *and* the
 * profile page, and actions on one must be reflected in the other. Keeping the
 * provider at the layout means navigating between them doesn't refetch it.
 *
 * The filter selections sit here for the same reason — the layout is what stays
 * mounted while the user opens a profile and comes back.
 */
export default function BuddiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BuddiesProvider>
      <DiscoveryFiltersProvider>{children}</DiscoveryFiltersProvider>
    </BuddiesProvider>
  );
}
