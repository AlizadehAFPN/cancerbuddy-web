import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import ScreenPlaceholder from "@/components/app-shell/ScreenPlaceholder";

export const metadata: Metadata = { title: t("app.screens.notificationsTitle") };

export default function NotificationsPage() {
  return (
    <ScreenPlaceholder
      title={t("app.screens.notificationsTitle")}
      body={t("app.screens.notificationsBody")}
    />
  );
}
