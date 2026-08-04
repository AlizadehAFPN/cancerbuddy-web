import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import ProfileHub from "@/components/profile/ProfileHub";

export const metadata: Metadata = { title: t("app.screens.profileTitle") };

export default function ProfilePage() {
  return <ProfileHub />;
}
