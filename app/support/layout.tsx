import type { Metadata } from "next";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("metadata.supportTitle"),
  description: t("metadata.supportDescription"),
  robots: { index: false, follow: false },
};

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
