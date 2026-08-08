"use client";

/**
 * Composer for new posts and edits.
 *
 * Holds **HTML**, not plain text. It used to open a post with `postHtmlToText`
 * and save with `textToPostHtml`, which meant editing a formatted post silently
 * destroyed its bold, italics, underline, lists and anchor `href`s — for every
 * member, on both clients.
 *
 * The toolbar carries what mobile's carries: bold, italic, underline
 * (`FormatToolbar.tsx:20-31`) plus a link action from its own dialog.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import {
  uploadFeedMedia,
  validateDocument,
  type FeedMediaAttachment,
} from "@/lib/groups/feedMedia";
import {
  POST_MAX_CHARS,
  isOverLimit,
  linkifyPostHtml,
  normaliseHref,
  openForEdit,
  postTextLength,
  serialize,
  shouldShowCounter,
} from "@/lib/groups/richText";

type Command = "bold" | "italic" | "underline";

const FORMATS = [
  { command: "bold", label: t("app.groups.formatBold"), glyph: "B", className: "font-bold" },
  { command: "italic", label: t("app.groups.formatItalic"), glyph: "I", className: "italic" },
  { command: "underline", label: t("app.groups.formatUnderline"), glyph: "U", className: "underline" },
] satisfies { command: Command; label: string; glyph: string; className: string }[];

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
  onSubmit: (html: string, attachments: FeedMediaAttachment[]) => void | Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [length, setLength] = useState(0);
  const [empty, setEmpty] = useState(true);
  /** Picked but not yet uploaded — the tray shows these with a remove button. */
  const [pending, setPending] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  /**
   * Seeded imperatively, once. React must not own this subtree: re-rendering it
   * from state on every keystroke would destroy the selection mid-word.
   */
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.innerHTML = openForEdit(initialHtml);
    const text = node.textContent ?? "";
    setLength(text.trim().length);
    setEmpty(text.trim().length === 0);
  }, [initialHtml]);

  useEffect(() => {
    if (!autoFocus) return;
    const id = setTimeout(() => ref.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [autoFocus]);

  const sync = useCallback(() => {
    const text = ref.current?.textContent ?? "";
    setLength(text.trim().length);
    setEmpty(text.trim().length === 0);
  }, []);

  const format = (command: Command) => {
    ref.current?.focus();
    // `execCommand` is deprecated but is still the only API that applies
    // formatting to a selection inside contentEditable without a full editor
    // framework. It emits <b>/<i>/<u>, all of which the allowlist permits.
    document.execCommand(command);
    sync();
  };

  const addLink = () => {
    const node = ref.current;
    if (!node) return;
    const selection = window.getSelection();
    const selected = selection?.toString() ?? "";

    const raw = window.prompt(t("app.groups.addLinkPrompt"));
    const href = normaliseHref(raw);
    if (!href) return;

    node.focus();
    if (selected) document.execCommand("createLink", false, href);
    else document.execCommand("insertHTML", false, `<a href="${href}">${href}</a>`);
    sync();
  };

  const pick = (files: FileList | null) => {
    setMediaError(null);
    const accepted: File[] = [];
    for (const file of Array.from(files ?? [])) {
      if (!validateDocument(file).ok) {
        setMediaError(t("app.groups.attachmentTooLarge"));
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length) setPending((p) => [...p, ...accepted]);
  };

  const over = length > POST_MAX_CHARS;
  // A post may be media only — mobile allows that too.
  const hasBody = !empty || pending.length > 0;
  const canSubmit = hasBody && !over && !busy && !uploading;

  const submit = async () => {
    const node = ref.current;
    if (!node || !canSubmit) return;
    // Linkify first so bare URLs become anchors, then sanitise — the allowlist
    // is the last word on what reaches the feed.
    const html = serialize(linkifyPostHtml(node.innerHTML));
    if (isOverLimit(html)) return;
    if (postTextLength(html) === 0 && pending.length === 0) return;

    let attachments: FeedMediaAttachment[] = [];
    if (pending.length) {
      setUploading(true);
      try {
        attachments = await Promise.all(pending.map(uploadFeedMedia));
      } catch (err) {
        console.error("[groups] attachment upload failed:", err);
        setMediaError(t("app.groups.attachmentUploadFailed"));
        return;
      } finally {
        setUploading(false);
      }
    }

    await onSubmit(html, attachments);
    setPending([]);
  };

  return (
    <div className="rounded-2xl border border-cb-gray-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-1 border-b border-cb-gray-100 pb-2">
        {FORMATS.map((f) => (
          <button
            key={f.command}
            type="button"
            aria-label={f.label}
            onMouseDown={(e) => e.preventDefault()} // keep the selection
            onClick={() => format(f.command)}
            className={`h-8 w-8 rounded-lg text-[14px] text-cb-gray-700 transition-colors hover:bg-cb-gray-100 hover:text-cb-black ${f.className}`}
          >
            {f.glyph}
          </button>
        ))}
        <button
          type="button"
          aria-label={t("app.groups.attachMedia")}
          onClick={() => fileInput.current?.click()}
          className="h-8 rounded-lg px-2 font-body text-[13px] font-medium text-cb-gray-700 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
        >
          {t("app.groups.attachMedia")}
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/*,video/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          aria-label={t("app.groups.addLink")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={addLink}
          className="h-8 rounded-lg px-2 font-body text-[13px] font-medium text-cb-gray-700 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
        >
          {t("app.groups.addLink")}
        </button>
      </div>

      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder ?? t("app.groups.postPlaceholder")}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder ?? t("app.groups.postPlaceholder")}
        onInput={sync}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
        className="max-h-[420px] min-h-[76px] w-full overflow-y-auto px-1 py-1 font-body text-[15px] leading-relaxed text-cb-black outline-none empty:before:text-cb-gray-400 empty:before:content-[attr(data-placeholder)] [&_a]:text-cb-link [&_a]:underline"
      />

      {pending.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {pending.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-cb-gray-200 bg-cb-gray-100 py-1 pl-2.5 pr-1.5 font-body text-[12.5px] text-cb-black"
            >
              <span className="max-w-[180px] truncate">{file.name}</span>
              <button
                type="button"
                aria-label={t("app.groups.removeAttachment", { name: file.name })}
                onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                className="flex h-5 w-5 items-center justify-center rounded-full text-cb-gray-500 transition-colors hover:bg-cb-gray-300 hover:text-cb-black"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {mediaError && (
        <p role="alert" className="mt-2 font-body text-[12.5px] text-cb-danger">
          {mediaError}
        </p>
      )}

      <div className="mt-2 flex items-center justify-end gap-2.5">
        {shouldShowCounter(length) && (
          <span
            className={`me-auto font-body text-[12px] ${over ? "text-cb-danger" : "text-cb-gray-500"}`}
          >
            {length} / {POST_MAX_CHARS}
          </span>
        )}
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            {t("app.groups.cancel")}
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => void submit()}
          disabled={!canSubmit}
          loading={busy || uploading}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
