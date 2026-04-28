import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { CHILD_SAFETY, PRIVACY_POLICY, TERMS_OF_USE } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The agreement between you and the Bone Marrow & Cancer Foundation that governs your use of the CancerBuddy™ app.",
};

export default function TermsPage() {
  return (
    <LegalShell doc={TERMS_OF_USE} related={[PRIVACY_POLICY, CHILD_SAFETY]} />
  );
}
