"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { t } from "@/lib/i18n";
import { PRIMARY_NAV, HOME_HREF } from "@/lib/navigation/appNav";
import { isActivePath, type NavBadges } from "./navState";

/**
 * Desktop / tablet primary navigation (≥ lg). Hidden on mobile, where the
 * BottomBar takes over. The footer button opens the account menu (the web
 * equivalent of the mobile hamburger drawer).
 */
export default function Sidebar({
  badges,
  onOpenMenu,
}: {
  badges: NavBadges;
  onOpenMenu: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-cb-gray-200 bg-white">
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center px-6">
        <Link href={HOME_HREF} aria-label={t("common.cancerBuddyHome")}>
          <Image
            src="/images/trademark-logo.png"
            alt={t("common.cancerBuddyAlt")}
            width={170}
            height={23}
            className="object-contain"
            priority
          />
        </Link>
      </div>

      {/* Primary destinations */}
      <nav
        aria-label={t("app.nav.primaryLabel")}
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2"
      >
        {PRIMARY_NAV.map(({ href, labelKey, Icon, badge }) => {
          const active = isActivePath(pathname, href);
          const count = badge ? badges[badge] ?? 0 : 0;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={[
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5",
                "font-heading text-[0.95rem] transition-colors",
                active
                  ? "bg-cb-yellow text-cb-black font-semibold"
                  : "text-cb-gray-700 hover:bg-cb-gray-100",
              ].join(" ")}
            >
              <span className="relative shrink-0">
                <Icon
                  className="h-6 w-6"
                  strokeWidth={active ? 2.4 : 2}
                />
                {count > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              <span className="truncate">{t(labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      {/* Account / resources menu trigger */}
      <div className="shrink-0 border-t border-cb-gray-200 p-3">
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-heading text-[0.95rem] text-cb-gray-700 transition-colors hover:bg-cb-gray-100"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cb-gray-100">
            <Menu className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="truncate">{t("app.nav.more")}</span>
        </button>
      </div>
    </aside>
  );
}
