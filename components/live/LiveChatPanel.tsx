"use client";

/**
 * Live chat.
 *
 * Bubble colours are lifted straight from the mobile room: the host's messages
 * are white and left-aligned, your own are bone (`#FEF9CA`) and right-aligned.
 * Keeping those exact values is what makes the two clients read as one chat
 * even though the panel around them is dark here and light on the phone.
 *
 * Auto-scroll only follows new messages while the reader is already at the
 * bottom — scrolling up to re-read something and being yanked back down is the
 * fastest way to make a chat feel hostile. Whenever the view is held back, a
 * pill offers the jump; the unread count itself lives on the chat button in the
 * control bar, so this one only has to say "there's more below".
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, RotateCcw, SendHorizontal } from "lucide-react";
import { t } from "@/lib/i18n";
import type { LiveChatMessage } from "@/lib/live/types";

const NEAR_BOTTOM_PX = 80;

function timeLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function Bubble({
  message,
  onRetry,
}: {
  message: LiveChatMessage;
  onRetry: (id: string) => void;
}) {
  const mine = message.isMine;

  return (
    <li className={`flex w-full ${mine ? "justify-end" : "justify-start"}`}>
      <div className="flex max-w-[86%] flex-col gap-1">
        <div
          className={[
            "rounded-2xl px-4 py-2.5",
            mine ? "bg-cb-bone text-cb-black" : "bg-white text-cb-black",
            message.failed ? "opacity-60" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <p
            className={[
              "font-heading text-[11.5px] font-bold uppercase tracking-[0.06em]",
              message.isHost ? "text-cb-yellow-800" : "text-cb-gray-500",
              mine ? "text-right" : "text-left",
            ].join(" ")}
          >
            {message.isHost ? t("app.live.hostSender") : message.sender}
          </p>
          <p
            className={[
              "mt-0.5 whitespace-pre-wrap break-words font-body text-[14.5px] leading-relaxed",
              mine ? "text-right" : "text-left",
            ].join(" ")}
          >
            {message.text}
          </p>
        </div>

        <div
          className={`flex items-center gap-2 px-1 ${mine ? "justify-end" : "justify-start"}`}
        >
          {message.failed ? (
            <button
              type="button"
              onClick={() => onRetry(message.id)}
              className="flex items-center gap-1 font-body text-[11px] font-semibold text-cb-danger hover:underline"
            >
              <RotateCcw size={11} />
              {t("app.live.messageFailed")}
            </button>
          ) : (
            <time className="font-body text-[11px] text-white/35">
              {timeLabel(message.timestamp)}
            </time>
          )}
        </div>
      </div>
    </li>
  );
}

export default function LiveChatPanel({
  messages,
  ready,
  error,
  onSend,
  onRetry,
}: {
  messages: LiveChatMessage[];
  ready: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onRetry: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [pinnedToBottom, setPinnedToBottom] = useState(true);

  /* Mirrors `pinnedToBottom` for the layout effect below, which must not
     re-run when the reader scrolls — only when a message arrives. */
  const pinnedRef = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
  }, []);

  const onScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    const atBottom = distance < NEAR_BOTTOM_PX;
    pinnedRef.current = atBottom;
    setPinnedToBottom(atBottom);
  }, []);

  /* Layout effect so the jump happens in the same frame the message paints —
     a smooth scroll started a tick later reads as a stutter. */
  useLayoutEffect(() => {
    if (messages.length === 0) return;
    if (pinnedRef.current) scrollToBottom("auto");
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 120)}px`;
  }, [draft]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    /* Sending always jumps you to your own message. */
    pinnedRef.current = true;
    setPinnedToBottom(true);
    onSend(text);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-full overflow-y-auto overscroll-contain px-3 py-3"
        >
          {error ? (
            <p className="px-2 py-6 text-center font-body text-[13.5px] text-white/55">
              {error}
            </p>
          ) : !ready ? (
            <div aria-hidden className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className={`h-14 animate-pulse rounded-2xl bg-white/8 ${
                    index % 2 ? "ml-10" : "mr-10"
                  }`}
                />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 px-4 text-center">
              <p className="font-heading text-[15px] font-bold text-white/85">
                {t("app.live.chatEmpty")}
              </p>
              <p className="font-body text-[13px] leading-snug text-white/45">
                {t("app.live.chatEmptySub")}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {messages.map((message) => (
                <Bubble key={message.id} message={message} onRetry={onRetry} />
              ))}
            </ul>
          )}
        </div>

        {!pinnedToBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              pinnedRef.current = true;
              setPinnedToBottom(true);
              scrollToBottom();
            }}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-cb-yellow px-3.5 py-1.5 font-body text-[12.5px] font-bold text-cb-black shadow-lg"
          >
            <ArrowDown size={13} />
            {t("app.live.jumpToLatest")}
          </button>
        )}
      </div>

      <div className="shrink-0 border-t border-white/8 p-2.5">
        <div className="flex items-end gap-2 rounded-2xl border border-white/12 bg-cb-live-surface px-3 py-2 focus-within:border-white/30">
          <textarea
            ref={textareaRef}
            value={draft}
            rows={1}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={t("app.live.chatPlaceholder")}
            aria-label={t("app.live.chatPlaceholder")}
            className="max-h-[120px] min-h-6 flex-1 resize-none bg-transparent font-body text-[14.5px] leading-relaxed text-white outline-none placeholder:text-white/35"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim()}
            aria-label={t("app.live.send")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cb-yellow text-cb-black transition-opacity disabled:opacity-30"
          >
            <SendHorizontal size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
