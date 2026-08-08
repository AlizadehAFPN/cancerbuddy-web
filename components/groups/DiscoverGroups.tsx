"use client";

/**
 * `/groups/discover` — every group the user hasn't joined.
 *
 * Mobile lists them flat and searchable, which is what this mirrors. (The older
 * affinity-scored "recommended / more options" split described in the mobile
 * README belongs to a legacy screen that tab no longer routes to — matching the
 * live behaviour rather than the docs is deliberate.)
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { BMCF_CONTACT_EMAIL } from "@/lib/constants/contact";
import { SearchIcon, XIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui";
import GroupAvatar from "@/components/groups/GroupAvatar";
import JoinGroupDialog from "@/components/groups/JoinGroupDialog";
import { useGroups } from "@/lib/groups/GroupsProvider";
import { fetchAllGroups } from "@/lib/groups/groupQueries";
import type { Group } from "@/lib/groups/types";

function LockIcon() {
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
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function DiscoverGroups() {
  const { isMember, refreshGroups } = useGroups();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [joining, setJoining] = useState<Group | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllGroups()
      .then((all) => {
        if (!cancelled) setGroups(all);
      })
      .catch((err) => {
        console.error("[groups] discover load failed:", err);
        if (!cancelled) setError(t("app.groups.loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const copyContactEmail = async () => {
    try {
      await navigator.clipboard.writeText(BMCF_CONTACT_EMAIL);
      toast.success(t("app.groups.mailCopied"));
    } catch (err) {
      // Clipboard access can be refused outright (permissions, insecure origin);
      // the address is on screen, so say so rather than failing silently.
      console.error("[groups] clipboard write failed:", err);
      toast.error(t("app.groups.copyMailError"));
    }
  };

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((g) => !isMember(g.id))
      .filter(
        (g) =>
          !q ||
          g.name.toLowerCase().includes(q) ||
          (g.description ?? "").toLowerCase().includes(q) ||
          (g.sponsor?.name ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  }, [groups, isMember, query]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="font-heading text-[24px] font-bold leading-tight tracking-tight text-cb-black">
          {t("app.groups.discoverHeading")}
        </h1>
        <p className="mt-1.5 font-body text-[14.5px] text-cb-gray-500">
          {t("app.groups.discoverSub")}
        </p>
      </header>

      <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-cb-gray-200 bg-cb-gray-100/70 px-3.5 py-2.5 transition-all focus-within:border-cb-black focus-within:bg-white">
        <span className="shrink-0 text-cb-gray-400">
          <SearchIcon />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("app.groups.discoverSearch")}
          className="min-w-0 flex-1 bg-transparent font-body text-[15px] text-cb-black outline-none placeholder:text-cb-gray-400"
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

      {loading ? (
        <div aria-hidden className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-2xl border border-cb-gray-200 bg-white p-4"
            >
              <div className="h-12 w-12 animate-pulse rounded-2xl bg-cb-gray-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 animate-pulse rounded bg-cb-gray-100" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-cb-gray-100" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="rounded-xl border border-cb-danger/30 bg-cb-danger/10 px-4 py-3 font-body text-[14px] text-cb-black">
          {error}
        </p>
      ) : available.length === 0 ? (
        <div className="rounded-2xl border border-cb-gray-200 bg-white px-6 py-14 text-center">
          <p className="font-heading text-[17px] font-bold text-cb-black">
            {query
              ? t("app.groups.noSearchResults", { query })
              : t("app.groups.discoverEmpty")}
          </p>
          {/*
            Not a dead end: mobile's empty state hands over the foundation's
            address and a Copy Mail button so a member can ask for the group they
            wanted (`NoSuggestedGroups.tsx`). Web said "you've joined everything"
            and stopped there.
          */}
          {!query && (
            <>
              <p className="mx-auto mt-2 max-w-md font-body text-[14px] leading-relaxed text-cb-gray-600">
                {t("app.groups.discoverEmptySub")}
              </p>
              <p className="mt-3 font-heading text-[15px] font-bold text-cb-black">
                {BMCF_CONTACT_EMAIL}
              </p>
              <div className="mt-4">
                <Button variant="secondary" onClick={copyContactEmail}>
                  {t("app.groups.copyMail")}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {available.map((group) => (
            <li
              key={group.id}
              className="flex items-start gap-4 rounded-2xl border border-cb-gray-200 bg-white p-4 transition-shadow hover:shadow-[0_6px_24px_-10px_rgba(36,36,36,0.2)]"
            >
              {/*
                The row itself opens the group, where its hosts, sponsor and
                about text are — mobile's Discover row opens the same detail
                before you decide. Web offered Join and nothing else, so the only
                way to find out who ran a group was to join it.
              */}
              <Link
                href={`/groups/${group.id}`}
                className="flex min-w-0 flex-1 items-start gap-4 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-cb-black"
              >
                <GroupAvatar
                  name={group.name}
                  imageUrl={group.profilePicUrl}
                  verified={group.verified}
                  size={52}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-heading text-[16px] font-bold leading-tight text-cb-black">
                      {group.name}
                    </span>
                    {!group.isPublic && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-cb-gray-100 px-2 py-0.5 font-body text-[10.5px] font-bold uppercase tracking-wide text-cb-gray-600">
                        <LockIcon />
                        {t("app.groups.privateGroup")}
                      </span>
                    )}
                  </div>
                  {group.sponsor?.name && (
                    <p className="mt-0.5 font-body text-[12.5px] text-cb-gray-500">
                      {t("app.groups.hostedBy", { sponsor: group.sponsor.name })}
                    </p>
                  )}
                  {group.description && (
                    <p className="mt-1.5 line-clamp-2 font-body text-[13.5px] leading-snug text-cb-gray-600">
                      {group.description}
                    </p>
                  )}
                </div>
              </Link>
              <Button
                size="sm"
                className="shrink-0"
                onClick={() => setJoining(group)}
              >
                {t("app.groups.join")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {joining && (
        <JoinGroupDialog
          group={joining}
          onClose={() => setJoining(null)}
          onJoined={async () => {
            setJoining(null);
            await refreshGroups();
          }}
        />
      )}
    </div>
  );
}
