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
import { ChevronRightIcon } from "@/components/ui/icons";
import GroupAvatar from "@/components/groups/GroupAvatar";
import { canLeaveGroup } from "@/lib/groups/moderation";
import BuddyAvatar from "@/components/buddies/BuddyAvatar";
import { formatName } from "@/lib/buddies/display";
import { fetchGroupMemberCount } from "@/lib/groups/groupQueries";
import { reportPost } from "@/lib/groups/membership";
import {
  OTHER_MAX_CHARS,
  OTHER_REASON,
  REPORT_REASONS,
  ReportTargetType,
  reportReasonValue,
  reportSubmitDisabled,
  type ReportTargetTypeValue,
} from "@/lib/groups/reporting";
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
  /**
   * Host / SUPPORT only, and never on your own post — see
   * `canReplyPrivately` in `lib/groups/moderation.ts`. Absent when the rule says
   * no, so this component does not re-derive it.
   */
  onReplyPrivately?: (post: FeedPost) => void;
  /** Whose name the row offers to message. */
  authorName?: string | null;
  /** True while the channel is being found or created. */
  replyPrivatelyBusy?: boolean;
}

function ActionRow({
  title,
  description,
  danger,
  busy,
  disabled,
  onClick,
}: {
  title: string;
  description?: string;
  danger?: boolean;
  /** Shows a spinner and blocks the row while the action is in flight. */
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      className="flex w-full items-center gap-3 border-b border-cb-gray-100 px-5 py-4 text-left transition-colors last:border-0 hover:bg-cb-gray-100/70 disabled:cursor-default disabled:hover:bg-transparent"
    >
      <span className="min-w-0 flex-1">
        <span
          className={[
            "block font-heading text-[15px] font-bold transition-opacity",
            danger ? "text-cb-danger" : "text-cb-black",
            disabled && !busy ? "opacity-40" : "",
          ].join(" ")}
        >
          {title}
        </span>
        {description && (
          <span className="mt-0.5 block font-body text-[13px] leading-snug text-cb-gray-500">
            {description}
          </span>
        )}
      </span>
      {busy && (
        <span
          aria-hidden
          className="h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-2 border-cb-gray-300 border-t-cb-black"
        />
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
  onReplyPrivately,
  authorName,
  replyPrivatelyBusy,
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
        {/* The host's only route to a member in private. Resolving the channel
            is a round trip, so the row states that it is working. */}
        {onReplyPrivately && (
          <ActionRow
            title={t("app.groups.replyPrivately")}
            description={t("app.groups.replyPrivatelySub", {
              name: formatName(authorName ?? "") || t("app.groups.member"),
            })}
            busy={replyPrivatelyBusy}
            onClick={() => onReplyPrivately(post)}
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

/* ── Comment actions ────────────────────────────────────────────────────── */

export interface CommentActionsProps {
  /** True for a reply (a child reaction) — only the wording differs. */
  isReply: boolean;
  /** The comment's author was the signed-in member. */
  mine: boolean;
  /** Host or SUPPORT: may delete anyone's comment. */
  canModerate: boolean;
  authorName?: string | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
  onReplyPrivately?: () => void;
  replyPrivatelyBusy?: boolean;
}

/**
 * The ⋯ menu on a comment or a reply.
 *
 * Web had none at all: a comment could not be edited or reported, and deleting
 * one was an inline link. Mobile opens the same actions modal it opens for a
 * post (`ReportPost.modal.tsx`), with the nouns swapped — so this mirrors that
 * set rather than inventing a smaller one.
 */
export function CommentActionsSheet({
  isReply,
  mine,
  canModerate,
  authorName,
  onClose,
  onEdit,
  onDelete,
  onReport,
  onReplyPrivately,
  replyPrivatelyBusy,
}: CommentActionsProps) {
  return (
    <Sheet
      open
      title={t(isReply ? "app.groups.replyActions" : "app.groups.commentActions")}
      onClose={onClose}
    >
      <div className="pb-2">
        {mine && (
          <ActionRow
            title={t(isReply ? "app.groups.editReply" : "app.groups.editComment")}
            onClick={onEdit}
          />
        )}
        {!mine && (
          <ActionRow
            title={t(isReply ? "app.groups.reportReply" : "app.groups.reportComment")}
            description={t(
              isReply ? "app.groups.reportReplySub" : "app.groups.reportCommentSub",
            )}
            onClick={onReport}
          />
        )}
        {onReplyPrivately && (
          <ActionRow
            title={t("app.groups.replyPrivately")}
            description={t("app.groups.replyPrivatelySub", {
              name: formatName(authorName ?? "") || t("app.groups.member"),
            })}
            busy={replyPrivatelyBusy}
            onClick={onReplyPrivately}
          />
        )}
        {(mine || canModerate) && (
          <ActionRow
            title={t(isReply ? "app.groups.deleteReply" : "app.groups.deleteComment")}
            danger
            onClick={onDelete}
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

/** What is being reported, and everything moderation needs to act on it. */
export interface ReportTarget {
  /** The activity id for a post, the reaction id for a comment or reply. */
  id: string;
  /** The author of the reported content. */
  authorId: string;
  /** The reported body itself — HTML for a post, text for a comment. */
  body: string;
  type: ReportTargetTypeValue;
  /** Only changes the wording; a reply reports as a `COMMENT`. */
  isReply?: boolean;
}

/**
 * Reporting a post, a comment or a reply.
 *
 * Two things were missing and both mattered to whoever reads these: choosing
 * *Other* submitted the literal word "Other" with no way to say what happened,
 * and the payload carried neither the reported member, the content, nor whether
 * it was a post or a comment. See `lib/groups/reporting.ts`.
 */
export function ReportSheet({
  target,
  currentUserId,
  onClose,
}: {
  target: ReportTarget;
  currentUserId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);

  const disabled = reportSubmitDisabled({ reason, detail });

  const submit = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      await reportPost({
        postId: target.id,
        reportedUser: target.authorId,
        reporterUser: currentUserId,
        post: target.body,
        type: target.type,
        reason: reportReasonValue({ reason, detail }),
      });
      toast.success(t("app.groups.reportThanks"));
      onClose();
    } catch (err) {
      console.error("[groups] report failed:", err);
      toast.error(t("app.groups.reportError"));
    } finally {
      setBusy(false);
    }
  };

  const title =
    target.type === ReportTargetType.POST
      ? t("app.groups.reportTitle")
      : target.isReply
        ? t("app.groups.reportTitleReply")
        : t("app.groups.reportTitleComment");

  return (
    <Sheet
      open
      title={title}
      subtitle={t("app.groups.reportPrompt")}
      onClose={onClose}
      footer={
        <Button fullWidth onClick={submit} disabled={disabled} loading={busy}>
          {t("app.groups.reportSubmit")}
        </Button>
      }
    >
      <div className="px-5 pb-4">
        {REPORT_REASONS.map((option) => (
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

        {reason === OTHER_REASON && (
          <div className="mt-4">
            <label
              htmlFor="report-detail"
              className="mb-1.5 block font-body text-[11px] font-bold uppercase tracking-[0.14em] text-cb-gray-500"
            >
              {t("app.groups.reportOtherLabel")}
            </label>
            <textarea
              id="report-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={4}
              maxLength={OTHER_MAX_CHARS}
              autoFocus
              placeholder={t("app.groups.reportOtherPlaceholder")}
              className="w-full resize-none rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-3.5 py-2.5 font-body text-[14.5px] text-cb-black outline-none transition-colors placeholder:text-cb-gray-400 focus:border-cb-black"
            />
            <p className="mt-1 font-body text-[12px] text-cb-gray-500">
              {t("app.groups.reportOtherHint")}
            </p>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/* ── Group info ─────────────────────────────────────────────────────────── */

/**
 * Who runs a group and who pays for it: avatar, member count, about, hosts,
 * sponsor.
 *
 * Extracted from the info sheet so a **non-member** can read it before joining.
 * Mobile opens the full group-detail screen from a Discover row; web's Discover
 * row only had a Join button, so the answer to "who hosts this?" was behind a
 * decision you had already made. Same content, two containers.
 */
export function GroupDetailBody({
  group,
  onNavigate,
}: {
  group: Group;
  /** Called when a link inside leaves — the sheet uses it to close itself. */
  onNavigate?: () => void;
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

  const onClose = onNavigate;

  return (
    <>
      {/* Wraps rather than squeezes: on a phone-width sheet the members link
          drops to its own line instead of crushing the sponsor name. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <GroupAvatar
          name={group.name}
          imageUrl={group.profilePicUrl}
          verified={group.verified}
          size={72}
        />
        <div className="min-w-0 flex-1 basis-[140px]">
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

        {/* Sits with the count rather than at the foot of the sheet — the
            number is what prompts the question "who's in here?". */}
        <Link
          href={`/groups/${group.id}/members`}
          onClick={onClose}
          className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-cb-gray-100 px-3.5 py-2 font-heading text-[13px] font-bold text-cb-black transition-colors hover:bg-cb-gray-200/70"
        >
          {t("app.groups.viewMembers")}
          <ChevronRightIcon size={14} className="text-cb-gray-400" />
        </Link>
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
    </>
  );
}

export function GroupInfoSheet({
  group,
  isMember,
  userId,
  onClose,
  onToggleMute,
  onLeave,
  muteBusy,
}: {
  group: Group;
  isMember: boolean;
  /** The signed-in account, to decide whether Leave applies. */
  userId: string | null;
  onClose: () => void;
  onToggleMute: () => void;
  onLeave: () => void;
  muteBusy?: boolean;
}) {
  return (
    <Sheet open wide title={group.name} onClose={onClose}>
      <div className="px-5 pb-6">
        <GroupDetailBody group={group} onNavigate={onClose} />

        {isMember && (
          <section className="mt-6 border-t border-cb-gray-100 pt-4">
            {/* Muting round-trips to AppSync and back, which is slow enough to
                look like a dead tap — so the row states what it's doing and
                spins until the answer lands. */}
            <ActionRow
              title={
                muteBusy
                  ? t(group.muted ? "app.groups.unmuting" : "app.groups.muting")
                  : t(
                      group.muted
                        ? "app.groups.unmuteGroup"
                        : "app.groups.muteGroup",
                    )
              }
              description={
                group.muted
                  ? t("app.groups.unmuteGroupSub")
                  : t("app.groups.muteGroupSub")
              }
              busy={muteBusy}
              onClick={onToggleMute}
            />
            {/*
              Hosts get Mute but not Leave: leaving would orphan the group they
              host, and neither client can undo it. Mobile hides the row the same
              way (`GroupActions.tsx:44`).
            */}
            {canLeaveGroup({ userId, hosts: group.hosts }) && (
              <ActionRow
                title={t("app.groups.leaveGroup")}
                description={t("app.groups.leaveGroupSub")}
                danger
                disabled={muteBusy}
                onClick={onLeave}
              />
            )}
          </section>
        )}
      </div>
    </Sheet>
  );
}
