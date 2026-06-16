"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { t } from "@/lib/i18n";
import { PRIMARY_NAV } from "@/lib/navigation/appNav";
import { isActivePath, type NavBadges } from "./navState";

/**
 * Mobile primary navigation (< lg) — the familiar bottom tab bar, mirroring
 * the phone app. The trailing "More" button opens the account menu sheet (the
 * web equivalent of the mobile hamburger drawer).
 */
export default function BottomBar({
  badges,
  onOpenMenu,
}: {
  badges: NavBadges;
  onOpenMenu: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("app.nav.primaryLabel")}
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-cb-gray-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {PRIMARY_NAV.map(({ href, labelKey, Icon, badge }) => {
        const active = isActivePath(pathname, href);
        const count = badge ? badges[badge] ?? 0 : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 px-1"
          >
            <span className="relative">
              <Icon
                className={active ? "h-6 w-6 text-cb-black" : "h-6 w-6 text-cb-gray-500"}
                strokeWidth={active ? 2.4 : 2}
              />
              {count > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </span>
            <span
              className={[
                "max-w-full truncate text-[10px] font-medium",
                active ? "text-cb-black" : "text-cb-gray-500",
              ].join(" ")}
            >
              {t(labelKey)}
            </span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={onOpenMenu}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-cb-gray-500"
      >
        <Menu className="h-6 w-6" strokeWidth={2} />
        <span className="text-[10px] font-medium">{t("app.nav.more")}</span>
      </button>
    </nav>
  );
}
