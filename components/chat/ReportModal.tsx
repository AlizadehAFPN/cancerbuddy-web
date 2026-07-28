"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { t } from "@/lib/i18n";

/**
 * Report reasons. `id` is the canonical value sent to the backend
 * (`blockingReason`) — kept identical to the mobile app so reports line up
 * across platforms. `labelKey` is the i18n key for the displayed label.
 */
const REASONS: { id: string; labelKey: string }[] = [
  { id: "Inappropriate comments", labelKey: "app.chat.reasonInappropriate" },
  { id: "Spam", labelKey: "app.chat.reasonSpam" },
  { id: "Made me feel uncomfortable", labelKey: "app.chat.reasonUncomfortable" },
  { id: "False profile", labelKey: "app.chat.reasonFalseProfile" },
  { id: "Other", labelKey: "app.chat.reasonOther" },
];

const OTHER_MIN = 10;
const OTHER_MAX = 1000;

/**
 * Block & report dialog. Mirrors the mobile ReportTemplate: pick a reason, and
 * when "Other" is chosen, a free-text field (10–1000 chars) is required.
 * Calls `onSubmit(reason)` with the canonical reason (or the custom text).
 */
export default function ReportModal({
  name,
  submitting,
  onSubmit,
  onClose,
}: {
  name: string;
  submitting: boolean;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [other, setOther] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const isOther = selected === "Other";
  const disabled =
    submitting ||
    !selected ||
    (isOther && other.trim().length < OTHER_MIN);

  const submit = () => {
    if (disabled || !selected) return;
    onSubmit(isOther ? other.trim() : selected);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t("app.chat.reportTitle")}
    >
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-cb-gray-200 px-5 py-3.5">
          <h2 className="font-heading text-base font-bold text-cb-black">
            {t("app.chat.reportTitle")}
            {name ? ` · ${name}` : ""}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label={t("app.chat.reportCancel")}
            className="rounded-lg p-1.5 text-cb-gray-400 transition-colors hover:bg-cb-gray-100 hover:text-cb-black disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="mb-3 font-body text-sm text-cb-gray-600">
            {t("app.chat.reportReasonPrompt")}
          </p>
          <div className="flex flex-col gap-1.5">
            {REASONS.map((r) => {
              const active = selected === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelected(r.id)}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left font-body text-sm transition-colors ${
                    active
                      ? "border-cb-black bg-cb-gray-50 text-cb-black"
                      : "border-cb-gray-200 text-cb-gray-700 hover:bg-cb-gray-50"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      active ? "border-cb-black" : "border-cb-gray-300"
                    }`}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-cb-black" />}
                  </span>
                  {t(r.labelKey as Parameters<typeof t>[0])}
                </button>
              );
            })}
          </div>

          {isOther && (
            <div className="mt-3">
              <p className="font-heading text-sm font-semibold text-cb-black">
                {t("app.chat.reportMoreTitle")}
              </p>
              <p className="mb-2 mt-0.5 font-body text-xs text-cb-gray-500">
                {t("app.chat.reportMoreSub")}
              </p>
              <textarea
                value={other}
                onChange={(e) => setOther(e.target.value.slice(0, OTHER_MAX))}
                maxLength={OTHER_MAX}
                rows={4}
                className="w-full resize-none rounded-xl border border-cb-gray-200 px-3 py-2 font-body text-sm text-cb-black outline-none focus:border-cb-black"
                placeholder={t("app.chat.reportMoreTitle")}
              />
              <p className="mt-1 text-right font-body text-xs text-cb-gray-400">
                {t("app.chat.reportMoreHint")}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-cb-gray-200 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-xl bg-cb-gray-100 px-4 py-2.5 font-heading text-sm font-medium text-cb-black transition-colors hover:bg-cb-gray-200 disabled:opacity-50"
          >
            {t("app.chat.reportCancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={disabled}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 font-heading text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {t("app.chat.reportSubmit")}
          </button>
        </div>
      </div>
    </div>
  );
}
