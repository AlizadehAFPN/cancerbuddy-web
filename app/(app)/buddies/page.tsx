import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import ScreenPlaceholder from "@/components/app-shell/ScreenPlaceholder";

export const metadata: Metadata = { title: t("app.screens.buddiesTitle") };

export default function BuddiesPage() {
  return (
    <ScreenPlaceholder
      title={t("app.screens.buddiesTitle")}
      body={t("app.screens.buddiesBody")}
    />
  );
}
