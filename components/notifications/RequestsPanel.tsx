"use client";

/**
 * The "Buddy requests" tab of `/notifications` — mobile's `HomeRequestBuddies`.
 *
 * Deliberately not a second copy of the feature. The cards, the accept/dismiss
 * calls and the loading state all come from the same `useRequests` hook that
 * `/buddies` renders, so answering a request here removes it there too without
 * either screen refetching. The only thing this file decides is the shape: a
 * vertical stack, because a tab has the full width to use where the rail on
 * `/buddies` does not.
 */

import Link from "next/link";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { RequestCard } from "@/components/buddies/RequestsSection";
import { useBuddies } from "@/lib/buddies/BuddiesProvider";
import { setNeighbourQueue } from "@/lib/buddies/discoveryOrder";
import { formatName } from "@/lib/buddies/display";
import type { RequestsResult } from "@/lib/buddies/useRequests";
import type { PendingRequest } from "@/lib/buddies/types";

function Skeleton() {
  return (
    <div aria-hidden className="space-y-3 pt-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-cb-gray-200 bg-white p-4">
          <div className="flex items-start gap-3.5">
            <div className="h-[52px] w-[52px] animate-pulse rounded-full bg-cb-gray-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-cb-gray-100" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-cb-gray-100" />
            </div>
          </div>
          <div className="mt-4 h-9 animate-pulse rounded-full bg-cb-gray-100" />
        </div>
      ))}
    </div>
  );
}

export default function RequestsPanel({ requests }: { requests: RequestsResult }) {
  const { requests: items, loading, error, busyIds, accept, dismiss } = requests;
  const { currentUser } = useBuddies();

  const onAccept = async (request: PendingRequest) => {
    try {
      await accept(request);
      toast.success(
        t("app.buddies.connectedToast", { name: formatName(request.remitent.name) }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("app.buddies.acceptError", {
        name: formatName(request.remitent.name),
      }));
    }
  };

  const onDismiss = async (request: PendingRequest) => {
    try {
      await dismiss(request);
      toast.success(
        t("app.buddies.dismissedToast", { name: formatName(request.remitent.name) }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("app.buddies.dismissError"));
    }
  };

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <p className="mt-3 rounded-xl border border-cb-danger/30 bg-cb-danger/10 px-4 py-3 font-body text-[13.5px] text-cb-black">
        {error}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-center">
        <h2 className="font-heading text-[19px] font-bold text-cb-black">
          {t("app.updates.emptyRequests")}
        </h2>
        <p className="max-w-sm font-body text-[14.5px] text-cb-gray-500">
          {t("app.updates.emptyRequestsSub")}
        </p>
        {/* Mobile's empty state offers the same next step. */}
        <Link
          href="/buddies"
          className="mt-3 inline-flex h-11 items-center justify-center rounded-full border-2 border-cb-black bg-cb-black px-5 font-heading text-sm font-medium text-white transition-colors hover:bg-cb-gray-800"
        >
          {t("app.updates.findBuddies")}
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3 pt-2">
      {items.map((request) => (
        <li key={request.id}>
          <RequestCard
            request={request}
            viewer={currentUser}
            wide
            busy={busyIds.includes(request.id)}
            onOpen={() =>
              setNeighbourQueue(
                items.map((r) => r.remitent.id),
                "requests",
              )
            }
            onAccept={() => void onAccept(request)}
            onDismiss={() => void onDismiss(request)}
          />
        </li>
      ))}
    </ul>
  );
}
