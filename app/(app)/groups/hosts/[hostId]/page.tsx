"use client";

import { useParams } from "next/navigation";
import HostDetailScreen from "@/components/groups/HostDetailScreen";

export default function HostDetailPage() {
  const params = useParams<{ hostId: string }>();
  const hostId = params?.hostId;
  if (!hostId) return null;
  return <HostDetailScreen hostId={hostId} />;
}
