"use client";

/**
 * Composer for new posts and edits.
 *
 * Mobile ships a rich-text editor; this is a plain multi-line field whose text
 * is converted to the same paragraph HTML the feed stores, so posts written on
 * either client render correctly on both. Formatting toolbars are a separate
 * piece of work — see the note in the delivery summary.
 */

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { postHtmlToText, textToPostHtml } from "@/lib/groups/sanitizeHtml";

export default function PostComposer({
  initialHtml,
  submitLabel,
  placeholder,
  busy,
  onSubmit,
  onCancel,
  autoFocus,
}: {
  initialHtml?: string;
  submitLabel: string;
  placeholder?: string;
  busy?: boolean;
  onSubmit: (html: string) => void | Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(() => postHtmlToText(initialHtml));
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const id = setTimeout(() => ref.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [autoFocus]);

  // Grow with the content instead of scrolling inside a fixed box.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 420)}px`;
  }, [text]);

  const trimmed = text.trim();

  const submit = () => {
    if (!trimmed || busy) return;
    void onSubmit(textToPostHtml(trimmed));
  };

  return (
    <div className="rounded-2xl border border-cb-gray-200 bg-white p-3">
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // ⌘/Ctrl+Enter posts — Enter alone inserts a newline.
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        rows={3}
        placeholder={placeholder ?? t("app.groups.postPlaceholder")}
        className="w-full resize-none bg-transparent px-1 py-1 font-body text-[15px] leading-relaxed text-cb-black outline-none placeholder:text-cb-gray-400"
      />

      <div className="mt-2 flex items-center justify-end gap-2.5">
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            {t("app.groups.cancel")}
          </Button>
        )}
        <Button size="sm" onClick={submit} disabled={!trimmed} loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
