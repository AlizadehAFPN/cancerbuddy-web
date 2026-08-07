"use client";

/**
 * One participant rectangle — the same component for the stage, the filmstrip
 * and the grid, sized by its container.
 *
 * The `<video>` element is always mounted, even with no track: remounting it
 * when a camera comes on causes a visible black flash in Chrome, and keeping it
 * lets the camera-off overlay cross-fade instead of popping.
 */

import { useEffect, useRef, useState } from "react";
import { MicOff, Radio, TriangleAlert } from "lucide-react";
import { t } from "@/lib/i18n";
import { initialsOf } from "@/lib/live/identity";
import NetworkQualityBars from "./NetworkQualityBars";
import type { TileModel } from "./tiles";

export type TileSize = "sm" | "md" | "lg";

interface VideoTileProps {
  tile: TileModel;
  size?: TileSize;
  /** Show the "⋮" affordance — hosts moderating someone other than themselves. */
  onOptions?: () => void;
  /** Click-through to pin this tile onto the stage. */
  onClick?: () => void;
  pinned?: boolean;
  className?: string;
}

const avatarSize: Record<TileSize, string> = {
  sm: "h-10 w-10 text-[13px]",
  md: "h-14 w-14 text-[17px]",
  lg: "h-24 w-24 text-[30px]",
};

const labelSize: Record<TileSize, string> = {
  sm: "text-[11px] px-1.5 py-0.5",
  md: "text-[12px] px-2 py-1",
  lg: "text-[13px] px-2.5 py-1",
};

export default function VideoTile({
  tile,
  size = "md",
  onOptions,
  onClick,
  pinned,
  className = "",
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [attached, setAttached] = useState(false);

  useEffect(() => {
    const element = videoRef.current;
    const track = tile.videoTrack;
    if (!element || !track) {
      setAttached(false);
      return;
    }
    track.attach(element);
    setAttached(true);
    return () => {
      track.detach(element);
      /* Twilio leaves the last frame behind on detach. */
      element.srcObject = null;
      setAttached(false);
    };
  }, [tile.videoTrack]);

  const showVideo = attached && tile.cameraOn;

  return (
    <div
      className={[
        "group relative isolate overflow-hidden rounded-2xl bg-cb-live-surface",
        "ring-inset transition-[box-shadow,transform] duration-200",
        tile.speaking
          ? "ring-2 ring-cb-yellow shadow-[0_0_0_1px_rgba(254,233,72,0.35),0_0_28px_-6px_rgba(254,233,72,0.55)]"
          : pinned
            ? "ring-2 ring-white/40"
            : "ring-1 ring-white/10",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={[
          "h-full w-full transition-opacity duration-200",
          tile.isScreen ? "object-contain bg-black" : "object-cover",
          /* A self-view that isn't mirrored feels wrong to everyone; a screen
             share that is mirrored is unreadable. */
          tile.isLocal && !tile.isScreen ? "-scale-x-100" : "",
          showVideo ? "opacity-100" : "opacity-0",
        ]
          .filter(Boolean)
          .join(" ")}
      />

      {/* Camera off */}
      {!showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-cb-live-surface">
          <span
            className={[
              "flex items-center justify-center rounded-full bg-cb-live-raised font-heading font-bold text-white/90",
              avatarSize[size],
            ].join(" ")}
          >
            {initialsOf(tile.fullName)}
          </span>
          {size === "lg" && (
            <span className="font-body text-[13px] text-white/45">
              {t("app.live.cameraOff")}
            </span>
          )}
        </div>
      )}

      {/* Reconnecting */}
      {tile.reconnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
          <span className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 font-body text-[12px] text-white">
            <TriangleAlert size={14} className="text-cb-warning" />
            {t("app.live.reconnectingParticipant")}
          </span>
        </div>
      )}

      {/* Name + state, bottom-left */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2">
        <span
          className={[
            "flex min-w-0 items-center gap-1.5 rounded-md bg-black/55 font-body text-white backdrop-blur-sm",
            labelSize[size],
          ].join(" ")}
        >
          {!tile.micOn && !tile.isScreen && (
            <MicOff size={size === "sm" ? 11 : 13} className="shrink-0 text-cb-danger" />
          )}
          <span className="truncate">{tile.label}</span>
          {tile.isHost && !tile.isScreen && (
            <span className="shrink-0 rounded-sm bg-cb-yellow px-1 font-heading text-[9px] font-bold uppercase tracking-wide text-cb-black">
              {t("app.live.hostBadge")}
            </span>
          )}
        </span>

        {tile.networkQuality !== null && size !== "sm" && (
          <NetworkQualityBars level={tile.networkQuality} />
        )}
      </div>

      {/* Screen-share marker, top-left */}
      {tile.isScreen && (
        <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 font-body text-[11px] text-white backdrop-blur-sm">
          <Radio size={12} className="text-cb-green" />
          {t("app.live.presenting")}
        </span>
      )}

      {/* Pinning covers the tile as its own layer rather than wrapping it: a
          `<button>` around the whole thing would nest the options button
          inside it, which is invalid and gets dropped by some browsers. */}
      {onClick && (
        <button
          type="button"
          onClick={onClick}
          aria-label={t("app.live.pinTile", { name: tile.fullName })}
          className="absolute inset-0 z-[1] cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cb-yellow"
        />
      )}

      {/* Host moderation, top-right. Always reachable on touch, hover-revealed
          on pointer devices so it doesn't clutter a wall of tiles. */}
      {onOptions && (
        <button
          type="button"
          onClick={onOptions}
          aria-label={t("app.live.manageParticipant", { name: tile.fullName })}
          className="absolute right-2 top-2 z-[2] flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white/90 backdrop-blur-sm transition-opacity hover:bg-black/75 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
        >
          <span aria-hidden className="text-[16px] leading-none">⋯</span>
        </button>
      )}
    </div>
  );
}
