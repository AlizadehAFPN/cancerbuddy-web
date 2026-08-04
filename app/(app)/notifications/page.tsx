import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import UpdatesScreen from "@/components/notifications/UpdatesScreen";

export const metadata: Metadata = { title: t("app.screens.notificationsTitle") };

export default function NotificationsPage() {
  return <UpdatesScreen />;
}
