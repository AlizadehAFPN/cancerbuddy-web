"use client";

/**
 * The Twilio Video room — the web counterpart of `useTwilioRoom.ts` in
 * `cancerbuddyapp`.
 *
 * Behaviour deliberately matched to mobile:
 *  • The token Lambda is the sole authority on `isHost` / `hostIds`; nothing
 *    here infers a role from the participant list.
 *  • Everyone joins muted with the camera off. Media permission is requested
 *    the moment someone turns a device on, never before.
 *  • Turning a device off *unpublishes and stops* its track rather than only
 *    disabling it, so the camera light goes out and the browser stops showing
 *    a recording indicator. Mobile has the same intent.
 *
 * Web-only, because a browser is not a phone:
 *  • Screen sharing (hosts).
 *  • Per-device selection, switchable mid-session.
 *  • Dominant speaker and network quality are surfaced in the UI; mobile asks
 *    Twilio for both but never shows them.
 *
 * Remote state is rebuilt wholesale from `room.participants` on every relevant
 * event instead of being patched track-by-track. Sessions are small (a group
 * call, not a webinar), and a full rebuild cannot drift out of sync with the
 * SDK the way incremental patches did on mobile.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteAudioTrack,
  RemoteParticipant,
  RemoteVideoTrack,
  Room,
  TwilioError,
} from "twilio-video";
import { t } from "@/lib/i18n";
import { firstNameOf, parseIdentity } from "@/lib/live/identity";
import {
  MediaAccessError,
  SCREEN_TRACK_NAME,
  createCameraTrack,
  createMicrophoneTrack,
  createScreenTrack,
  loadTwilioVideo,
} from "@/lib/live/localTracks";
import { LiveServiceError, fetchTwilioToken } from "@/lib/live/liveService";
import { roomNameFor } from "@/lib/live/session";
import type { LiveConnectionState, RemoteMedia } from "@/lib/live/types";

export interface JoinOptions {
  /** Tracks the pre-join preview already created; adopted as-is. */
  cameraTrack?: LocalVideoTrack | null;
  microphoneTrack?: LocalAudioTrack | null;
}

export interface LiveRoomController {
  status: LiveConnectionState;
  error: string | null;
  /**
   * Acknowledges an in-room error (once it's been shown). Without this the
   * same failure twice in a row — "your camera is in use", tried again — would
   * leave `error` unchanged and the second attempt would fail silently.
   */
  clearError: () => void;
  /** Set when the failure is terminal (blocked, removed) — retry is pointless. */
  fatal: boolean;
  isHost: boolean;
  hostIds: string[];
  remotes: RemoteMedia[];
  dominantSpeakerSid: string | null;
  localVideoTrack: LocalVideoTrack | null;
  localAudioTrack: LocalAudioTrack | null;
  localScreenTrack: LocalVideoTrack | null;
  cameraOn: boolean;
  micOn: boolean;
  screenOn: boolean;
  /** A device toggle is in flight; buttons disable so it can't be double-fired. */
  mediaBusy: boolean;
  localNetworkQuality: number | null;
  /** Remote participants plus this user. */
  participantCount: number;

  join: (options?: JoinOptions) => Promise<void>;
  leave: () => void;
  toggleCamera: () => Promise<void>;
  toggleMicrophone: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  /** Applies a host's mute — same path as the user's own toggle, no prompt. */
  forceCameraOff: () => void;
  forceMicrophoneOff: () => void;
  /** Drops someone locally when moderation removes them before Twilio catches up. */
  dropParticipant: (userId: string) => void;
  switchCamera: (deviceId: string) => Promise<void>;
  switchMicrophone: (deviceId: string) => Promise<void>;
}

interface UseLiveRoomParams {
  eventId: string;
  groupId?: string;
  userId: string | null;
  userName: string | null;
  cameraId?: string;
  microphoneId?: string;
}

/* ── Remote snapshot ─────────────────────────────────────────────────────── */

function isScreenPublication(name: string | undefined): boolean {
  return (name ?? "").toLowerCase().includes(SCREEN_TRACK_NAME);
}

/**
 * Flattens one participant's publications into the shape a tile renders.
 *
 * A publication can exist without a subscribed track (still negotiating, or
 * switched off by the bandwidth profile), which is why `videoEnabled` comes
 * from the publication and the track itself may still be null.
 */
function snapshotParticipant(
  participant: RemoteParticipant,
  hostIds: string[],
): RemoteMedia {
  const { userId, displayName } = parseIdentity(participant.identity);

  let cameraTrack: RemoteVideoTrack | null = null;
  let screenTrack: RemoteVideoTrack | null = null;
  let videoEnabled = false;

  participant.videoTracks.forEach((publication) => {
    const track = (publication.track as RemoteVideoTrack | null) ?? null;
    if (isScreenPublication(publication.trackName)) {
      if (track) screenTrack = track;
      return;
    }
    if (publication.isTrackEnabled) videoEnabled = true;
    if (track && publication.isTrackEnabled) cameraTrack = track;
  });

  let audioTrack: RemoteAudioTrack | null = null;
  let audioEnabled = false;
  participant.audioTracks.forEach((publication) => {
    if (publication.isTrackEnabled) audioEnabled = true;
    const track = (publication.track as RemoteAudioTrack | null) ?? null;
    if (track) audioTrack = track;
  });

  return {
    sid: participant.sid,
    identity: participant.identity,
    userId,
    displayName: firstNameOf(displayName),
    isHost: hostIds.includes(userId),
    cameraTrack,
    screenTrack,
    audioTrack,
    audioEnabled,
    videoEnabled,
    networkQuality: participant.networkQualityLevel,
    reconnecting: participant.state === "reconnecting",
    participant,
  };
}

/* ── Hook ────────────────────────────────────────────────────────────────── */

export function useLiveRoom(params: UseLiveRoomParams): LiveRoomController {
  const { eventId, groupId, userId, userName, cameraId, microphoneId } = params;

  const [status, setStatus] = useState<LiveConnectionState>("prejoin");
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [hostIds, setHostIds] = useState<string[]>([]);
  const [remotes, setRemotes] = useState<RemoteMedia[]>([]);
  const [dominantSpeakerSid, setDominantSpeakerSid] = useState<string | null>(
    null,
  );
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(
    null,
  );
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(
    null,
  );
  const [localScreenTrack, setLocalScreenTrack] =
    useState<LocalVideoTrack | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [localNetworkQuality, setLocalNetworkQuality] = useState<number | null>(
    null,
  );

  /**
   * The room lives in state as well as a ref: the ref is what callbacks read
   * (always current, never stale), the state is what the event-wiring effect
   * depends on. Keying that effect off `status` instead would detach every
   * listener during a `reconnecting` blip — including the `reconnected` one.
   */
  const [room, setRoom] = useState<Room | null>(null);
  const roomRef = useRef<Room | null>(null);
  const hostIdsRef = useRef<string[]>([]);
  /** Ids we removed locally, so a late Twilio event can't resurrect their tile. */
  const droppedRef = useRef<Set<string>>(new Set());
  /** Guards the whole teardown path against React's double-invoked effects. */
  const leftRef = useRef(false);
  /* Read by the toggles, which only ever run from a click — post-commit. */
  const cameraIdRef = useRef(cameraId);
  const microphoneIdRef = useRef(microphoneId);

  useEffect(() => {
    cameraIdRef.current = cameraId;
    microphoneIdRef.current = microphoneId;
  }, [cameraId, microphoneId]);

  /* ── Remote list ───────────────────────────────────────────────────────── */

  const rebuildRemotes = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const next: RemoteMedia[] = [];
    room.participants.forEach((participant) => {
      const { userId: participantUserId } = parseIdentity(participant.identity);
      /* Never show ourselves twice if we rejoin before the old session ages out. */
      if (participantUserId && participantUserId === userId) return;
      if (droppedRef.current.has(participantUserId)) return;
      next.push(snapshotParticipant(participant, hostIdsRef.current));
    });
    /* Hosts first, then alphabetically — a stable order stops tiles jumping. */
    next.sort((a, b) => {
      if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });
    setRemotes(next);
  }, [userId]);

  const clearError = useCallback(() => setError(null), []);

  const dropParticipant = useCallback(
    (targetUserId: string) => {
      if (!targetUserId) return;
      droppedRef.current.add(targetUserId);
      setRemotes((prev) => prev.filter((r) => r.userId !== targetUserId));
    },
    [],
  );

  /* ── Teardown ──────────────────────────────────────────────────────────── */

  /* `leave` must not depend on state, or a stale copy would tear down the
     wrong tracks; the live values are read from the room instead. */
  const leave = useCallback(() => {
    leftRef.current = true;
    const room = roomRef.current;
    roomRef.current = null;
    setRoom(null);
    if (room) {
      room.localParticipant.tracks.forEach((publication) => {
        const track = publication.track;
        if (track.kind === "audio" || track.kind === "video") {
          try {
            (track as LocalAudioTrack | LocalVideoTrack).stop();
          } catch {
            /* already stopped */
          }
        }
      });
      try {
        room.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    setLocalVideoTrack(null);
    setLocalAudioTrack(null);
    setLocalScreenTrack(null);
    setRemotes([]);
    setStatus("disconnected");
  }, []);

  /* Leaving the page must release the camera and the room, always. */
  useEffect(() => {
    return () => {
      if (!leftRef.current) leave();
    };
  }, [leave]);

  /* ── Join ──────────────────────────────────────────────────────────────── */

  const join = useCallback(
    async (options: JoinOptions = {}) => {
      if (!userId) {
        setError(t("app.live.notSignedIn"));
        setStatus("error");
        return;
      }
      if (roomRef.current) return;

      /* A retry after a failed attempt must not inherit the old "we left" flag. */
      leftRef.current = false;
      droppedRef.current = new Set();
      setStatus("connecting");
      setError(null);
      setFatal(false);

      const initialTracks = [options.cameraTrack, options.microphoneTrack].filter(
        (track): track is LocalVideoTrack | LocalAudioTrack => Boolean(track),
      );

      try {
        const roomName = roomNameFor(eventId);
        const credentials = await fetchTwilioToken({
          userId,
          roomName,
          identity: userName || userId,
          groupId,
          eventId,
        });

        if (leftRef.current) {
          initialTracks.forEach((track) => track.stop());
          return;
        }

        hostIdsRef.current = credentials.hostIds ?? [];
        setHostIds(credentials.hostIds ?? []);
        setIsHost(credentials.isHost);

        const Video = await loadTwilioVideo();
        const connected = await Video.connect(credentials.token, {
          name: credentials.roomName || roomName,
          tracks: initialTracks,
          dominantSpeaker: true,
          networkQuality: { local: 1, remote: 1 },
          /* `collaboration` keeps every participant visible while still
             prioritising whoever is speaking; `auto` lets the SDK switch off
             tracks that are off-screen or too small to matter. */
          bandwidthProfile: {
            video: {
              mode: "collaboration",
              clientTrackSwitchOffControl: "auto",
              contentPreferencesMode: "auto",
              dominantSpeakerPriority: "high",
            },
          },
          maxAudioBitrate: 16_000,
          preferredVideoCodecs: [{ codec: "VP8", simulcast: true }],
        });

        /* The user left while the handshake was in flight. */
        if (leftRef.current) {
          connected.localParticipant.tracks.forEach((publication) => {
            const track = publication.track;
            if (track.kind === "audio" || track.kind === "video") {
              (track as LocalAudioTrack | LocalVideoTrack).stop();
            }
          });
          connected.disconnect();
          return;
        }

        roomRef.current = connected;
        setRoom(connected);
        setLocalVideoTrack(options.cameraTrack ?? null);
        setLocalAudioTrack(options.microphoneTrack ?? null);
        setLocalNetworkQuality(connected.localParticipant.networkQualityLevel);
        setStatus("connected");
        rebuildRemotes();
      } catch (err) {
        if (leftRef.current) return;
        initialTracks.forEach((track) => {
          try {
            track.stop();
          } catch {
            /* already stopped */
          }
        });
        const message =
          err instanceof Error && err.message
            ? err.message
            : t("app.live.joinFailed");
        /* A 4xx from the token Lambda is a decision — the session ended, this
           user is blocked, the room is full. Retrying repeats it verbatim, so
           the UI must not offer to. Log those at info: they are the backend
           working, not a fault. */
        const terminal = err instanceof LiveServiceError && err.terminal;
        if (terminal) console.info("[live] join refused:", message);
        else console.error("[live] join failed:", err);

        setError(message);
        setFatal(terminal);
        setStatus("error");
      }
    },
    [eventId, groupId, userId, userName, rebuildRemotes],
  );

  /* ── Room events ───────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!room) return;

    const sync = () => rebuildRemotes();

    /* Network quality is the one event Room doesn't re-emit, so each
       participant is subscribed individually. */
    const watchQuality = (participant: RemoteParticipant) => {
      participant.on("networkQualityLevelChanged", sync);
    };
    const unwatchQuality = (participant: RemoteParticipant) => {
      participant.off("networkQualityLevelChanged", sync);
    };

    room.participants.forEach(watchQuality);

    const onParticipantConnected = (participant: RemoteParticipant) => {
      watchQuality(participant);
      sync();
    };
    const onParticipantDisconnected = (participant: RemoteParticipant) => {
      unwatchQuality(participant);
      /* Someone who left cleanly may come back — clear any local drop. */
      droppedRef.current.delete(parseIdentity(participant.identity).userId);
      sync();
    };
    const onDominantSpeaker = (participant: RemoteParticipant | null) => {
      setDominantSpeakerSid(participant?.sid ?? null);
    };
    const onLocalQuality = (level: number) => setLocalNetworkQuality(level);
    const onReconnecting = () => setStatus("reconnecting");
    const onReconnected = () => {
      setStatus("connected");
      sync();
    };
    const onDisconnected = (_room: Room, twilioError: TwilioError | null) => {
      roomRef.current = null;
      setRoom(null);
      setRemotes([]);
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
      setLocalScreenTrack(null);
      if (leftRef.current) return;

      if (twilioError) {
        /* Matched on the message, not the numeric code: joining from a second
           tab is common enough that a generic error would send people hunting. */
        const duplicate = /duplicate identity/i.test(twilioError.message ?? "");
        setError(
          duplicate ? t("app.live.duplicateIdentity") : t("app.live.sessionEnded"),
        );
        setFatal(duplicate);
        setStatus("error");
        return;
      }
      setStatus("disconnected");
    };

    room.on("participantConnected", onParticipantConnected);
    room.on("participantDisconnected", onParticipantDisconnected);
    room.on("participantReconnecting", sync);
    room.on("participantReconnected", sync);
    room.on("trackSubscribed", sync);
    room.on("trackUnsubscribed", sync);
    room.on("trackPublished", sync);
    room.on("trackUnpublished", sync);
    room.on("trackEnabled", sync);
    room.on("trackDisabled", sync);
    room.on("trackSwitchedOn", sync);
    room.on("trackSwitchedOff", sync);
    room.on("dominantSpeakerChanged", onDominantSpeaker);
    room.on("reconnecting", onReconnecting);
    room.on("reconnected", onReconnected);
    room.on("disconnected", onDisconnected);
    room.localParticipant.on("networkQualityLevelChanged", onLocalQuality);

    return () => {
      room.participants.forEach(unwatchQuality);
      room.off("participantConnected", onParticipantConnected);
      room.off("participantDisconnected", onParticipantDisconnected);
      room.off("participantReconnecting", sync);
      room.off("participantReconnected", sync);
      room.off("trackSubscribed", sync);
      room.off("trackUnsubscribed", sync);
      room.off("trackPublished", sync);
      room.off("trackUnpublished", sync);
      room.off("trackEnabled", sync);
      room.off("trackDisabled", sync);
      room.off("trackSwitchedOn", sync);
      room.off("trackSwitchedOff", sync);
      room.off("dominantSpeakerChanged", onDominantSpeaker);
      room.off("reconnecting", onReconnecting);
      room.off("reconnected", onReconnected);
      room.off("disconnected", onDisconnected);
      room.localParticipant.off("networkQualityLevelChanged", onLocalQuality);
    };
  }, [room, rebuildRemotes]);

  /* ── Local media ───────────────────────────────────────────────────────── */

  const unpublishAndStop = useCallback(
    (track: LocalVideoTrack | LocalAudioTrack | null) => {
      if (!track) return;
      try {
        roomRef.current?.localParticipant.unpublishTrack(track);
      } catch {
        /* not published */
      }
      try {
        track.stop();
      } catch {
        /* already stopped */
      }
    },
    [],
  );

  const toggleCamera = useCallback(async () => {
    if (mediaBusy) return;
    setMediaBusy(true);
    try {
      if (localVideoTrack) {
        unpublishAndStop(localVideoTrack);
        setLocalVideoTrack(null);
        return;
      }
      const track = await createCameraTrack(cameraIdRef.current);
      const room = roomRef.current;
      if (!room) {
        track.stop();
        return;
      }
      await room.localParticipant.publishTrack(track);
      setLocalVideoTrack(track);
    } catch (err) {
      if (err instanceof MediaAccessError && err.message) setError(err.message);
      else if (!(err instanceof MediaAccessError)) {
        console.error("[live] camera toggle failed:", err);
        setError(t("app.live.cameraFailed"));
      }
    } finally {
      setMediaBusy(false);
    }
  }, [mediaBusy, localVideoTrack, unpublishAndStop]);

  const toggleMicrophone = useCallback(async () => {
    if (mediaBusy) return;
    setMediaBusy(true);
    try {
      if (localAudioTrack) {
        unpublishAndStop(localAudioTrack);
        setLocalAudioTrack(null);
        return;
      }
      const track = await createMicrophoneTrack(microphoneIdRef.current);
      const room = roomRef.current;
      if (!room) {
        track.stop();
        return;
      }
      await room.localParticipant.publishTrack(track);
      setLocalAudioTrack(track);
    } catch (err) {
      if (err instanceof MediaAccessError && err.message) setError(err.message);
      else if (!(err instanceof MediaAccessError)) {
        console.error("[live] microphone toggle failed:", err);
        setError(t("app.live.micFailed"));
      }
    } finally {
      setMediaBusy(false);
    }
  }, [mediaBusy, localAudioTrack, unpublishAndStop]);

  const toggleScreenShare = useCallback(async () => {
    if (mediaBusy) return;
    setMediaBusy(true);
    try {
      if (localScreenTrack) {
        unpublishAndStop(localScreenTrack);
        setLocalScreenTrack(null);
        return;
      }
      const track = await createScreenTrack();
      const room = roomRef.current;
      if (!room) {
        track.stop();
        return;
      }
      /* The browser's own "Stop sharing" bar ends the MediaStreamTrack
         directly; without this the tile would linger as a frozen frame. */
      track.mediaStreamTrack.addEventListener("ended", () => {
        try {
          roomRef.current?.localParticipant.unpublishTrack(track);
        } catch {
          /* not published */
        }
        setLocalScreenTrack(null);
      });
      await room.localParticipant.publishTrack(track, { priority: "high" });
      setLocalScreenTrack(track);
    } catch (err) {
      if (err instanceof MediaAccessError && err.message) setError(err.message);
      else if (!(err instanceof MediaAccessError)) {
        console.error("[live] screen share failed:", err);
        setError(t("app.live.screenFailed"));
      }
    } finally {
      setMediaBusy(false);
    }
  }, [mediaBusy, localScreenTrack, unpublishAndStop]);

  const forceCameraOff = useCallback(() => {
    if (!localVideoTrack) return;
    unpublishAndStop(localVideoTrack);
    setLocalVideoTrack(null);
  }, [localVideoTrack, unpublishAndStop]);

  const forceMicrophoneOff = useCallback(() => {
    if (!localAudioTrack) return;
    unpublishAndStop(localAudioTrack);
    setLocalAudioTrack(null);
  }, [localAudioTrack, unpublishAndStop]);

  /**
   * Swapping a device mid-session uses `restart`, which replaces the underlying
   * `MediaStreamTrack` in place — the publication survives, so nobody else sees
   * the video blink out and back.
   */
  const switchCamera = useCallback(
    async (deviceId: string) => {
      if (!localVideoTrack) return;
      try {
        await localVideoTrack.restart({ deviceId: { exact: deviceId } });
      } catch (err) {
        console.error("[live] camera switch failed:", err);
        setError(t("app.live.deviceSwitchFailed"));
      }
    },
    [localVideoTrack],
  );

  const switchMicrophone = useCallback(
    async (deviceId: string) => {
      if (!localAudioTrack) return;
      try {
        await localAudioTrack.restart({ deviceId: { exact: deviceId } });
      } catch (err) {
        console.error("[live] microphone switch failed:", err);
        setError(t("app.live.deviceSwitchFailed"));
      }
    },
    [localAudioTrack],
  );

  return {
    status,
    error,
    clearError,
    fatal,
    isHost,
    hostIds,
    remotes,
    dominantSpeakerSid,
    localVideoTrack,
    localAudioTrack,
    localScreenTrack,
    cameraOn: Boolean(localVideoTrack),
    micOn: Boolean(localAudioTrack),
    screenOn: Boolean(localScreenTrack),
    mediaBusy,
    localNetworkQuality,
    participantCount: remotes.length + 1,
    join,
    leave,
    toggleCamera,
    toggleMicrophone,
    toggleScreenShare,
    forceCameraOff,
    forceMicrophoneOff,
    dropParticipant,
    switchCamera,
    switchMicrophone,
  };
}
