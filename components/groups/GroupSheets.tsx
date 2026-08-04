"use client";

/**
 * The sheets a group feed opens: post actions, reporting, group info, and the
 * two confirmations (delete a post, leave a group).
 *
 * They live together because they share one shape — a sheet over the feed — and
 * keeping them beside each other makes the set of destructive actions easy to
 * audit in one place.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui";
import GroupAvatar from "@/components/groups/GroupAvatar";
import BuddyAvatar from "@/components/buddies/BuddyAvatar";
import { formatName } from "@/lib/buddies/display";
import { fetchGroupMemberCount } from "@/lib/groups/groupQueries";
import { reportPost } from "@/lib/groups/membership";
import { POST_REPORT_REASONS } from "@/lib/groups/types";
import type { FeedPost, Group } from "@/lib/groups/types";

/* ── Post actions ───────────────────────────────────────────────────────── */

export interface PostActionsProps {
  post: FeedPost;
  currentUserId: string | null;
  canModerate: boolean;
  onClose: () => void;
  onEdit: (post: FeedPost) => void;
  onDelete: (post: FeedPost) => void;
  onReport: (post: FeedPost) => void;
  onTogglePin: (post: FeedPost) => void;
}

function ActionRow({
  title,
  description,
  danger,
  onClick,
}: {
  title: string;
  description?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full border-b border-cb-gray-100 px-5 py-4 text-left transition-colors last:border-0 hover:bg-cb-gray-100/70"
    >
      <span
        className={[
          "block font-heading text-[15px] font-bold",
          danger ? "text-cb-danger" : "text-cb-black",
        ].join(" ")}
      >
        {title}
      </span>
      {description && (
        <span className="mt-0.5 block font-body text-[13px] leading-snug text-cb-gray-500">
          {description}
        </span>
      )}
    </button>
  );
}

export function PostActionsSheet({
  post,
  currentUserId,
  canModerate,
  onClose,
  onEdit,
  onDelete,
  onReport,
  onTogglePin,
}: PostActionsProps) {
  const mine = post.actorId === currentUserId;

  return (
    <Sheet open title={t("app.groups.postActions")} onClose={onClose}>
      <div className="pb-2">
        {mine && (
          <ActionRow title={t("app.groups.editPost")} onClick={() => onEdit(post)} />
        )}
        {canModerate && (
          <ActionRow
            title={post.pinned ? t("app.groups.unpinPost") : t("app.groups.pinPost")}
            onClick={() => onTogglePin(post)}
          />
        )}
        {!mine && (
          <ActionRow
            title={t("app.groups.report")}
            description={t("app.groups.reportSub")}
            onClick={() => onReport(post)}
          />
        )}
        {(mine || canModerate) && (
          <ActionRow
            title={t("app.groups.deletePost")}
            danger
            onClick={() => onDelete(post)}
          />
        )}
      </div>
    </Sheet>
  );
}

/* ── Confirmation ───────────────────────────────────────────────────────── */

export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      open
      title={title}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={busy}>
            {t("app.groups.cancel")}
          </Button>
          <Button
            fullWidth
            onClick={onConfirm}
            loading={busy}
            className={danger ? "!border-cb-danger !bg-cb-danger" : undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="px-5 pb-6 font-body text-[15px] leading-relaxed text-cb-black">
        {body}
      </p>
    </Sheet>
  );
}

/* ── Report ─────────────────────────────────────────────────────────────── */

export function ReportPostSheet({
  post,
  currentUserId,
  onClose,
}: {
  post: FeedPost;
  currentUserId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await reportPost({ postId: post.id, userId: currentUserId, reason });
      toast.success(t("app.groups.reportThanks"));
      onClose();
    } catch (err) {
      console.error("[groups] report failed:", err);
      toast.error(t("app.groups.reportError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      title={t("app.groups.reportTitle")}
      subtitle={t("app.groups.reportPrompt")}
      onClose={onClose}
      footer={
        <Button fullWidth onClick={submit} disabled={!reason} loading={busy}>
          {t("app.groups.reportSubmit")}
        </Button>
      }
    >
      <div className="px-5 pb-4">
        {POST_REPORT_REASONS.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-3 border-b border-cb-gray-100 py-3.5 last:border-0"
          >
            <span
              className={[
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                reason === option ? "border-cb-black" : "border-cb-gray-300",
              ].join(" ")}
            >
              {reason === option && (
                <span className="h-2.5 w-2.5 rounded-full bg-cb-black" />
              )}
            </span>
            <input
              type="radio"
              name="report-reason"
              checked={reason === option}
              onChange={() => setReason(option)}
              className="sr-only"
            />
            <span className="font-body text-[15px] text-cb-black">{option}</span>
          </label>
        ))}
      </div>
    </Sheet>
  );
}

/* ── Group info ─────────────────────────────────────────────────────────── */

export function GroupInfoSheet({
  group,
  isMember,
  onClose,
  onToggleMute,
  onLeave,
  muteBusy,
}: {
  group: Group;
  isMember: boolean;
  onClose: () => void;
  onToggleMute: () => void;
  onLeave: () => void;
  muteBusy?: boolean;
}) {
  const [memberCount, setMemberCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchGroupMemberCount(group.id).then((count) => {
      if (!cancelled) setMemberCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [group.id]);

  return (
    <Sheet open wide title={group.name} onClose={onClose}>
      <div className="px-5 pb-6">
        <div className="flex items-center gap-4">
          <GroupAvatar
            name={group.name}
            imageUrl={group.profilePicUrl}
            verified={group.verified}
            size={72}
          />
          <div className="min-w-0">
            {group.sponsor?.name && (
              <p className="font-body text-[13.5px] text-cb-gray-500">
                {t("app.groups.hostedBy", { sponsor: group.sponsor.name })}
              </p>
            )}
            {memberCount !== null && (
              <p className="font-heading text-[14px] font-bold text-cb-black">
                {t(
                  memberCount === 1
                    ? "app.groups.memberCountOne"
                    : "app.groups.memberCount",
                  { count: memberCount },
                )}
              </p>
            )}
          </div>
        </div>

        {(group.about || group.description) && (
          <section className="mt-6">
            <h3 className="font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-cb-black">
              {t("app.groups.about")}
            </h3>
            <p className="mt-2 whitespace-pre-line font-body text-[15px] leading-relaxed text-cb-black">
              {group.about || group.description}
            </p>
          </section>
        )}

        {group.hosts.length > 0 && (
          <section className="mt-6">
            <h3 className="font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-cb-black">
              {t("app.groups.hosts")}
            </h3>
            <ul className="mt-3 space-y-3">
              {group.hosts.map((host) => (
                <li key={host.id}>
                  <Link
                    href={`/groups/hosts/${host.id}`}
                    onClick={onClose}
                    className="flex items-start gap-3 rounded-xl p-1 transition-colors hover:bg-cb-gray-100/70"
                  >
                  <BuddyAvatar
                    name={host.name}
                    photoUrl={host.profilePicUrl}
                    size={44}
                  />
                  <div className="min-w-0">
                    <p className="font-heading text-[14.5px] font-bold text-cb-black">
                      {formatName(host.name, "HOST")}
                    </p>
                    {host.occupation && (
                      <p className="font-body text-[13px] text-cb-gray-500">
                        {host.occupation}
                      </p>
                    )}
                    {host.bio && (
                      <p className="mt-1 line-clamp-3 font-body text-[13.5px] leading-snug text-cb-gray-600">
                        {host.bio}
                      </p>
                    )}
                  </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {group.sponsor?.description && (
          <section className="mt-6 rounded-2xl bg-cb-gray-100 p-4">
            <h3 className="font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-cb-black">
              {t("app.groups.sponsoredBy")}
            </h3>
            {group.sponsor.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={group.sponsor.logoUrl}
                alt=""
                className="mt-3 max-h-12 w-auto object-contain"
              />
            )}
            <p className="mt-2 font-body text-[14px] leading-relaxed text-cb-black">
              {group.sponsor.description}
            </p>
          </section>
        )}

        <Link
          href={`/groups/${group.id}/members`}
          onClick={onClose}
          className="mt-6 flex items-center justify-between gap-3 rounded-xl bg-cb-gray-100 px-4 py-3 transition-colors hover:bg-cb-gray-200/70"
        >
          <span className="font-heading text-[14.5px] font-bold text-cb-black">
            {t("app.groups.viewMembers")}
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

        {isMember && (
          <section className="mt-6 border-t border-cb-gray-100 pt-4">
            <ActionRow
              title={
                group.muted ? t("app.groups.unmuteGroup") : t("app.groups.muteGroup")
              }
              description={
                group.muted
                  ? t("app.groups.unmuteGroupSub")
                  : t("app.groups.muteGroupSub")
              }
              onClick={muteBusy ? () => {} : onToggleMute}
            />
            <ActionRow
              title={t("app.groups.leaveGroup")}
              description={t("app.groups.leaveGroupSub")}
              danger
              onClick={onLeave}
            />
          </section>
        )}
      </div>
    </Sheet>
  );
}
