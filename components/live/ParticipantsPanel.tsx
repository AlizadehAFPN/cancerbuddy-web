"use client";

/**
 * Who's in the room.
 *
 * Web-only. On mobile the only way to moderate is to long-press a tile, which
 * is undiscoverable and impossible once the grid is more than a screen tall.
 * A list is also where a host can see at a glance who is muted, who has their
 * camera off, and whose connection is struggling.
 */

import { MicOff, Mic, Ellipsis } from "lucide-react";
import { t } from "@/lib/i18n";
import { initialsOf } from "@/lib/live/identity";
import NetworkQualityBars from "./NetworkQualityBars";
import type { TileModel } from "./tiles";

export default function ParticipantsPanel({
  tiles,
  canModerate,
  onModerate,
}: {
  tiles: TileModel[];
  canModerate: (tile: TileModel) => boolean;
  onModerate: (tile: TileModel) => void;
}) {
  /* Screen shares are tiles, not people. */
  const people = tiles.filter((tile) => !tile.isScreen);
  const hosts = people.filter((tile) => tile.isHost);
  const others = people.filter((tile) => !tile.isHost);

  const row = (tile: TileModel) => {
    const moderatable = canModerate(tile);
    return (
      <li
        key={tile.key}
        className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/6"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cb-live-raised font-heading text-[12.5px] font-bold text-white/90">
          {initialsOf(tile.fullName)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-body text-[14px] text-white">
              {tile.isLocal ? t("app.live.youWithName", { name: tile.fullName }) : tile.fullName}
            </span>
            {tile.isHost && (
              <span className="shrink-0 rounded-sm bg-cb-yellow px-1 font-heading text-[9px] font-bold uppercase tracking-wide text-cb-black">
                {t("app.live.hostBadge")}
              </span>
            )}
          </span>
          <span className="block font-body text-[12px] text-white/40">
            {tile.cameraOn ? t("app.live.cameraOn") : t("app.live.cameraOff")}
          </span>
        </span>

        {tile.networkQuality !== null && (
          <NetworkQualityBars level={tile.networkQuality} className="shrink-0" />
        )}

        <span className="flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden>
          {tile.micOn ? (
            <Mic size={15} className="text-white/55" />
          ) : (
            <MicOff size={15} className="text-cb-danger" />
          )}
        </span>
        <span className="sr-only">
          {tile.micOn ? t("app.live.micOn") : t("app.live.micOff")}
        </span>

        {moderatable && (
          <button
            type="button"
            onClick={() => onModerate(tile)}
            aria-label={t("app.live.manageParticipant", { name: tile.fullName })}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/12 hover:text-white"
          >
            <Ellipsis size={16} />
          </button>
        )}
      </li>
    );
  };

  const section = (label: string, group: TileModel[]) =>
    group.length === 0 ? null : (
      <section key={label}>
        <h3 className="px-2 pb-1 font-heading text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/40">
          {label}
        </h3>
        <ul>{group.map(row)}</ul>
      </section>
    );

  return (
    <div className="h-full overflow-y-auto overscroll-contain px-2 py-3">
      <div className="flex flex-col gap-4">
        {section(t("app.live.hostsSection"), hosts)}
        {section(t("app.live.participantsSection"), others)}
      </div>
    </div>
  );
}
