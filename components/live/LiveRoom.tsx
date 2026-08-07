"use client";

/**
 * `/live/[eventId]` — the live video room.
 *
 * The web counterpart of `TwilioVideoRoom.tsx` in `cancerbuddyapp`, with the
 * same feature set: join as host or viewer, camera and microphone that start
 * off, live chat on the session's Stream channel, host moderation (mute, hide
 * camera, remove, block), "notify the group", and ending the session for
 * everyone. Everything a host can do on the phone, a host can do here.
 *
 * The pieces are split up: `useLiveRoom` owns Twilio, `useLiveChat` owns Stream
 * and the moderation signals that ride it, and this component is the one place
 * that knows about both — it is where a "you were muted" signal turns into an
 * actual microphone being switched off.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, VolumeX } from "lucide-react";
import { t } from "@/lib/i18n";
import { ConfirmSheet } from "@/components/groups/GroupSheets";
import { useStreamChat } from "@/lib/chat/StreamChatProvider";
import { fetchSignedInFirstName } from "@/lib/aws/sessionAttributes";
import { getSignedInUserId } from "@/lib/buddies/currentUser";
import {
  endLiveSession,
  moderateParticipant,
  notifyGroupLive,
} from "@/lib/live/liveService";
import {
  chatChannelIdFor,
  fetchLiveRoomSession,
  hasSessionEnded,
} from "@/lib/live/session";
import { useLiveChat, type ModerationNotice } from "@/lib/live/useLiveChat";
import { useLiveRoom } from "@/lib/live/useLiveRoom";
import { useMediaDevices } from "@/lib/live/useMediaDevices";
import { useViewportDefaults } from "@/lib/live/useViewportDefaults";
import { useWakeLock } from "@/lib/live/useWakeLock";
import type {
  LiveLayout,
  LiveRoomSession,
  ModerationAction,
  StageSelection,
} from "@/lib/live/types";
import LiveChatPanel from "./LiveChatPanel";
import LiveControlBar from "./LiveControlBar";
import LiveErrorScreen from "./LiveErrorScreen";
import LiveHeader from "./LiveHeader";
import LiveSidePanel, { type SidePanelTab } from "./LiveSidePanel";
import LiveStage from "./LiveStage";
import { LiveOptionsSheet, ModerationSheet } from "./LiveSheets";
import ParticipantsPanel from "./ParticipantsPanel";
import PreJoin from "./PreJoin";
import RemoteAudio from "./RemoteAudio";
import {
  localScreenTile,
  localTile,
  remoteScreenTile,
  remoteTile,
  type TileModel,
} from "./tiles";

/**
 * `leaving` exists so the "you've left the session" screen never flashes on
 * the way out: disconnecting and navigating happen in the same tick, and
 * without it React paints the interstitial before the route changes.
 */
type Phase =
  | "loading"
  /** The session was already over before we ever tried to join it. */
  | "over"
  | "prejoin"
  | "room"
  | "leaving"
  | "ended";

export default function LiveRoom({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { client: streamClient } = useStreamChat();
  const devices = useMediaDevices();

  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<LiveRoomSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  /**
   * Layout and rail start from the viewport and stay wherever the user puts
   * them. Held as nullable overrides rather than seeded state so the default
   * can resolve after mount without a second render pass fighting a choice
   * that's already been made.
   */
  const viewport = useViewportDefaults();
  const [layoutOverride, setLayoutOverride] = useState<LiveLayout | null>(null);
  const [panelOverride, setPanelOverride] = useState<boolean | null>(null);
  const layout = layoutOverride ?? viewport.layout;
  const panelOpen = panelOverride ?? viewport.panelOpen;

  const [pinned, setPinned] = useState<StageSelection>(null);
  const [panelTab, setPanelTab] = useState<SidePanelTab>("chat");
  const [deviceMenu, setDeviceMenu] = useState<"camera" | "microphone" | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [moderationTarget, setModerationTarget] = useState<TileModel | null>(null);
  const [moderationBusy, setModerationBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  /** Removed or blocked: the session is over for this person. */
  const [terminalNotice, setTerminalNotice] = useState<ModerationNotice | null>(null);

  const room = useLiveRoom({
    eventId,
    groupId: session?.groupId,
    userId,
    userName,
    cameraId: devices.cameraId,
    microphoneId: devices.microphoneId,
  });

  useWakeLock(phase === "room" && room.status === "connected");

  const backHref = session?.groupId ? `/groups/${session.groupId}` : "/groups";

  /* ── Bootstrap ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [id, name, detail] = await Promise.all([
          getSignedInUserId(),
          fetchSignedInFirstName(),
          fetchLiveRoomSession(eventId),
        ]);
        if (cancelled) return;
        setUserId(id);
        setUserName(name);
        if (!detail) {
          setLoadError(t("app.live.sessionNotFound"));
          return;
        }
        setSession(detail);
        /* Don't walk someone through a camera check for a session the token
           Lambda is going to refuse anyway. */
        setPhase(hasSessionEnded(detail) ? "over" : "prejoin");
      } catch (error) {
        console.error("[live] session load failed:", error);
        if (!cancelled) setLoadError(t("app.live.loadFailed"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  /* ── Moderation received ───────────────────────────────────────────────── */

  /* The moderation handler is invoked from a Stream websocket event, so it
     reads the room through a ref kept fresh after each commit. */
  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const handleModeration = useCallback(
    (notice: ModerationNotice) => {
      if (notice.action === "mute_audio") roomRef.current.forceMicrophoneOff();
      if (notice.action === "mute_video") roomRef.current.forceCameraOff();

      if (notice.terminal) {
        roomRef.current.leave();
        setTerminalNotice(notice);
        setPhase("ended");
        return;
      }
      /* Long enough to be read while someone is talking over it. */
      toast.warning(notice.title, { description: notice.body, duration: 8000 });
    },
    [],
  );

  const chat = useLiveChat({
    client: streamClient,
    channelId: session ? chatChannelIdFor(session) : "",
    userId,
    userName,
    hostIds: room.hostIds,
    isHost: room.isHost,
    onModeration: handleModeration,
    onParticipantRemoved: room.dropParticipant,
  });

  /* Failures inside the room surface as toasts and the room stays up — a
     camera that won't start shouldn't drop you out of the session. Clearing
     lets an identical second failure be reported again. */
  const roomError = room.error;
  const roomStatus = room.status;
  const clearRoomError = room.clearError;
  useEffect(() => {
    if (!roomError || roomStatus === "error") return;
    toast.error(roomError);
    clearRoomError();
  }, [roomError, roomStatus, clearRoomError]);

  const chatUnread = chat.unread;
  const markChatRead = chat.markRead;
  useEffect(() => {
    if (panelOpen && panelTab === "chat" && chatUnread > 0) markChatRead();
  }, [panelOpen, panelTab, chatUnread, markChatRead]);

  /* ── Tiles ─────────────────────────────────────────────────────────────── */

  const tiles = useMemo<TileModel[]>(() => {
    const list: TileModel[] = [];

    /* A screen share is the point of the session while it's running, so it
       leads — `pickStageTile` then puts it on the stage automatically. */
    if (room.localScreenTrack) list.push(localScreenTile(room.localScreenTrack));
    for (const remote of room.remotes) {
      const screen = remoteScreenTile(remote);
      if (screen) list.push(screen);
    }

    list.push(
      localTile({
        videoTrack: room.localVideoTrack,
        micOn: room.micOn,
        isHost: room.isHost,
        networkQuality: room.localNetworkQuality,
        name: userName,
      }),
    );

    for (const remote of room.remotes) {
      list.push(remoteTile(remote, remote.sid === room.dominantSpeakerSid));
    }

    return list;
  }, [
    room.localScreenTrack,
    room.localVideoTrack,
    room.remotes,
    room.micOn,
    room.isHost,
    room.localNetworkQuality,
    room.dominantSpeakerSid,
    userName,
  ]);

  /* A host may moderate anyone except themselves and other hosts — the same
     rule the mobile long-press applies. */
  const canModerate = useCallback(
    (tile: TileModel) =>
      room.isHost && !tile.isLocal && !tile.isHost && !tile.isScreen && Boolean(tile.userId),
    [room.isHost],
  );

  const togglePin = useCallback((tile: TileModel) => {
    setPinned((current) => {
      const already =
        current &&
        ((current.kind === "local" && tile.key === "local") ||
          (current.kind === "local-screen" && tile.key === "local-screen") ||
          (current.kind === "remote" && current.sid === tile.key) ||
          (current.kind === "screen" && `${current.sid}-screen` === tile.key));
      if (already) return null;
      if (tile.key === "local") return { kind: "local" };
      if (tile.key === "local-screen") return { kind: "local-screen" };
      if (tile.isScreen) return { kind: "screen", sid: tile.key.replace(/-screen$/, "") };
      return { kind: "remote", sid: tile.key };
    });
  }, []);

  /* ── Actions ───────────────────────────────────────────────────────────── */

  const leaveAndGoBack = useCallback(() => {
    setPhase("leaving");
    room.leave();
    router.push(backHref);
  }, [room, router, backHref]);

  const applyModeration = useCallback(
    async (action: ModerationAction) => {
      const target = moderationTarget;
      if (!target?.userId || !userId || moderationBusy) return;
      setModerationTarget(null);
      setModerationBusy(true);
      try {
        await moderateParticipant({
          userId,
          eventId,
          targetUserId: target.userId,
          action,
        });
        if (action === "remove" || action === "block") {
          room.dropParticipant(target.userId);
        }
        toast.success(
          t(
            action === "remove"
              ? "app.live.removedToast"
              : action === "block"
                ? "app.live.blockedToast"
                : action === "mute_audio"
                  ? "app.live.mutedToast"
                  : "app.live.cameraOffToast",
            { name: target.fullName },
          ),
        );
      } catch (error) {
        console.error("[live] moderation failed:", error);
        toast.error(
          error instanceof Error ? error.message : t("app.live.moderationFailed"),
        );
      } finally {
        setModerationBusy(false);
      }
    },
    [moderationTarget, userId, eventId, moderationBusy, room],
  );

  const handleNotifyGroup = useCallback(async () => {
    if (!session || !userId || notifyBusy) return;
    setOptionsOpen(false);
    setNotifyBusy(true);
    try {
      await notifyGroupLive({
        hostId: userId,
        hostName: userName || t("app.live.hostSender"),
        groupId: session.groupId,
        groupName: session.groupName ?? "",
        eventId,
        eventTitle: session.title ?? "",
        chatChannelId: chatChannelIdFor(session),
      });
      toast.success(t("app.live.notifySent"));
    } catch (error) {
      console.error("[live] notify group failed:", error);
      toast.error(
        error instanceof Error ? error.message : t("app.live.notifyFailed"),
      );
    } finally {
      setNotifyBusy(false);
    }
  }, [session, userId, userName, eventId, notifyBusy]);

  const handleEndLive = useCallback(async () => {
    if (!userId) return;
    setConfirmEnd(false);
    try {
      await endLiveSession({ userId, eventId });
      toast.success(t("app.live.endedToast"));
    } catch (error) {
      console.error("[live] end live failed:", error);
      toast.error(error instanceof Error ? error.message : t("app.live.endFailed"));
    } finally {
      leaveAndGoBack();
    }
  }, [userId, eventId, leaveAndGoBack]);

  const openPanel = useCallback((tab: SidePanelTab) => {
    setPanelTab(tab);
    setPanelOverride(true);
  }, []);

  const closePanel = useCallback(() => setPanelOverride(false), []);

  const toggleLayout = useCallback(
    () => setLayoutOverride(layout === "stage" ? "grid" : "stage"),
    [layout],
  );

  /* ── Render ────────────────────────────────────────────────────────────── */

  if (loadError) {
    return (
      <LiveErrorScreen
        message={loadError}
        onGoBack={() => router.push("/groups")}
        goBackLabel={t("app.live.backToGroups")}
      />
    );
  }

  if (phase === "loading" || phase === "leaving") {
    return (
      <div className="flex h-full items-center justify-center bg-cb-live-bg">
        <Loader2 size={30} className="animate-spin text-cb-yellow" />
        <span className="sr-only">{t("app.live.loading")}</span>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <LiveErrorScreen
        title={t("app.live.overTitle")}
        message={t("app.live.overBody")}
        onGoBack={() => router.push(backHref)}
        goBackLabel={t("app.live.backToGroup")}
      />
    );
  }

  if (phase === "ended" && terminalNotice) {
    return (
      <LiveErrorScreen
        title={terminalNotice.title}
        message={terminalNotice.body}
        onGoBack={() => router.push(backHref)}
        goBackLabel={t("app.live.backToGroup")}
      />
    );
  }

  if (room.status === "error" && room.error) {
    return (
      <LiveErrorScreen
        message={room.error}
        onRetry={room.fatal ? undefined : () => setPhase("prejoin")}
        onGoBack={() => router.push(backHref)}
        goBackLabel={t("app.live.backToGroup")}
      />
    );
  }

  if (phase === "prejoin") {
    return (
      <PreJoin
        sessionTitle={session?.title ?? ""}
        groupName={session?.groupName ?? ""}
        userName={userName ?? ""}
        connecting={room.status === "connecting"}
        onJoin={async ({ cameraTrack, microphoneTrack }) => {
          setPhase("room");
          await room.join({ cameraTrack, microphoneTrack });
        }}
        onCancel={() => router.push(backHref)}
        cameras={devices.cameras}
        microphones={devices.microphones}
        speakers={devices.speakers}
        cameraId={devices.cameraId}
        microphoneId={devices.microphoneId}
        speakerId={devices.speakerId}
        canChooseSpeaker={devices.canChooseSpeaker}
        onSelectCamera={devices.setCameraId}
        onSelectMicrophone={devices.setMicrophoneId}
        onSelectSpeaker={devices.setSpeakerId}
        onDevicesChanged={() => void devices.refresh()}
      />
    );
  }

  if (room.status === "disconnected") {
    return (
      <LiveErrorScreen
        title={t("app.live.leftTitle")}
        message={t("app.live.leftBody")}
        onRetry={() => setPhase("prejoin")}
        retryLabel={t("app.live.rejoin")}
        onGoBack={() => router.push(backHref)}
        goBackLabel={t("app.live.backToGroup")}
      />
    );
  }

  /* Anything that isn't a live connection is still on its way in — `prejoin`
     lingers for the tick between handing over the tracks and `join` starting. */
  if (room.status !== "connected" && room.status !== "reconnecting") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-cb-live-bg px-6 text-center">
        <Loader2 size={30} className="animate-spin text-cb-yellow" />
        <p className="font-body text-[15px] text-white/70">
          {t("app.live.joining", {
            name: session?.groupName || session?.title || t("app.live.liveSession"),
          })}
        </p>
      </div>
    );
  }

  const screenSharingAllowed =
    room.isHost &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getDisplayMedia);

  return (
    <div className="flex h-full min-h-0 flex-col bg-cb-live-bg">
      <LiveHeader
        title={session?.title ?? ""}
        groupName={session?.groupName ?? ""}
        participantCount={room.participantCount}
        isHost={room.isHost}
        status={room.status}
        networkQuality={room.localNetworkQuality}
      />

      {audioBlocked && (
        <button
          type="button"
          onClick={() => setAudioBlocked(false)}
          className="flex shrink-0 items-center justify-center gap-2 bg-cb-yellow px-4 py-2 font-body text-[13px] font-semibold text-cb-black"
        >
          <VolumeX size={14} />
          {t("app.live.audioBlocked")}
        </button>
      )}

      <div className="relative flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1">
          <LiveStage
            tiles={tiles}
            /* The stage needs width the phone doesn't have. */
            layout={layout}
            pinned={pinned}
            onPin={togglePin}
            onModerate={setModerationTarget}
            canModerate={canModerate}
          />
        </div>

        <LiveSidePanel
          open={panelOpen}
          tab={panelTab}
          onTabChange={setPanelTab}
          onClose={closePanel}
          unreadChat={chat.unread}
          participantCount={room.participantCount}
        >
          {panelTab === "chat" ? (
            <LiveChatPanel
              messages={chat.messages}
              ready={chat.ready}
              error={chat.error}
              onSend={(text) => void chat.send(text)}
              onRetry={(id) => void chat.retry(id)}
            />
          ) : (
            <ParticipantsPanel
              tiles={tiles}
              canModerate={canModerate}
              onModerate={setModerationTarget}
            />
          )}
        </LiveSidePanel>
      </div>

      <LiveControlBar
        cameraOn={room.cameraOn}
        micOn={room.micOn}
        screenOn={room.screenOn}
        screenSharingAllowed={screenSharingAllowed}
        mediaBusy={room.mediaBusy}
        layout={layout}
        chatOpen={panelOpen && panelTab === "chat"}
        peopleOpen={panelOpen && panelTab === "people"}
        unreadChat={chat.unread}
        participantCount={room.participantCount}
        cameras={devices.cameras}
        microphones={devices.microphones}
        speakers={devices.speakers}
        cameraId={devices.cameraId}
        microphoneId={devices.microphoneId}
        speakerId={devices.speakerId}
        canChooseSpeaker={devices.canChooseSpeaker}
        openMenu={deviceMenu}
        onOpenMenu={setDeviceMenu}
        onToggleCamera={() => void room.toggleCamera()}
        onToggleMic={() => void room.toggleMicrophone()}
        onToggleScreen={() => void room.toggleScreenShare()}
        onToggleLayout={toggleLayout}
        onToggleChat={() =>
          panelOpen && panelTab === "chat" ? closePanel() : openPanel("chat")
        }
        onTogglePeople={() =>
          panelOpen && panelTab === "people" ? closePanel() : openPanel("people")
        }
        onOpenOptions={() => setOptionsOpen(true)}
        onLeave={leaveAndGoBack}
        onSelectCamera={(id) => {
          devices.setCameraId(id);
          void room.switchCamera(id);
        }}
        onSelectMicrophone={(id) => {
          devices.setMicrophoneId(id);
          void room.switchMicrophone(id);
        }}
        onSelectSpeaker={devices.setSpeakerId}
      />

      <RemoteAudio
        remotes={room.remotes}
        speakerId={devices.speakerId}
        onBlocked={() => setAudioBlocked(true)}
      />

      <LiveOptionsSheet
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        isHost={room.isHost}
        layout={layout}
        screenSharingAllowed={screenSharingAllowed}
        screenOn={room.screenOn}
        notifyBusy={notifyBusy}
        onNotifyGroup={() => void handleNotifyGroup()}
        onToggleLayout={() => {
          toggleLayout();
          setOptionsOpen(false);
        }}
        onOpenPeople={() => {
          openPanel("people");
          setOptionsOpen(false);
        }}
        onToggleScreen={() => {
          setOptionsOpen(false);
          void room.toggleScreenShare();
        }}
        onLeave={() => {
          setOptionsOpen(false);
          leaveAndGoBack();
        }}
        onEndLive={() => {
          setOptionsOpen(false);
          setConfirmEnd(true);
        }}
      />

      <ModerationSheet
        target={moderationTarget}
        busy={moderationBusy}
        onClose={() => setModerationTarget(null)}
        onAction={(action) => void applyModeration(action)}
      />

      {confirmEnd && (
        <ConfirmSheet
          title={t("app.live.endForEveryone")}
          body={t("app.live.endForEveryoneConfirm")}
          confirmLabel={t("app.live.endForEveryone")}
          danger
          onConfirm={() => void handleEndLive()}
          onClose={() => setConfirmEnd(false)}
        />
      )}
    </div>
  );
}
