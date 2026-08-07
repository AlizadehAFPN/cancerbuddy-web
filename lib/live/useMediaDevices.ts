"use client";

/**
 * Camera / microphone / speaker pickers.
 *
 * Mobile has one camera and a speakerphone toggle, so it needs none of this.
 * A laptop routinely has a built-in webcam, an external one, AirPods, and a
 * monitor's speakers, and picking the wrong one is the single most common way
 * a call goes wrong — so the web room lets people choose.
 *
 * Two browser quirks shape this file:
 *  • Device *labels* are empty until a media permission has been granted once.
 *    The list is therefore re-read after the first `getUserMedia`, not only on
 *    mount, otherwise the menu shows "Camera 1 / Camera 2".
 *  • Output selection (`setSinkId`) is Chromium-only. Where it's missing the
 *    speaker picker is hidden rather than shown broken.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { DeviceOption } from "@/lib/live/types";

const STORAGE_KEY = "cb.live.devices";

export interface MediaDevicesState {
  cameras: DeviceOption[];
  microphones: DeviceOption[];
  speakers: DeviceOption[];
  cameraId?: string;
  microphoneId?: string;
  speakerId?: string;
  /** False on Firefox/Safari, where audio output can't be redirected. */
  canChooseSpeaker: boolean;
  setCameraId: (id: string) => void;
  setMicrophoneId: (id: string) => void;
  setSpeakerId: (id: string) => void;
  /** Re-enumerate — call after a permission is granted so labels fill in. */
  refresh: () => Promise<void>;
}

interface StoredSelection {
  cameraId?: string;
  microphoneId?: string;
  speakerId?: string;
}

/**
 * Device choices persist — being asked to re-pick your headset on every call
 * is exactly the kind of friction that makes people avoid the web client. This
 * is a UI preference, not personal data.
 */
function readStored(): StoredSelection {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const o = parsed as Record<string, unknown>;
    const pick = (v: unknown) => (typeof v === "string" && v ? v : undefined);
    return {
      cameraId: pick(o.cameraId),
      microphoneId: pick(o.microphoneId),
      speakerId: pick(o.speakerId),
    };
  } catch {
    return {};
  }
}

function writeStored(selection: StoredSelection): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    /* private mode / quota — the picker just won't be remembered */
  }
}

/**
 * Read through `useSyncExternalStore` so the server renders `false` and the
 * client's first paint agrees with it — a capability check straight in the
 * render body would show the speaker picker on the client and not in the
 * server HTML, which is a hydration mismatch.
 */
const NEVER_CHANGES = () => () => {};

function supportsOutputSelection(): boolean {
  return (
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype
  );
}

function useCanChooseSpeaker(): boolean {
  return useSyncExternalStore(
    NEVER_CHANGES,
    supportsOutputSelection,
    () => false,
  );
}

function toOptions(
  devices: MediaDeviceInfo[],
  kind: MediaDeviceKind,
  fallbackLabel: string,
): DeviceOption[] {
  return devices
    .filter((d) => d.kind === kind && d.deviceId)
    .map((d, index) => ({
      deviceId: d.deviceId,
      label: d.label || `${fallbackLabel} ${index + 1}`,
    }));
}

/** Keep a stored choice only while that device is still plugged in. */
function resolve(
  stored: string | undefined,
  options: DeviceOption[],
): string | undefined {
  if (stored && options.some((o) => o.deviceId === stored)) return stored;
  return options[0]?.deviceId;
}

export function useMediaDevices(): MediaDevicesState {
  const [cameras, setCameras] = useState<DeviceOption[]>([]);
  const [microphones, setMicrophones] = useState<DeviceOption[]>([]);
  const [speakers, setSpeakers] = useState<DeviceOption[]>([]);
  const [selection, setSelection] = useState<StoredSelection>({});
  const canChooseSpeaker = useCanChooseSpeaker();

  /* Read once on mount rather than in a lazy initialiser, so the server and
     first client render agree and React doesn't flag a hydration mismatch. */
  const hydratedRef = useRef(false);

  /** Applies an enumeration result. Always reached from a browser callback. */
  const apply = useCallback((devices: MediaDeviceInfo[]) => {
    const nextCameras = toOptions(devices, "videoinput", "Camera");
    const nextMicrophones = toOptions(devices, "audioinput", "Microphone");
    const nextSpeakers = toOptions(devices, "audiooutput", "Speaker");

    setCameras(nextCameras);
    setMicrophones(nextMicrophones);
    setSpeakers(nextSpeakers);

    setSelection((prev) => {
      const base = hydratedRef.current ? prev : { ...readStored(), ...prev };
      hydratedRef.current = true;
      return {
        cameraId: resolve(base.cameraId, nextCameras),
        microphoneId: resolve(base.microphoneId, nextMicrophones),
        speakerId: resolve(base.speakerId, nextSpeakers),
      };
    });
  }, []);

  const refresh = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    try {
      apply(await navigator.mediaDevices.enumerateDevices());
    } catch {
      /* Enumeration can fail on a locked-down browser; the pickers stay empty
         and the room falls back to the default devices. */
    }
  }, [apply]);

  /**
   * `navigator.mediaDevices` is an external system with its own change event,
   * so this effect subscribes to it and seeds the first read from the same
   * source. Every state update happens in a browser callback, never inline.
   */
  useEffect(() => {
    const mediaDevices =
      typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!mediaDevices) return;

    let cancelled = false;
    const read = () => {
      mediaDevices
        .enumerateDevices()
        .then((devices) => {
          if (!cancelled) apply(devices);
        })
        .catch(() => {});
    };

    read();
    mediaDevices.addEventListener?.("devicechange", read);
    return () => {
      cancelled = true;
      mediaDevices.removeEventListener?.("devicechange", read);
    };
  }, [apply]);

  const update = useCallback((patch: StoredSelection) => {
    setSelection((prev) => {
      const next = { ...prev, ...patch };
      writeStored(next);
      return next;
    });
  }, []);

  return {
    cameras,
    microphones,
    speakers,
    cameraId: selection.cameraId,
    microphoneId: selection.microphoneId,
    speakerId: selection.speakerId,
    canChooseSpeaker,
    setCameraId: useCallback((id: string) => update({ cameraId: id }), [update]),
    setMicrophoneId: useCallback(
      (id: string) => update({ microphoneId: id }),
      [update],
    ),
    setSpeakerId: useCallback(
      (id: string) => update({ speakerId: id }),
      [update],
    ),
    refresh,
  };
}
