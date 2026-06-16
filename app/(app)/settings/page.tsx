import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import ScreenPlaceholder from "@/components/app-shell/ScreenPlaceholder";

export const metadata: Metadata = { title: t("app.screens.settingsTitle") };

export default function SettingsPage() {
  return (
    <ScreenPlaceholder
      title={t("app.screens.settingsTitle")}
      body={t("app.screens.settingsBody")}
    />
  );
}
