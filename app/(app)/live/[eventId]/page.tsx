"use client";

import { useParams } from "next/navigation";
import LiveRoom from "@/components/live/LiveRoom";

/**
 * The live video room. Kept inside the app shell so a member can still see the
 * nav — leaving a call shouldn't feel like leaving the app — and given the full
 * height of the content area, which the room fills without scrolling.
 */
export default function LiveRoomPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params?.eventId;
  if (!eventId) return null;
  return <LiveRoom eventId={eventId} />;
}
