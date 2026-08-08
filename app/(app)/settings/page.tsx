import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import PushSettingsCard from "@/components/push/PushSettingsCard";
import SettingsScreen from "@/components/account/SettingsScreen";

export const metadata: Metadata = { title: t("app.screens.settingsTitle") };

/**
 * `/settings` — notifications, snooze, and the two account-altering flows.
 *
 * Member-only: a host account has nothing here it may use, so `SettingsScreen`
 * turns one away rather than rendering controls that would fail. That guard
 * lives in the client component because the account type is read in the
 * browser (see `lib/account/AccountProvider.tsx`).
 */
export default function SettingsPage() {
  return <SettingsScreen notifications={<PushSettingsCard />} />;
}
