import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import ChangeStatusScreen from "@/components/account/ChangeStatusScreen";

export const metadata: Metadata = { title: t("app.settings.changeStatusTitle") };

export default function ChangeStatusPage() {
  return <ChangeStatusScreen />;
}
