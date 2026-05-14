import type { Metadata } from "next";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("metadata.dashboardTitle"),
};

/**
 * Dashboard — first authenticated screen.
 * Placeholder until the full app shell is built in a future step.
 */
export default function DashboardPage() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-3 p-8 text-center">
      <h1 className="font-heading font-bold text-2xl text-cb-black">
        {t("dashboard.heading")}
      </h1>
      <p className="font-body text-cb-gray-500 max-w-[280px]">
        {t("dashboard.body")}
      </p>
    </div>
  );
}
