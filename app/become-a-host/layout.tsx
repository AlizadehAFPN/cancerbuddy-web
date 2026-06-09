import type { Metadata } from "next";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("metadata.hostsRegisterTitle"),
  description: t("metadata.hostsRegisterDescription"),
  robots: { index: false, follow: true },
};

export default function HostsRegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
