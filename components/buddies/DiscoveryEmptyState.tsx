"use client";

/**
 * Shown when discovery returns nobody.
 *
 * Two very different situations share this component, so the copy branches:
 * filters that matched no one (the fix is to loosen them) versus a genuinely
 * empty pool (the fix is to invite people). Mobile shows a share screen with a
 * QR code here; on the web an invite link is the equivalent affordance.
 */

import { useState } from "react";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";

export default function DiscoveryEmptyState({
  hasFilters,
  onClearFilters,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/register`;

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "CancerBuddy",
          text: t("app.buddies.shareText"),
          url: shareUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* the user dismissed the share sheet — nothing to report */
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-cb-gray-200 bg-white px-6 py-14 text-center">
      <span
        aria-hidden
        className="flex h-16 w-16 items-center justify-center rounded-full bg-cb-bone text-[28px]"
      >
        🤝
      </span>

      <h2 className="font-heading text-[19px] font-bold leading-snug tracking-tight text-cb-black">
        {hasFilters
          ? t("app.buddies.emptyFiltered")
          : t("app.buddies.emptyTitle")}
      </h2>

      <p className="font-body text-[14.5px] leading-relaxed text-cb-gray-500">
        {hasFilters
          ? t("app.buddies.emptyFilteredSub")
          : t("app.buddies.emptySub")}
      </p>

      <div className="mt-2 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
        {hasFilters && (
          <Button variant="primary" onClick={onClearFilters}>
            {t("app.buddies.clearFilters")}
          </Button>
        )}
        <Button variant={hasFilters ? "secondary" : "primary"} onClick={share}>
          {copied ? t("app.buddies.linkCopied") : t("app.buddies.shareWithFriend")}
        </Button>
      </div>
    </div>
  );
}
