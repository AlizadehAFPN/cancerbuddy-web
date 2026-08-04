"use client";

/**
 * A post's comment thread, opened as a sheet from the feed.
 *
 * Threads are two levels deep — comments and replies to them — which is the
 * depth Stream stores as child reactions and the depth mobile renders. Adding
 * a comment refetches the thread rather than splicing it in: reaction ids and
 * counts come from the server, and guessing them leads to a thread that
 * disagrees with the next reload.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui";
import BuddyAvatar from "@/components/buddies/BuddyAvatar";
import PostCard, { postTimestamp } from "@/components/groups/PostCard";
import { formatName } from "@/lib/buddies/display";
import { loadAuthor } from "@/lib/groups/authors";
import { useGroups } from "@/lib/groups/GroupsProvider";
import {
  addComment,
  addReply,
  deleteComment,
  fetchPostComments,
} from "@/lib/groups/posts";
import type { FeedComment, FeedPost } from "@/lib/groups/types";

function CommentRow({
  comment,
  currentUserId,
  depth,
  onReply,
  onDelete,
  highlighted = false,
}: {
  comment: FeedComment;
  currentUserId: string | null;
  depth: number;
  onReply: (comment: FeedComment) => void;
  onDelete: (comment: FeedComment) => void;
  /** The comment an Updates notification pointed at — opened and scrolled to. */
  highlighted?: boolean;
}) {
  const [showReplies, setShowReplies] = useState(depth > 0 || highlighted);
  const rowRef = useRef<HTMLLIElement>(null);
  const name = formatName(comment.author?.name ?? "Member");
  const mine = comment.userId === currentUserId;

  // Mobile scrolls the highlighted comment to a third of the way down the
  // screen; `center` is the closest equivalent that doesn't fight the sheet's
  // own scroll container.
  useEffect(() => {
    if (!highlighted) return;
    rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

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
        <BuddyAvatar
          name={comment.author?.name ?? "?"}
          photoUrl={comment.author?.profilePicUrl}
          size={depth > 0 ? 28 : 34}
        />
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-cb-gray-100 px-3.5 py-2.5">
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-[13.5px] font-bold text-cb-black">
                {name}
              </span>
              <span className="font-body text-[11.5px] text-cb-gray-500">
                {postTimestamp(comment.createdAt)}
                {comment.edited && ` · ${t("app.groups.edited")}`}
              </span>
            </div>
            <p className="mt-0.5 whitespace-pre-line font-body text-[14px] leading-snug text-cb-black">
              {comment.text}
            </p>
          </div>

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
            {mine && (
              <button
                type="button"
                onClick={() => onDelete(comment)}
                className="font-body text-[12px] font-semibold text-cb-gray-600 hover:text-cb-danger"
              >
                {t("app.groups.deleteCommentConfirm").replace("?", "")}
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
                  currentUserId={currentUserId}
                  depth={depth + 1}
                  onReply={onReply}
                  onDelete={onDelete}
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

export default function PostThread({
  post,
  canModerate,
  onClose,
  onCommentCountChange,
  highlightCommentId,
}: {
  /**
   * Opened from the feed this is the real post. Opened from an Updates
   * notification only `id` and `feedId` are known — the rest is filled in by
   * the fetch below, the same way mobile's `PostDetail` receives `{id, feedId}`
   * and loads the body itself.
   */
  post: FeedPost;
  canModerate: boolean;
  onClose: () => void;
  onCommentCountChange: (postId: string, count: number) => void;
  /** A comment to open and scroll to — mobile's `highlightParentReactionId`. */
  highlightCommentId?: string;
}) {
  const { userId, requireFeedSession } = useGroups();

  const [comments, setComments] = useState<FeedComment[]>([]);
  const [detail, setDetail] = useState<FeedPost>(post);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const session = await requireFeedSession();
      const result = await fetchPostComments(session, post.id, loadAuthor);
      setComments(result.comments);
      if (result.post) setDetail({ ...result.post, author: result.post.author ?? post.author });
      setError(null);

      const total = result.comments.reduce(
        (n, c) => n + 1 + c.replies.length,
        0,
      );
      onCommentCountChange(post.id, total);
    } catch (err) {
      console.error("[groups] thread load failed:", err);
      setError(t("app.groups.feedError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, requireFeedSession]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const session = await requireFeedSession();
      if (replyTo) {
        await addReply({ session, parentReactionId: replyTo.id, text });
      } else {
        await addComment({ session, activityId: post.id, text });
      }
      setDraft("");
      setReplyTo(null);
      await load();
    } catch (err) {
      console.error("[groups] comment failed:", err);
      toast.error(t("app.groups.commentError"));
    } finally {
      setSending(false);
    }
  };

  const remove = async (comment: FeedComment) => {
    try {
      const session = await requireFeedSession();
      await deleteComment(session, comment.id);
      toast.success(t("app.groups.commentDeleted"));
      await load();
    } catch (err) {
      console.error("[groups] comment delete failed:", err);
      toast.error(t("app.groups.deleteError"));
    }
  };

  return (
    <Sheet
      open
      wide
      title={t("app.groups.comments")}
      onClose={onClose}
      footer={
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
          <div className="flex items-end gap-2">
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
              disabled={!draft.trim()}
              loading={sending}
            >
              {t("app.groups.send")}
            </Button>
          </div>
        </div>
      }
    >
      <div className="px-5 pb-4">
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
            onToggleLike={() => {}}
            onOpenComments={() => {}}
            onOpenActions={() => {}}
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
        ) : error ? (
          <p className="mt-6 text-center font-body text-[14px] text-cb-black">
            {error}
          </p>
        ) : comments.length === 0 ? (
          <p className="mt-8 text-center font-body text-[14px] text-cb-gray-500">
            {t("app.groups.noComments")}
          </p>
        ) : (
          <ul className="mt-2">
            {comments.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                currentUserId={userId}
                depth={0}
                onReply={setReplyTo}
                onDelete={remove}
                highlighted={
                  !!highlightCommentId && comment.id === highlightCommentId
                }
              />
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
