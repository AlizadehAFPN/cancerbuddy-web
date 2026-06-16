import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import ScreenPlaceholder from "@/components/app-shell/ScreenPlaceholder";

export const metadata: Metadata = { title: t("app.screens.profileTitle") };

export default function ProfilePage() {
  return (
    <ScreenPlaceholder
      title={t("app.screens.profileTitle")}
      body={t("app.screens.profileBody")}
    />
  );
}
