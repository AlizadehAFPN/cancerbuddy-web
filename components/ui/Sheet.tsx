"use client";

/**
 * Responsive modal: a bottom sheet on phones, a centred dialog from `sm` up.
 *
 * Shared by the Buddies filters and the Groups actions. Sheets nest (a filter
 * panel opens a picker), which is why the open ones are tracked in a stack —
 * Escape must peel one layer, not collapse them all.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import { ArrowLeftIcon, XIcon } from "@/components/ui/icons";

/**
 * Open sheets, innermost last. Sheets nest (the custom filter opens a picker),
 * and without a stack a single Escape would close every layer at once.
 */
const sheetStack: symbol[] = [];

export interface SheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Wider dialog for the multi-section custom filter. */
  wide?: boolean;
}

/**
 * A bottom sheet on phones and a centred dialog from `sm` up. Focus is trapped
 * loosely (Escape + backdrop close); the body scroll lock prevents the page
 * behind from moving under the sheet on iOS.
 */
export function Sheet({
  open,
  title,
  subtitle,
  onClose,
  onBack,
  children,
  footer,
  wide,
}: SheetProps) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const idRef = useRef<symbol>(Symbol("sheet"));

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const id = idRef.current;
    sheetStack.push(id);

    const onKey = (e: KeyboardEvent) => {
      // Only the topmost sheet reacts, so Escape peels one layer at a time.
      if (e.key === "Escape" && sheetStack[sheetStack.length - 1] === id) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      const index = sheetStack.lastIndexOf(id);
      if (index !== -1) sheetStack.splice(index, 1);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] motion-safe:animate-[hero-fade-in_0.18s_ease-out_both]"
        onClick={onClose}
        aria-hidden
      />

      <div
        className={[
          "relative z-10 flex w-full flex-col overflow-hidden bg-white",
          "rounded-t-3xl sm:rounded-2xl",
          "shadow-[0_32px_80px_-8px_rgba(0,0,0,0.28),0_8px_32px_-4px_rgba(0,0,0,0.12)]",
          "motion-safe:animate-[hero-fade-up_0.22s_cubic-bezier(0.2,0.8,0.2,1)_both]",
          wide ? "sm:max-w-[680px]" : "sm:max-w-[460px]",
        ].join(" ")}
        style={{ maxHeight: "min(86vh, 900px)" }}
      >
        <div className="flex shrink-0 justify-center pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-cb-gray-200" />
        </div>

        <header className="flex shrink-0 items-start gap-3 px-5 pb-4 pt-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={t("app.buddies.back")}
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-cb-gray-600 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
            >
              <ArrowLeftIcon />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="font-heading text-[20px] font-bold leading-tight tracking-tight text-cb-black"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 font-body text-[13.5px] leading-snug text-cb-gray-500">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("app.buddies.close")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cb-gray-100 text-cb-gray-600 transition-colors hover:bg-cb-gray-200 hover:text-cb-black"
          >
            <XIcon size={15} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-cb-gray-100 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

