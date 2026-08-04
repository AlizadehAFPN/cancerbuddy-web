import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import JournalScreen from "@/components/profile/JournalScreen";

export const metadata: Metadata = { title: t("app.profile.journalTitle") };

export default function JournalPage() {
  return <JournalScreen />;
}
