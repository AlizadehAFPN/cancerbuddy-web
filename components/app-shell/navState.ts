import type { NavBadgeKey } from "@/lib/navigation/appNav";

/** A nav item is active when the path equals it or is nested under it. */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Live counts for the nav badges. Wire these to real data (Stream unread,
 * pending connections, notifications) later; empty for now so no fake badges.
 */
export type NavBadges = Partial<Record<NavBadgeKey, number>>;
