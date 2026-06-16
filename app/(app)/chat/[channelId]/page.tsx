"use client";

import { useParams } from "next/navigation";
import ActiveConversation from "@/components/chat/ActiveConversation";

export default function ChatChannelPage() {
  const params = useParams<{ channelId: string }>();
  const channelId = params?.channelId;
  if (!channelId) return null;
  return <ActiveConversation channelId={channelId} />;
}
