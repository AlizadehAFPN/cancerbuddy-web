"use client";

/**
 * Full-screen failure state — the web port of mobile's `LiveStreamErrorScreen`.
 *
 * Retry is hidden for terminal outcomes (blocked, removed, duplicate session):
 * offering a button that cannot succeed reads as a bug and makes people try it
 * repeatedly.
 */

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { t } from "@/lib/i18n";

export default function LiveErrorScreen({
  title,
  message,
  onRetry,
  onGoBack,
  retryLabel,
  goBackLabel,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  onGoBack: () => void;
  retryLabel?: string;
  goBackLabel?: string;
}) {
  return (
    <div className="flex h-full items-center justify-center bg-cb-live-bg px-6 py-10">
      <div className="w-full max-w-[380px] text-center">
        <TriangleAlert size={48} className="mx-auto text-cb-yellow" strokeWidth={1.6} />

        <h1 className="mt-5 font-heading text-[22px] font-bold leading-tight tracking-tight text-white">
          {title ?? t("app.live.errorTitle")}
        </h1>
        <p className="mt-3 font-body text-[15px] leading-relaxed text-white/60">
          {message}
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {onRetry && (
            <Button variant="primary-alt" size="lg" fullWidth onClick={onRetry}>
              {retryLabel ?? t("app.live.retry")}
            </Button>
          )}
          <button
            type="button"
            onClick={onGoBack}
            className="w-full rounded-full border-2 border-white/25 py-3 font-heading text-[15px] font-bold text-white transition-colors hover:bg-white/8"
          >
            {goBackLabel ?? t("app.live.goBack")}
          </button>
        </div>
      </div>
    </div>
  );
}
