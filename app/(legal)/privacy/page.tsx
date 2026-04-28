import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { CHILD_SAFETY, PRIVACY_POLICY, TERMS_OF_USE } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How CancerBuddy™ collects, uses, and protects your information. Source-of-truth content from the Bone Marrow & Cancer Foundation.",
};

export default function PrivacyPage() {
  return <LegalShell doc={PRIVACY_POLICY} related={[CHILD_SAFETY, TERMS_OF_USE]} />;
}
