"use client";

import { usePathname } from "next/navigation";
import ConversationList from "@/components/chat/ConversationList";

/**
 * Two-pane master–detail chat layout.
 *   ≥ lg → list (left) + open conversation/empty state (right), always both.
 *   < lg → one pane: the list, or the open conversation when one is selected.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const conversationOpen = pathname !== "/chat";

  return (
    <div className="flex h-full min-h-0">
      <aside
        className={`min-h-0 w-full shrink-0 flex-col border-r border-cb-gray-200 lg:flex lg:w-80 xl:w-96 ${
          conversationOpen ? "hidden lg:flex" : "flex"
        }`}
      >
        <ConversationList />
      </aside>

      <section
        className={`min-h-0 min-w-0 flex-1 flex-col ${
          conversationOpen ? "flex" : "hidden lg:flex"
        }`}
      >
        {children}
      </section>
    </div>
  );
}
