/**
 * One flat model for everything the stage and the grid render.
 *
 * A local camera, a remote camera, and a screen share are three different
 * objects in the Twilio SDK but the same rectangle on screen. Normalising them
 * here keeps the layout code free of `isLocal ? … : …` branches and makes the
 * two layouts share a single tile component.
 */

import type { LocalVideoTrack, RemoteVideoTrack } from "twilio-video";
import { t } from "@/lib/i18n";
import type { RemoteMedia } from "@/lib/live/types";

export interface TileModel {
  /** Stable across re-renders — a screen share is a separate tile from its owner. */
  key: string;
  /** Null for the local user; moderation and pinning key on it otherwise. */
  userId: string | null;
  /** Short label under the tile ("You", "Sara"). */
  label: string;
  /** Full name, used by the participants list and moderation sheet. */
  fullName: string;
  isLocal: boolean;
  isHost: boolean;
  isScreen: boolean;
  videoTrack: LocalVideoTrack | RemoteVideoTrack | null;
  cameraOn: boolean;
  micOn: boolean;
  speaking: boolean;
  /** 0–5, or null before Twilio's first report. */
  networkQuality: number | null;
  reconnecting: boolean;
}

export function localTile(options: {
  videoTrack: LocalVideoTrack | null;
  micOn: boolean;
  isHost: boolean;
  networkQuality: number | null;
  name: string | null;
}): TileModel {
  return {
    key: "local",
    userId: null,
    label: t("app.live.you"),
    fullName: options.name || t("app.live.you"),
    isLocal: true,
    isHost: options.isHost,
    isScreen: false,
    videoTrack: options.videoTrack,
    cameraOn: Boolean(options.videoTrack),
    micOn: options.micOn,
    speaking: false,
    networkQuality: options.networkQuality,
    reconnecting: false,
  };
}

export function localScreenTile(track: LocalVideoTrack): TileModel {
  return {
    key: "local-screen",
    userId: null,
    label: t("app.live.yourScreen"),
    fullName: t("app.live.yourScreen"),
    isLocal: true,
    isHost: false,
    isScreen: true,
    videoTrack: track,
    cameraOn: true,
    micOn: false,
    speaking: false,
    networkQuality: null,
    reconnecting: false,
  };
}

export function remoteTile(media: RemoteMedia, speaking: boolean): TileModel {
  return {
    key: media.sid,
    userId: media.userId,
    label: media.displayName,
    fullName: media.displayName,
    isLocal: false,
    isHost: media.isHost,
    isScreen: false,
    videoTrack: media.cameraTrack,
    cameraOn: Boolean(media.cameraTrack) && media.videoEnabled,
    micOn: media.audioEnabled,
    speaking,
    networkQuality: media.networkQuality,
    reconnecting: media.reconnecting,
  };
}

export function remoteScreenTile(media: RemoteMedia): TileModel | null {
  if (!media.screenTrack) return null;
  return {
    key: `${media.sid}-screen`,
    userId: media.userId,
    label: t("app.live.screenOf", { name: media.displayName }),
    fullName: t("app.live.screenOf", { name: media.displayName }),
    isLocal: false,
    isHost: media.isHost,
    isScreen: true,
    videoTrack: media.screenTrack,
    cameraOn: true,
    micOn: false,
    speaking: false,
    networkQuality: null,
    reconnecting: false,
  };
}

/**
 * What the stage shows when nobody has pinned anything.
 *
 * A screen share wins outright — it is always the reason the session exists at
 * that moment. Otherwise the current speaker, then any host with their camera
 * on, then a host, then whoever is first. Mobile has no stage, so this ordering
 * is web-only; it is what stops the stage flickering between people in a quiet
 * room.
 */
export function pickStageTile(tiles: TileModel[]): TileModel | null {
  if (tiles.length === 0) return null;
  return (
    tiles.find((tile) => tile.isScreen) ??
    tiles.find((tile) => tile.speaking) ??
    tiles.find((tile) => tile.isHost && tile.cameraOn && !tile.isLocal) ??
    tiles.find((tile) => tile.isHost && !tile.isLocal) ??
    tiles.find((tile) => !tile.isLocal) ??
    tiles[0]
  );
}
