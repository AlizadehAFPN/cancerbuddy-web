import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import BuddiesScreen from "@/components/buddies/BuddiesScreen";

export const metadata: Metadata = { title: t("app.screens.buddiesTitle") };

export default function BuddiesPage() {
  return <BuddiesScreen />;
}
