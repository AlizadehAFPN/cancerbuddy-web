import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { CHILD_SAFETY, PRIVACY_POLICY, TERMS_OF_USE, t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("metadata.privacyTitle"),
  description: t("metadata.privacyDescription"),
};

export default function PrivacyPage() {
  return <LegalShell doc={PRIVACY_POLICY} related={[CHILD_SAFETY, TERMS_OF_USE]} />;
}
