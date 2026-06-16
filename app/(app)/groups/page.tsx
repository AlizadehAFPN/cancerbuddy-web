import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import ScreenPlaceholder from "@/components/app-shell/ScreenPlaceholder";

export const metadata: Metadata = { title: t("app.screens.groupsTitle") };

export default function GroupsPage() {
  return (
    <ScreenPlaceholder
      title={t("app.screens.groupsTitle")}
      body={t("app.screens.groupsBody")}
    />
  );
}
