import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import ChatEmptyState from "@/components/chat/ChatEmptyState";

export const metadata: Metadata = { title: t("app.screens.chatTitle") };

/**
 * /chat — on desktop this is the right-pane empty state (the list lives in the
 * layout). On mobile only the list shows; this is hidden until a conversation
 * is opened.
 */
export default function ChatPage() {
  return <ChatEmptyState />;
}
