"use client";

/**
 * `/groups/hosts/[hostId]` — the person running a group.
 *
 * Hosts get their own page rather than the buddy profile: there's no connecting
 * with them, and what matters is who they are, what they do, and who sponsors
 * the group. That's the same split mobile makes when a member row is tapped.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { ArrowLeftIcon } from "@/components/ui/icons";
import BuddyAvatar from "@/components/buddies/BuddyAvatar";
import { fetchHostDetail, type HostDetail } from "@/lib/groups/members";

export default function HostDetailScreen({ hostId }: { hostId: string }) {
  const router = useRouter();

  const [host, setHost] = useState<HostDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchHostDetail(hostId)
      .then((result) => {
        if (!cancelled && mountedRef.current) setHost(result);
      })
      .catch((err) => console.error("[groups] host detail failed:", err))
      .finally(() => {
        if (!cancelled && mountedRef.current) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hostId]);

  if (loading) {
    return (
      <div aria-hidden className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <div className="h-48 animate-pulse rounded-2xl bg-cb-gray-100" />
        <div className="mt-4 h-32 animate-pulse rounded-2xl bg-cb-gray-100" />
      </div>
    );
  }

  if (!host) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
        <p className="font-heading text-[18px] font-bold text-cb-black">
          {t("app.groups.hostNotFound")}
        </p>
        <Button variant="secondary" onClick={() => router.back()}>
          {t("app.groups.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t("app.groups.back")}
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-cb-gray-600 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
        >
          <ArrowLeftIcon />
        </button>
        <h1 className="font-heading text-[22px] font-bold tracking-tight text-cb-black">
          {t("app.groups.hostTitle")}
        </h1>
      </header>

      <section className="rounded-2xl border border-cb-gray-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <BuddyAvatar name={host.name} photoUrl={host.profilePicUrl} size={80} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-[20px] font-bold leading-tight text-cb-black">
                {host.name}
              </h2>
              <span className="rounded-full bg-cb-green px-2 py-0.5 font-body text-[10.5px] font-bold uppercase tracking-wide text-cb-black">
                {t("app.groups.host")}
              </span>
              {host.ambassador && (
                <span className="rounded-full bg-cb-bone px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wide text-cb-black">
                  {t("app.buddies.ambassador")}
                </span>
              )}
            </div>
            {host.occupation && (
              <p className="mt-0.5 font-body text-[13.5px] text-cb-gray-600">
                {host.occupation}
              </p>
            )}
            {host.pronoun && (
              <p className="font-body text-[12.5px] text-cb-gray-500">
                {host.pronoun}
              </p>
            )}
          </div>
        </div>

        {host.bio && (
          <p className="mt-5 whitespace-pre-line font-body text-[15px] leading-relaxed text-cb-black">
            {host.bio}
          </p>
        )}

        {host.groupId && host.groupName && (
          <Link
            href={`/groups/${host.groupId}`}
            className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-cb-gray-100 px-4 py-3 transition-colors hover:bg-cb-gray-200/70"
          >
            <span className="min-w-0">
              <span className="block font-body text-[11px] font-bold uppercase tracking-[0.14em] text-cb-gray-600">
                {t("app.groups.hostsGroup")}
              </span>
              <span className="block truncate font-heading text-[15px] font-bold text-cb-black">
                {host.groupName}
              </span>
            </span>
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-cb-gray-400"
              aria-hidden
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        )}
      </section>

      {host.sponsorDescription && (
        <section className="mt-4 rounded-2xl bg-cb-gray-100 p-5">
          <h3 className="font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-cb-black">
            {t("app.groups.sponsoredBy")}
          </h3>
          {host.sponsorLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={host.sponsorLogoUrl}
              alt={host.sponsorName ?? ""}
              className="mt-3 max-h-12 w-auto object-contain"
            />
          )}
          <p className="mt-2 font-body text-[14px] leading-relaxed text-cb-black">
            {host.sponsorDescription}
          </p>
        </section>
      )}
    </div>
  );
}
