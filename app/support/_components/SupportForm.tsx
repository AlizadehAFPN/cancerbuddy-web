"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Textarea } from "@/components/ui";
import {
  CATEGORY_LABELS,
  MESSAGE_MAX,
  SUBJECT_MAX,
  SUPPORT_CATEGORIES,
  type SupportAttachment,
  type SupportCategory,
  type SupportTicketResult,
} from "@/lib/support/types";
import {
  supportFormSchema,
  validateAttachment,
  type SupportFormValues,
} from "@/lib/support/validation";
import { defaultSupportService } from "@/lib/support/service";

/* ── Inline icons ── */

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** Reads a File as base-64 (without the `data:...;base64,` prefix). The mock
 *  service uses this; a real backend should swap in a multipart upload. */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r === "string") {
        resolve(r.replace(/^data:[^;]+;base64,/, ""));
      } else {
        reject(new Error("Unexpected reader result"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function SupportForm() {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<SupportFormValues>({
    resolver: zodResolver(supportFormSchema),
    mode: "onTouched",
    defaultValues: {
      subject: "",
      category: "account",
      message: "",
      email: "",
    },
  });

  const [attachment, setAttachment] = useState<SupportAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SupportTicketResult | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const category = watch("category");
  const message = watch("message") ?? "";

  async function handleAttach(file: File | null) {
    setAttachmentError(null);
    if (!file) {
      setAttachment(null);
      return;
    }
    const ok = validateAttachment(file);
    if (!ok.ok) {
      setAttachmentError(ok.message);
      return;
    }
    try {
      const base64 = await readFileAsBase64(file);
      setAttachment({
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        dataBase64: base64,
      });
    } catch {
      setAttachmentError("Couldn't read that file. Please try a different one.");
    }
  }

  async function onSubmit(values: SupportFormValues) {
    setSubmitting(true);
    try {
      const ticket = await defaultSupportService.submitTicket({
        ...values,
        subject: values.subject.trim(),
        message: values.message.trim(),
        email: values.email.trim().toLowerCase(),
        attachment,
      });
      setResult(ticket);
    } catch {
      setAttachmentError("Couldn't send. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    reset();
    setAttachment(null);
    setAttachmentError(null);
    setResult(null);
    setCopied(false);
  }

  if (result) {
    return (
      <div className="text-center">
        <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cb-success/15 text-cb-success">
          <CheckIcon className="h-7 w-7" />
        </div>
        <h2
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.6rem, 2.2vw, 2rem)", lineHeight: 1.15 }}
        >
          Message sent
        </h2>
        <p className="mx-auto mt-2 max-w-[40ch] font-body text-cb-gray-500">
          Thanks — we&apos;ll get back to you by email shortly.
        </p>
        <div className="mt-6 flex items-center justify-between rounded-xl border border-cb-gray-200 bg-cb-bone-300/30 px-4 py-3 text-start">
          <div>
            <p className="font-heading text-[11px] font-medium uppercase tracking-[0.16em] text-cb-gray-500">
              Ticket ID
            </p>
            <p className="mt-1 font-mono text-sm text-cb-black">
              {result.ticketId}
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(result.ticketId);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* clipboard blocked — silently no-op */
              }
            }}
            className="rounded-lg border-[1.5px] border-cb-gray-300 bg-white px-3 py-1.5 font-body text-sm font-medium text-cb-gray-700 transition-colors hover:border-cb-black hover:text-cb-black"
          >
            {copied ? "Copied!" : "Copy ID"}
          </button>
        </div>
        <div className="mt-6 flex gap-3">
          <Button type="button" variant="secondary" size="lg" fullWidth onClick={startOver}>
            Send another
          </Button>
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Back to home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col">
      <Input
        label="Subject"
        placeholder="Briefly describe your issue"
        autoFocus
        maxLength={SUBJECT_MAX}
        error={errors.subject?.message}
        {...register("subject")}
      />

      {/* Category picker */}
      <div className="mb-5">
        <label className="mb-1.5 block font-body text-[13px] font-medium text-cb-gray-700">
          Category
        </label>
        <div className="flex flex-wrap gap-2">
          {SUPPORT_CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() =>
                  setValue("category", c as SupportCategory, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                aria-pressed={active}
                className={[
                  "inline-flex h-10 items-center rounded-full border-[1.5px] px-4 font-body text-sm transition-all duration-150",
                  active
                    ? "border-cb-black bg-cb-black text-white shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                    : "border-cb-gray-300 bg-white text-cb-gray-700 hover:border-cb-black hover:text-cb-black",
                ].join(" ")}
              >
                {CATEGORY_LABELS[c]}
              </button>
            );
          })}
        </div>
        {errors.category?.message ? (
          <p role="alert" className="mt-1.5 font-body text-[13px] text-cb-danger">
            {errors.category.message}
          </p>
        ) : null}
      </div>

      <Textarea
        label="Message"
        placeholder="Share what happened, what you expected, and anything else we should know."
        rows={6}
        maxLength={MESSAGE_MAX + 100}
        error={errors.message?.message}
        labelHint={
          <span
            className={message.length > MESSAGE_MAX ? "text-cb-danger" : undefined}
          >
            {message.length} / {MESSAGE_MAX}
          </span>
        }
        {...register("message")}
      />

      <Input
        label="Reply email"
        placeholder="you@example.com"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        error={errors.email?.message}
        {...register("email")}
      />

      {/* Attachment */}
      <div className="mb-7">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <label className="font-body text-[13px] font-medium text-cb-gray-700">
            Attach a screenshot
          </label>
          <span className="font-body text-xs text-cb-gray-400">
            Optional · single image · up to 4 MB
          </span>
        </div>

        {attachment ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border-[1.5px] border-cb-gray-300 bg-cb-bone-300/30 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3 font-body text-sm text-cb-black">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-cb-gray-600 border border-cb-gray-200">
                <ImageIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{attachment.fileName}</p>
                <p className="text-xs text-cb-gray-500">
                  {(attachment.sizeBytes / 1024).toFixed(0)} KB
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-cb-gray-500 transition-colors hover:bg-cb-gray-100 hover:text-cb-danger"
              aria-label="Remove attachment"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="group flex w-full items-center gap-3 rounded-xl border-[1.5px] border-dashed border-cb-gray-300 bg-white px-4 py-3.5 font-body text-sm text-cb-gray-600 transition-all hover:border-cb-black hover:bg-cb-bone-300/20 hover:text-cb-black"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-cb-gray-100 text-cb-gray-600 transition-colors group-hover:bg-cb-yellow group-hover:text-cb-black">
              <PaperclipIcon className="h-4 w-4" />
            </span>
            <span className="font-medium">Choose an image</span>
            <span className="ms-auto text-xs text-cb-gray-400">PNG, JPG, GIF</span>
          </button>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleAttach(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />

        {attachmentError ? (
          <p role="alert" className="mt-2 font-body text-[13px] text-cb-danger">
            {attachmentError}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={submitting}
      >
        {submitting ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
