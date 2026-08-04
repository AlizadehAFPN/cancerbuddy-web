"use client";

/**
 * Shown when a support account reaches /profile.
 *
 * Mobile solves this by never mounting the tab, so there is no mobile screen to
 * copy — this explains the absence instead of failing silently, and points
 * somewhere useful.
 */

import Link from "next/link";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";

export default function ProfileForbidden() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="font-heading text-[20px] font-bold leading-snug text-cb-black">
        {t("app.profile.supportNoProfile")}
      </h1>
      <p className="max-w-sm font-body text-[14.5px] leading-relaxed text-cb-gray-500">
        {t("app.profile.supportNoProfileSub")}
      </p>
      <Link href="/groups">
        <Button>{t("app.profile.backToGroups")}</Button>
      </Link>
    </div>
  );
}
