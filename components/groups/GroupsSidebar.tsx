"use client";

/**
 * Left pane: search, the two standing destinations, and the user's groups.
 *
 * Mobile puts "Groups" and "Live group calendar" behind a tab switcher because
 * only one can fit. Here they're both permanent rows above the list, so the
 * calendar is one click from any group instead of a mode you switch into — and
 * "Discover" joins them rather than hiding behind an empty state.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import { SearchIcon, XIcon } from "@/components/ui/icons";
import GroupAvatar from "@/components/groups/GroupAvatar";
import { useGroups } from "@/lib/groups/GroupsProvider";
import { useGroupHasUnread } from "@/lib/groups/useUnreadGroups";
import type { Group } from "@/lib/groups/types";

/** Matches a group on the same fields mobile's group search does. */
function matchesQuery(group: Group, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    group.name.toLowerCase().includes(q) ||
    (group.description ?? "").toLowerCase().includes(q) ||
    (group.sponsor?.name ?? "").toLowerCase().includes(q)
  );
}

function MutedIcon() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
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

function GroupRow({
  group,
  live,
  active,
}: {
  group: Group;
  live: boolean;
  active: boolean;
}) {
  /**
   * `NEW` when a pushed post for this group has not been opened yet — mobile
   * badges the same row from the same signal (`GroupsList.tsx:81-84`). Opening
   * the group clears it.
   */
  const unread = useGroupHasUnread(group.id);

  return (
    <Link
      href={`/groups/${group.id}`}
      aria-current={active ? "page" : undefined}
      className={[
        "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
        active ? "bg-cb-gray-100" : "hover:bg-cb-gray-100/70",
      ].join(" ")}
    >
      <GroupAvatar
        name={group.name}
        imageUrl={group.profilePicUrl}
        verified={group.verified}
        size={44}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-heading text-[0.95rem] font-semibold text-cb-black">
            {group.name}
          </span>
          {live && (
            <span className="shrink-0 rounded-full bg-cb-danger px-1.5 py-0.5 font-body text-[9.5px] font-bold uppercase tracking-wide text-white">
              {t("app.groups.live")}
            </span>
          )}
          {group.muted && (
            <span
              className="shrink-0 text-cb-gray-400"
              title={t("app.groups.muted")}
              aria-label={t("app.groups.muted")}
            >
              <MutedIcon />
            </span>
          )}
          {unread && (
            <span
              aria-label={t("app.groups.newPostsLabel", { name: group.name })}
              className="ml-auto shrink-0 rounded-full bg-cb-yellow px-1.5 py-0.5 font-body text-[9.5px] font-bold uppercase tracking-wide text-cb-black"
            >
              {t("app.groups.newPosts")}
            </span>
          )}
        </div>
        {group.sponsor?.name && (
          <span className="block truncate font-body text-[12.5px] text-cb-gray-500">
            {t("app.groups.hostedBy", { sponsor: group.sponsor.name })}
          </span>
        )}
      </div>
    </Link>
  );
}

function StandingRow({
  href,
  label,
  icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
        active ? "bg-cb-yellow/30" : "hover:bg-cb-gray-100/70",
      ].join(" ")}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-[1.5px] border-cb-gray-200 bg-white text-cb-black">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate font-heading text-[0.95rem] font-semibold text-cb-black">
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="shrink-0 rounded-full bg-cb-black px-2 py-0.5 font-body text-[11px] font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function GroupsSidebar() {
  const pathname = usePathname();
  const { joinedGroups, liveGroupIds, status } = useGroups();
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => joinedGroups.filter((g) => matchesQuery(g, query)),
    [joinedGroups, query],
  );

  const liveGroups = useMemo(
    () => filtered.filter((g) => liveGroupIds.has(g.id)),
    [filtered, liveGroupIds],
  );
  const restGroups = useMemo(
    () => filtered.filter((g) => !liveGroupIds.has(g.id)),
    [filtered, liveGroupIds],
  );

  const liveCount = useMemo(
    () => joinedGroups.filter((g) => liveGroupIds.has(g.id)).length,
    [joinedGroups, liveGroupIds],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pb-3 pt-4">
        <h1 className="mb-3 font-heading text-[20px] font-bold tracking-tight text-cb-black">
          {t("app.groups.heading")}
        </h1>

        <div className="flex items-center gap-2.5 rounded-xl border border-cb-gray-200 bg-cb-gray-100/70 px-3.5 py-2.5 transition-all focus-within:border-cb-black focus-within:bg-white">
          <span className="shrink-0 text-cb-gray-400">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("app.groups.search")}
            className="min-w-0 flex-1 bg-transparent font-body text-[14.5px] text-cb-black outline-none placeholder:text-cb-gray-400"
          />
          {query && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setQuery("");
              }}
              aria-label={t("app.buddies.clearSearch")}
              className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-cb-gray-400 text-white transition-colors hover:bg-cb-gray-600"
            >
              <XIcon size={9} />
            </button>
          )}
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
        <div className="space-y-1">
          <StandingRow
            href="/groups/calendar"
            label={t("app.groups.tabCalendar")}
            active={pathname === "/groups/calendar"}
            badge={liveCount}
            icon={
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            }
          />
          <StandingRow
            href="/groups/discover"
            label={t("app.groups.exploreGroups")}
            active={pathname === "/groups/discover"}
            icon={
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
              </svg>
            }
          />
        </div>

        {status === "loading" ? (
          <div aria-hidden className="mt-4 space-y-2 px-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2">
                <div className="h-11 w-11 animate-pulse rounded-2xl bg-cb-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-2/3 animate-pulse rounded bg-cb-gray-100" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-cb-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : joinedGroups.length === 0 ? (
          <p className="mt-6 px-3 font-body text-[13.5px] leading-relaxed text-cb-gray-500">
            {t("app.groups.noGroupsTitle")}
          </p>
        ) : filtered.length === 0 ? (
          <p className="mt-6 px-3 font-body text-[13.5px] text-cb-gray-500">
            {t("app.groups.noSearchResults", { query })}
          </p>
        ) : (
          <>
            {liveGroups.length > 0 && (
              <section className="mt-4">
                <h2 className="px-3 pb-1.5 font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-cb-black">
                  {t("app.groups.yourLiveGroups")}
                </h2>
                <div className="space-y-0.5">
                  {liveGroups.map((group) => (
                    <GroupRow
                      key={group.id}
                      group={group}
                      live
                      active={pathname === `/groups/${group.id}`}
                    />
                  ))}
                </div>
              </section>
            )}

            {restGroups.length > 0 && (
              <section className="mt-4">
                <h2 className="px-3 pb-1.5 font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-cb-black">
                  {t("app.groups.yourGroups")}
                </h2>
                <div className="space-y-0.5">
                  {restGroups.map((group) => (
                    <GroupRow
                      key={group.id}
                      group={group}
                      live={false}
                      active={pathname === `/groups/${group.id}`}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </nav>
    </div>
  );
}
