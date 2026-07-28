"use client";

import { usePathname } from "next/navigation";
import GroupsProvider from "@/lib/groups/GroupsProvider";
import GroupsSidebar from "@/components/groups/GroupsSidebar";

/**
 * Two-pane groups layout, matching the chat tab's shape.
 *   ≥ lg → group list (left) + the selected group / calendar / discover (right).
 *   < lg → one pane: the list, or the open view once something is selected.
 *
 * The provider sits here so the joined-groups list, live badges and feed
 * session survive navigation between groups.
 */
export default function GroupsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const detailOpen = pathname !== "/groups";

  return (
    <GroupsProvider>
      <div className="flex h-full min-h-0">
        <aside
          className={`min-h-0 w-full shrink-0 flex-col border-r border-cb-gray-200 lg:flex lg:w-80 xl:w-96 ${
            detailOpen ? "hidden lg:flex" : "flex"
          }`}
        >
          <GroupsSidebar />
        </aside>

        <section
          className={`min-h-0 min-w-0 flex-1 flex-col overflow-y-auto ${
            detailOpen ? "flex" : "hidden lg:flex"
          }`}
        >
          {children}
        </section>
      </div>
    </GroupsProvider>
  );
}
