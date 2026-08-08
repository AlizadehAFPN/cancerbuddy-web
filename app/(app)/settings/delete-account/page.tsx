import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import DeleteAccountScreen from "@/components/account/DeleteAccountScreen";

export const metadata: Metadata = { title: t("app.settings.deleteTitle") };

export default function DeleteAccountPage() {
  return <DeleteAccountScreen />;
}
