"use client";

/**
 * `/groups/[groupId]` — a group's feed: header, composer, posts, and the
 * actions reachable from each of them.
 *
 * Non-members see the group in read-only form with a Join prompt instead of the
 * composer, so a link to a public group still leads somewhere useful.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { ArrowLeftIcon } from "@/components/ui/icons";
import GroupAvatar from "@/components/groups/GroupAvatar";
import PostCard from "@/components/groups/PostCard";
import PostComposer from "@/components/groups/PostComposer";
import PostThread from "@/components/groups/PostThread";
import {
  ConfirmSheet,
  GroupInfoSheet,
  PostActionsSheet,
  ReportPostSheet,
} from "@/components/groups/GroupSheets";
import JoinGroupDialog from "@/components/groups/JoinGroupDialog";
import { useGroups } from "@/lib/groups/GroupsProvider";
import { useGroupFeed } from "@/lib/groups/useGroupFeed";
import { fetchGroupById } from "@/lib/groups/groupQueries";
import { leaveGroup, setGroupMuted } from "@/lib/groups/membership";
import { createPost, replacePin, togglePin } from "@/lib/groups/posts";
import type { FeedPost, Group } from "@/lib/groups/types";

type OpenSheet =
  | { kind: "actions"; post: FeedPost }
  | { kind: "report"; post: FeedPost }
  | { kind: "delete"; post: FeedPost }
  | { kind: "thread"; post: FeedPost; highlightCommentId?: string }
  | { kind: "pin-conflict"; post: FeedPost }
  | { kind: "info" }
  | { kind: "leave" }
  | { kind: "join" }
  | null;

/**
 * A post identified only by id — what an Updates notification carries.
 *
 * `PostThread` refetches by id and replaces every other field, so the blanks
 * are placeholders that never reach the screen. Mobile does the same thing,
 * handing `PostDetail` a `{id, feedId}` pair and nothing else.
 */
function postStub(id: string, feedId: string): FeedPost {
  return {
    id,
    feedId,
    actorId: "",
    html: "",
    createdAt: "",
    edited: false,
    pinned: false,
    likeCount: 0,
    commentCount: 0,
    attachments: [],
  };
}

function FeedSkeleton() {
  return (
    <div aria-hidden className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-cb-gray-200 bg-white p-4">
          <div className="flex gap-3">
            <div className="h-11 w-11 animate-pulse rounded-full bg-cb-gray-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/3 animate-pulse rounded bg-cb-gray-100" />
              <div className="h-3 w-1/5 animate-pulse rounded bg-cb-gray-100" />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-cb-gray-100" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-cb-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function GroupFeed({ groupId }: { groupId: string }) {
  const router = useRouter();
  const {
    userId,
    joinedGroups,
    isMember,
    liveGroupIds,
    liveEventIdFor,
    requireFeedSession,
    refreshGroups,
    removeJoinedGroup,
    setGroupMutedLocal,
  } = useGroups();

  const feed = useGroupFeed(groupId);

  const [group, setGroup] = useState<Group | null>(null);
  const [groupLoading, setGroupLoading] = useState(true);
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [editing, setEditing] = useState<FeedPost | null>(null);
  const [busy, setBusy] = useState(false);
  const [posting, setPosting] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);

  /**
   * Deep link from the Updates tab: `?post=…&feed=…&reaction=…` opens that
   * post's thread, which is where mobile lands too — its notification router
   * passes through the feed screen and straight on to `PostDetail`.
   *
   * Read once per target rather than on every render: the sheet is dismissible,
   * and re-opening it because the query string is still in the URL would trap
   * the user. Without the parameter nothing here runs and the feed behaves
   * exactly as before.
   */
  const searchParams = useSearchParams();
  const targetPostId = searchParams.get("post");
  const targetFeedId = searchParams.get("feed");
  const targetReactionId = searchParams.get("reaction");
  const openedTargetRef = useRef<string | null>(null);

  // Not a lazy initialiser: arriving from a second notification for the same
  // group changes only the query string, and this component stays mounted. The
  // ref bounds this to one state write per distinct target.
  useEffect(() => {
    if (!targetPostId || openedTargetRef.current === targetPostId) return;
    openedTargetRef.current = targetPostId;

    // Prefer the loaded post when the feed already has it — the sheet then
    // renders instantly instead of showing its placeholder for a beat.
    const loaded = feed.posts.find((p) => p.id === targetPostId);
    setSheet({
      kind: "thread",
      post: loaded ?? postStub(targetPostId, targetFeedId ?? groupId),
      highlightCommentId: targetReactionId ?? undefined,
    });
  }, [targetPostId, targetFeedId, targetReactionId, groupId, feed.posts]);

  // The joined copy carries mute state and the membership row id, so prefer it.
  const joined = useMemo(
    () => joinedGroups.find((g) => g.id === groupId),
    [joinedGroups, groupId],
  );
  const member = isMember(groupId);
  const live = liveGroupIds.has(groupId);
  const liveEventId = live ? liveEventIdFor(groupId) : null;

  useEffect(() => {
    let cancelled = false;
    setGroupLoading(true);
    fetchGroupById(groupId)
      .then((result) => {
        if (!cancelled) setGroup(result);
      })
      .catch((err) => console.error("[groups] group load failed:", err))
      .finally(() => {
        if (!cancelled) setGroupLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const displayGroup = useMemo<Group | null>(
    () => (joined ? { ...(group ?? joined), ...joined } : group),
    [group, joined],
  );

  const canModerate = useMemo(() => {
    if (!userId || !displayGroup) return false;
    return displayGroup.hosts.some((h) => h.id === userId);
  }, [userId, displayGroup]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !feed.hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) feed.loadMore();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [feed]);

  /* ── Actions ─────────────────────────────────────────────────────────── */

  const publish = useCallback(
    async (html: string) => {
      setPosting(true);
      try {
        const session = await requireFeedSession();
        await createPost({ session, groupId, html });
        toast.success(t("app.groups.postCreated"));
        await feed.refresh();
      } catch (err) {
        console.error("[groups] publish failed:", err);
        toast.error(t("app.groups.postError"));
      } finally {
        setPosting(false);
      }
    },
    [groupId, requireFeedSession, feed],
  );

  const saveEdit = useCallback(
    async (html: string) => {
      if (!editing) return;
      setPosting(true);
      try {
        await feed.updatePostBody(editing, html);
        toast.success(t("app.groups.postUpdated"));
        setEditing(null);
      } catch (err) {
        console.error("[groups] edit failed:", err);
        toast.error(t("app.groups.editError"));
      } finally {
        setPosting(false);
      }
    },
    [editing, feed],
  );

  const confirmDelete = useCallback(async () => {
    if (sheet?.kind !== "delete") return;
    setBusy(true);
    try {
      await feed.removePost(sheet.post);
      toast.success(t("app.groups.postDeleted"));
      setSheet(null);
    } catch (err) {
      console.error("[groups] delete failed:", err);
      toast.error(t("app.groups.deleteError"));
    } finally {
      setBusy(false);
    }
  }, [sheet, feed]);

  const handleTogglePin = useCallback(
    async (post: FeedPost) => {
      setSheet(null);
      try {
        const session = await requireFeedSession();
        const outcome = await togglePin(session, post);
        if (outcome === "conflict") {
          setSheet({ kind: "pin-conflict", post });
          return;
        }
        toast.success(
          outcome === "pinned" ? t("app.groups.pinned") : t("app.groups.unpinned"),
        );
        await feed.refresh();
      } catch (err) {
        console.error("[groups] pin failed:", err);
        toast.error(t("app.groups.pinError"));
      }
    },
    [requireFeedSession, feed],
  );

  const confirmReplacePin = useCallback(async () => {
    if (sheet?.kind !== "pin-conflict") return;
    setBusy(true);
    try {
      const session = await requireFeedSession();
      await replacePin(session, sheet.post);
      toast.success(t("app.groups.pinned"));
      setSheet(null);
      await feed.refresh();
    } catch (err) {
      console.error("[groups] pin replace failed:", err);
      toast.error(t("app.groups.pinError"));
    } finally {
      setBusy(false);
    }
  }, [sheet, requireFeedSession, feed]);

  const handleToggleMute = useCallback(async () => {
    if (!joined?.userGroupId || !userId || !displayGroup) return;
    setBusy(true);
    const nextMuted = !joined.muted;
    try {
      const ok = await setGroupMuted({
        userId,
        groupId,
        userGroupId: joined.userGroupId,
        muted: !!joined.muted,
      });
      if (!ok) throw new Error("mute rejected");
      setGroupMutedLocal(groupId, nextMuted);
      toast.success(
        t(nextMuted ? "app.groups.mutedToast" : "app.groups.unmutedToast", {
          name: displayGroup.name,
        }),
      );
    } catch (err) {
      console.error("[groups] mute failed:", err);
      toast.error(t("app.groups.muteError"));
    } finally {
      setBusy(false);
    }
  }, [joined, userId, groupId, displayGroup, setGroupMutedLocal]);

  const confirmLeave = useCallback(async () => {
    if (!joined?.userGroupId || !displayGroup) return;
    setBusy(true);
    try {
      const session = await requireFeedSession();
      await leaveGroup({ session, groupId, userGroupId: joined.userGroupId });
      removeJoinedGroup(groupId);
      toast.success(t("app.groups.leftToast", { name: displayGroup.name }));
      setSheet(null);
      router.push("/groups");
    } catch (err) {
      console.error("[groups] leave failed:", err);
      toast.error(t("app.groups.leaveError"));
    } finally {
      setBusy(false);
    }
  }, [joined, displayGroup, requireFeedSession, groupId, removeJoinedGroup, router]);

  /* ── Render ──────────────────────────────────────────────────────────── */

  if (groupLoading && !displayGroup) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <FeedSkeleton />
      </div>
    );
  }

  if (!displayGroup) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
        <h1 className="font-heading text-[20px] font-bold text-cb-black">
          {t("app.groups.loadError")}
        </h1>
        <Button variant="secondary" onClick={() => router.push("/groups")}>
          {t("app.groups.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-cb-gray-200 px-4 py-3">
        <button
          type="button"
          onClick={() => router.push("/groups")}
          aria-label={t("app.groups.back")}
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-cb-gray-600 transition-colors hover:bg-cb-gray-100 hover:text-cb-black lg:hidden"
        >
          <ArrowLeftIcon />
        </button>

        <button
          type="button"
          onClick={() => setSheet({ kind: "info" })}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-cb-gray-100/70"
        >
          <GroupAvatar
            name={displayGroup.name}
            imageUrl={displayGroup.profilePicUrl}
            verified={displayGroup.verified}
            size={40}
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-heading text-[16px] font-bold text-cb-black">
                {displayGroup.name}
              </span>
              {live && (
                <span className="shrink-0 rounded-full bg-cb-danger px-1.5 py-0.5 font-body text-[9.5px] font-bold uppercase tracking-wide text-white">
                  {t("app.groups.live")}
                </span>
              )}
            </span>
            <span className="block truncate font-body text-[12.5px] text-cb-gray-500">
              {t("app.groups.groupInfo")}
            </span>
          </span>
        </button>

        {/* A running session is the most time-sensitive thing on this screen,
            so it gets a button in the header rather than a line in the feed. */}
        {member && liveEventId && (
          <Link
            href={`/live/${liveEventId}`}
            className="shrink-0 rounded-full bg-cb-danger px-4 py-2 font-heading text-[13px] font-bold text-white transition-[filter] hover:brightness-110"
          >
            {t("app.groups.joinLive")}
          </Link>
        )}

        {!member && (
          <Button size="sm" onClick={() => setSheet({ kind: "join" })}>
            {t("app.groups.join")}
          </Button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          {member && !editing && (
            <div className="mb-4">
              <PostComposer
                submitLabel={t("app.groups.post")}
                placeholder={t("app.groups.writePost")}
                busy={posting}
                onSubmit={publish}
              />
            </div>
          )}

          {editing && (
            <div className="mb-4">
              <PostComposer
                initialHtml={editing.html}
                submitLabel={t("app.groups.saveChanges")}
                busy={posting}
                autoFocus
                onSubmit={saveEdit}
                onCancel={() => setEditing(null)}
              />
            </div>
          )}

          {feed.loading ? (
            <FeedSkeleton />
          ) : feed.error ? (
            <div className="rounded-2xl border border-cb-danger/30 bg-cb-danger/10 px-5 py-6 text-center">
              <p className="font-body text-[14px] text-cb-black">{feed.error}</p>
              <div className="mt-3">
                <Button size="sm" variant="secondary" onClick={feed.refresh}>
                  {t("app.groups.retry")}
                </Button>
              </div>
            </div>
          ) : feed.posts.length === 0 ? (
            <div className="rounded-2xl border border-cb-gray-200 bg-white px-6 py-16 text-center">
              <p className="font-heading text-[17px] font-bold text-cb-black">
                {t("app.groups.noPostsTitle")}
              </p>
              <p className="mt-1.5 font-body text-[14px] text-cb-gray-500">
                {t("app.groups.noPostsSub")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {feed.posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={userId}
                  canModerate={canModerate}
                  onToggleLike={(p) =>
                    void feed.toggleLike(p).catch(() => {
                      toast.error(t("app.groups.likeError"));
                    })
                  }
                  onOpenComments={(p) => setSheet({ kind: "thread", post: p })}
                  onOpenActions={(p) => setSheet({ kind: "actions", post: p })}
                />
              ))}

              {feed.hasMore && (
                <div ref={sentinelRef} className="pt-1">
                  <FeedSkeleton />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Sheets ── */}

      {sheet?.kind === "actions" && (
        <PostActionsSheet
          post={sheet.post}
          currentUserId={userId}
          canModerate={canModerate}
          onClose={() => setSheet(null)}
          onEdit={(post) => {
            setSheet(null);
            setEditing(post);
          }}
          onDelete={(post) => setSheet({ kind: "delete", post })}
          onReport={(post) => setSheet({ kind: "report", post })}
          onTogglePin={handleTogglePin}
        />
      )}

      {sheet?.kind === "delete" && (
        <ConfirmSheet
          title={t("app.groups.deletePost")}
          body={t("app.groups.deletePostConfirm")}
          confirmLabel={t("app.groups.deletePostYes")}
          danger
          busy={busy}
          onConfirm={confirmDelete}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.kind === "pin-conflict" && (
        <ConfirmSheet
          title={t("app.groups.pinConflictTitle")}
          body={t("app.groups.pinConflictBody")}
          confirmLabel={t("app.groups.pinConflictYes")}
          busy={busy}
          onConfirm={confirmReplacePin}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.kind === "report" && userId && (
        <ReportPostSheet
          post={sheet.post}
          currentUserId={userId}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.kind === "thread" && (
        <PostThread
          post={sheet.post}
          canModerate={canModerate}
          highlightCommentId={sheet.highlightCommentId}
          onClose={() => setSheet(null)}
          onCommentCountChange={(postId, count) =>
            feed.patchPost(postId, { commentCount: count })
          }
        />
      )}

      {sheet?.kind === "info" && (
        <GroupInfoSheet
          group={displayGroup}
          isMember={member}
          muteBusy={busy}
          onClose={() => setSheet(null)}
          onToggleMute={handleToggleMute}
          onLeave={() => setSheet({ kind: "leave" })}
        />
      )}

      {sheet?.kind === "leave" && (
        <ConfirmSheet
          title={t("app.groups.leaveConfirmTitle", { name: displayGroup.name })}
          body={t("app.groups.leaveConfirmBody")}
          confirmLabel={t("app.groups.leaveConfirmYes")}
          danger
          busy={busy}
          onConfirm={confirmLeave}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.kind === "join" && (
        <JoinGroupDialog
          group={displayGroup}
          onClose={() => setSheet(null)}
          onJoined={async () => {
            setSheet(null);
            await refreshGroups();
            await feed.refresh();
          }}
        />
      )}
    </div>
  );
}
