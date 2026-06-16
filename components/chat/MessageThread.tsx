"use client";

import { useLayoutEffect, useRef } from "react";
import { dayLabel, sameDay } from "@/lib/chat/helpers";
import MessageBubble from "./MessageBubble";
import type { UIMessage } from "@/lib/chat/useChannelMessages";

/**
 * Scrollable message list with day separators, auto-scroll-to-newest, a read
 * mark, and load-older-on-scroll-up (preserving scroll position on prepend).
 */
export default function MessageThread({
  messages,
  otherLastReadAt,
  hasMore,
  loadingMore,
  onLoadMore,
  onRetry,
  onEdit,
  onDelete,
  onReact,
}: {
  messages: UIMessage[];
  otherLastReadAt: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRetry: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onReact: (id: string, type: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const prevHeightRef = useRef<number | null>(null);

  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (el.scrollTop < 80 && hasMore && !loadingMore) {
      prevHeightRef.current = el.scrollHeight;
      onLoadMore();
    }
  };

  // After render: restore position when older messages prepend, else stick to bottom.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (prevHeightRef.current != null && !loadingMore) {
      const diff = el.scrollHeight - prevHeightRef.current;
      if (diff > 0) el.scrollTop += diff;
      prevHeightRef.current = null;
    } else if (pinnedRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, loadingMore]);

  const lastOwnSent = [...messages].reverse().find((m) => m.mine && m.status === "sent");

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4"
    >
      {loadingMore && (
        <div className="flex justify-center py-2" aria-hidden>
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-cb-gray-300 border-t-cb-black" />
        </div>
      )}

      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const showDay = !prev || !sameDay(prev.createdAt, m.createdAt);
        const showRead =
          lastOwnSent?.id === m.id && new Date(m.createdAt).getTime() <= otherLastReadAt;
        return (
          <div key={m.id}>
            {showDay && (
              <div className="my-3 flex justify-center">
                <span className="rounded-full bg-cb-gray-100 px-3 py-1 text-[11px] font-medium text-cb-gray-500">
                  {dayLabel(m.createdAt)}
                </span>
              </div>
            )}
            <div className="mb-1.5">
              <MessageBubble
                message={m}
                showRead={showRead}
                onRetry={onRetry}
                onEdit={onEdit}
                onDelete={onDelete}
                onReact={onReact}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
