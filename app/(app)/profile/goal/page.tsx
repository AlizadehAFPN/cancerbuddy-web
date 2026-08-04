import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import GoalForm from "@/components/profile/GoalForm";

export const metadata: Metadata = { title: t("app.profile.goalTitle") };

export default function GoalPage() {
  return <GoalForm />;
}
