"use client";

/**
 * Incoming buddy requests — the top half of the mobile Buddies tab.
 *
 * On mobile this is the entire screen and discovery sits behind a button. The
 * web has room for both, so requests stay pinned above the results: a
 * horizontal rail on wide screens, a stack on phones. When there are none the
 * section disappears entirely rather than showing mobile's full-page empty
 * state — discovery below is already the thing to do next.
 */

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import BuddyAvatar from "@/components/buddies/BuddyAvatar";
import AmbassadorBadge from "@/components/buddies/AmbassadorBadge";
import { ageSuffix } from "@/lib/buddies/age";
import {
  ROLE_BADGE_CLASS,
  ROLE_LABELS,
  formatName,
  matchSummary,
} from "@/lib/buddies/display";
import { useBuddies } from "@/lib/buddies/BuddiesProvider";
import { setNeighbourQueue } from "@/lib/buddies/discoveryOrder";
import { useRequests } from "@/lib/buddies/useRequests";
import type { CurrentUserData, PendingRequest } from "@/lib/buddies/types";

/**
 * Exported so the Updates tab renders the identical card. The two surfaces
 * differ only in shape — a fixed-width rail here, a full-width stack there —
 * so `wide` swaps the sizing rather than the markup.
 */
export function RequestCard({
  request,
  viewer,
  busy,
  onAccept,
  onDismiss,
  onOpen,
  wide = false,
}: {
  request: PendingRequest;
  /**
   * The signed-in member's own relations, for the shared-attribute line. Null
   * while they load — the subtitle shows `…` rather than flashing the wrong
   * answer, which is what mobile does (`ConnectionRequest.tsx:215`).
   */
  viewer: CurrentUserData | null;
  busy: boolean;
  onAccept: () => void;
  onDismiss: () => void;
  /** Seeds the profile's Previous/Next queue with every pending sender. */
  onOpen?: () => void;
  wide?: boolean;
}) {
  const { remitent } = request;
  const name = formatName(remitent.name);
  const role = ROLE_LABELS[remitent.userType] ?? "";

  /**
   * What you have in common with the sender — "New York, interests, medical
   * center" — not their bio.
   *
   * This is the single most visible content divergence the audit found in this
   * area: mobile computes the shared categories against the viewer
   * (`getLabelCoincidencies`), and web showed free text the sender wrote about
   * themselves. The helper already existed for discovery cards and was simply
   * never called here.
   */
  const summary = viewer ? matchSummary(remitent, viewer) : "…";

  return (
    <article
      className={[
        "flex w-full shrink-0 flex-col rounded-2xl border border-cb-gray-200 bg-white p-4",
        "transition-shadow hover:shadow-[0_6px_24px_-10px_rgba(36,36,36,0.2)]",
        wide ? "" : "lg:w-[320px]",
      ].join(" ")}
    >
      <div className="flex items-start gap-3.5">
        <BuddyAvatar
          name={remitent.name}
          photoUrl={remitent.profilePicUrl}
          goalUrl={remitent.goalImageUrl}
          size={52}
        />
        <div className="min-w-0 flex-1">
          {/*
            `connectionId` is what lets the profile offer "Maybe later" — it is
            the incoming request's id, and the profile has no other way to know
            which row to decline. Mobile passes it the same way
            (`ConnectionRequest.tsx:194-196`).
          */}
          <Link
            href={`/buddies/${remitent.id}?connectionId=${request.id}`}
            onClick={onOpen}
            className="font-heading text-[16px] font-bold leading-tight tracking-tight text-cb-black hover:underline"
          >
            {`${name}${ageSuffix(remitent.userType, remitent.birth)}`}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {role && (
              <span
                className={[
                  "rounded-full px-2.5 py-0.5 font-body text-[11px] font-bold",
                  ROLE_BADGE_CLASS[remitent.userType] ?? "bg-cb-gray-200 text-cb-black",
                ].join(" ")}
              >
                {role}
              </span>
            )}
            <AmbassadorBadge
              ambassador={remitent.ambassador}
              myName={viewer?.name}
            />
          </div>
        </div>
      </div>

      {summary && (
        <p className="mt-3 line-clamp-2 font-body text-[13px] leading-snug text-cb-gray-500">
          {summary}
        </p>
      )}

      <div className="mt-4 flex gap-2.5">
        <Button size="sm" fullWidth onClick={onAccept} disabled={busy}>
          {t("app.buddies.connect")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          fullWidth
          onClick={onDismiss}
          disabled={busy}
        >
          {t("app.buddies.maybeLater")}
        </Button>
      </div>
    </article>
  );
}

function RequestSkeleton() {
  return (
    <div
      aria-hidden
      className="w-full shrink-0 rounded-2xl border border-cb-gray-200 bg-white p-4 lg:w-[320px]"
    >
      <div className="flex items-start gap-3.5">
        <div
          className="shrink-0 animate-pulse rounded-full bg-cb-gray-100"
          style={{ height: 52, width: 52 }}
        />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-cb-gray-100" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-cb-gray-100" />
        </div>
      </div>
      <div className="mt-4 h-9 animate-pulse rounded-full bg-cb-gray-100" />
    </div>
  );
}

export default function RequestsSection() {
  const { requests, loading, error, busyIds, accept, dismiss } = useRequests();
  const { currentUser } = useBuddies();
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <section className="space-y-3">
        <div className="h-4 w-40 animate-pulse rounded bg-cb-gray-100" />
        <div className="flex gap-3 overflow-hidden">
          <RequestSkeleton />
          <RequestSkeleton />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-cb-danger/30 bg-cb-danger/10 px-4 py-3 font-body text-[13.5px] text-cb-black">
        {error}
      </p>
    );
  }

  if (requests.length === 0) return null;

  const handle = async (
    action: (r: PendingRequest) => Promise<void>,
    request: PendingRequest,
    successMessage: string,
  ) => {
    try {
      await action(request);
      toast.success(successMessage);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("errors.fallback"),
      );
    }
  };

  // Past a handful, collapse to a scrollable rail with a count-driven toggle.
  const COLLAPSED_LIMIT = 6;
  const shown = expanded ? requests : requests.slice(0, COLLAPSED_LIMIT);

  return (
    <section aria-labelledby="buddy-requests-heading" className="space-y-3">
      <div className="flex items-center gap-2.5">
        <h2
          id="buddy-requests-heading"
          className="font-heading text-[13px] font-bold uppercase tracking-[0.14em] text-cb-black"
        >
          {t("app.buddies.requestsHeading")}
        </h2>
        <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-cb-yellow px-1.5 font-body text-[12px] font-bold text-cb-black">
          {requests.length}
        </span>
        {requests.length > COLLAPSED_LIMIT && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto font-body text-[13px] font-semibold text-cb-gray-600 underline-offset-2 hover:text-cb-black hover:underline"
          >
            {expanded
              ? t("app.buddies.showFewer")
              : t("app.buddies.showAll", { count: requests.length })}
          </button>
        )}
      </div>

      <div
        className={[
          "gap-3",
          expanded
            ? "grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3"
            : "flex snap-x snap-mandatory overflow-x-auto pb-1 [scrollbar-width:thin]",
        ].join(" ")}
      >
        {shown.map((request) => (
          <div key={request.id} className={expanded ? "" : "snap-start"}>
            <RequestCard
              request={request}
              viewer={currentUser}
              busy={busyIds.includes(request.id)}
              /* Opening a sender's profile makes the other senders its
                 Previous/Next queue — mobile seeds `usersList` the same way. */
              onOpen={() =>
                setNeighbourQueue(
                  requests.map((r) => r.remitent.id),
                  "requests",
                )
              }
              onAccept={() =>
                handle(
                  accept,
                  request,
                  t("app.buddies.connectedToast", {
                    name: formatName(request.remitent.name),
                  }),
                )
              }
              onDismiss={() =>
                handle(
                  dismiss,
                  request,
                  t("app.buddies.dismissedToast", {
                    name: formatName(request.remitent.name),
                  }),
                )
              }
            />
          </div>
        ))}
      </div>
    </section>
  );
}
