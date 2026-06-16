"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";

function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className="h-6 w-6"
      aria-hidden
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className="h-6 w-6"
      aria-hidden
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

const LINKS: { href: string; labelKey: Parameters<typeof t>[0] }[] = [
  { href: "/login", labelKey: "common.signIn" },
  { href: "/register", labelKey: "common.getStarted" },
  { href: "/support", labelKey: "common.support" },
  { href: "/privacy", labelKey: "common.privacy" },
  { href: "/terms", labelKey: "common.terms" },
];

export default function MobileMenu() {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the overlay menu is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="shrink-0 rounded-lg p-2 text-cb-black transition-colors hover:bg-black/5"
        aria-label={open ? t("common.closeMenu") : t("common.openMenu")}
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {open ? (
        <>
          {/* Backdrop */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-14 z-40 bg-black/20"
          />
          {/* Panel */}
          <nav
            id="mobile-menu-panel"
            aria-label={t("common.mainNavigation")}
            className="fixed inset-x-0 top-14 z-50 border-b border-cb-gray-200 bg-white shadow-lg"
          >
            <ul className="flex flex-col px-6 py-2">
              {LINKS.map(({ href, labelKey }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-2 py-3 font-body text-base font-medium text-cb-black transition-colors hover:bg-cb-gray-100"
                  >
                    {t(labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      ) : null}
    </div>
  );
}
