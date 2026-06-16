"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { t } from "@/lib/i18n";
import { signOut } from "@/lib/auth-client";
import { disconnectStream } from "@/lib/chat/streamClient";
import {
  RESOURCE_LINKS,
  LOGOUT_LINK,
  type AccountLink,
} from "@/lib/navigation/appNav";

/**
 * Account menu — the web equivalent of the mobile hamburger drawer. Resources,
 * support, settings, legal and log out. Slides in from the right on every
 * breakpoint; opened from the sidebar footer (desktop) or the "More" tab
 * (mobile).
 */
export default function AccountSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const handleShare = async () => {
    const url = window.location.origin;
    const data = { title: "CancerBuddy", url };
    try {
      if (navigator.share) {
        await navigator.share(data);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* user cancelled / unsupported — no-op */
    }
    onClose();
  };

  const handleLogout = async () => {
    onClose();
    await disconnectStream();
    await signOut();
    router.replace("/");
  };

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-cb-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("app.account.menuLabel")}
        className={`absolute right-0 top-0 flex h-dvh w-[min(88vw,22rem)] flex-col bg-white shadow-2xl transition-transform duration-250 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-cb-gray-200 px-5">
          <span className="font-heading text-base font-semibold text-cb-black">
            {t("app.account.menuLabel")}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("app.nav.closeMenu")}
            className="rounded-lg p-2 text-cb-black transition-colors hover:bg-cb-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-cb-gray-400">
            {t("app.account.resourcesHeading")}
          </p>
          <ul className="flex flex-col">
            {RESOURCE_LINKS.map((item) => (
              <li key={item.labelKey}>
                <AccountRow item={item} onClose={onClose} onShare={handleShare} />
              </li>
            ))}
          </ul>

          <div className="my-2 border-t border-cb-gray-200" />

          <AccountRow
            item={LOGOUT_LINK}
            onClose={onClose}
            onShare={handleShare}
            onLogout={handleLogout}
            danger
          />
        </div>
      </div>
    </div>
  );
}

function AccountRow({
  item,
  onClose,
  onShare,
  onLogout,
  danger,
}: {
  item: AccountLink;
  onClose: () => void;
  onShare: () => void;
  onLogout?: () => void;
  danger?: boolean;
}) {
  const { Icon } = item;

  const inner = (
    <>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          danger ? "bg-red-50 text-red-600" : "bg-cb-gray-100 text-cb-black"
        }`}
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span
          className={`block truncate font-heading text-[0.95rem] ${
            danger ? "text-red-600" : "text-cb-black"
          }`}
        >
          {t(item.labelKey)}
        </span>
        {item.subKey && (
          <span className="block truncate font-body text-xs text-cb-gray-500">
            {t(item.subKey)}
          </span>
        )}
      </span>
    </>
  );

  const rowClass =
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-cb-gray-100";

  // Action items (share / logout)
  if (item.action === "share") {
    return (
      <button type="button" onClick={onShare} className={rowClass}>
        {inner}
      </button>
    );
  }
  if (item.action === "logout") {
    return (
      <button type="button" onClick={onLogout} className={rowClass}>
        {inner}
      </button>
    );
  }

  // External link
  if (item.external && item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClose}
        className={rowClass}
      >
        {inner}
      </a>
    );
  }

  // Internal route
  return (
    <Link href={item.href ?? "#"} onClick={onClose} className={rowClass}>
      {inner}
    </Link>
  );
}
