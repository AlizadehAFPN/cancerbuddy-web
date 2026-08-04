"use client";

/**
 * `/groups/[groupId]/members` — who else is in the group.
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
import { ArrowLeftIcon } from "@/components/ui/icons";
import BuddyAvatar from "@/components/buddies/BuddyAvatar";
import {
  ROLE_BADGE_CLASS,
  ROLE_LABELS,
  formatLocation,
  formatName,
} from "@/lib/buddies/display";
import { ageSuffix } from "@/lib/buddies/age";
import { useGroups } from "@/lib/groups/GroupsProvider";
import { fetchGroupMembers, type GroupMember } from "@/lib/groups/members";
import { fetchGroupById } from "@/lib/groups/groupQueries";

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
        className="flex items-center gap-3 rounded-2xl border border-cb-gray-200 bg-white p-3.5 transition-shadow hover:shadow-[0_6px_24px_-10px_rgba(36,36,36,0.2)]"
      >
        <BuddyAvatar
          name={member.name}
          photoUrl={member.profilePicUrl}
          goalUrl={member.goalImageUrl}
          size={48}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-heading text-[15px] font-bold leading-tight text-cb-black">
              {displayName}
            </span>
            {/* Hosts show the host tag instead of a role — the same rule the
                rest of the app follows. */}
            {member.groupHostId ? (
              <span className="rounded-full bg-cb-green px-2 py-0.5 font-body text-[10.5px] font-bold uppercase tracking-wide text-cb-black">
                {t("app.groups.host")}
              </span>
            ) : (
              role && (
                <span
                  className={[
                    "rounded-full px-2 py-0.5 font-body text-[10.5px] font-bold",
                    ROLE_BADGE_CLASS[member.userType!] ??
                      "bg-cb-gray-200 text-cb-black",
                  ].join(" ")}
                >
                  {role}
                </span>
              )
            )}
            {member.ambassador && (
              <span className="rounded-full bg-cb-bone px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wide text-cb-black">
                {t("app.buddies.ambassador")}
              </span>
            )}
          </div>
          {location && (
            <span className="block truncate font-body text-[12.5px] text-cb-gray-500">
              {location}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

export default function GroupMembers({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { joinedGroups } = useGroups();

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [token, setToken] = useState<string | undefined>();
  const [groupName, setGroupName] = useState<string>(
    joinedGroups.find((g) => g.id === groupId)?.name ?? "",
  );
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const seenRef = useRef(new Set<string>());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (groupName) return;
    fetchGroupById(groupId)
      .then((g) => mountedRef.current && g && setGroupName(g.name))
      .catch(() => {});
  }, [groupId, groupName]);

  const loadPage = useCallback(
    async (pageToken?: string) => {
      try {
        const result = await fetchGroupMembers({ groupId, token: pageToken });
        if (!mountedRef.current) return;

        // Paging by token can repeat a row if membership changes mid-scroll.
        const fresh = result.members.filter((m) => !seenRef.current.has(m.id));
        fresh.forEach((m) => seenRef.current.add(m.id));

        setMembers((prev) => [...prev, ...fresh]);
        setToken(result.nextToken);
        if (!result.nextToken) setDone(true);
        setError(false);
      } catch (err) {
        console.error("[groups] members load failed:", err);
        if (mountedRef.current) setError(true);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [groupId],
  );

  useEffect(() => {
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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(`/groups/${groupId}`)}
          aria-label={t("app.groups.back")}
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-cb-gray-600 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
        >
          <ArrowLeftIcon />
        </button>
        <div className="min-w-0">
          <h1 className="font-heading text-[22px] font-bold tracking-tight text-cb-black">
            {t("app.groups.members")}
          </h1>
          {groupName && (
            <p className="truncate font-body text-[13px] text-cb-gray-500">
              {groupName}
            </p>
          )}
        </div>
      </header>

      {loading ? (
        <ul aria-hidden className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl border border-cb-gray-200 bg-white p-3.5">
              <div className="h-12 w-12 animate-pulse rounded-full bg-cb-gray-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-1/3 animate-pulse rounded bg-cb-gray-100" />
                <div className="h-3 w-1/4 animate-pulse rounded bg-cb-gray-100" />
              </div>
            </li>
          ))}
        </ul>
      ) : error && members.length === 0 ? (
        <div className="rounded-2xl border border-cb-danger/30 bg-cb-danger/10 px-5 py-6 text-center">
          <p className="font-body text-[14px] text-cb-black">
            {t("app.groups.membersError")}
          </p>
          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={() => void loadPage()}>
              {t("app.groups.retry")}
            </Button>
          </div>
        </div>
      ) : members.length === 0 ? (
        <p className="py-16 text-center font-body text-[14.5px] text-cb-gray-500">
          {t("app.groups.membersEmpty")}
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {members.map((member) => (
              <MemberRow key={member.id} member={member} />
            ))}
          </ul>

          {!done && (
            <div ref={sentinelRef} className="pt-3">
              <div
                aria-hidden
                className="h-[76px] animate-pulse rounded-2xl bg-cb-gray-100"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
