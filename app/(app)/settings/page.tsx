import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import PushSettingsCard from "@/components/push/PushSettingsCard";

export const metadata: Metadata = { title: t("app.screens.settingsTitle") };

/**
 * `/settings` — currently one real section (notifications). The rest of the
 * mobile settings surface is not ported yet, so the page stays a simple stack
 * of cards that new sections append to.
 */
export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <h1 className="font-heading text-2xl font-bold text-cb-black">
        {t("app.screens.settingsTitle")}
      </h1>
      <p className="mt-1 font-body text-cb-gray-500">
        {t("app.screens.settingsBody")}
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <PushSettingsCard />
      </div>
    </div>
  );
}
