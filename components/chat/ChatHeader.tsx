"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MoreVertical, UserMinus } from "lucide-react";
import { t } from "@/lib/i18n";
import type { ContactProfile } from "@/lib/chat/contactProfile";
import ChatAvatar from "./ChatAvatar";
import RoleBadges from "./RoleBadges";
import TypingIndicator from "./TypingIndicator";

/** Conversation header: back (mobile), avatar, name, role badges, typing, menu. */
export default function ChatHeader({
  name,
  image,
  icon,
  profile,
  typing,
  onRemove,
}: {
  name: string;
  image?: string;
  icon?: string;
  profile: ContactProfile | null;
  typing: boolean;
  onRemove?: () => void;
}) {
  // The menu is hidden for Support/Host conversations, mirroring mobile.
  const showMenu = !!onRemove && !profile?.isSupport && !profile?.isHost;

  return (
    <div className="flex h-16 shrink-0 items-center gap-3 border-b border-cb-gray-200 px-3 sm:px-4">
      <Link
        href="/chat"
        aria-label={t("app.chat.back")}
        className="-ml-1 rounded-lg p-1.5 text-cb-black transition-colors hover:bg-cb-gray-100 lg:hidden"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <ChatAvatar name={name || "…"} image={image} icon={icon} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-heading text-[0.95rem] font-semibold text-cb-black">
            {name || "…"}
          </p>
          <RoleBadges profile={profile} />
        </div>
        {typing && (
          <span className="flex items-center gap-1.5 text-xs text-cb-gray-500">
            <TypingIndicator />
            {t("app.chat.typing")}
          </span>
        )}
      </div>

      {showMenu && <HeaderMenu onRemove={onRemove!} />}
    </div>
  );
}

function HeaderMenu({ onRemove }: { onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("app.chat.conversationMenu")}
        className="rounded-lg p-2 text-cb-gray-500 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
      >
        <MoreVertical className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-20 w-64 overflow-hidden rounded-xl border border-cb-gray-200 bg-white py-1 shadow-lg">
          {confirming ? (
            <div className="px-3 py-2">
              <p className="mb-2 font-body text-sm text-cb-gray-600">
                {t("app.chat.removeConfirm")}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setConfirming(false);
                    onRemove();
                  }}
                  className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 font-heading text-sm font-medium text-white hover:bg-red-700"
                >
                  {t("app.chat.removeYes")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="flex-1 rounded-lg bg-cb-gray-100 px-3 py-1.5 font-heading text-sm font-medium text-cb-black hover:bg-cb-gray-200"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-cb-gray-100"
            >
              <UserMinus className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <span>
                <span className="block font-heading text-sm font-medium text-red-600">
                  {t("app.chat.removeBuddy")}
                </span>
                <span className="block font-body text-xs text-cb-gray-500">
                  {t("app.chat.removeBuddySub")}
                </span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
