import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { CHILD_SAFETY, PRIVACY_POLICY, TERMS_OF_USE } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: "Child Safety Standards",
  description:
    "Our commitment to children's safety and wellbeing — COPPA compliance, content age-appropriateness, and CSAM/CSAE policies.",
};

export default function ChildSafetyPage() {
  return (
    <LegalShell doc={CHILD_SAFETY} related={[PRIVACY_POLICY, TERMS_OF_USE]} />
  );
}
