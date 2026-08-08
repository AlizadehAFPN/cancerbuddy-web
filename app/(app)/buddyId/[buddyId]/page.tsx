"use client";

/**
 * Inside the `(app)` group so the shared link lands behind the same auth and
 * providers as everything else — the guard ladder needs the viewer's own row to
 * apply the age rule. The group name does not appear in the URL, so this is
 * `/buddyId/<id>`: byte-for-byte the link the mobile app shares.
 */

import { useParams } from "next/navigation";
import BuddyIdLandingScreen from "@/components/buddies/BuddyIdLandingScreen";

export default function BuddyIdLandingPage() {
  const params = useParams<{ buddyId: string }>();
  const buddyId = params?.buddyId;
  if (!buddyId) return null;
  return <BuddyIdLandingScreen buddyId={buddyId} />;
}
