"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { channelDisplay } from "@/lib/chat/helpers";
import { useStreamChat } from "@/lib/chat/StreamChatProvider";
import { useChannelMessages } from "@/lib/chat/useChannelMessages";
import { useContactProfile } from "@/lib/chat/useContactProfile";
import { removeConnection, reportConnection } from "@/lib/chat/connections";
import {
  buildAskToHostAttachment,
  buildReplyHostAttachment,
  chatPrefill,
  emptyThreadCopy,
  notifyReplyHost,
  type ContextKind,
} from "@/lib/chat/contextEntry";
import ChatHeader from "./ChatHeader";
import MessageThread from "./MessageThread";
import MessageComposer from "./MessageComposer";
import ReportModal from "./ReportModal";
import { Button } from "@/components/ui";

/** The right pane: a single open conversation. */
export default function ActiveConversation({ channelId }: { channelId: string }) {
  const router = useRouter();
  const { userId, status, reconnect } = useStreamChat();
  const {
    channel,
    messages,
    loading,
    error,
    hasMore,
    loadingMore,
    frozen,
    send,
    retry,
    sendFiles,
    editMessage,
    deleteMessage,
    toggleReaction,
    loadMore,
    onTyping,
    typingNames,
    otherLastReadAt,
    myLastReadAt,
    retryLoad,
  } = useChannelMessages(channelId);

  /**
   * Context carried in the URL by the three entry points that start a
   * conversation *about* something: asking a host for a private group's code,
   * replying privately about a post, and the ambassador intro.
   *
   * Read from the query string rather than passed as props because the entry
   * points live in other tabs and navigate here.
   */
  const searchParams = useSearchParams();
  const contextType = searchParams.get("ctx") as ContextKind | null;
  const contextGroupId = searchParams.get("groupId");
  const contextGroupName = searchParams.get("groupName");
  const contextHostName = searchParams.get("hostName");
  const contextPostId = searchParams.get("postId");
  const contextFeedId = searchParams.get("feedId");
  const contextPostActor = searchParams.get("postActor");

  const prefill =
    contextType && (contextGroupName || contextHostName)
      ? chatPrefill({
          type: contextType,
          groupName: contextGroupName,
          hostName: contextHostName,
        })
      : "";

  /** Attached to the first message so the recipient sees the card. */
  const contextAttachment = useMemo(() => {
    if (contextType === "AskToHost" && contextGroupId) {
      return buildAskToHostAttachment({
        id: contextGroupId,
        name: contextGroupName ?? undefined,
      });
    }
    if (contextType === "ReplyHost" && contextPostId && contextFeedId) {
      return buildReplyHostAttachment({
        id: contextPostId,
        feedId: contextFeedId,
        actor: contextPostActor ?? undefined,
      });
    }
    return undefined;
  }, [
    contextType,
    contextGroupId,
    contextGroupName,
    contextPostId,
    contextFeedId,
    contextPostActor,
  ]);

  /** Attached once: the second message in the thread is an ordinary message. */
  const contextSentRef = useRef(false);
  const sendWithContext = useCallback(
    async (text: string) => {
      if (contextAttachment && !contextSentRef.current) {
        contextSentRef.current = true;
        await send(text, contextAttachment);
        if (contextType === "ReplyHost" && contextPostId && userId) {
          void notifyReplyHost({
            post: {
              id: contextPostId,
              feedId: contextFeedId ?? undefined,
              actor: contextPostActor ?? undefined,
            },
            channelId,
            senderId: userId,
          });
        }
        return;
      }
      await send(text);
    },
    [
      contextAttachment,
      contextType,
      contextPostId,
      contextFeedId,
      contextPostActor,
      channelId,
      userId,
      send,
    ],
  );

  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [reporting, setReporting] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);

  const display =
    channel && userId
      ? channelDisplay(channel, userId)
      : { name: "", image: undefined, other: undefined };
  const profile = useContactProfile(display.other?.id);

  const handleRemove = async () => {
    if (!channel) return;
    const id = channel.id;
    try {
      await channel.delete();
    } catch {
      /* ignore */
    }
    try {
      if (id) await removeConnection(id);
    } catch {
      // The connection row is what removal means; without it the person is
      // still a buddy. Say so rather than navigating away as though it worked.
      toast.error(t("app.chat.removeError"));
      return;
    }
    router.push("/chat");
  };

  // Block & report: record the block first (so it survives even if the channel
  // delete fails — the opposite order to mobile, which deletes the channel
  // first), then delete the Stream channel.
  const handleReport = async (reason: string) => {
    const id = channel?.id;
    const blockedUserId = display.other?.id;
    if (!channel || !id || !blockedUserId) return;
    setSubmittingReport(true);
    try {
      await reportConnection({ connectionId: id, blockedUserId, reason });
      try {
        await channel.delete();
      } catch {
        /* the block is already recorded; channel cleanup is best-effort */
      }
      toast.success(t("app.chat.reportThankYou"));
      setReporting(false);
      router.push("/chat");
    } catch {
      toast.error(t("app.chat.reportError"));
    } finally {
      setSubmittingReport(false);
    }
  };

  if (status === "error") {
    return (
      <Centered
        text={t("app.chat.connectError")}
        actionLabel={t("app.chat.retry")}
        onAction={reconnect}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader
        name={profile?.name || display.name}
        image={profile?.profilePicUrl || display.image}
        icon={profile?.goalImageUrl}
        profile={profile}
        otherUserId={display.other?.id}
        typing={typingNames.length > 0}
        onRemove={channel ? handleRemove : undefined}
        onReport={
          channel && display.other?.id ? () => setReporting(true) : undefined
        }
      />

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="font-body text-[14px] text-cb-gray-600">
            {t("app.chat.loadError")}
          </p>
          {/* A dead end before this: the only way out was a full page reload. */}
          <Button variant="secondary" size="sm" onClick={retryLoad}>
            {t("app.chat.retry")}
          </Button>
        </div>
      ) : loading && !channel ? (
        <ThreadSkeleton />
      ) : messages.length === 0 ? (
        <Centered
          text={t("app.chat.startConversation")}
          sub={emptyThreadCopy(contextType)}
        />
      ) : (
        <MessageThread
          messages={messages}
          otherLastReadAt={otherLastReadAt}
        myLastReadAt={myLastReadAt}
        currentUserId={userId ?? null}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          onRetry={retry}
          onEdit={(id, text) => setEditing({ id, text })}
          onDelete={deleteMessage}
          onReact={toggleReaction}
        />
      )}

      <MessageComposer
        onSend={sendWithContext}
        initialText={prefill}
        onSendFiles={sendFiles}
        onTyping={onTyping}
        frozen={frozen}
        editing={editing}
        onCommitEdit={(text) => {
          if (editing) editMessage(editing.id, text);
          setEditing(null);
        }}
        onCancelEdit={() => setEditing(null)}
      />

      {reporting && (
        <ReportModal
          name={profile?.name || display.name}
          submitting={submittingReport}
          onSubmit={handleReport}
          onClose={() => {
            if (!submittingReport) setReporting(false);
          }}
        />
      )}
    </div>
  );
}

function Centered({
  text,
  sub,
  actionLabel,
  onAction,
}: {
  text: string;
  sub?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="font-body text-cb-gray-500">{text}</p>
      {sub && (
        <p className="max-w-sm font-body text-sm text-cb-gray-400">{sub}</p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="rounded-full bg-cb-black px-5 py-2 font-heading text-sm font-medium text-white transition-colors hover:bg-cb-gray-800"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-hidden px-4 py-4" aria-hidden>
      {[60, 40, 72, 50, 64].map((w, i) => (
        <div key={i} className={`flex ${i % 2 ? "justify-end" : "justify-start"}`}>
          <div
            className="h-9 animate-pulse rounded-2xl bg-cb-gray-200"
            style={{ width: `${w}%` }}
          />
        </div>
      ))}
    </div>
  );
}
