"use client";

/**
 * The check-your-setup step before joining.
 *
 * Mobile drops you straight into the room, which works because a phone has one
 * camera, one microphone, and permissions the app already holds. A browser has
 * none of that: the device may be wrong, permission may not have been granted
 * yet, and the audio autoplay policy needs a click before remote sound will
 * play at all. This screen turns all four into one deliberate moment.
 *
 * It owns the preview tracks and hands them to the room, so joining does not
 * prompt for permission a second time or make the camera light blink.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { t } from "@/lib/i18n";
import { initialsOf } from "@/lib/live/identity";
import {
  MediaAccessError,
  createCameraTrack,
  createMicrophoneTrack,
} from "@/lib/live/localTracks";
import { useAudioLevel } from "@/lib/live/useAudioLevel";
import type { LocalAudioTrack, LocalVideoTrack } from "twilio-video";
import type { DeviceOption } from "@/lib/live/types";

interface PreJoinProps {
  sessionTitle: string;
  groupName: string;
  userName: string;
  connecting: boolean;
  /** Ownership of both tracks transfers to the caller. */
  onJoin: (tracks: {
    cameraTrack: LocalVideoTrack | null;
    microphoneTrack: LocalAudioTrack | null;
  }) => void;
  onCancel: () => void;

  cameras: DeviceOption[];
  microphones: DeviceOption[];
  speakers: DeviceOption[];
  cameraId?: string;
  microphoneId?: string;
  speakerId?: string;
  canChooseSpeaker: boolean;
  onSelectCamera: (deviceId: string) => void;
  onSelectMicrophone: (deviceId: string) => void;
  onSelectSpeaker: (deviceId: string) => void;
  /** Re-enumerate devices once a permission grant fills in their labels. */
  onDevicesChanged: () => void;
}

function DeviceSelect({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: DeviceOption[];
  value?: string;
  onChange: (deviceId: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-heading text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/40">
        {label}
      </span>
      <select
        value={value ?? ""}
        disabled={disabled || options.length === 0}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-white/12 bg-cb-live-surface px-3 font-body text-[14px] text-white outline-none transition-colors hover:border-white/25 focus:border-white/40 disabled:opacity-45"
      >
        {options.length === 0 ? (
          <option value="">{t("app.live.noDevices")}</option>
        ) : (
          options.map((option) => (
            <option key={option.deviceId} value={option.deviceId}>
              {option.label}
            </option>
          ))
        )}
      </select>
    </label>
  );
}

export default function PreJoin(props: PreJoinProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraTrack, setCameraTrack] = useState<LocalVideoTrack | null>(null);
  const [microphoneTrack, setMicrophoneTrack] = useState<LocalAudioTrack | null>(
    null,
  );
  const [busy, setBusy] = useState<"camera" | "microphone" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Set once we hand the tracks over, so cleanup doesn't stop them. */
  const handedOverRef = useRef(false);

  const level = useAudioLevel(microphoneTrack);

  /* Preview attachment. */
  useEffect(() => {
    const element = videoRef.current;
    if (!element || !cameraTrack) return;
    cameraTrack.attach(element);
    return () => {
      cameraTrack.detach(element);
      element.srcObject = null;
    };
  }, [cameraTrack]);

  /**
   * Anything still running when this screen goes away must be released — a
   * preview that keeps the camera light on after cancelling is alarming.
   *
   * Read through refs and cleaned up on unmount only. Depending on the tracks
   * directly would run the cleanup on every change, so turning the microphone
   * on would stop the camera that was already previewing.
   */
  const cameraTrackRef = useRef<LocalVideoTrack | null>(null);
  const microphoneTrackRef = useRef<LocalAudioTrack | null>(null);
  useEffect(() => {
    cameraTrackRef.current = cameraTrack;
    microphoneTrackRef.current = microphoneTrack;
  }, [cameraTrack, microphoneTrack]);

  useEffect(() => {
    return () => {
      if (handedOverRef.current) return;
      cameraTrackRef.current?.stop();
      microphoneTrackRef.current?.stop();
    };
  }, []);

  const toggleCamera = useCallback(async () => {
    if (busy) return;
    setNotice(null);
    if (cameraTrack) {
      cameraTrack.stop();
      setCameraTrack(null);
      return;
    }
    setBusy("camera");
    try {
      const track = await createCameraTrack(props.cameraId);
      setCameraTrack(track);
      props.onDevicesChanged();
    } catch (error) {
      if (error instanceof MediaAccessError && error.message) setNotice(error.message);
      else setNotice(t("app.live.cameraFailed"));
    } finally {
      setBusy(null);
    }
  }, [busy, cameraTrack, props]);

  const toggleMicrophone = useCallback(async () => {
    if (busy) return;
    setNotice(null);
    if (microphoneTrack) {
      microphoneTrack.stop();
      setMicrophoneTrack(null);
      return;
    }
    setBusy("microphone");
    try {
      const track = await createMicrophoneTrack(props.microphoneId);
      setMicrophoneTrack(track);
      props.onDevicesChanged();
    } catch (error) {
      if (error instanceof MediaAccessError && error.message) setNotice(error.message);
      else setNotice(t("app.live.micFailed"));
    } finally {
      setBusy(null);
    }
  }, [busy, microphoneTrack, props]);

  /* Changing a device with the preview running swaps it in place. */
  const selectCamera = useCallback(
    async (deviceId: string) => {
      props.onSelectCamera(deviceId);
      if (!cameraTrack) return;
      try {
        await cameraTrack.restart({ deviceId: { exact: deviceId } });
      } catch {
        setNotice(t("app.live.deviceSwitchFailed"));
      }
    },
    [cameraTrack, props],
  );

  const selectMicrophone = useCallback(
    async (deviceId: string) => {
      props.onSelectMicrophone(deviceId);
      if (!microphoneTrack) return;
      try {
        await microphoneTrack.restart({ deviceId: { exact: deviceId } });
      } catch {
        setNotice(t("app.live.deviceSwitchFailed"));
      }
    },
    [microphoneTrack, props],
  );

  const join = () => {
    handedOverRef.current = true;
    props.onJoin({ cameraTrack, microphoneTrack });
  };

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-cb-live-bg px-4 py-6">
      <div className="w-full max-w-4xl">
        <header className="mb-5 text-center">
          <p className="font-heading text-[11px] font-bold uppercase tracking-[0.18em] text-cb-yellow">
            {props.groupName || t("app.live.liveSession")}
          </p>
          <h1 className="mt-1.5 font-heading text-[26px] font-bold leading-tight tracking-tight text-white">
            {props.sessionTitle || t("app.live.liveSession")}
          </h1>
          <p className="mt-1.5 font-body text-[14px] text-white/50">
            {t("app.live.prejoinSub")}
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          {/* Preview */}
          <div>
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-cb-live-surface ring-1 ring-inset ring-white/10">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full -scale-x-100 object-cover ${
                  cameraTrack ? "opacity-100" : "opacity-0"
                }`}
              />
              {!cameraTrack && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-cb-live-raised font-heading text-[26px] font-bold text-white/90">
                    {initialsOf(props.userName || "?")}
                  </span>
                  <span className="font-body text-[13.5px] text-white/45">
                    {t("app.live.cameraOff")}
                  </span>
                </div>
              )}

              {busy && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 size={26} className="animate-spin text-cb-yellow" />
                </div>
              )}
            </div>

            {/* Device toggles */}
            <div className="mt-3 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={toggleCamera}
                disabled={busy !== null}
                aria-pressed={Boolean(cameraTrack)}
                className={[
                  "flex h-12 w-12 items-center justify-center rounded-full transition-colors disabled:opacity-50",
                  cameraTrack
                    ? "bg-cb-yellow text-cb-black hover:bg-cb-yellow-600"
                    : "bg-cb-danger text-white hover:brightness-110",
                ].join(" ")}
                aria-label={t(
                  cameraTrack ? "app.live.turnCameraOff" : "app.live.turnCameraOn",
                )}
              >
                <CameraGlyph off={!cameraTrack} />
              </button>

              <button
                type="button"
                onClick={toggleMicrophone}
                disabled={busy !== null}
                aria-pressed={Boolean(microphoneTrack)}
                className={[
                  "relative flex h-12 w-12 items-center justify-center rounded-full transition-colors disabled:opacity-50",
                  microphoneTrack
                    ? "bg-cb-yellow text-cb-black hover:bg-cb-yellow-600"
                    : "bg-cb-danger text-white hover:brightness-110",
                ].join(" ")}
                aria-label={t(microphoneTrack ? "app.live.muteMic" : "app.live.unmuteMic")}
              >
                {microphoneTrack ? <Mic size={21} /> : <MicOff size={21} />}
                {/* Ring grows with input level — proof the mic is picking you up. */}
                {microphoneTrack && level > 0.04 && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-cb-yellow/70"
                    style={{ transform: `scale(${1 + level * 0.32})`, opacity: 0.9 - level * 0.4 }}
                  />
                )}
              </button>
            </div>

            <p className="mt-3 text-center font-body text-[12.5px] text-white/40">
              {t("app.live.prejoinDefaultsNote")}
            </p>
          </div>

          {/* Devices + join */}
          <div className="flex flex-col gap-3">
            <DeviceSelect
              label={t("app.live.camera")}
              options={props.cameras}
              value={props.cameraId}
              onChange={selectCamera}
            />
            <DeviceSelect
              label={t("app.live.microphone")}
              options={props.microphones}
              value={props.microphoneId}
              onChange={selectMicrophone}
            />
            {props.canChooseSpeaker && (
              <DeviceSelect
                label={t("app.live.speaker")}
                options={props.speakers}
                value={props.speakerId}
                onChange={props.onSelectSpeaker}
              />
            )}

            {notice && (
              <p
                role="alert"
                className="rounded-xl border border-cb-danger/40 bg-cb-danger/12 px-3 py-2.5 font-body text-[13px] leading-snug text-white"
              >
                {notice}
              </p>
            )}

            <div className="mt-auto flex flex-col gap-2 pt-2">
              <Button
                variant="primary-alt"
                size="lg"
                fullWidth
                onClick={join}
                loading={props.connecting}
              >
                {t("app.live.joinNow")}
              </Button>
              <button
                type="button"
                onClick={props.onCancel}
                className="rounded-full py-2 font-body text-[13.5px] font-semibold text-white/55 transition-colors hover:text-white"
              >
                {t("app.live.cancel")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CameraGlyph({ off }: { off: boolean }) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="6"
        width="12.5"
        height="12"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M15 11l4.6-2.9c.6-.4 1.4 0 1.4.8v6.2c0 .8-.8 1.2-1.4.8L15 13v-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {off && (
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}
