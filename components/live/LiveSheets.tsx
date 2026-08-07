"use client";

/**
 * The room's two bottom sheets, matching the mobile modals row for row.
 *
 * Both reuse the app's shared `Sheet`, which is light — that isn't an
 * inconsistency with the dark room, it's what mobile does too: the Twilio
 * room's "Call options" and moderation modals are white sheets over the dark
 * video. Same icon circle, same title/description pairing, same order, same
 * copy intent.
 *
 * The one addition is that the options sheet also carries the layout and
 * people controls, because the control bar hides those below `sm` and they'd
 * otherwise be unreachable on a phone browser.
 */

import type { ReactNode } from "react";
import {
  Ban,
  BellRing,
  CircleStop,
  LayoutGrid,
  LogOut,
  GalleryVerticalEnd,
  MonitorUp,
  UserMinus,
  Users,
  VideoOff,
  VolumeX,
} from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { t } from "@/lib/i18n";
import type { LiveLayout, ModerationAction } from "@/lib/live/types";
import type { TileModel } from "./tiles";

type IconTone = "neutral" | "soft-danger" | "danger";

const iconToneStyles: Record<IconTone, string> = {
  neutral: "bg-cb-gray-100 text-cb-gray-600",
  "soft-danger": "bg-[#FEE2E2] text-cb-danger",
  danger: "bg-cb-danger text-white",
};

function OptionRow({
  icon,
  tone = "neutral",
  title,
  description,
  danger,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  tone?: IconTone;
  title: string;
  description: string;
  /** Title in danger red — destructive or irreversible actions. */
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-cb-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className={[
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          iconToneStyles[tone],
        ].join(" ")}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={[
            "block font-heading text-[15px] font-bold",
            danger ? "text-cb-danger" : "text-cb-black",
          ].join(" ")}
        >
          {title}
        </span>
        <span className="mt-0.5 block font-body text-[13px] leading-snug text-cb-gray-500">
          {description}
        </span>
      </span>
    </button>
  );
}

const Divider = () => <div className="mx-5 h-px bg-cb-gray-200" />;

/* ── Room options ────────────────────────────────────────────────────────── */

export function LiveOptionsSheet({
  open,
  onClose,
  isHost,
  layout,
  screenSharingAllowed,
  screenOn,
  notifyBusy,
  onNotifyGroup,
  onToggleLayout,
  onOpenPeople,
  onToggleScreen,
  onLeave,
  onEndLive,
}: {
  open: boolean;
  onClose: () => void;
  isHost: boolean;
  layout: LiveLayout;
  screenSharingAllowed: boolean;
  screenOn: boolean;
  notifyBusy: boolean;
  onNotifyGroup: () => void;
  onToggleLayout: () => void;
  onOpenPeople: () => void;
  onToggleScreen: () => void;
  onLeave: () => void;
  onEndLive: () => void;
}) {
  return (
    <Sheet open={open} title={t("app.live.roomOptions")} onClose={onClose}>
      <div className="pb-3">
        {isHost && (
          <>
            <OptionRow
              icon={<BellRing size={19} />}
              tone="soft-danger"
              title={t("app.live.notifyMembers")}
              description={t("app.live.notifyMembersSub")}
              disabled={notifyBusy}
              onClick={onNotifyGroup}
            />
            <Divider />
          </>
        )}

        {/* Small screens hide these on the control bar. */}
        <div className="md:hidden">
          <OptionRow
            icon={
              layout === "stage" ? <LayoutGrid size={19} /> : <GalleryVerticalEnd size={19} />
            }
            title={t(layout === "stage" ? "app.live.switchToGrid" : "app.live.switchToStage")}
            description={t(
              layout === "stage" ? "app.live.switchToGridSub" : "app.live.switchToStageSub",
            )}
            onClick={onToggleLayout}
          />
        </div>
        <div className="sm:hidden">
          <OptionRow
            icon={<Users size={19} />}
            title={t("app.live.viewPeople")}
            description={t("app.live.viewPeopleSub")}
            onClick={onOpenPeople}
          />
          {screenSharingAllowed && (
            <OptionRow
              icon={<MonitorUp size={19} />}
              title={t(screenOn ? "app.live.stopSharing" : "app.live.shareScreen")}
              description={t("app.live.shareScreenSub")}
              onClick={onToggleScreen}
            />
          )}
        </div>

        <Divider />
        <OptionRow
          icon={<LogOut size={19} />}
          tone="soft-danger"
          title={t("app.live.exitLive")}
          description={t("app.live.exitLiveSub")}
          danger
          onClick={onLeave}
        />

        {isHost && (
          <>
            <Divider />
            <OptionRow
              icon={<CircleStop size={19} />}
              tone="danger"
              title={t("app.live.endForEveryone")}
              description={t("app.live.endForEveryoneSub")}
              danger
              onClick={onEndLive}
            />
          </>
        )}
      </div>
    </Sheet>
  );
}

/* ── Moderation ──────────────────────────────────────────────────────────── */

export function ModerationSheet({
  target,
  busy,
  onClose,
  onAction,
}: {
  target: TileModel | null;
  busy: boolean;
  onClose: () => void;
  onAction: (action: ModerationAction) => void;
}) {
  if (!target) return null;

  return (
    <Sheet
      open
      title={target.fullName}
      subtitle={t("app.live.moderationSub")}
      onClose={onClose}
    >
      <div className="pb-3">
        <OptionRow
          icon={<VolumeX size={19} />}
          title={t("app.live.muteMicrophone")}
          description={t("app.live.muteMicrophoneSub")}
          disabled={busy}
          onClick={() => onAction("mute_audio")}
        />
        <OptionRow
          icon={<VideoOff size={19} />}
          title={t("app.live.disableCamera")}
          description={t("app.live.disableCameraSub")}
          disabled={busy}
          onClick={() => onAction("mute_video")}
        />

        <Divider />

        <OptionRow
          icon={<UserMinus size={19} />}
          tone="soft-danger"
          title={t("app.live.removeFromLive")}
          description={t("app.live.removeFromLiveSub")}
          danger
          disabled={busy}
          onClick={() => onAction("remove")}
        />
        <OptionRow
          icon={<Ban size={19} />}
          tone="danger"
          title={t("app.live.blockFromLive")}
          description={t("app.live.blockFromLiveSub")}
          danger
          disabled={busy}
          onClick={() => onAction("block")}
        />
      </div>
    </Sheet>
  );
}
