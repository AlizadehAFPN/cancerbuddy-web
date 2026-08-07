"use client";

/**
 * The chat / people rail.
 *
 * Docked beside the video from `lg` up, where there is room for both — the
 * mobile app has to cover the video to show chat, and losing the speaker's face
 * every time you read a message is the worst part of live chat on a phone.
 * Below `lg` it becomes a full-height overlay, which is that same mobile
 * behaviour.
 */

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { t } from "@/lib/i18n";

export type SidePanelTab = "chat" | "people";

export default function LiveSidePanel({
  open,
  tab,
  onTabChange,
  onClose,
  unreadChat,
  participantCount,
  children,
}: {
  open: boolean;
  tab: SidePanelTab;
  onTabChange: (tab: SidePanelTab) => void;
  onClose: () => void;
  unreadChat: number;
  participantCount: number;
  children: ReactNode;
}) {
  if (!open) return null;

  const tabButton = (key: SidePanelTab, label: string, badge?: number) => {
    const active = tab === key;
    return (
      <button
        key={key}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => onTabChange(key)}
        className={[
          "relative flex-1 rounded-lg px-3 py-1.5 font-body text-[13px] font-semibold transition-colors",
          active ? "bg-white/14 text-white" : "text-white/55 hover:text-white",
        ].join(" ")}
      >
        {label}
        {typeof badge === "number" && badge > 0 && !active && (
          <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-cb-danger px-1 font-body text-[10px] font-bold text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside
      className={[
        /* Overlay below lg, docked column from lg up. */
        "absolute inset-0 z-30 flex flex-col bg-cb-live-bg",
        "lg:static lg:z-auto lg:w-[364px] lg:shrink-0 lg:border-l lg:border-white/8",
      ].join(" ")}
      aria-label={t("app.live.sidePanel")}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-white/8 p-2.5">
        <div role="tablist" className="flex flex-1 gap-1 rounded-xl bg-white/6 p-1">
          {tabButton("chat", t("app.live.chat"), unreadChat)}
          {tabButton(
            "people",
            t("app.live.people", { count: participantCount }),
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("app.live.closePanel")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="min-h-0 flex-1">{children}</div>
    </aside>
  );
}
