"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal, Paperclip, X } from "lucide-react";
import { t } from "@/lib/i18n";

/**
 * Message input. Enter sends; Shift+Enter = newline. Paperclip attaches images
 * or files. Switches to an inline editor when `editing` is set. Disabled with a
 * notice when the channel is frozen.
 */
export default function MessageComposer({
  onSend,
  onSendFiles,
  onTyping,
  frozen,
  editing,
  onCommitEdit,
  onCancelEdit,
}: {
  onSend: (text: string) => void;
  onSendFiles: (files: File[], text: string) => void;
  onTyping: () => void;
  frozen?: boolean;
  editing?: { id: string; text: string } | null;
  onCommitEdit?: (text: string) => void;
  onCancelEdit?: () => void;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setText(editing.text);
      ref.current?.focus();
    }
  }, [editing]);

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const reset = () => {
    setText("");
    if (ref.current) ref.current.style.height = "auto";
  };

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    if (editing) {
      onCommitEdit?.(value);
    } else {
      onSend(value);
    }
    reset();
  };

  const pickFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onSendFiles(Array.from(list), text);
    reset();
  };

  if (frozen) {
    return (
      <div className="shrink-0 border-t border-cb-gray-200 px-4 py-4 text-center">
        <p className="font-body text-sm text-cb-gray-500">{t("app.chat.frozen")}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="shrink-0 border-t border-cb-gray-200 p-3"
    >
      {editing && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-cb-gray-100 px-3 py-1.5">
          <span className="font-body text-xs font-medium text-cb-gray-600">
            {t("app.chat.editing")}
          </span>
          <button
            type="button"
            onClick={() => {
              onCancelEdit?.();
              reset();
            }}
            aria-label={t("common.cancel")}
            className="rounded p-0.5 text-cb-gray-500 hover:text-cb-black"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        {!editing && (
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => pickFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label={t("app.chat.attach")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-cb-gray-500 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
            >
              <Paperclip className="h-5 w-5" />
            </button>
          </>
        )}

        <textarea
          ref={ref}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            grow();
            if (!editing) onTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={
            editing ? t("app.chat.editPlaceholder") : t("app.chat.messagePlaceholder")
          }
          className="max-h-32 flex-1 resize-none rounded-2xl border border-cb-gray-300 px-4 py-2.5 font-body text-[0.95rem] text-cb-black outline-none transition-colors placeholder:text-cb-gray-400 focus:border-cb-black"
        />

        <button
          type="submit"
          disabled={!text.trim()}
          aria-label={editing ? t("app.chat.saveEdit") : t("app.chat.send")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cb-black text-white transition-opacity hover:bg-cb-gray-800 disabled:opacity-40"
        >
          <SendHorizontal className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}
