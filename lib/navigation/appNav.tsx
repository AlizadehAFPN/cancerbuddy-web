/**
 * Single source of truth for the authenticated app's navigation.
 *
 * Mirrors the mobile app (cancerbuddyapp):
 *  • PRIMARY_NAV  → the bottom-tab destinations (web: sidebar on desktop,
 *    bottom bar on mobile). Decoded from the mobile TabsNavigator by
 *    icon + screen, NOT the misleading enum values.
 *  • RESOURCE_LINKS + LOGOUT → the mobile hamburger "drawer" (web: the
 *    account menu at the bottom of the sidebar / a slide-in sheet on mobile).
 *
 * Badges are wired by key only; the counts are supplied at render time so this
 * file stays data-free (no fetching here).
 */

import type { ComponentType } from "react";
import {
  MessageCircle,
  LayoutGrid,
  Handshake,
  Bell,
  User,
  Leaf,
  Award,
  Share2,
  MessageCircleQuestion,
  Landmark,
  FileText,
  Settings,
  LogOut,
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n";

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

/** Keys for the count badges the nav can display. */
export type NavBadgeKey = "chat" | "buddies" | "notifications";

export interface PrimaryNavItem {
  href: string;
  labelKey: MessageKey;
  Icon: IconType;
  badge?: NavBadgeKey;
}

/** The home destination — matches the mobile app (Groups is the landing tab). */
export const HOME_HREF = "/groups";

/** External resources. */
export const BMCF_URL = "https://bonemarrow.org/";

export const PRIMARY_NAV: PrimaryNavItem[] = [
  { href: "/chat", labelKey: "app.nav.chat", Icon: MessageCircle, badge: "chat" },
  { href: "/groups", labelKey: "app.nav.groups", Icon: LayoutGrid },
  { href: "/buddies", labelKey: "app.nav.buddies", Icon: Handshake, badge: "buddies" },
  {
    href: "/notifications",
    labelKey: "app.nav.notifications",
    Icon: Bell,
    badge: "notifications",
  },
  { href: "/profile", labelKey: "app.nav.profile", Icon: User },
];

/**
 * The nav a given account type actually gets.
 *
 * Support accounts have no profile — mobile never mounts that tab for them, so
 * showing the entry here would lead to a page that immediately turns them away.
 * While the type is still unknown the full nav is returned; the profile route
 * guards itself either way.
 */
export function primaryNavFor(
  userType: string | null | undefined,
): PrimaryNavItem[] {
  if (userType === "SUPPORT") {
    return PRIMARY_NAV.filter((item) => item.href !== "/profile");
  }
  return PRIMARY_NAV;
}

export interface AccountLink {
  labelKey: MessageKey;
  subKey?: MessageKey;
  Icon: IconType;
  /** Internal route or external URL. Omitted for action-only items. */
  href?: string;
  external?: boolean;
  /** Non-navigation behaviours handled by the menu component. */
  action?: "share" | "logout";
}

/** Mirror of the mobile drawer's resource list (account menu on web). */
export const RESOURCE_LINKS: AccountLink[] = [
  {
    labelKey: "app.account.bmcf",
    subKey: "app.account.bmcfSub",
    Icon: Leaf,
    href: BMCF_URL,
    external: true,
  },
  {
    labelKey: "app.account.partners",
    subKey: "app.account.partnersSub",
    Icon: Award,
    href: "/partners",
  },
  {
    labelKey: "app.account.share",
    subKey: "app.account.shareSub",
    Icon: Share2,
    action: "share",
  },
  {
    labelKey: "app.account.support",
    subKey: "app.account.supportSub",
    Icon: MessageCircleQuestion,
    href: "/support",
  },
  {
    labelKey: "app.account.funders",
    subKey: "app.account.fundersSub",
    Icon: Landmark,
    href: "/funders",
  },
  { labelKey: "app.account.legal", Icon: FileText, href: "/privacy" },
  { labelKey: "app.account.settings", Icon: Settings, href: "/settings" },
];

/**
 * The account menu a given account type gets.
 *
 * Settings is member-only. Everything behind it — snooze, change status, delete
 * account — is meaningless or actively wrong for a **host** account: a host has
 * no discovery presence to snooze, no patient/survivor/caregiver status to
 * change, and their account is provisioned by the foundation rather than owned
 * by them. Mobile never mounts the settings stack for one
 * (`HamburgerMenu.tsx` gates the row on `userType !== HOST`), and web offered it
 * to everybody.
 *
 * An unknown type is treated as a host would be: the surface is withheld until
 * we know it is safe to show, and `/settings` guards itself as well.
 */
export function resourceLinksFor(
  userType: string | null | undefined,
): AccountLink[] {
  const memberTypes = ["PATIENT", "SURVIVOR", "CAREGIVER"];
  if (userType && memberTypes.includes(userType)) return RESOURCE_LINKS;
  return RESOURCE_LINKS.filter((item) => item.href !== "/settings");
}

export const LOGOUT_LINK: AccountLink = {
  labelKey: "app.account.logout",
  Icon: LogOut,
  action: "logout",
};
