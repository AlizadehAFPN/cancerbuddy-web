"use client";

import { useParams } from "next/navigation";
import GroupFeed from "@/components/groups/GroupFeed";

export default function GroupFeedPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params?.groupId;
  if (!groupId) return null;
  return <GroupFeed groupId={groupId} />;
}
