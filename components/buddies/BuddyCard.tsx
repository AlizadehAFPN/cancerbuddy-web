"use client";

/**
 * One person in the discovery grid.
 *
 * Renders a skeleton until its profile batch lands, and nothing at all once we
 * know the id has no row — deleted accounts can linger in the join tables the
 * search reads, and mobile hides them the same way rather than showing a blank
 * card.
 *
 * `content-visibility: auto` lets the browser skip layout and paint for cards
 * outside the viewport, which is what keeps a several-thousand-result grid
 * responsive without hand-rolled windowing. `contain-intrinsic-size` supplies
 * the placeholder height so the scrollbar stays honest.
 */

import Link from "next/link";
import { useState } from "react";
import { t } from "@/lib/i18n";
import BuddyAvatar from "@/components/buddies/BuddyAvatar";
import AmbassadorBadge from "@/components/buddies/AmbassadorBadge";
import { UserPlusIcon, XIcon } from "@/components/buddies/controls";
import { ageSuffix } from "@/lib/buddies/age";
import {
  ROLE_BADGE_CLASS,
  badgeLabel,
  formatName,
  matchSummary,
} from "@/lib/buddies/display";
import type {
  BuddyProfile,
  ConnectionEntry,
  CurrentUserData,
} from "@/lib/buddies/types";

export const CARD_MIN_HEIGHT = 132;

export function BuddyCardSkeleton() {
  return (
    <div
      aria-hidden
      className="flex items-center gap-4 rounded-2xl border border-cb-gray-200 bg-white p-4"
      style={{ minHeight: CARD_MIN_HEIGHT }}
    >
      <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-cb-gray-100" />
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="h-4 w-1/2 animate-pulse rounded bg-cb-gray-100" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-cb-gray-100" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-cb-gray-100" />
      </div>
    </div>
  );
}

export default function BuddyCard({
  profile,
  viewer,
  connection,
  onConnect,
  onHide,
  busy,
}: {
  profile: BuddyProfile;
  viewer: CurrentUserData | null;
  connection?: ConnectionEntry;
  onConnect: (profile: BuddyProfile) => void;
  /** Permanently removes this person from the viewer's suggestions. */
  onHide: (profile: BuddyProfile) => void;
  busy?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [confirmingHide, setConfirmingHide] = useState(false);

  const displayName = `${formatName(profile.name, profile.userType)}${ageSuffix(
    profile.userType,
    profile.birth,
  )}`;
  const role = badgeLabel(profile, viewer?.userType);
  const summary = matchSummary(profile, viewer);

  // Inline rather than a modal: the confirmation belongs to this one card, and
  // hiding someone is irreversible from the UI.
  if (confirmingHide) {
    return (
      <div
        className="flex flex-col justify-center gap-3 rounded-2xl border border-cb-gray-300 bg-cb-gray-100 p-4"
        style={{ minHeight: CARD_MIN_HEIGHT }}
      >
        <p className="font-body text-[14px] leading-snug text-cb-black">
          {t("app.buddies.hideConfirm", { name: formatName(profile.name) })}
        </p>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => {
              setConfirmingHide(false);
              onHide(profile);
            }}
            className="rounded-full border-2 border-cb-black bg-cb-black px-4 py-1.5 font-body text-[13px] font-bold text-white transition-colors hover:bg-cb-gray-800"
          >
            {t("app.buddies.hideConfirmYes")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingHide(false)}
            className="rounded-full border-2 border-cb-black px-4 py-1.5 font-body text-[13px] font-bold text-cb-black transition-colors hover:bg-black/5"
          >
            {t("app.buddies.cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={[
        "group relative flex items-start gap-4 rounded-2xl border bg-white p-4 transition-all",
        hovered
          ? "border-cb-black shadow-[0_6px_24px_-8px_rgba(36,36,36,0.22)]"
          : "border-cb-gray-200",
      ].join(" ")}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: `${CARD_MIN_HEIGHT}px`,
      }}
    >
      <BuddyAvatar
        name={profile.name}
        photoUrl={profile.profilePicUrl}
        goalUrl={profile.goalImageUrl}
        size={56}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* Stretched link: the whole card is clickable, buttons stay on top. */}
          <Link
            href={`/buddies/${profile.id}`}
            className="font-heading text-[16px] font-bold leading-tight tracking-tight text-cb-black after:absolute after:inset-0 after:rounded-2xl after:content-['']"
          >
            {displayName}
          </Link>
          <AmbassadorBadge
            ambassador={profile.ambassador}
            myName={viewer?.name}
          />
        </div>

        {role && (
          <span
            className={[
              "mt-1.5 inline-block rounded-full px-2.5 py-0.5 font-body text-[11px] font-bold",
              ROLE_BADGE_CLASS[profile.userType] ?? "bg-cb-gray-200 text-cb-black",
            ].join(" ")}
          >
            {role}
          </span>
        )}

        {summary && (
          <p className="mt-2 line-clamp-2 font-body text-[13px] leading-snug text-cb-gray-500">
            {summary}
          </p>
        )}
      </div>

      {/* Dismiss lives top-right, revealed on hover / keyboard focus. */}
      <button
        type="button"
        onClick={() => setConfirmingHide(true)}
        aria-label={t("app.buddies.hideAction", { name: formatName(profile.name) })}
        className={[
          "absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full",
          "text-cb-gray-400 transition-all hover:bg-cb-gray-100 hover:text-cb-black focus-visible:opacity-100",
          hovered ? "opacity-100" : "opacity-0",
        ].join(" ")}
      >
        <XIcon size={13} />
      </button>

      <div className="relative z-10 shrink-0 self-center">
        {connection?.status === "connected" ? (
          <span className="rounded-full border border-cb-gray-200 px-3 py-1.5 font-body text-[12px] font-semibold text-cb-gray-500">
            {t("app.buddies.connected")}
          </span>
        ) : connection?.status === "pending" ? (
          <span className="rounded-full border border-cb-gray-300 px-3 py-1.5 font-body text-[12px] font-semibold text-cb-gray-600">
            {t("app.buddies.pending")}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onConnect(profile)}
            disabled={busy}
            aria-label={t("app.buddies.connectWith", { name: formatName(profile.name) })}
            className="flex items-center gap-1.5 rounded-full border-2 border-cb-black bg-cb-black px-3.5 py-1.5 font-body text-[12px] font-bold text-white transition-colors hover:bg-cb-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserPlusIcon size={14} />
            <span className="hidden sm:inline">{t("app.buddies.connect")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
