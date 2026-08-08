"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Search, X, MailWarning } from "lucide-react";
import type { Channel } from "stream-chat";
import { t } from "@/lib/i18n";
import { channelSortTs } from "@/lib/chat/helpers";
import { useStreamChat } from "@/lib/chat/StreamChatProvider";
import { useChannelList } from "@/lib/chat/useChannelList";
import { useUnreadChannels } from "@/lib/chat/useUnreadChannels";
import { useConversationSearch } from "@/lib/chat/useConversationSearch";
import ConversationListItem from "./ConversationListItem";
import { useSupportChannelBootstrap } from "@/lib/chat/useSupportChannelBootstrap";
import type { SupportStreamClient } from "@/lib/host-signup/bootstrapSupportChannel";
import PhoneCaptureDialog from "@/components/profile/PhoneCaptureDialog";
import {
  PHONE_PROMPT_DISMISSED_KEY,
  fetchPhone,
  shouldPromptForPhone,
} from "@/lib/profile/phoneStatus";

/** Instant local match over already-loaded channels, shown until server results land. */
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
  const { client, userId, status, reconnect } = useStreamChat();

  /*
   * Finishes the Support conversation when signup deferred it — enrolment has
   * no Stream client, so it leaves a marker and this is where it is honoured.
   */
  useSupportChannelBootstrap(
    client as unknown as SupportStreamClient | null,
    userId,
  );

  /**
   * An account with no phone number is asked for one.
   *
   * Read once per visit and only prompts when the answer is definitively "no
   * number" — the read-failure sentinel counts as having one, so a network blip
   * never interrupts someone with a modal.
   */
  const [phone, setPhone] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void fetchPhone(userId).then((value) => {
      if (!cancelled) setPhone(value);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const [phoneDismissed, setPhoneDismissed] = useState(false);
  const askForPhone =
    phone !== undefined &&
    shouldPromptForPhone(
      phone,
      phoneDismissed ||
        (typeof window !== "undefined" &&
          window.sessionStorage.getItem(PHONE_PROMPT_DISMISSED_KEY) === "true"),
    );
  const { channels, loading, error, loadMore, hasMore, loadingMore } =
    useChannelList();
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  // Server-side search: all conversations, matched by channel or participant name.
  const { results, searching, active } = useConversationSearch(query);
  // All unread conversations, fetched only while the filter is on.
  const { channels: unreadChannels, loading: unreadLoading } =
    useUnreadChannels(unreadOnly && !active);

  // Instant local matches over loaded channels (also matches message text), shown
  // immediately and kept even after server results land.
  const localFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!active) return channels;
    return channels.filter((c) => matchesQuery(c, userId ?? "", q));
  }, [channels, query, userId, active]);

  // Search view = UNION of server results (all conversations, by name) and local
  // matches (loaded conversations, incl. message text). Union — not replacement —
  // so local matches don't vanish when the server (which doesn't search message
  // bodies) returns fewer or no results.
  const searchView = useMemo(() => {
    const seen = new Set<string>();
    const merged: Channel[] = [];
    for (const c of [...(results ?? []), ...localFiltered]) {
      if (c.cid && !seen.has(c.cid)) {
        seen.add(c.cid);
        merged.push(c);
      }
    }
    return merged.sort((a, b) => channelSortTs(b) - channelSortTs(a));
  }, [results, localFiltered]);

  const filtered = active
    ? searchView
    : unreadOnly
      ? unreadChannels
      : channels;

  const showSkeleton = status === "connecting" || (loading && channels.length === 0);

  // Infinite scroll: pull the next page as the user nears the bottom. Disabled
  // while searching or filtering unread (both are already fully fetched).
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (active || unreadOnly || !hasMore || loadingMore) return;
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) loadMore();
  };

  const showControls =
    !showSkeleton && status === "ready" && channels.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {askForPhone && (
        <PhoneCaptureDialog onClose={() => setPhoneDismissed(true)} />
      )}
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-5">
        <h1 className="font-heading text-xl font-bold text-cb-black">
          {t("app.chat.title")}
        </h1>
        {showControls && (
          <button
            type="button"
            onClick={() => setUnreadOnly((v) => !v)}
            aria-pressed={unreadOnly}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-heading text-xs font-medium transition-colors ${
              unreadOnly
                ? "border-cb-black bg-cb-black text-white"
                : "border-cb-gray-200 text-cb-gray-600 hover:bg-cb-gray-100"
            }`}
          >
            <MailWarning className="h-3.5 w-3.5" />
            {t("app.chat.filterUnread")}
          </button>
        )}
      </div>

      {showControls && (
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

      <div
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-2"
      >
        {showSkeleton ? (
          <ListSkeleton />
        ) : status === "error" || error ? (
          <StateMessage
            text={t("app.chat.connectError")}
            actionLabel={t("app.chat.retry")}
            onAction={reconnect}
          />
        ) : !active && channels.length === 0 ? (
          <StateMessage text={t("app.chat.empty")} sub={t("app.chat.emptySub")} />
        ) : filtered.length === 0 ? (
          <StateMessage
            text={
              active && searching
                ? t("app.chat.searching")
                : unreadOnly
                  ? unreadLoading
                    ? t("app.chat.searching")
                    : t("app.chat.filterUnreadEmpty")
                  : t("app.chat.noResults")
            }
          />
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
            {!active && loadingMore && (
              <li
                className="flex justify-center py-3"
                aria-label={t("app.chat.searching")}
              >
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-cb-gray-300 border-t-cb-black" />
              </li>
            )}
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
