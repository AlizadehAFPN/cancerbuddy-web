import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import GroupsEmptyState from "@/components/groups/GroupsEmptyState";

export const metadata: Metadata = { title: t("app.screens.groupsTitle") };

/**
 * `/groups` — on desktop this is the right-pane prompt (the list lives in the
 * layout). On mobile only the list shows, so this stays hidden until a group is
 * opened.
 */
export default function GroupsPage() {
  return <GroupsEmptyState />;
}
