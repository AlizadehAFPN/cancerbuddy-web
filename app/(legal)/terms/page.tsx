import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { CHILD_SAFETY, PRIVACY_POLICY, TERMS_OF_USE, t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("metadata.termsTitle"),
  description: t("metadata.termsDescription"),
};

export default function TermsPage() {
  return (
    <LegalShell doc={TERMS_OF_USE} related={[PRIVACY_POLICY, CHILD_SAFETY]} />
  );
}
