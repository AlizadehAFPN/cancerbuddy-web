import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import InterestsForm from "@/components/profile/InterestsForm";

export const metadata: Metadata = { title: t("app.profile.interestsTitle") };

export default function InterestsPage() {
  return <InterestsForm />;
}
