/**
 * Types for the live video room.
 *
 * The wire shapes (`TwilioTokenResponse`, `ModerationAction`) are a contract
 * with the `users-demo` Lambda and are byte-identical to the ones the mobile
 * app sends — see `cancerbuddyapp/src/services/streaming/twilio-video.ts`.
 * The view models below that are web-only.
 */

import type {
  RemoteAudioTrack,
  RemoteParticipant,
  RemoteVideoTrack,
} from "twilio-video";

/* ── Lambda contract ─────────────────────────────────────────────────────── */

export interface TwilioTokenResponse {
  token: string;
  roomName: string;
  identity: string;
  isHost: boolean;
  /** Everyone who hosts this session's group. Drives host badges and moderation. */
  hostIds?: string[];
}

/** Host-only actions, applied to another participant. */
export type ModerationAction = "mute_audio" | "mute_video" | "remove" | "block";

/* ── Session ─────────────────────────────────────────────────────────────── */

/** The scheduled session the room is built around. */
export interface LiveRoomSession {
  id: string;
  groupId: string;
  groupName?: string | null;
  title?: string | null;
  description?: string | null;
  /** Stream channel backing the live chat; defaults to `live-<id>`. */
  chatChannelId?: string | null;
  /** `"scheduled"` | `"live"` | `"ended"`. */
  status?: string | null;
  inLive?: boolean | null;
  archived?: boolean | null;
  /** `false` means the host has hidden it from members. */
  active?: boolean | null;
  scheduledAt?: string | null;
  duration?: number | null;
}

/* ── Room view models ────────────────────────────────────────────────────── */

/**
 * One remote participant, flattened for rendering.
 *
 * Rebuilt from `Room.participants` whenever Twilio fires a track or
 * participant event rather than mutated in place, so React sees a new object
 * and re-renders the tile.
 */
export interface RemoteMedia {
  /** Twilio participant SID — stable for the participant's whole session. */
  sid: string;
  identity: string;
  userId: string;
  displayName: string;
  isHost: boolean;
  /** Camera track, present and subscribed. Null when the camera is off. */
  cameraTrack: RemoteVideoTrack | null;
  /** Screen share, published under the `screen` track name. */
  screenTrack: RemoteVideoTrack | null;
  audioTrack: RemoteAudioTrack | null;
  /** `false` while the participant has muted themselves. */
  audioEnabled: boolean;
  videoEnabled: boolean;
  /** 0 (unusable) – 5 (excellent), or null before the first report. */
  networkQuality: number | null;
  /** Twilio is re-establishing this participant's media. */
  reconnecting: boolean;
  participant: RemoteParticipant;
}

export type LiveConnectionState =
  | "idle"
  | "prejoin"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

/** Which tile the stage is showing, if the user has pinned one. */
export type StageSelection =
  | { kind: "local" }
  | { kind: "remote"; sid: string }
  | { kind: "screen"; sid: string }
  | { kind: "local-screen" }
  | null;

export type LiveLayout = "stage" | "grid";

/* ── Chat ────────────────────────────────────────────────────────────────── */

export interface LiveChatMessage {
  id: string;
  sender: string;
  text: string;
  /** Epoch ms. */
  timestamp: number;
  isHost: boolean;
  /** This user wrote it — right-aligned, bone bubble. */
  isMine: boolean;
  /** Optimistic message whose send failed; offers a retry. */
  failed?: boolean;
}

/* ── Devices ─────────────────────────────────────────────────────────────── */

export interface DeviceOption {
  deviceId: string;
  label: string;
}

export interface DeviceSelection {
  cameraId?: string;
  microphoneId?: string;
  speakerId?: string;
}
