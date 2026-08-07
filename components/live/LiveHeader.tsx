"use client";

/**
 * Room header: what this session is, who's in it, and how it's doing.
 *
 * Mobile shows the group name, a participant count and a HOST marker. The web
 * header adds the session title (a URL can be opened cold, with no memory of
 * what was tapped to get here) and a live reconnection state, which on a laptop
 * is otherwise invisible until audio starts breaking up.
 */

import { Loader2, Radio } from "lucide-react";
import { t } from "@/lib/i18n";
import type { LiveConnectionState } from "@/lib/live/types";
import NetworkQualityBars from "./NetworkQualityBars";

export default function LiveHeader({
  title,
  groupName,
  participantCount,
  isHost,
  status,
  networkQuality,
}: {
  title: string;
  groupName: string;
  participantCount: number;
  isHost: boolean;
  status: LiveConnectionState;
  networkQuality: number | null;
}) {
  const reconnecting = status === "reconnecting";

  return (
    <header className="relative z-20 flex shrink-0 items-center gap-3 border-b border-white/8 bg-cb-live-scrim px-3 py-2.5 sm:px-4">
      <span
        className={[
          "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-heading text-[10.5px] font-bold uppercase tracking-[0.1em]",
          reconnecting ? "bg-white/12 text-white/70" : "bg-cb-danger text-white",
        ].join(" ")}
      >
        {reconnecting ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse" />
        )}
        {t(reconnecting ? "app.live.reconnecting" : "app.live.liveBadge")}
      </span>

      <div className="min-w-0 flex-1">
        <h1 className="truncate font-heading text-[15px] font-bold leading-tight text-white">
          {title || groupName || t("app.live.liveSession")}
        </h1>
        <p className="truncate font-body text-[12px] text-white/45">
          {groupName && title ? `${groupName} · ` : ""}
          {participantCount === 1
            ? t("app.live.participantCountOne")
            : t("app.live.participantCount", { count: participantCount })}
          {isHost ? ` · ${t("app.live.youAreHost")}` : ""}
        </p>
      </div>

      {networkQuality !== null && (
        <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <Radio size={13} className="text-white/35" />
          <NetworkQualityBars level={networkQuality} />
        </span>
      )}
    </header>
  );
}
