"use client";

/**
 * `/buddies/[userId]/journal` — everything a member has chosen to share.
 *
 * Read-only by definition: only the author can change what's public, from their
 * own journal screen.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { ArrowLeftIcon } from "@/components/ui/icons";
import BuddyAvatar from "@/components/buddies/BuddyAvatar";
import { formatJournalDate } from "@/components/buddies/JournalPreview";
import { formatName } from "@/lib/buddies/display";
import { fetchPublicJournal, type JournalEntry } from "@/lib/profile/journal";
import { fetchBuddyProfileDetail } from "@/lib/buddies/profileDetail";

export default function JournalList({ userId }: { userId: string }) {
  const router = useRouter();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [author, setAuthor] = useState<{
    name: string;
    userType?: string;
    photoUrl?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [list, profile] = await Promise.all([
          fetchPublicJournal(userId),
          // Only for the header; a failure here shouldn't hide the entries.
          fetchBuddyProfileDetail(userId).catch(() => null),
        ]);
        if (cancelled || !mountedRef.current) return;

        setEntries(list);
        if (profile) {
          setAuthor({
            name: profile.name ?? "",
            userType: profile.userType ?? undefined,
            photoUrl: profile.profilePicUrl,
          });
        }
      } catch (err) {
        console.error("[buddies] journal list failed:", err);
        if (!cancelled && mountedRef.current) setError(true);
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const displayName = author ? formatName(author.name, author.userType) : "";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(`/buddies/${userId}`)}
          aria-label={t("app.buddies.back")}
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-cb-gray-600 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
        >
          <ArrowLeftIcon />
        </button>
        {author && (
          <BuddyAvatar name={author.name} photoUrl={author.photoUrl} size={40} />
        )}
        <div className="min-w-0">
          <h1 className="font-heading text-[20px] font-bold tracking-tight text-cb-black">
            {t("app.buddies.journal")}
          </h1>
          {displayName && (
            <p className="truncate font-body text-[13px] text-cb-gray-500">
              {displayName}
            </p>
          )}
        </div>
      </header>

      {loading ? (
        <div aria-hidden className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-cb-gray-100" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-cb-danger/30 bg-cb-danger/10 px-5 py-6 text-center">
          <p className="font-body text-[14px] text-cb-black">
            {t("app.buddies.journalError")}
          </p>
          <div className="mt-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => router.refresh()}
            >
              {t("app.groups.retry")}
            </Button>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <p className="py-16 text-center font-body text-[14.5px] text-cb-gray-500">
          {t("app.buddies.journalNoneShared")}
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-2xl border border-cb-gray-200 bg-white p-4"
            >
              <p className="font-body text-[12.5px] text-cb-gray-500">
                {formatJournalDate(entry.createdAt)}
              </p>
              <p className="mt-1.5 whitespace-pre-line font-body text-[15px] leading-relaxed text-cb-black">
                {entry.text}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
