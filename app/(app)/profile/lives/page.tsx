import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import ManageLivesScreen from "@/components/profile/ManageLivesScreen";

export const metadata: Metadata = { title: t("app.profile.manageLives") };

export default function ManageLivesPage() {
  return <ManageLivesScreen />;
}
