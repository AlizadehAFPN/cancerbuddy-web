"use client";

import { useParams } from "next/navigation";
import BuddyProfileScreen from "@/components/buddies/BuddyProfileScreen";

export default function BuddyProfilePage() {
  const params = useParams<{ userId: string }>();
  const userId = params?.userId;
  if (!userId) return null;
  return <BuddyProfileScreen userId={userId} />;
}
