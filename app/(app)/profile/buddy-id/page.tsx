import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import BuddyIdScreen from "@/components/profile/BuddyIdScreen";

export const metadata: Metadata = { title: t("app.profile.buddyId") };

export default function BuddyIdPage() {
  return <BuddyIdScreen />;
}
