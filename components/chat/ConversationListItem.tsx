"use client";

import Link from "next/link";
import type { Channel } from "stream-chat";
import { t } from "@/lib/i18n";
import { channelDisplay, listTimestamp } from "@/lib/chat/helpers";
import { useContactProfile } from "@/lib/chat/useContactProfile";
import ChatAvatar from "./ChatAvatar";
import RoleBadges from "./RoleBadges";

/** One conversation row: avatar (photo), name + role badges, preview, time, unread. */
export default function ConversationListItem({
  channel,
  userId,
  active,
}: {
  channel: Channel;
  userId: string;
  active: boolean;
}) {
  const { name, image, other } = channelDisplay(channel, userId);
  const profile = useContactProfile(other?.id);

  const displayName = profile?.name || name;
  const avatarUrl = profile?.profilePicUrl || image;

  const messages = channel.state.messages;
  const last = messages[messages.length - 1];
  const lastText = last?.text?.trim();
  const preview = lastText || t("app.chat.connected");
  const lastFromMe = last?.user?.id === userId;
  const time = listTimestamp(channel.state.last_message_at);
  const unread = channel.countUnread();
  const isNew = !channel.state.last_message_at;
  const frozen = channel.data?.frozen === true;

  return (
    <Link
      href={`/chat/${channel.id}`}
      aria-current={active ? "page" : undefined}
      className={[
        "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
        active ? "bg-cb-gray-100" : "hover:bg-cb-gray-50",
        frozen ? "opacity-60" : "",
      ].join(" ")}
    >
      <ChatAvatar
        name={displayName}
        image={avatarUrl}
        icon={profile?.goalImageUrl}
        size={48}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-heading text-[0.95rem] font-semibold text-cb-black">
              {displayName}
            </span>
            <RoleBadges profile={profile} />
          </span>
          {isNew ? (
            <span className="shrink-0 rounded-full bg-cb-yellow px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cb-black">
              {t("app.chat.new")}
            </span>
          ) : (
            time && (
              <span
                className={[
                  "shrink-0 text-[11px]",
                  unread > 0 ? "font-semibold text-cb-black" : "text-cb-gray-400",
                ].join(" ")}
              >
                {time}
              </span>
            )
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span
            className={[
              "truncate font-body text-sm",
              unread > 0 ? "text-cb-black" : "text-cb-gray-500",
            ].join(" ")}
          >
            {lastFromMe && lastText ? "You: " : ""}
            {preview}
          </span>
          {unread > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-cb-black px-1.5 text-[11px] font-bold leading-none text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
