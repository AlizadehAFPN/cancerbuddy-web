import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import PhotosForm from "@/components/profile/PhotosForm";

export const metadata: Metadata = { title: t("app.profile.photosTitle") };

export default function PhotosPage() {
  return <PhotosForm />;
}
