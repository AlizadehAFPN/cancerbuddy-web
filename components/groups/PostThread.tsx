"use client";

/**
 * A post's comment thread, opened as a sheet from the feed.
 *
 * Threads are two levels deep — comments and replies to them — which is the
 * depth Stream stores as child reactions and the depth mobile renders. Adding
 * a comment refetches the thread rather than splicing it in: reaction ids and
 * counts come from the server, and guessing them leads to a thread that
 * disagrees with the next reload.
 *
 * Three things a comment carries that web used to drop: its **body is HTML**
 * (mobile sends `\n` as `<br>`, so web rendered the literal characters), its
 * author has an age, a host badge and an ambassador badge, and it has a ⋯ menu —
 * edit, report, delete, reply privately — which web had no affordance for at all.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Sheet } from "@/components/ui/Sheet";
import {
  CommentActionsSheet,
  ConfirmSheet,
  ReportSheet,
} from "@/components/groups/GroupSheets";
import { Button } from "@/components/ui";
import BuddyAvatar from "@/components/buddies/BuddyAvatar";
import PostCard, { AuthorLink, postTimestamp } from "@/components/groups/PostCard";
import PostAttachments from "@/components/groups/PostAttachments";
import {
  uploadFeedMedia,
  validateDocument,
} from "@/lib/groups/feedMedia";
import { ageSuffix } from "@/lib/buddies/age";
import { formatName } from "@/lib/buddies/display";
import { authorProfileHref } from "@/lib/groups/authorLink";
import { loadAuthor } from "@/lib/groups/authors";
import { useGroups } from "@/lib/groups/GroupsProvider";
import { canReplyPrivately } from "@/lib/groups/moderation";
import { ReportTargetType } from "@/lib/groups/reporting";
import {
  POST_MAX_CHARS,
  commentToHtml,
  htmlToPlainText,
  shouldShowCounter,
} from "@/lib/groups/richText";
import { sanitizePostHtml } from "@/lib/groups/sanitizeHtml";
import { useReplyPrivately } from "@/lib/groups/useReplyPrivately";
import { useToggleLike } from "@/lib/groups/useLikes";
import {
  addComment,
  addReply,
  deleteComment,
  editComment,
  fetchMoreComments,
  fetchPostCommentsWithRetry,
} from "@/lib/groups/posts";
import type { FeedComment, FeedPost } from "@/lib/groups/types";

function DotsIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

function CommentRow({
  comment,
  post,
  currentUserId,
  viewerBirth,
  canModerate,
  depth,
  onReply,
  onOpenActions,
  highlighted = false,
}: {
  comment: FeedComment;
  /** The post the thread belongs to — the host badge compares against its feed. */
  post: FeedPost;
  currentUserId: string | null;
  viewerBirth: string | null;
  /**
   * A group host or SUPPORT account may delete anyone's comment, not only their
   * own — the same authority the `deleteMessage` Lambda enforces server-side, and
   * the same rule mobile applies to posts.
   */
  canModerate: boolean;
  depth: number;
  onReply: (comment: FeedComment) => void;
  onOpenActions: (comment: FeedComment, isReply: boolean) => void;
  /** The comment an Updates notification pointed at — opened and scrolled to. */
  highlighted?: boolean;
}) {
  const [showReplies, setShowReplies] = useState(depth > 0 || highlighted);
  const rowRef = useRef<HTMLLIElement>(null);
  const author = comment.author;
  const name = `${formatName(author?.name ?? "Member", author?.userType ?? undefined)}${ageSuffix(
    author?.userType ?? "",
    author?.birth,
  )}`;
  const isHostComment =
    !!author?.groupHostId && author.groupHostId === post.feedId;

  // Mobile scrolls the highlighted comment to a third of the way down the
  // screen; `center` is the closest equivalent that doesn't fight the sheet's
  // own scroll container.
  useEffect(() => {
    if (!highlighted) return;
    rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  const authorLink = authorProfileHref(
    {
      authorId: comment.userId,
      groupHostId: author?.groupHostId,
      postFeedId: post.feedId,
    },
    {
      viewerId: currentUserId,
      viewerBirth,
      author: {
        id: comment.userId,
        birth: author?.birth,
        isSnooze: author?.isSnooze,
      },
    },
  );

  return (
    <li ref={rowRef} className={depth > 0 ? "ml-9 mt-3" : "mt-4"}>
      <div
        className={
          highlighted
            ? "-mx-2 rounded-2xl bg-cb-bone-300 px-2 py-2 transition-colors"
            : undefined
        }
      >
        <div className="flex items-start gap-2.5">
          <AuthorLink href={authorLink} name={name}>
            <BuddyAvatar
              name={author?.name ?? "?"}
              photoUrl={author?.profilePicUrl}
              goalUrl={author?.goalImageUrl}
              size={depth > 0 ? 28 : 34}
            />
          </AuthorLink>
          <div className="min-w-0 flex-1">
            <div className="rounded-2xl bg-cb-gray-100 px-3.5 py-2.5">
              <div className="flex items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <AuthorLink href={authorLink} name={name}>
                    <span className="font-heading text-[13.5px] font-bold text-cb-black">
                      {name}
                    </span>
                  </AuthorLink>
                  {isHostComment && (
                    <span className="rounded-full bg-cb-green px-1.5 py-0.5 font-body text-[9.5px] font-bold uppercase tracking-wide text-cb-black">
                      {t("app.groups.host")}
                    </span>
                  )}
                  {author?.ambassador && (
                    <span className="rounded-full bg-cb-bone px-1.5 py-0.5 font-body text-[9.5px] font-bold uppercase tracking-wide text-cb-black">
                      {t("app.buddies.ambassador")}
                    </span>
                  )}
                  <span className="font-body text-[11.5px] text-cb-gray-500">
                    {postTimestamp(comment.createdAt)}
                    {comment.edited && ` · ${t("app.groups.edited")}`}
                  </span>
                </div>

                {currentUserId && (
                  <button
                    type="button"
                    onClick={() => onOpenActions(comment, depth > 0)}
                    aria-label={t(
                      depth > 0
                        ? "app.groups.replyActions"
                        : "app.groups.commentActions",
                    )}
                    className="-mr-1 -mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-cb-gray-400 transition-colors hover:bg-cb-gray-200/70 hover:text-cb-black"
                  >
                    <DotsIcon />
                  </button>
                )}
              </div>

              {/*
                Comment bodies are HTML on both clients — mobile stores `\n` as
                `<br>` and renders through RenderHtml. Sanitised for the same
                reason post bodies are: a browser will run what a React Native
                parser ignores. `whitespace-pre-line` stays for the comments web
                wrote as plain text before this.
              */}
              <div
                className="mt-0.5 whitespace-pre-line font-body text-[14px] leading-snug text-cb-black [&_a]:text-cb-link [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: sanitizePostHtml(comment.text) }}
              />
            </div>

            {/* Comments carry media too, and it was parsed but never rendered. */}
            <PostAttachments attachments={comment.attachments} />

            <div className="mt-1 flex items-center gap-3 pl-1">
              {depth === 0 && (
                <button
                  type="button"
                  onClick={() => onReply(comment)}
                  className="font-body text-[12px] font-semibold text-cb-gray-600 hover:text-cb-black"
                >
                  {t("app.groups.reply")}
                </button>
              )}
              {comment.replyCount > 0 && depth === 0 && (
                <button
                  type="button"
                  onClick={() => setShowReplies((v) => !v)}
                  className="font-body text-[12px] font-semibold text-cb-gray-600 hover:text-cb-black"
                >
                  {showReplies
                    ? t("app.groups.hideReplies")
                    : t(
                        comment.replyCount === 1
                          ? "app.groups.replyCountOne"
                          : "app.groups.replyCount",
                        { count: comment.replyCount },
                      )}
                </button>
              )}
            </div>

            {showReplies && comment.replies.length > 0 && (
              <ul>
                {comment.replies.map((reply) => (
                  <CommentRow
                    key={reply.id}
                    comment={reply}
                    post={post}
                    currentUserId={currentUserId}
                    viewerBirth={viewerBirth}
                    canModerate={canModerate}
                    depth={depth + 1}
                    onReply={onReply}
                    onOpenActions={onOpenActions}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/** Which comment a sheet is acting on, and as what. */
interface CommentTarget {
  comment: FeedComment;
  isReply: boolean;
}

export default function PostThread({
  post,
  group,
  canModerate,
  onClose,
  onCommentCountChange,
  onOpenActions,
  highlightCommentId,
}: {
  /**
   * Opened from the feed this is the real post. Opened from an Updates
   * notification only `id` and `feedId` are known — the rest is filled in by
   * the fetch below, the same way mobile's `PostDetail` receives `{id, feedId}`
   * and loads the body itself.
   */
  post: FeedPost;
  /** The group, for the "reply privately" pre-filled sentence. */
  group?: { id: string; name: string } | null;
  canModerate: boolean;
  onClose: () => void;
  onCommentCountChange: (postId: string, count: number) => void;
  /**
   * Opens the post's ⋯ menu. Owned by the feed, which holds the sheet stack —
   * the thread would otherwise render a second, competing sheet over itself.
   */
  onOpenActions: (post: FeedPost) => void;
  /** A comment to open and scroll to — mobile's `highlightParentReactionId`. */
  highlightCommentId?: string;
}) {
  const { userId, role, requireFeedSession } = useGroups();
  const toggleLike = useToggleLike(requireFeedSession);
  const { replyPrivately, busy: replyingPrivately } = useReplyPrivately();

  const [comments, setComments] = useState<FeedComment[]>([]);
  const [detail, setDetail] = useState<FeedPost>(post);
  const [loading, setLoading] = useState(true);
  /** The post itself could not be read, twice — mobile's CONTENT NOT FOUND. */
  const [notFound, setNotFound] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const [sending, setSending] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<File[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const commentFileInput = useRef<HTMLInputElement>(null);

  /** Stream's cursor for the comments past the first page. */
  const [nextComments, setNextComments] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const [actionsFor, setActionsFor] = useState<CommentTarget | null>(null);
  const [editing, setEditing] = useState<CommentTarget | null>(null);
  const [reporting, setReporting] = useState<CommentTarget | null>(null);
  /**
   * Comment deletion is confirmed before it is sent. It used to fire straight
   * from the row — and since deletion now goes through a Lambda that really
   * deletes, an accidental tap was unrecoverable.
   */
  const [pendingDelete, setPendingDelete] = useState<CommentTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  /** True once the thread has been read successfully at least once. */
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const session = await requireFeedSession();
      const result = await fetchPostCommentsWithRetry(session, post.id, loadAuthor);

      if (!result.post) {
        // Keep whatever is on screen; only a first load that never returned the
        // post can mean the content is really gone. Mobile draws the same line
        // (`PostDetails.tsx:118-125`).
        if (!loadedRef.current) setNotFound(true);
        return;
      }

      loadedRef.current = true;
      setNotFound(false);
      setComments(result.comments);
      setNextComments(result.next);
      setDetail({ ...result.post, author: result.post.author ?? post.author });

      /**
       * The larger of what is on screen and what the server counts. Counting the
       * rendered rows alone under-reports a thread longer than one page — which
       * is now possible to have, and used to be invisible.
       */
      const counted = result.comments.reduce(
        (n, c) => n + 1 + c.replies.length,
        0,
      );
      onCommentCountChange(post.id, Math.max(counted, result.post.commentCount));
    } catch (err) {
      // `fetchPostCommentsWithRetry` swallows its own failures; this is the
      // session itself being unavailable, which is the same outcome for a reader.
      console.error("[groups] thread load failed:", err);
      if (!loadedRef.current) setNotFound(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, requireFeedSession]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  /** The rest of a thread longer than one page of reactions. */
  const loadMoreComments = useCallback(async () => {
    if (!nextComments || loadingMore) return;
    setLoadingMore(true);
    try {
      const session = await requireFeedSession();
      const page = await fetchMoreComments(session, nextComments, loadAuthor);
      setComments((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...page.comments.filter((c) => !seen.has(c.id))];
      });
      setNextComments(page.next);
    } catch (err) {
      console.error("[groups] comment paging failed:", err);
      toast.error(t("app.groups.feedError"));
    } finally {
      setLoadingMore(false);
    }
  }, [nextComments, loadingMore, requireFeedSession]);

  const pickFiles = (files: FileList | null) => {
    setMediaError(null);
    const accepted: File[] = [];
    for (const file of Array.from(files ?? [])) {
      if (!validateDocument(file).ok) {
        setMediaError(t("app.groups.attachmentTooLarge"));
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length) setPendingMedia((p) => [...p, ...accepted]);
  };

  const draftLength = draft.trim().length;
  const overLimit = draftLength > POST_MAX_CHARS;

  const submit = async () => {
    const text = draft.trim();
    // A comment may be media only, as on mobile.
    if ((!text && pendingMedia.length === 0) || sending || overLimit) return;

    setSending(true);
    try {
      const attachments = pendingMedia.length
        ? await Promise.all(pendingMedia.map(uploadFeedMedia))
        : [];
      const session = await requireFeedSession();
      // Line breaks are stored as `<br>`, which is what mobile writes and what
      // both clients render.
      const body = commentToHtml(text);
      if (replyTo) {
        await addReply({
          session,
          parentReactionId: replyTo.id,
          text: body,
          attachments,
        });
      } else {
        await addComment({
          session,
          activityId: post.id,
          text: body,
          attachments,
        });
      }
      setDraft("");
      setPendingMedia([]);
      setReplyTo(null);
      await load();
    } catch (err) {
      console.error("[groups] comment failed:", err);
      toast.error(t("app.groups.commentError"));
    } finally {
      setSending(false);
    }
  };

  const confirmRemove = async () => {
    const target = pendingDelete;
    if (!target) return;
    setDeleting(true);
    try {
      await deleteComment(post, target.comment.id);
      setPendingDelete(null);
      toast.success(
        t(target.isReply ? "app.groups.replyDeleted" : "app.groups.commentDeleted"),
      );
      await load();
    } catch (err) {
      console.error("[groups] comment delete failed:", err);
      toast.error(t("app.groups.deleteError"));
    } finally {
      setDeleting(false);
    }
  };

  const saveEdit = async (text: string) => {
    const target = editing;
    if (!target) return;
    try {
      const session = await requireFeedSession();
      await editComment(session, target.comment.id, commentToHtml(text));
      setEditing(null);
      toast.success(t("app.groups.commentUpdated"));
      await load();
    } catch (err) {
      console.error("[groups] comment edit failed:", err);
      toast.error(t("app.groups.editCommentError"));
    }
  };

  const openReplyPrivately = async (target: CommentTarget) => {
    setActionsFor(null);
    await replyPrivately({
      authorId: target.comment.userId,
      authorName: target.comment.author?.name,
      groupName: group?.name,
      // The parent post, not the reaction: a reaction id resolves to nothing on
      // the other side, so the recipient would land on "content not found".
      post: { id: post.id, feedId: post.feedId, actorId: detail.actorId },
    });
  };

  const actionsAuthor = actionsFor?.comment.author;
  const mayReplyPrivately =
    !!actionsFor &&
    canReplyPrivately({
      viewerType: role.userType,
      authorType: actionsAuthor?.userType,
      viewerId: userId,
      authorId: actionsFor.comment.userId,
    });

  return (
    <Sheet
      open
      wide
      title={t("app.groups.comments")}
      onClose={onClose}
      footer={
        notFound ? undefined : (
          <div className="space-y-2">
            {replyTo && (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-cb-gray-100 px-3 py-1.5">
                <span className="min-w-0 truncate font-body text-[12.5px] text-cb-gray-600">
                  {t("app.groups.replyPlaceholder", {
                    name: formatName(replyTo.author?.name ?? "Member"),
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="font-body text-[12px] font-semibold text-cb-gray-600 hover:text-cb-black"
                >
                  {t("app.groups.cancel")}
                </button>
              </div>
            )}
            {pendingMedia.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-2">
                {pendingMedia.map((file, i) => (
                  <li
                    key={`${file.name}-${i}`}
                    className="flex items-center gap-2 rounded-lg border border-cb-gray-200 bg-cb-gray-100 py-1 pl-2.5 pr-1.5 font-body text-[12px] text-cb-black"
                  >
                    <span className="max-w-[160px] truncate">{file.name}</span>
                    <button
                      type="button"
                      aria-label={t("app.groups.removeAttachment", { name: file.name })}
                      onClick={() => setPendingMedia((p) => p.filter((_, j) => j !== i))}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-cb-gray-500 transition-colors hover:bg-cb-gray-300 hover:text-cb-black"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {mediaError && (
              <p role="alert" className="mb-2 font-body text-[12px] text-cb-danger">
                {mediaError}
              </p>
            )}

            <div className="flex items-end gap-2">
              <button
                type="button"
                aria-label={t("app.groups.attachMedia")}
                onClick={() => commentFileInput.current?.click()}
                className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-cb-gray-300 font-body text-[16px] text-cb-gray-600 transition-colors hover:border-cb-black hover:text-cb-black"
              >
                +
              </button>
              <input
                ref={commentFileInput}
                type="file"
                multiple
                accept="image/*,video/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  pickFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                rows={1}
                placeholder={t("app.groups.commentPlaceholder")}
                className="min-h-[44px] flex-1 resize-none rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-3.5 py-2.5 font-body text-[14.5px] text-cb-black outline-none transition-colors placeholder:text-cb-gray-400 focus:border-cb-black"
              />
              <Button
                size="md"
                onClick={submit}
                disabled={(!draft.trim() && pendingMedia.length === 0) || overLimit}
                loading={sending}
              >
                {t("app.groups.send")}
              </Button>
            </div>

            {/* Mobile caps comments at 2000 characters and reveals the counter at
                1920 (`PostDetails.tsx:447-451`); web had neither, so it could
                write a comment the mobile composer would have refused. */}
            {shouldShowCounter(draftLength) && (
              <p
                className={`text-right font-body text-[12px] ${
                  overLimit ? "text-cb-danger" : "text-cb-gray-500"
                }`}
              >
                {draftLength} / {POST_MAX_CHARS}
              </p>
            )}
          </div>
        )
      }
    >
      <div className="px-5 pb-4">
        {notFound ? (
          <div className="px-6 py-16 text-center">
            <p className="font-heading text-[17px] font-bold uppercase tracking-[0.08em] text-cb-black">
              {t("app.groups.contentNotFound")}
            </p>
            <p className="mt-1.5 font-body text-[14px] text-cb-gray-500">
              {t("app.groups.contentNotFoundSub")}
            </p>
          </div>
        ) : (
          <>
            {/* Opened from a notification the body arrives with the fetch, so show
                a placeholder until it does rather than an empty card. Opening from
                the feed the post is already complete and this never renders. */}
            {loading && !detail.html ? (
              <div aria-hidden className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-cb-gray-100" />
                  <div className="h-4 w-40 animate-pulse rounded bg-cb-gray-100" />
                </div>
                <div className="h-4 w-full animate-pulse rounded bg-cb-gray-100" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-cb-gray-100" />
              </div>
            ) : (
              <PostCard
                post={detail}
                currentUserId={userId}
                canModerate={canModerate}
                expanded
                onToggleLike={(p) =>
                  void toggleLike(p).catch(() => {
                    toast.error(t("app.groups.likeError"));
                  })
                }
                // Already in the thread — nothing to open.
                onOpenComments={() => {}}
                onOpenActions={onOpenActions}
              />
            )}

            {loading ? (
              <div aria-hidden className="mt-5 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-2.5">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-cb-gray-100" />
                    <div className="h-14 flex-1 animate-pulse rounded-2xl bg-cb-gray-100" />
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <p className="mt-8 text-center font-body text-[14px] text-cb-gray-500">
                {t("app.groups.noComments")}
              </p>
            ) : (
              <>
                <ul className="mt-2">
                  {comments.map((comment) => (
                    <CommentRow
                      key={comment.id}
                      comment={comment}
                      post={detail}
                      currentUserId={userId}
                      viewerBirth={role.birth}
                      canModerate={canModerate}
                      depth={0}
                      onReply={setReplyTo}
                      onOpenActions={(c, isReply) =>
                        setActionsFor({ comment: c, isReply })
                      }
                      highlighted={
                        !!highlightCommentId && comment.id === highlightCommentId
                      }
                    />
                  ))}
                </ul>

                {/* The thread used to stop at the first 25 reactions with no way
                    to reach the rest — on a busy post most of it was invisible. */}
                {nextComments && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void loadMoreComments()}
                      loading={loadingMore}
                    >
                      {t("app.groups.loadMoreComments")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {actionsFor && (
        <CommentActionsSheet
          isReply={actionsFor.isReply}
          mine={actionsFor.comment.userId === userId}
          canModerate={canModerate}
          authorName={actionsFor.comment.author?.name}
          replyPrivatelyBusy={replyingPrivately}
          onClose={() => setActionsFor(null)}
          onEdit={() => {
            setEditing(actionsFor);
            setActionsFor(null);
          }}
          onDelete={() => {
            setPendingDelete(actionsFor);
            setActionsFor(null);
          }}
          onReport={() => {
            setReporting(actionsFor);
            setActionsFor(null);
          }}
          onReplyPrivately={
            mayReplyPrivately ? () => void openReplyPrivately(actionsFor) : undefined
          }
        />
      )}

      {editing && (
        <EditCommentSheet
          target={editing}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}

      {reporting && userId && (
        <ReportSheet
          target={{
            id: reporting.comment.id,
            authorId: reporting.comment.userId,
            body: reporting.comment.text,
            type: ReportTargetType.COMMENT,
            isReply: reporting.isReply,
          }}
          currentUserId={userId}
          onClose={() => setReporting(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmSheet
          title={t(
            pendingDelete.isReply
              ? "app.groups.deleteReply"
              : "app.groups.deleteComment",
          )}
          body={t(
            pendingDelete.isReply
              ? "app.groups.deleteReplyConfirm"
              : "app.groups.deleteCommentConfirm",
          )}
          confirmLabel={t(
            pendingDelete.isReply
              ? "app.groups.deleteReply"
              : "app.groups.deleteComment",
          )}
          danger
          busy={deleting}
          onConfirm={() => void confirmRemove()}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </Sheet>
  );
}

/**
 * Editing a comment or reply, in place.
 *
 * A plain textarea, like mobile's `EditComment.modal` — comments have never
 * carried formatting beyond line breaks, and the stored `<br>`s are converted
 * back for editing exactly as mobile's `stripHtml` does.
 */
function EditCommentSheet({
  target,
  onClose,
  onSave,
}: {
  target: CommentTarget;
  onClose: () => void;
  onSave: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState(() => htmlToPlainText(target.comment.text));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await onSave(text.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      title={t(target.isReply ? "app.groups.editReply" : "app.groups.editComment")}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={busy}>
            {t("app.groups.cancel")}
          </Button>
          <Button
            fullWidth
            onClick={() => void save()}
            disabled={!text.trim()}
            loading={busy}
          >
            {t("app.groups.save")}
          </Button>
        </div>
      }
    >
      <div className="px-5 pb-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          autoFocus
          maxLength={POST_MAX_CHARS}
          className="w-full resize-none rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-3.5 py-2.5 font-body text-[14.5px] text-cb-black outline-none transition-colors focus:border-cb-black"
        />
      </div>
    </Sheet>
  );
}
