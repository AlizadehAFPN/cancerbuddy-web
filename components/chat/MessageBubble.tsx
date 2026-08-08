"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MoreHorizontal,
  Copy,
  Pencil,
  Trash2,
  FileText,
  Download,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { messageTime } from "@/lib/chat/helpers";
import type { UIMessage } from "@/lib/chat/useChannelMessages";
import ReactionPicker from "./ReactionPicker";
import ReactionPills from "./ReactionPills";
import { sanitizePostHtml } from "@/lib/groups/sanitizeHtml";
import { formatFileSize } from "@/lib/groups/feedMedia";
import ContextAttachment from "@/components/chat/ContextAttachment";

/** A single message bubble: attachments, text, time, status, reactions, actions. */
export default function MessageBubble({
  message,
  showRead,
  onRetry,
  onEdit,
  onDelete,
  onReact,
}: {
  message: UIMessage;
  showRead?: boolean;
  onRetry?: (id: string) => void;
  onEdit?: (id: string, text: string) => void;
  onDelete?: (id: string) => void;
  onReact?: (id: string, type: string) => void;
}) {
  const mine = message.mine;
  /** The reaction this member already gave — at most one, as mobile allows. */
  const myReactionType = message.reactions.find((r) => r.mine)?.type;
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const clusterRef = useRef<HTMLDivElement>(null);
  const reactable = message.status === "sent" && !!onReact;

  useEffect(() => {
    if (!menuOpen && !pickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (
        clusterRef.current &&
        !clusterRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen, pickerOpen]);

  const canActOnSelf = mine && message.status === "sent";

  /** Matches the platform convention and mobile's own long-press threshold. */
  const LONG_PRESS_MS = 500;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }, []);

  const startLongPress = useCallback(() => {
    longPressFired.current = false;
    cancelLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setMenuOpen(true);
    }, LONG_PRESS_MS);
  }, [cancelLongPress]);

  useEffect(() => cancelLongPress, [cancelLongPress]);

  /**
   * The react + actions controls.
   *
   * `opacity-0 group-hover:opacity-100` alone made these unreachable on a phone
   * or tablet: there is no hover, so edit, delete, copy and react had no path at
   * all. `pointer-coarse:opacity-100` reveals them on touch devices, and a
   * long-press on the bubble opens the action menu the way mobile does.
   *
   * Kept visible while either popover is open, on any device.
   */
  const controls =
    message.status === "sent" ? (
      <div
        ref={clusterRef}
        className={`flex items-center gap-0.5 self-center transition-opacity ${
          menuOpen || pickerOpen
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100"
        }`}
      >
        {mine ? (
          <>
            {reactable && (
              <ReactionPicker
                open={pickerOpen}
                setOpen={setPickerOpen}
                currentType={myReactionType}
                align="right"
                onPick={(type) => onReact?.(message.id, type)}
              />
            )}
            <ActionMenu
              open={menuOpen}
              setOpen={setMenuOpen}
              align="right"
              message={message}
              // No Edit on a message carrying a quoted group or post: the
              // attachment cannot be re-authored, so editing would strip it.
              // Mobile applies the same rule (`ChatMessageRenderer.tsx:93-96`).
              canEdit={
                canActOnSelf &&
                message.text.length > 0 &&
                message.context.length === 0
              }
              canDelete={canActOnSelf}
              onEdit={onEdit}
              onRequestDelete={() => setConfirmDelete(true)}
            />
          </>
        ) : (
          <>
            <ActionMenu
              open={menuOpen}
              setOpen={setMenuOpen}
              align="left"
              message={message}
              canEdit={false}
              canDelete={false}
              onEdit={onEdit}
              onRequestDelete={() => setConfirmDelete(true)}
            />
            {reactable && (
              <ReactionPicker
                open={pickerOpen}
                setOpen={setPickerOpen}
                currentType={myReactionType}
                align="left"
                onPick={(type) => onReact?.(message.id, type)}
              />
            )}
          </>
        )}
      </div>
    ) : null;

  return (
    <div
      className={`group flex items-center gap-1.5 ${mine ? "justify-end" : "justify-start"}`}
      // Long-press opens the action menu, as it does on mobile. Without it a
      // touch device has no way to reach edit, delete, copy or react — the
      // controls are otherwise hover-only.
      onTouchStart={message.status === "sent" ? startLongPress : undefined}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onTouchCancel={cancelLongPress}
      // A long press selects text on some browsers; the menu is the intent here.
      onContextMenu={(e) => {
        if (longPressFired.current) e.preventDefault();
      }}
    >
      {mine && controls}

      <div className="max-w-[80%] sm:max-w-[68%]">
        <div className="relative">
          {/* The group or post this message refers to. */}
          {message.context.length > 0 && (
            <div className={mine ? "self-end" : "self-start"}>
              {message.context.map((c, i) => (
                <ContextAttachment key={i} attachment={c} />
              ))}
            </div>
          )}

          {/* Attachments */}
          {message.attachments.length > 0 && (
            <div
              className={`mb-1 flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}
            >
              {message.attachments.map((a, i) =>
                a.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={a.url}
                      alt={a.name || ""}
                      // `contain`, not `cover`: a tall photo was being cropped
                      // to a square and the sender's point lost with it. The
                      // intrinsic size reserves space so the thread does not
                      // jump as each image loads.
                      width={a.width}
                      height={a.height}
                      className="max-h-64 max-w-full rounded-2xl object-contain"
                    />
                  </a>
                ) : a.type === "video" ? (
                  // Plays inline. This used to fall through to the file branch
                  // and render as a download link.
                  <video
                    key={i}
                    src={a.url}
                    controls
                    preload="metadata"
                    playsInline
                    className="max-h-64 max-w-full rounded-2xl bg-black"
                  />
                ) : (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-cb-gray-200 bg-white px-3 py-2 transition-colors hover:bg-cb-gray-50"
                  >
                    <FileText className="h-5 w-5 shrink-0 text-cb-gray-500" />
                    <span className="min-w-0">
                      <span className="block max-w-[12rem] truncate font-body text-sm text-cb-black">
                        {a.name || t("app.chat.file")}
                      </span>
                      {formatFileSize(a.size) && (
                        <span className="block font-body text-[11.5px] text-cb-gray-500">
                          {formatFileSize(a.size)}
                        </span>
                      )}
                    </span>
                    <Download className="h-4 w-4 shrink-0 text-cb-gray-400" />
                  </a>
                ),
              )}
            </div>
          )}

          {/*
            Server-authored HTML body — support, ambassador and system messages
            arrive with an empty `text` and their content here. Sanitised through
            the same allowlist the feed uses, because this is markup the client
            did not write.
          */}
          {message.text.length === 0 && !!message.html?.trim() && (
            <div
              className={[
                "break-words rounded-2xl px-3.5 py-2 font-body text-[0.95rem] leading-snug",
                mine
                  ? "rounded-br-md bg-cb-black text-white"
                  : "rounded-bl-md bg-cb-gray-100 text-cb-black",
                "[&_a]:underline",
              ].join(" ")}
              dangerouslySetInnerHTML={{ __html: sanitizePostHtml(message.html) }}
            />
          )}

          {/* Text */}
          {message.text.length > 0 && (
            <div
              className={[
                "whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 font-body text-[0.95rem] leading-snug",
                mine
                  ? "rounded-br-md bg-cb-black text-white"
                  : "rounded-bl-md bg-cb-gray-100 text-cb-black",
                message.status === "failed" ? "opacity-70" : "",
              ].join(" ")}
            >
              <LinkifiedText text={message.text} mine={mine} />
            </div>
          )}

          {message.reactions.length > 0 && (
            <div className={` z-10 ${mine ? "right-2" : "left-2"}`}>
              <ReactionPills
                reactions={message.reactions}
                onClick={() => {
                  const own = message.reactions.filter((r) => r.mine);
                  if (own.length) {
                    // Remove your reaction(s).
                    own.forEach((r) => onReact?.(message.id, r.type));
                  } else {
                    // Add one — open the picker.
                    setPickerOpen(true);
                  }
                }}
              />
            </div>
          )}
        </div>

        <div
          className={`flex items-center gap-1.5 px-1 text-[11px] text-cb-gray-400 mt-0.5 ${mine ? "justify-end" : "justify-start"}`}
        >
          <span>{messageTime(message.createdAt)}</span>
          {message.edited && <span>· {t("app.chat.edited")}</span>}
          {mine && message.status === "sending" && (
            <span>{t("app.chat.sending")}</span>
          )}
          {mine && message.status === "failed" && (
            <button
              type="button"
              onClick={() => onRetry?.(message.id)}
              className="font-medium text-red-500 hover:underline"
            >
              {t("app.chat.failedRetry")}
            </button>
          )}
          {mine && message.status === "sent" && showRead && (
            <span className="text-cb-gray-500">{t("app.chat.read")}</span>
          )}
        </div>
      </div>

      {!mine && controls}

      {confirmDelete && (
        <ConfirmDeleteModal
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete?.(message.id);
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function ConfirmDeleteModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t("app.chat.deleteConfirmTitle")}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="px-5 pb-2 pt-5">
          <h2 className="font-heading text-base font-bold text-cb-black">
            {t("app.chat.deleteConfirmTitle")}
          </h2>
          <p className="mt-1.5 font-body text-sm text-cb-gray-600">
            {t("app.chat.deleteConfirmBody")}
          </p>
        </div>
        <div className="flex gap-2 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl bg-cb-gray-100 px-4 py-2.5 font-heading text-sm font-medium text-cb-black transition-colors hover:bg-cb-gray-200"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 font-heading text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            {t("app.chat.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionMenu({
  open,
  setOpen,
  align,
  message,
  canEdit,
  canDelete,
  onEdit,
  onRequestDelete,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  align: "left" | "right";
  message: UIMessage;
  canEdit: boolean;
  canDelete: boolean;
  onEdit?: (id: string, text: string) => void;
  onRequestDelete?: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Which way the popover opens, decided from the trigger's spot in the viewport.
  const [direction, setDirection] = useState<"up" | "down">("up");

  // Rows the menu renders, used to estimate its height.
  const rows =
    (message.text.length > 0 ? 1 : 0) + (canEdit ? 1 : 0) + (canDelete ? 1 : 0);
  // ~36px per row + 8px vertical padding.
  const estimatedHeight = rows * 36 + 8;

  const copy = () => {
    if (message.text)
      navigator.clipboard?.writeText(message.text).catch(() => {});
    setOpen(false);
  };

  const toggle = () => {
    if (!open) {
      // Decide direction from how much room sits below the trigger in the viewport.
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        // Open down when it fits below, else up; if neither fits, pick the roomier side.
        setDirection(
          spaceBelow >= estimatedHeight || spaceBelow >= spaceAbove
            ? "down"
            : "up",
        );
      }
    }
    setOpen(!open);
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label={t("app.chat.messageActions")}
        className="flex h-7 w-7 items-center justify-center rounded-full text-cb-gray-400 hover:bg-cb-gray-100 hover:text-cb-black"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          className={`absolute z-20 w-40 overflow-hidden rounded-xl border border-cb-gray-200 bg-white py-1 shadow-lg ${
            direction === "up" ? "bottom-8" : "top-8"
          } ${align === "right" ? "right-0" : "left-0"}`}
        >
          {message.text.length > 0 && (
            <MenuItem
              icon={<Copy className="h-4 w-4" />}
              label={t("app.chat.copy")}
              onClick={copy}
            />
          )}
          {canEdit && (
            <MenuItem
              icon={<Pencil className="h-4 w-4" />}
              label={t("app.chat.edit")}
              onClick={() => {
                onEdit?.(message.id, message.text);
                setOpen(false);
              }}
            />
          )}
          {canDelete && (
            <MenuItem
              icon={<Trash2 className="h-4 w-4" />}
              label={t("app.chat.delete")}
              danger
              onClick={() => {
                setOpen(false);
                onRequestDelete?.();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Matches http(s):// URLs and bare www. URLs, mirroring the mobile app's
// auto-linkification of message text.
const URL_PATTERN = "(https?:\\/\\/[^\\s]+|www\\.[^\\s]+)";
// Trailing punctuation that shouldn't be part of a clicked link.
const TRAILING_RE = /[.,!?;:'")\]]+$/;

/** Render message text with clickable links. */
function LinkifiedText({ text, mine }: { text: string; mine: boolean }) {
  const parts: React.ReactNode[] = [];
  const re = new RegExp(URL_PATTERN, "gi");
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    let raw = m[0];
    // Strip trailing punctuation, keeping it as plain text after the link.
    const trail = raw.match(TRAILING_RE)?.[0] ?? "";
    if (trail) raw = raw.slice(0, raw.length - trail.length);
    if (start > last) parts.push(text.slice(last, start));
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    parts.push(
      <a
        key={key++}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`underline underline-offset-2 ${
          mine ? "text-white decoration-white/60" : "text-blue-600"
        }`}
      >
        {raw}
      </a>,
    );
    if (trail) parts.push(trail);
    last = start + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left font-body text-sm transition-colors hover:bg-cb-gray-100 ${
        danger ? "text-red-600" : "text-cb-black"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
