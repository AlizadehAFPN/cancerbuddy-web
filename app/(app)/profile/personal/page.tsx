import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import PersonalInfoForm from "@/components/profile/PersonalInfoForm";

export const metadata: Metadata = { title: t("app.profile.personalTitle") };

export default function PersonalInfoPage() {
  return <PersonalInfoForm />;
}
