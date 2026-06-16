"use client";

import { useEffect, useRef, useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
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

  // The hover controls (react + actions). Kept visible while a popover is open.
  const controls =
    message.status === "sent" ? (
      <div
        ref={clusterRef}
        className={`flex items-center gap-0.5 self-center transition-opacity ${
          menuOpen || pickerOpen
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {mine ? (
          <>
            {reactable && (
              <ReactionPicker
                open={pickerOpen}
                setOpen={setPickerOpen}
                align="right"
                onPick={(type) => onReact?.(message.id, type)}
              />
            )}
            <ActionMenu
              open={menuOpen}
              setOpen={setMenuOpen}
              align="right"
              message={message}
              canEdit={canActOnSelf && message.text.length > 0}
              canDelete={canActOnSelf}
              onEdit={onEdit}
              onDelete={onDelete}
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
              onDelete={onDelete}
            />
            {reactable && (
              <ReactionPicker
                open={pickerOpen}
                setOpen={setPickerOpen}
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
    >
      {mine && controls}

      <div className="max-w-[80%] sm:max-w-[68%]">
        <div className="relative">
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
                      className="max-h-64 max-w-full rounded-2xl object-cover"
                    />
                  </a>
                ) : (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-cb-gray-200 bg-white px-3 py-2 transition-colors hover:bg-cb-gray-50"
                  >
                    <FileText className="h-5 w-5 shrink-0 text-cb-gray-500" />
                    <span className="max-w-[12rem] truncate font-body text-sm text-cb-black">
                      {a.name || t("app.chat.file")}
                    </span>
                    <Download className="h-4 w-4 shrink-0 text-cb-gray-400" />
                  </a>
                ),
              )}
            </div>
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
              {message.text}
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
  onDelete,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  align: "left" | "right";
  message: UIMessage;
  canEdit: boolean;
  canDelete: boolean;
  onEdit?: (id: string, text: string) => void;
  onDelete?: (id: string) => void;
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
                onDelete?.(message.id);
                setOpen(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
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
