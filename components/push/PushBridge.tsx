"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useStreamChat } from "@/lib/chat/StreamChatProvider";
import { subscribeForegroundPush, syncPushDevice } from "@/lib/push/pushClient";
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
