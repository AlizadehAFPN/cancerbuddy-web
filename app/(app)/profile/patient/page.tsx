import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import PatientInfoForm from "@/components/profile/PatientInfoForm";

export const metadata: Metadata = { title: t("app.profile.patientTitle") };

export default function PatientInfoPage() {
  return <PatientInfoForm />;
}
