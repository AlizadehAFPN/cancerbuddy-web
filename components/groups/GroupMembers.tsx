"use client";

/**
 * `/groups/[groupId]/members` — who else is in the group.
 *
 * Shaped after mobile's `ActiveUsersListGroups`: the group identifies the
 * screen at the top, then a "MEMBERS" caption with the total, then one plain
 * divided list. Mobile separates rows with hairlines rather than cards, so the
 * list here is a single card with dividers instead of a stack of bordered rows.
 *
 * Each row carries the member's role tag, which is the one place in the Groups
 * area mobile shows it (posts and comments deliberately don't). Tapping splits
 * the same way it does on the phone: hosts open the host page, everyone else
 * their buddy profile.
 *
 * Paged with an intersection observer rather than a "load more" button — the
 * list is long in an active group and scrolling is the natural gesture.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { ArrowLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import BuddyAvatar from "@/components/buddies/BuddyAvatar";
import GroupAvatar from "@/components/groups/GroupAvatar";
import {
  ROLE_BADGE_CLASS,
  ROLE_LABELS,
  formatLocation,
  formatName,
} from "@/lib/buddies/display";
import { ageSuffix } from "@/lib/buddies/age";
import { useGroups } from "@/lib/groups/GroupsProvider";
import { fetchGroupMembers, type GroupMember } from "@/lib/groups/members";
import {
  fetchGroupById,
  fetchGroupMemberCount,
} from "@/lib/groups/groupQueries";
import type { Group } from "@/lib/groups/types";

const BADGE_CLASS =
  "shrink-0 rounded-full px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-[0.06em]";

function MemberRow({ member }: { member: GroupMember }) {
  // Hosts get their own page; everyone else opens as a buddy profile.
  const href = member.groupHostId
    ? `/groups/hosts/${member.id}`
    : `/buddies/${member.id}`;

  const displayName = `${formatName(
    member.name,
    member.userType ?? undefined,
  )}${ageSuffix(member.userType ?? "", member.birth)}`;

  const location = formatLocation(member.city, member.stateAbbreviation);
  const role = member.userType ? ROLE_LABELS[member.userType] : undefined;

  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-cb-gray-100/60"
      >
        <BuddyAvatar
          name={member.name}
          photoUrl={member.profilePicUrl}
          goalUrl={member.goalImageUrl}
          size={48}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-heading text-[15px] font-bold leading-tight text-cb-black">
              {displayName}
            </span>
            {/* Hosts show the host tag instead of a role — the same rule the
                rest of the app follows. */}
            {member.groupHostId ? (
              <span className={`${BADGE_CLASS} bg-cb-green text-cb-black`}>
                {t("app.groups.host")}
              </span>
            ) : (
              role && (
                <span
                  className={[
                    BADGE_CLASS,
                    ROLE_BADGE_CLASS[member.userType!] ??
                      "bg-cb-gray-200 text-cb-black",
                  ].join(" ")}
                >
                  {role}
                </span>
              )
            )}
            {member.ambassador && (
              <span className={`${BADGE_CLASS} bg-cb-bone text-cb-black`}>
                {t("app.buddies.ambassador")}
              </span>
            )}
          </div>
          {location && (
            <span className="mt-0.5 block truncate font-body text-[12.5px] text-cb-gray-500">
              {location}
            </span>
          )}
        </div>
        <ChevronRightIcon
          size={18}
          className="shrink-0 text-cb-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-cb-gray-500"
        />
      </Link>
    </li>
  );
}

/**
 * Placeholder rows — the first load and the paging sentinel share them, so the
 * next page fades in where it will actually appear. `firstRef` marks the row
 * the observer watches.
 */
function SkeletonRows({
  count,
  firstRef,
}: {
  count: number;
  firstRef?: React.Ref<HTMLLIElement>;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          ref={i === 0 ? firstRef : undefined}
          aria-hidden
          className="flex items-center gap-3.5 px-4 py-3.5"
        >
          <div className="h-12 w-12 animate-pulse rounded-full bg-cb-gray-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 animate-pulse rounded bg-cb-gray-100" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-cb-gray-100" />
          </div>
        </li>
      ))}
    </>
  );
}

export default function GroupMembers({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { joinedGroups } = useGroups();

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [token, setToken] = useState<string | undefined>();
  /** Only needed for groups the user hasn't joined — the rest come from context. */
  const [fetchedGroup, setFetchedGroup] = useState<Group | null>(null);
  /** Tagged with its group so a stale total never labels a different list. */
  const [totalFor, setTotalFor] = useState<{ id: string; count: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);

  const sentinelRef = useRef<HTMLLIElement>(null);
  const mountedRef = useRef(true);
  const seenRef = useRef(new Set<string>());
  /** Bumped on every reset so a stale page can't append to a fresh list. */
  const runRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const joinedGroup = joinedGroups.find((g) => g.id === groupId) ?? null;
  const group =
    joinedGroup ?? (fetchedGroup?.id === groupId ? fetchedGroup : null);

  useEffect(() => {
    if (group) return;
    fetchGroupById(groupId)
      .then((g) => mountedRef.current && g && setFetchedGroup(g))
      .catch(() => {});
  }, [groupId, group]);

  // The same total the group info sheet shows, so the two never disagree.
  useEffect(() => {
    fetchGroupMemberCount(groupId)
      .then(
        (count) =>
          mountedRef.current && count > 0 && setTotalFor({ id: groupId, count }),
      )
      .catch(() => {});
  }, [groupId]);

  const loadPage = useCallback(
    async (pageToken?: string) => {
      const run = runRef.current;
      try {
        const result = await fetchGroupMembers({ groupId, token: pageToken });
        if (!mountedRef.current || run !== runRef.current) return;

        // AppSync can hand back a row twice — both across page tokens when
        // membership changes mid-scroll, and within a single page. Filtering
        // against a set that grows as we go covers both, and keeps the React
        // keys below unique.
        const fresh: GroupMember[] = [];
        for (const member of result.members) {
          if (!member.id || seenRef.current.has(member.id)) continue;
          seenRef.current.add(member.id);
          fresh.push(member);
        }

        setMembers((prev) => [...prev, ...fresh]);
        setToken(result.nextToken);
        if (!result.nextToken) setDone(true);
        setError(false);
      } catch (err) {
        console.error("[groups] members load failed:", err);
        if (mountedRef.current && run === runRef.current) setError(true);
      } finally {
        if (mountedRef.current && run === runRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [groupId],
  );

  useEffect(() => {
    runRef.current += 1;
    seenRef.current = new Set();
    setMembers([]);
    setToken(undefined);
    setDone(false);
    setLoading(true);
    void loadPage(undefined);
  }, [loadPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || done || loading || loadingMore || !token) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLoadingMore(true);
          void loadPage(token);
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [token, done, loading, loadingMore, loadPage]);

  // Falls back to what's loaded once paging is finished, so the caption still
  // has a number if the totals query came back empty.
  const total = totalFor?.id === groupId ? totalFor.count : null;
  const memberTotal = total ?? (done ? members.length : null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-cb-gray-200 px-4 py-3">
        <button
          type="button"
          onClick={() => router.push(`/groups/${groupId}`)}
          aria-label={t("app.groups.back")}
          className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-cb-gray-600 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
        >
          <ArrowLeftIcon />
        </button>

        {group && (
          <GroupAvatar
            name={group.name}
            imageUrl={group.profilePicUrl}
            verified={group.verified}
            size={40}
          />
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-[16px] font-bold text-cb-black">
            {t("app.groups.members")}
          </h1>
          {group?.name && (
            <p className="truncate font-body text-[12.5px] text-cb-gray-500">
              {group.name}
            </p>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
          <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
            <h2 className="font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-cb-gray-500">
              {t("app.groups.members")}
            </h2>
            {memberTotal !== null ? (
              <span className="shrink-0 rounded-full bg-cb-gray-100 px-2.5 py-1 font-body text-[11.5px] font-bold text-cb-black">
                {t(
                  memberTotal === 1
                    ? "app.groups.memberCountOne"
                    : "app.groups.memberCount",
                  { count: memberTotal },
                )}
              </span>
            ) : (
              // Only a placeholder while the first page is in flight — if the
              // totals query failed outright, the caption stands on its own
              // rather than pulsing forever.
              loading && (
                <span
                  aria-hidden
                  className="h-[22px] w-20 shrink-0 animate-pulse rounded-full bg-cb-gray-100"
                />
              )
            )}
          </div>

          {error && members.length === 0 ? (
            <div className="rounded-2xl border border-cb-danger/30 bg-cb-danger/10 px-5 py-6 text-center">
              <p className="font-body text-[14px] text-cb-black">
                {t("app.groups.membersError")}
              </p>
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void loadPage()}
                >
                  {t("app.groups.retry")}
                </Button>
              </div>
            </div>
          ) : !loading && members.length === 0 ? (
            <p className="rounded-2xl border border-cb-gray-200 bg-white py-16 text-center font-body text-[14.5px] text-cb-gray-500">
              {t("app.groups.membersEmpty")}
            </p>
          ) : (
            <ul className="divide-y divide-cb-gray-100 overflow-hidden rounded-2xl border border-cb-gray-200 bg-white shadow-[0_2px_16px_-12px_rgba(36,36,36,0.35)]">
              {loading ? (
                <SkeletonRows count={8} />
              ) : (
                <>
                  {members.map((member) => (
                    <MemberRow key={member.id} member={member} />
                  ))}
                  {!done && <SkeletonRows count={2} firstRef={sentinelRef} />}
                </>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
