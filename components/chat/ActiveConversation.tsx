"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { channelDisplay } from "@/lib/chat/helpers";
import { useStreamChat } from "@/lib/chat/StreamChatProvider";
import { useChannelMessages } from "@/lib/chat/useChannelMessages";
import { useContactProfile } from "@/lib/chat/useContactProfile";
import { removeConnection, reportConnection } from "@/lib/chat/connections";
import ChatHeader from "./ChatHeader";
import MessageThread from "./MessageThread";
import MessageComposer from "./MessageComposer";
import ReportModal from "./ReportModal";

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
  } = useChannelMessages(channelId);

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
    if (id) await removeConnection(id);
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
        typing={typingNames.length > 0}
        onRemove={channel ? handleRemove : undefined}
        onReport={
          channel && display.other?.id ? () => setReporting(true) : undefined
        }
      />

      {error ? (
        <Centered text={t("app.chat.loadError")} />
      ) : loading && !channel ? (
        <ThreadSkeleton />
      ) : messages.length === 0 ? (
        <Centered
          text={t("app.chat.startConversation")}
          sub={t("app.chat.disclaimer")}
        />
      ) : (
        <MessageThread
          messages={messages}
          otherLastReadAt={otherLastReadAt}
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
        onSend={send}
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
