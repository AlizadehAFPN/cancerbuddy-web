import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import ScreenPlaceholder from "@/components/app-shell/ScreenPlaceholder";

export const metadata: Metadata = { title: t("app.screens.fundersTitle") };

export default function FundersPage() {
  return (
    <ScreenPlaceholder
      title={t("app.screens.fundersTitle")}
      body={t("app.screens.fundersBody")}
    />
  );
}
