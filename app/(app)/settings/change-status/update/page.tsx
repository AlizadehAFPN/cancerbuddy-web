import type { Metadata } from "next";
import { Suspense } from "react";
import { t } from "@/lib/i18n";
import ChangeStatusUpdateScreen from "@/components/account/ChangeStatusUpdateScreen";

export const metadata: Metadata = { title: t("app.settings.changeStatusTitle") };

export default function ChangeStatusUpdatePage() {
  return (
    <Suspense fallback={null}>
      <ChangeStatusUpdateScreen />
    </Suspense>
  );
}
