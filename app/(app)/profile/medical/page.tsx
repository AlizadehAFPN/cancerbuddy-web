import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import MedicalInfoForm from "@/components/profile/MedicalInfoForm";

export const metadata: Metadata = { title: t("app.profile.medicalTitle") };

export default function MedicalInfoPage() {
  return <MedicalInfoForm />;
}
