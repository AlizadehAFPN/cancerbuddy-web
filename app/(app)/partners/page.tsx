import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import PartnersScreen from "@/components/partners/PartnersScreen";

export const metadata: Metadata = { title: t("app.screens.partnersTitle") };

export default function PartnersPage() {
  return <PartnersScreen />;
}
