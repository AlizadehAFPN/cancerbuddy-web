"use client";

import { useState } from "react";
import { useStreamChat } from "@/lib/chat/StreamChatProvider";
import { usePendingRequestCount } from "@/lib/buddies/usePendingRequestCount";
import Sidebar from "./Sidebar";
import BottomBar from "./BottomBar";
import AccountSheet from "./AccountSheet";
import type { NavBadges } from "./navState";

/**
 * Responsive authenticated app shell.
 *
 *   ≥ lg  → persistent left Sidebar + content.
 *   < lg  → content + fixed BottomBar (mirrors the mobile tab bar).
 *
 * Both breakpoints share one AccountSheet (the mobile drawer's web form),
 * opened from the sidebar footer or the bottom bar's "More" tab.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu = () => setMenuOpen(true);

  const { totalUnread, userId } = useStreamChat();

  /**
   * Badges.
   *
   * Chat comes live from Stream. Updates carries the buddy-request count,
   * which is the one countable, actionable thing the tab holds: the
   * notification rows themselves have no unread state to count, because the
   * `read` flag on them is never set (see `docs/UPDATES.md`). Mobile's Updates
   * badge counts push messages received since the app opened instead — a
   * number that resets on reload and can't be reconstructed here.
   */
  const pendingRequests = usePendingRequestCount(userId ?? null);
  const badges: NavBadges = {
    chat: totalUnread,
    notifications: pendingRequests,
  };

  return (
    <div className="flex h-dvh max-h-dvh w-full overflow-hidden bg-white">
      <Sidebar badges={badges} onOpenMenu={openMenu} />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto overscroll-contain pb-16 lg:pb-0">
          {children}
        </main>
      </div>

      <BottomBar badges={badges} onOpenMenu={openMenu} />

      <AccountSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
