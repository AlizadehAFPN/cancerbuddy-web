"use client";

import { useState } from "react";
import { useStreamChat } from "@/lib/chat/StreamChatProvider";
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

  // Chat unread count comes live from Stream; other badges await their data.
  const { totalUnread } = useStreamChat();
  const badges: NavBadges = { chat: totalUnread };

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
