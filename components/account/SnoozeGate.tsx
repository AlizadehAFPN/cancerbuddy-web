"use client";

/**
 * What a snoozed member sees instead of the app.
 *
 * Snooze hides the account from discovery and freezes its conversations, so a
 * snoozed member browsing a feed is looking at a product that is quietly not
 * working for them. Mobile replaces seven navigators with this state
 * (Buddies, Groups, Feeds, Updates, Profile, RequestBuddies, Streaming); web
 * behaved as though nothing had happened — including for someone who snoozed on
 * their phone and then opened a browser.
 *
 * **Chat is deliberately not gated.** Mobile does not gate its chat stack: the
 * conversations are frozen, not hidden, and a member should still be able to
 * read what was said before they went quiet. Settings is not gated either — it
 * is where the way out lives.
 */

import { usePathname } from "next/navigation";
import Link from "next/link";

import { t } from "@/lib/i18n";
import { useAccount } from "@/lib/account/AccountProvider";

/** Routes that keep working while snoozed. Everything else is replaced. */
const UNGATED_PREFIXES = ["/chat", "/settings", "/support", "/privacy", "/terms", "/child-safety"];

export function isGatedRoute(pathname: string): boolean {
  return !UNGATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function BellOffIcon() {
  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.9 17.9 0 0 1 18 8" />
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export default function SnoozeGate({ children }: { children: React.ReactNode }) {
  const { isSnooze, loaded } = useAccount();
  const pathname = usePathname();

  // Never gate on a guess: until the account has been read, show the app.
  if (!loaded || !isSnooze || !isGatedRoute(pathname)) return <>{children}</>;

  return (
    <div
      data-testid="snooze-empty"
      className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-cb-gray-100 text-cb-gray-600">
        <BellOffIcon />
      </span>
      <h1 className="font-heading text-[20px] font-bold text-cb-black">
        {t("app.settings.snoozeEmptyTitle")}
      </h1>
      <p className="font-body text-[14.5px] leading-relaxed text-cb-gray-600">
        {t("app.settings.snoozeEmptyBody")}
      </p>
      <Link
        href="/settings"
        className="mt-2 flex h-12 items-center justify-center rounded-full border-2 border-cb-black bg-cb-black px-6 font-heading text-[15px] font-bold text-white transition-colors hover:bg-cb-gray-800"
      >
        {t("app.settings.snoozeTurnOff")}
      </Link>
    </div>
  );
}
