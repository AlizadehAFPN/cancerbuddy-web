"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import type { Channel } from "stream-chat";
import { t } from "@/lib/i18n";
import { useStreamChat } from "@/lib/chat/StreamChatProvider";
import { useChannelList } from "@/lib/chat/useChannelList";
import ConversationListItem from "./ConversationListItem";

function matchesQuery(channel: Channel, userId: string, q: string): boolean {
  if (!q) return true;
  const data = channel.data as { name?: string } | undefined;
  if ((data?.name ?? "").toLowerCase().includes(q)) return true;
  for (const m of Object.values(channel.state?.members ?? {})) {
    const u = m.user;
    if (!u || u.id === userId) continue;
    if ((u.name ?? "").toLowerCase().includes(q)) return true;
  }
  const last = channel.state.messages[channel.state.messages.length - 1];
  if ((last?.text ?? "").toLowerCase().includes(q)) return true;
  return false;
}

/** Left pane: the user's conversations, with search. */
export default function ConversationList() {
  const pathname = usePathname();
  const { userId, status, reconnect } = useStreamChat();
  const { channels, loading, error } = useChannelList();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter((c) => matchesQuery(c, userId ?? "", q));
  }, [channels, query, userId]);

  const showSkeleton = status === "connecting" || (loading && channels.length === 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">
        <h1 className="font-heading text-xl font-bold text-cb-black">
          {t("app.chat.title")}
        </h1>
      </div>

      {!showSkeleton && status === "ready" && channels.length > 0 && (
        <div className="shrink-0 px-3 pb-2">
          <div className="flex items-center gap-2 rounded-xl bg-cb-gray-100 px-3">
            <Search className="h-4 w-4 shrink-0 text-cb-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("app.chat.search")}
              className="h-9 flex-1 bg-transparent font-body text-sm text-cb-black outline-none placeholder:text-cb-gray-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("common.cancel")}
                className="shrink-0 text-cb-gray-400 hover:text-cb-black"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {showSkeleton ? (
          <ListSkeleton />
        ) : status === "error" || error ? (
          <StateMessage
            text={t("app.chat.connectError")}
            actionLabel={t("app.chat.retry")}
            onAction={reconnect}
          />
        ) : channels.length === 0 ? (
          <StateMessage text={t("app.chat.empty")} sub={t("app.chat.emptySub")} />
        ) : filtered.length === 0 ? (
          <StateMessage text={t("app.chat.noResults")} />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {filtered.map((ch) => (
              <li key={ch.cid}>
                <ConversationListItem
                  channel={ch}
                  userId={userId ?? ""}
                  active={pathname === `/chat/${ch.id}`}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="flex flex-col gap-0.5 px-1" aria-hidden>
      {Array.from({ length: 7 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-2 py-2.5">
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-cb-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-cb-gray-200" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-cb-gray-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function StateMessage({
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
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="font-heading text-base font-semibold text-cb-black">{text}</p>
      {sub && <p className="font-body text-sm text-cb-gray-500">{sub}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 rounded-full bg-cb-black px-5 py-2 font-heading text-sm font-medium text-white transition-colors hover:bg-cb-gray-800"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
