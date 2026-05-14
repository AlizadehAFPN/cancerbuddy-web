import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { CHILD_SAFETY, PRIVACY_POLICY, TERMS_OF_USE, t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("metadata.childSafetyTitle"),
  description: t("metadata.childSafetyDescription"),
};

export default function ChildSafetyPage() {
  return (
    <LegalShell doc={CHILD_SAFETY} related={[PRIVACY_POLICY, TERMS_OF_USE]} />
  );
}
