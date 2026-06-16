import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import ScreenPlaceholder from "@/components/app-shell/ScreenPlaceholder";

export const metadata: Metadata = { title: t("app.screens.partnersTitle") };

export default function PartnersPage() {
  return (
    <ScreenPlaceholder
      title={t("app.screens.partnersTitle")}
      body={t("app.screens.partnersBody")}
    />
  );
}
