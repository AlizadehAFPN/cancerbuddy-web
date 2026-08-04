"use client";

import BuddiesProvider from "@/lib/buddies/BuddiesProvider";

/**
 * The Updates tab needs the viewer's id and the connection map, because its
 * second tab is the buddy requests — the same ones `/buddies` shows, through
 * the same `useRequests` hook.
 *
 * Scoped here rather than hoisted to the app layout on purpose. `BuddiesProvider`
 * pages through every connection the user has; putting it above every route
 * would make Chat, Groups and Profile pay for a scan they never read. Each of
 * the two screens gets its own instance and refetches on entry, so answering a
 * request on one and walking to the other still shows the truth.
 */
export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BuddiesProvider>{children}</BuddiesProvider>;
}
