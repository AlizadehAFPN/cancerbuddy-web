"use client";

/**
 * The right pane before a group is chosen.
 *
 * Two states share it: a member who simply hasn't picked a group yet, and
 * someone who hasn't joined any — the second gets mobile's invitation to go
 * find some rather than an empty shrug.
 */

import Link from "next/link";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { useGroups } from "@/lib/groups/GroupsProvider";

export default function GroupsEmptyState() {
  const { joinedGroups, status, retry } = useGroups();

  if (status === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
        <h2 className="font-heading text-[20px] font-bold text-cb-black">
          {t("app.groups.loadError")}
        </h2>
        <p className="font-body text-[14.5px] text-cb-gray-500">
          {t("app.groups.loadErrorSub")}
        </p>
        <Button onClick={retry}>{t("app.groups.tryAgain")}</Button>
      </div>
    );
  }

  const hasGroups = joinedGroups.length > 0;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <span
        aria-hidden
        className="flex h-16 w-16 items-center justify-center rounded-full bg-cb-bone text-[28px]"
      >
        💬
      </span>

      <h2 className="font-heading text-[19px] font-bold leading-snug tracking-tight text-cb-black">
        {hasGroups ? t("app.groups.selectGroup") : t("app.groups.noGroupsTitle")}
      </h2>
      <p className="max-w-sm font-body text-[14.5px] leading-relaxed text-cb-gray-500">
        {hasGroups ? t("app.groups.selectGroupSub") : t("app.groups.noGroupsSub")}
      </p>

      {!hasGroups && status === "ready" && (
        <Link href="/groups/discover">
          <Button>{t("app.groups.exploreGroups")}</Button>
        </Link>
      )}
    </div>
  );
}
