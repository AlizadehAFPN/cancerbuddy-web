"use client";

/**
 * The journal card on another member's profile.
 *
 * Shows their most recent public entry, clamped, with a link to the rest.
 * Renders nothing at all when they've shared none — an empty "Journal" heading
 * would imply they write and chose not to share, which isn't the same thing.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { fetchPublicJournal, type JournalEntry } from "@/lib/profile/journal";

export function formatJournalDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export default function JournalPreview({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPublicJournal(userId)
      .then((list) => {
        if (!cancelled && mountedRef.current) setEntries(list);
      })
      .catch((err) => {
        console.error("[buddies] journal preview failed:", err);
        if (!cancelled && mountedRef.current) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Nothing shared (or still loading) — stay out of the way.
  if (!entries || entries.length === 0) return null;

  const latest = entries[0];

  return (
    <section className="rounded-2xl border border-cb-gray-200 bg-white p-5">
      <h2 className="font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-cb-black">
        {t("app.buddies.journal")}
      </h2>

      <p className="mt-3 font-body text-[12.5px] text-cb-gray-500">
        {formatJournalDate(latest.createdAt)}
      </p>
      <p className="mt-1 line-clamp-4 whitespace-pre-line font-body text-[15px] leading-relaxed text-cb-black">
        {latest.text}
      </p>

      <Link
        href={`/buddies/${userId}/journal`}
        className="mt-3 inline-flex items-center gap-1.5 font-body text-[13.5px] font-bold text-cb-black underline-offset-2 hover:underline"
      >
        {t("app.buddies.readMore")}
        <svg
          width={15}
          height={15}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>

      {entries.length > 1 && (
        <p className="mt-2 font-body text-[12.5px] text-cb-gray-400">
          {t("app.buddies.journalEntryCount", { count: entries.length })}
        </p>
      )}
    </section>
  );
}
