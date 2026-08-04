"use client";

import { useParams } from "next/navigation";
import JournalList from "@/components/buddies/JournalList";

export default function BuddyJournalPage() {
  const params = useParams<{ userId: string }>();
  const userId = params?.userId;
  if (!userId) return null;
  return <JournalList userId={userId} />;
}
