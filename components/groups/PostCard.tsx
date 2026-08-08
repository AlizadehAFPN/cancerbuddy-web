"use client";

/**
 * One post in a group feed.
 *
 * The body is stored as HTML by the composer, so it goes through
 * `sanitizePostHtml` before rendering — see that module for why that isn't
 * optional on the web.
 *
 * Which menu actions appear depends on who's looking: authors can edit and
 * delete their own, hosts (and support accounts) can delete anyone's and pin
 * one post per group, and everyone else can report.
 */

import { useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import BuddyAvatar from "@/components/buddies/BuddyAvatar";
import { ageSuffix } from "@/lib/buddies/age";
import { formatName } from "@/lib/buddies/display";
import { authorProfileHref } from "@/lib/groups/authorLink";
import { useGroups } from "@/lib/groups/GroupsProvider";
import { sanitizePostHtml } from "@/lib/groups/sanitizeHtml";
import PostAttachments from "@/components/groups/PostAttachments";
import { useLikeSnapshot } from "@/lib/groups/useLikes";
import type { FeedPost } from "@/lib/groups/types";

/** "3m", "5h", "12 Mar" — compact relative time, like the mobile post header. */
export function postTimestamp(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    ...(new Date(iso).getFullYear() === new Date().getFullYear()
      ? {}
      : { year: "numeric" }),
  });
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 20.5l1.5-4.4A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

function PinIcon() {
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
      <path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z" />
    </svg>
  );
}

/**
 * Wraps an author's avatar or name in their link, and renders it plainly when
 * there is nowhere to go — an author whose record never resolved, which happens
 * for deleted accounts.
 */
export function AuthorLink({
  href,
  name,
  children,
}: {
  href: string | null;
  name: string;
  children: React.ReactNode;
}) {
  if (!href) return <>{children}</>;
  return (
    <Link
      href={href}
      aria-label={name}
      className="shrink-0 rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-cb-black"
    >
      {children}
    </Link>
  );
}

export interface PostCardProps {
  post: FeedPost;
  currentUserId: string | null;
  /** True when the viewer can moderate this group (host or support account). */
  canModerate: boolean;
  onToggleLike: (post: FeedPost) => void;
  onOpenComments: (post: FeedPost) => void;
  onOpenActions: (post: FeedPost) => void;
  /** Renders the full body instead of a clamped preview. */
  expanded?: boolean;
}

export default function PostCard({
  post,
  currentUserId,
  canModerate,
  onToggleLike,
  onOpenComments,
  onOpenActions,
  expanded,
}: PostCardProps) {
  const [showFull, setShowFull] = useState(!!expanded);
  const { role } = useGroups();

  const author = post.author;
  /**
   * Counts come from the shared store, not the `post` prop, so the feed and the
   * comment thread cannot disagree. The prop is the fallback until the first
   * snapshot for this post is recorded.
   */
  const counts = useLikeSnapshot(post.id, {
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    myLikeReactionId: post.myLikeReactionId,
  });
  const liked = !!counts.myLikeReactionId;
  const isHostPost = !!author?.groupHostId && author.groupHostId === post.feedId;
  const canAct = !!currentUserId;

  const displayName = author?.name
    ? `${formatName(author.name, author.userType ?? undefined)}${ageSuffix(
        author.userType ?? "",
        author.birth,
      )}`
    : "Member";

  const html = sanitizePostHtml(post.html);

  /**
   * The author opens their profile — or their host page, or the group they host.
   * Five destinations that a mobile user reaches from one tap and web reached
   * from none: the author was inert text.
   */
  const authorLink = authorProfileHref(
    {
      authorId: author?.id ?? post.actorId,
      groupHostId: author?.groupHostId,
      postFeedId: post.feedId,
    },
    {
      viewerId: currentUserId,
      viewerBirth: role.birth,
      author: {
        id: author?.id ?? post.actorId,
        birth: author?.birth,
        isSnooze: author?.isSnooze,
      },
    },
  );

  return (
    <article className="rounded-2xl border border-cb-gray-200 bg-white p-4">
      {post.pinned && (
        <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-cb-bone px-2.5 py-1 font-body text-[11px] font-bold text-cb-yellow-800">
          <PinIcon />
          {t("app.groups.pinnedPost")}
        </span>
      )}

      <header className="flex items-start gap-3">
        <AuthorLink href={authorLink} name={displayName}>
          <BuddyAvatar
            name={author?.name ?? "?"}
            photoUrl={author?.profilePicUrl}
            goalUrl={author?.goalImageUrl}
            size={44}
          />
        </AuthorLink>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <AuthorLink href={authorLink} name={displayName}>
              <span className="font-heading text-[15px] font-bold leading-tight text-cb-black">
                {displayName}
              </span>
            </AuthorLink>
            {isHostPost && (
              <span className="rounded-full bg-cb-green px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wide text-cb-black">
                {t("app.groups.host")}
              </span>
            )}
            {author?.ambassador && (
              <span className="rounded-full bg-cb-bone px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wide text-cb-black">
                {t("app.buddies.ambassador")}
              </span>
            )}
          </div>
          <span className="font-body text-[12.5px] text-cb-gray-500">
            {postTimestamp(post.createdAt)}
            {post.edited && ` · ${t("app.groups.edited")}`}
          </span>
        </div>

        {canAct && (
          <button
            type="button"
            onClick={() => onOpenActions(post)}
            aria-label={t("app.groups.postActions")}
            className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-cb-gray-400 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
          >
            <DotsIcon />
          </button>
        )}
      </header>

      <div
        className={[
          "prose-cb mt-3 font-body text-[15px] leading-relaxed text-cb-black",
          showFull ? "" : "line-clamp-6",
        ].join(" ")}
        // Sanitised above: allowlisted tags only, no attributes beyond safe hrefs.
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {!showFull && html.length > 400 && (
        <button
          type="button"
          onClick={() => setShowFull(true)}
          className="mt-1 font-body text-[13px] font-semibold text-cb-gray-600 underline-offset-2 hover:text-cb-black hover:underline"
        >
          {t("app.groups.loadMore")}
        </button>
      )}

      <PostAttachments attachments={post.attachments} />

      <footer className="mt-3 flex items-center gap-1 border-t border-cb-gray-100 pt-2.5">
        <button
          type="button"
          onClick={() => onToggleLike(post)}
          disabled={!canAct}
          aria-pressed={liked}
          aria-label={liked ? t("app.groups.unlike") : t("app.groups.like")}
          className={[
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-[13px] font-semibold transition-colors",
            liked
              ? "text-cb-danger hover:bg-cb-danger/10"
              : "text-cb-gray-600 hover:bg-cb-gray-100 hover:text-cb-black",
            canAct ? "" : "cursor-not-allowed opacity-60",
          ].join(" ")}
        >
          <HeartIcon filled={liked} />
          {counts.likeCount > 0 && counts.likeCount}
        </button>

        <button
          type="button"
          onClick={() => onOpenComments(post)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-[13px] font-semibold text-cb-gray-600 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
        >
          <CommentIcon />
          {counts.commentCount > 0 ? counts.commentCount : t("app.groups.comments")}
        </button>

        {canModerate && post.pinned && (
          <span className="ml-auto font-body text-[11.5px] text-cb-gray-400">
            {t("app.groups.pinnedPost")}
          </span>
        )}
      </footer>
    </article>
  );
}
