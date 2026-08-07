"use client";

/**
 * The two ways to arrange a session.
 *
 * **Stage** (default on a wide screen) gives one tile most of the space and
 * puts everyone else in a filmstrip beneath it. That's the right default here
 * because these sessions are a host talking to a group, not a round-table: a
 * 4-up grid on a 27" monitor shows four small faces and a lot of background.
 * The stage picks its own subject — screen share, then speaker, then host — and
 * a click pins a tile until it's clicked again.
 *
 * **Grid** is the mobile layout, and the only one below `md`: hosts first in
 * their own row, then everyone else. Columns are chosen from the count rather
 * than by `auto-fit`, so tiles stay 16:9 and the last row doesn't stretch.
 */

import { useMemo } from "react";
import { t } from "@/lib/i18n";
import type { LiveLayout, StageSelection } from "@/lib/live/types";
import VideoTile from "./VideoTile";
import { pickStageTile, type TileModel } from "./tiles";

interface LiveStageProps {
  tiles: TileModel[];
  layout: LiveLayout;
  pinned: StageSelection;
  onPin: (tile: TileModel) => void;
  /** Provided only when this user may moderate the given tile. */
  onModerate?: (tile: TileModel) => void;
  canModerate: (tile: TileModel) => boolean;
}

/** Column count that keeps 16:9 tiles filling the row without stretching. */
function columnsFor(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count <= 2) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid-cols-2";
  if (count <= 6) return "grid-cols-2 lg:grid-cols-3";
  if (count <= 9) return "grid-cols-2 sm:grid-cols-3";
  if (count <= 12) return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
  return "grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
}

function keyForSelection(selection: StageSelection): string | null {
  if (!selection) return null;
  switch (selection.kind) {
    case "local":
      return "local";
    case "local-screen":
      return "local-screen";
    case "remote":
      return selection.sid;
    case "screen":
      return `${selection.sid}-screen`;
  }
}

export default function LiveStage({
  tiles,
  layout,
  pinned,
  onPin,
  onModerate,
  canModerate,
}: LiveStageProps) {
  const pinnedKey = keyForSelection(pinned);

  const stageTile = useMemo(() => {
    if (pinnedKey) {
      const match = tiles.find((tile) => tile.key === pinnedKey);
      if (match) return match;
    }
    return pickStageTile(tiles);
  }, [tiles, pinnedKey]);

  const stripTiles = useMemo(
    () => tiles.filter((tile) => tile.key !== stageTile?.key),
    [tiles, stageTile],
  );

  const moderationHandler = (tile: TileModel) =>
    onModerate && canModerate(tile) ? () => onModerate(tile) : undefined;

  if (tiles.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="font-body text-[14px] text-white/50">
          {t("app.live.waitingForOthers")}
        </p>
      </div>
    );
  }

  /* ── Grid ──────────────────────────────────────────────────────────────── */

  if (layout === "grid") {
    const hosts = tiles.filter((tile) => tile.isHost || tile.isScreen);
    const others = tiles.filter((tile) => !tile.isHost && !tile.isScreen);

    const section = (label: string, group: TileModel[]) =>
      group.length === 0 ? null : (
        <section key={label}>
          {hosts.length > 0 && others.length > 0 && (
            <h2 className="mb-2 font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
              {label}
            </h2>
          )}
          <div className={`grid gap-2 sm:gap-3 ${columnsFor(group.length)}`}>
            {group.map((tile) => (
              <VideoTile
                key={tile.key}
                tile={tile}
                size={group.length <= 2 ? "lg" : "md"}
                onOptions={moderationHandler(tile)}
                onClick={() => onPin(tile)}
                className="aspect-video"
              />
            ))}
          </div>
        </section>
      );

    return (
      <div className="h-full overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-5">
          {section(t("app.live.hostsSection"), hosts)}
          {section(t("app.live.participantsSection"), others)}
        </div>
      </div>
    );
  }

  /* ── Stage + filmstrip ─────────────────────────────────────────────────── */

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 px-3 py-3 sm:px-4">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {stageTile && (
          <VideoTile
            tile={stageTile}
            size="lg"
            pinned={Boolean(pinnedKey)}
            onOptions={moderationHandler(stageTile)}
            onClick={pinnedKey ? () => onPin(stageTile) : undefined}
            className="h-full max-h-full w-full max-w-full"
          />
        )}
      </div>

      {stripTiles.length > 0 && (
        <div
          className="flex shrink-0 gap-2 overflow-x-auto overscroll-x-contain pb-1"
          role="list"
          aria-label={t("app.live.otherParticipants")}
        >
          {stripTiles.map((tile) => (
            <div key={tile.key} role="listitem" className="shrink-0">
              <VideoTile
                tile={tile}
                size="sm"
                onOptions={moderationHandler(tile)}
                onClick={() => onPin(tile)}
                className="h-[84px] w-[150px] lg:h-[104px] lg:w-[186px]"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
