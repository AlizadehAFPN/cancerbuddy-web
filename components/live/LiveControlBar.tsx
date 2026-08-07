"use client";

/**
 * The bottom control bar.
 *
 * Colour follows mobile exactly: a device that is **on** is brand yellow with a
 * black glyph, a device that is **off** is red. That inversion looks odd next
 * to a Meet or a Zoom, where red means "you are muted", but consistency with
 * the phone matters more — the same person uses both, and a control that means
 * the opposite thing on the other screen is how people end up broadcasting by
 * accident.
 *
 * Below `sm` the secondary controls (layout, people) fold into the room's
 * options sheet; only camera, microphone, chat and leave stay on the bar.
 */

import {
  LayoutGrid,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  PhoneOff,
  GalleryVerticalEnd,
  Users,
  Ellipsis,
} from "lucide-react";
import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import type { DeviceOption, LiveLayout } from "@/lib/live/types";
import DeviceMenu from "./DeviceMenu";

type ButtonTone = "on" | "off" | "neutral" | "danger";

const toneStyles: Record<ButtonTone, string> = {
  on: "bg-cb-yellow text-cb-black hover:bg-cb-yellow-600",
  off: "bg-cb-danger text-white hover:brightness-110",
  neutral: "bg-white/12 text-white hover:bg-white/20",
  danger: "bg-cb-danger text-white hover:brightness-110",
};

function ControlButton({
  tone,
  label,
  onClick,
  disabled,
  badge,
  active,
  children,
}: {
  tone: ButtonTone;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Small dot for unread chat. */
  badge?: number;
  /** Panel this button opens is currently visible. */
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={[
        "relative flex h-12 w-12 items-center justify-center rounded-full transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-cb-live-scrim",
        "disabled:cursor-not-allowed disabled:opacity-50",
        toneStyles[tone],
        active ? "ring-2 ring-white/50" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
      {typeof badge === "number" && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-cb-danger px-1 font-body text-[10px] font-bold text-white ring-2 ring-cb-live-scrim">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

export interface LiveControlBarProps {
  cameraOn: boolean;
  micOn: boolean;
  screenOn: boolean;
  screenSharingAllowed: boolean;
  mediaBusy: boolean;
  layout: LiveLayout;
  chatOpen: boolean;
  peopleOpen: boolean;
  unreadChat: number;
  participantCount: number;

  cameras: DeviceOption[];
  microphones: DeviceOption[];
  speakers: DeviceOption[];
  cameraId?: string;
  microphoneId?: string;
  speakerId?: string;
  canChooseSpeaker: boolean;
  openMenu: "camera" | "microphone" | null;
  onOpenMenu: (menu: "camera" | "microphone" | null) => void;

  onToggleCamera: () => void;
  onToggleMic: () => void;
  onToggleScreen: () => void;
  onToggleLayout: () => void;
  onToggleChat: () => void;
  onTogglePeople: () => void;
  onOpenOptions: () => void;
  onLeave: () => void;
  onSelectCamera: (deviceId: string) => void;
  onSelectMicrophone: (deviceId: string) => void;
  onSelectSpeaker: (deviceId: string) => void;
}

export default function LiveControlBar(props: LiveControlBarProps) {
  return (
    <div className="relative z-20 flex shrink-0 items-center justify-center gap-2 border-t border-white/8 bg-cb-live-scrim px-3 py-3 sm:gap-3 sm:px-5">
      {/* Camera */}
      <div className="flex flex-col items-center gap-1.5">
        <ControlButton
          tone={props.cameraOn ? "on" : "off"}
          label={t(props.cameraOn ? "app.live.turnCameraOff" : "app.live.turnCameraOn")}
          onClick={props.onToggleCamera}
          disabled={props.mediaBusy}
        >
          {props.cameraOn ? <VideoOnGlyph /> : <VideoOffGlyph />}
        </ControlButton>
        <div className="hidden sm:block">
          <DeviceMenu
            open={props.openMenu === "camera"}
            onOpenChange={(open) => props.onOpenMenu(open ? "camera" : null)}
            label={t("app.live.chooseCamera")}
            groups={[
              {
                label: t("app.live.camera"),
                options: props.cameras,
                selectedId: props.cameraId,
                onSelect: props.onSelectCamera,
              },
            ]}
          />
        </div>
      </div>

      {/* Microphone */}
      <div className="flex flex-col items-center gap-1.5">
        <ControlButton
          tone={props.micOn ? "on" : "off"}
          label={t(props.micOn ? "app.live.muteMic" : "app.live.unmuteMic")}
          onClick={props.onToggleMic}
          disabled={props.mediaBusy}
        >
          {props.micOn ? <Mic size={21} /> : <MicOff size={21} />}
        </ControlButton>
        <div className="hidden sm:block">
          <DeviceMenu
            open={props.openMenu === "microphone"}
            onOpenChange={(open) => props.onOpenMenu(open ? "microphone" : null)}
            label={t("app.live.chooseAudioDevices")}
            groups={[
              {
                label: t("app.live.microphone"),
                options: props.microphones,
                selectedId: props.microphoneId,
                onSelect: props.onSelectMicrophone,
              },
              ...(props.canChooseSpeaker
                ? [
                    {
                      label: t("app.live.speaker"),
                      options: props.speakers,
                      selectedId: props.speakerId,
                      onSelect: props.onSelectSpeaker,
                    },
                  ]
                : []),
            ]}
          />
        </div>
      </div>

      {/* Screen share — hosts only, and only where the browser supports it. */}
      {props.screenSharingAllowed && (
        <div className="hidden flex-col items-center gap-1.5 sm:flex">
          <ControlButton
            tone={props.screenOn ? "on" : "neutral"}
            label={t(props.screenOn ? "app.live.stopSharing" : "app.live.shareScreen")}
            onClick={props.onToggleScreen}
            disabled={props.mediaBusy}
          >
            {props.screenOn ? <MonitorX size={21} /> : <MonitorUp size={21} />}
          </ControlButton>
          <span className="h-6" />
        </div>
      )}

      <span className="mx-1 hidden h-8 w-px bg-white/10 sm:block" />

      {/* Layout */}
      <div className="hidden flex-col items-center gap-1.5 md:flex">
        <ControlButton
          tone="neutral"
          label={t(props.layout === "stage" ? "app.live.switchToGrid" : "app.live.switchToStage")}
          onClick={props.onToggleLayout}
        >
          {props.layout === "stage" ? (
            <LayoutGrid size={20} />
          ) : (
            <GalleryVerticalEnd size={20} />
          )}
        </ControlButton>
        <span className="h-6" />
      </div>

      {/* People */}
      <div className="hidden flex-col items-center gap-1.5 sm:flex">
        <ControlButton
          tone="neutral"
          label={t("app.live.people", { count: props.participantCount })}
          onClick={props.onTogglePeople}
          active={props.peopleOpen}
        >
          <Users size={20} />
        </ControlButton>
        <span className="h-6" />
      </div>

      {/* Chat */}
      <div className="flex flex-col items-center gap-1.5">
        <ControlButton
          tone="neutral"
          label={t("app.live.chat")}
          onClick={props.onToggleChat}
          badge={props.chatOpen ? 0 : props.unreadChat}
          active={props.chatOpen}
        >
          <MessageSquare size={20} />
        </ControlButton>
        <span className="hidden h-6 sm:block" />
      </div>

      {/* Room options */}
      <div className="flex flex-col items-center gap-1.5">
        <ControlButton
          tone="neutral"
          label={t("app.live.roomOptions")}
          onClick={props.onOpenOptions}
        >
          <Ellipsis size={20} />
        </ControlButton>
        <span className="hidden h-6 sm:block" />
      </div>

      {/* Leave */}
      <div className="ml-1 flex flex-col items-center gap-1.5 sm:ml-2">
        <ControlButton tone="danger" label={t("app.live.leave")} onClick={props.onLeave}>
          <PhoneOff size={20} />
        </ControlButton>
        <span className="hidden h-6 sm:block" />
      </div>
    </div>
  );
}

/* Lucide's `Video` is a filled-looking camcorder; these two match the phosphor
   glyphs the mobile room uses closely enough to read as the same control. */

function VideoOnGlyph() {
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
    </svg>
  );
}

function VideoOffGlyph() {
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
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
