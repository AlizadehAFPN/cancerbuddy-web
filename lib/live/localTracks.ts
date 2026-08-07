"use client";

/**
 * Creating the local camera / microphone / screen tracks.
 *
 * Shared by the pre-join screen and the in-room toggles so a person is asked
 * for permission at most once: the tracks the pre-join preview creates are the
 * same objects handed to `Video.connect`, rather than being torn down and
 * recreated (which prompts again in Safari and flashes the camera light).
 *
 * `getUserMedia` failures are translated here. The raw `DOMException` names
 * ("NotReadableError") are meaningless to a member, and each of the three
 * common ones needs a different action from them — allow the permission, plug
 * something in, or quit the app that's holding the camera.
 */

import type { LocalAudioTrack, LocalVideoTrack } from "twilio-video";
import { t } from "@/lib/i18n";

/** Track names Twilio publishes under; `screen` is how a share is recognised. */
export const CAMERA_TRACK_NAME = "camera";
export const MICROPHONE_TRACK_NAME = "microphone";
export const SCREEN_TRACK_NAME = "screen";

/** Loaded on demand — the SDK is ~500 kB and only the live room needs it. */
export async function loadTwilioVideo() {
  return import("twilio-video");
}

export class MediaAccessError extends Error {
  readonly kind: "denied" | "missing" | "busy" | "unknown";
  constructor(kind: MediaAccessError["kind"], message: string) {
    super(message);
    this.name = "MediaAccessError";
    this.kind = kind;
  }
}

function describeMediaError(error: unknown, kind: "camera" | "microphone"): MediaAccessError {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";

  if (name === "NotAllowedError" || name === "SecurityError") {
    return new MediaAccessError(
      "denied",
      t(kind === "camera" ? "app.live.cameraDenied" : "app.live.micDenied"),
    );
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return new MediaAccessError(
      "missing",
      t(kind === "camera" ? "app.live.cameraMissing" : "app.live.micMissing"),
    );
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return new MediaAccessError(
      "busy",
      t(kind === "camera" ? "app.live.cameraBusy" : "app.live.micBusy"),
    );
  }
  return new MediaAccessError(
    "unknown",
    t(kind === "camera" ? "app.live.cameraFailed" : "app.live.micFailed"),
  );
}

/**
 * A specific device is requested with `exact` so a stale saved id fails loudly
 * instead of silently opening the wrong camera; the caller falls back to the
 * default on `OverconstrainedError`.
 */
export async function createCameraTrack(
  deviceId?: string,
): Promise<LocalVideoTrack> {
  const Video = await loadTwilioVideo();
  try {
    return await Video.createLocalVideoTrack({
      name: CAMERA_TRACK_NAME,
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: 24,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    });
  } catch (error) {
    if (
      deviceId &&
      error &&
      typeof error === "object" &&
      "name" in error &&
      (error as { name?: unknown }).name === "OverconstrainedError"
    ) {
      return createCameraTrack(undefined);
    }
    throw describeMediaError(error, "camera");
  }
}

export async function createMicrophoneTrack(
  deviceId?: string,
): Promise<LocalAudioTrack> {
  const Video = await loadTwilioVideo();
  try {
    return await Video.createLocalAudioTrack({
      name: MICROPHONE_TRACK_NAME,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    });
  } catch (error) {
    if (
      deviceId &&
      error &&
      typeof error === "object" &&
      "name" in error &&
      (error as { name?: unknown }).name === "OverconstrainedError"
    ) {
      return createMicrophoneTrack(undefined);
    }
    throw describeMediaError(error, "microphone");
  }
}

/**
 * Screen capture. The browser's own "Stop sharing" bar ends the underlying
 * `MediaStreamTrack` without telling Twilio, so callers must listen for
 * `ended` on `track.mediaStreamTrack` and unpublish — see `useLiveRoom`.
 */
export async function createScreenTrack(): Promise<LocalVideoTrack> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
    throw new MediaAccessError("missing", t("app.live.screenUnsupported"));
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 15 },
      audio: false,
    });
  } catch (error) {
    const name =
      error && typeof error === "object" && "name" in error
        ? String((error as { name?: unknown }).name)
        : "";
    /* The user closing the picker is a normal outcome, not a failure. */
    if (name === "NotAllowedError" || name === "AbortError") {
      throw new MediaAccessError("denied", "");
    }
    throw new MediaAccessError("unknown", t("app.live.screenFailed"));
  }

  const [mediaStreamTrack] = stream.getVideoTracks();
  if (!mediaStreamTrack) {
    throw new MediaAccessError("unknown", t("app.live.screenFailed"));
  }

  const Video = await loadTwilioVideo();
  return new Video.LocalVideoTrack(mediaStreamTrack, {
    name: SCREEN_TRACK_NAME,
  });
}
