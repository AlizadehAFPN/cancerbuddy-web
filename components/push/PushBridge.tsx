"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useStreamChat } from "@/lib/chat/StreamChatProvider";
import {
  clearPushNotices,
  subscribeForegroundPush,
  subscribePushData,
  syncPushDevice,
} from "@/lib/push/pushClient";
import { useLiveResync } from "@/lib/hooks/useLiveResync";
import { markGroupUnread } from "@/lib/groups/unreadPosts";
import { t } from "@/lib/i18n";

/**
 * Headless bridge between web push and the app shell. Rendered once inside the
 * authenticated layout; renders nothing.
 *
 * Two jobs:
 *
 *  1. Re-register the FCM token with Stream once chat is connected. Stream needs
 *     the device attached to a connected user, so this waits for `status ===
 *     "ready"` rather than firing on mount.
 *
 *  2. Surface foreground pushes. When a tab is focused the OS does not show the
 *     notification — FCM delivers it to the page — so an in-app toast is the
 *     only signal the member gets. Tapping it navigates to the conversation.
 *
 * Deliberately silent: it never requests notification permission. That only
 * happens from the Settings toggle.
 */
export default function PushBridge() {
  const { status, userId } = useStreamChat();
  const router = useRouter();
  const pathname = usePathname();

  /* Read the live path from inside the FCM callback without making it a
     dependency — re-subscribing on every route change would tear the listener
     down and rebuild it while the member navigates. */
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (status !== "ready" || !userId) return;
    void syncPushDevice();
  }, [status, userId]);

  /**
   * The app-icon badge is a count of things waiting *while you were away*, so
   * coming back clears it — mobile does exactly this on foreground
   * (`push-notification.provider.tsx:93-95`). The tray is left alone here: a
   * banner is still a useful reminder of what you have not opened yet, and
   * opening Updates is what clears those.
   */
  useLiveResync(
    useCallback(() => {
      void clearPushNotices("badge");
    }, []),
    { enabled: status === "ready" && Boolean(userId) },
  );

  /**
   * A pushed group post marks that group `NEW` in the sidebar, and opening the
   * group clears it — mobile keeps the same marker from the same signal
   * (`push-notification.provider.tsx:264`, `GroupsList.tsx:81-84`).
   *
   * Deliberately not gated on the chat connection: a push about a post has
   * nothing to do with Stream Chat being ready, and waiting for it would drop
   * the marker for anyone who never opens the chat tab.
   */
  useEffect(
    () =>
      subscribePushData((data) => {
        const feedId = data.feedId || data.groupId;
        if (feedId && pathnameRef.current !== `/groups/${feedId}`) {
          markGroupUnread(feedId);
        }
      }),
    [],
  );

  useEffect(() => {
    if (status !== "ready") return;

    return subscribeForegroundPush((push) => {
      /* Don't toast a message the member is already looking at — the chat pane
         renders it live through the Stream websocket. */
      if (push.channelId && pathnameRef.current === `/chat/${push.channelId}`)
        return;

      toast(push.title, {
        description: push.body || undefined,
        action: {
          label: t("app.push.toastOpen"),
          onClick: () => router.push(push.path),
        },
      });
    });
  }, [status, router]);

  return null;
}
