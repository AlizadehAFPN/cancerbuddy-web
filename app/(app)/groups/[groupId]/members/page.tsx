"use client";

import { useParams } from "next/navigation";
import GroupMembers from "@/components/groups/GroupMembers";

export default function GroupMembersPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params?.groupId;
  if (!groupId) return null;
  return <GroupMembers groupId={groupId} />;
}
