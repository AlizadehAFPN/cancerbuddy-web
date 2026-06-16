"use client";

import { SmilePlus } from "lucide-react";
import { REACTIONS } from "@/lib/chat/reactions";
import { t } from "@/lib/i18n";

/** Hover control that opens a compact emoji row to react with. Controlled. */
export default function ReactionPicker({
  open,
  setOpen,
  align,
  onPick,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  align: "left" | "right";
  onPick: (type: string) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={t("app.chat.addReaction")}
        className="flex h-7 w-7 items-center justify-center rounded-full text-cb-gray-400 hover:bg-cb-gray-100 hover:text-cb-black"
      >
        <SmilePlus className="h-4 w-4" />
      </button>
      {open && (
        <div
          className={`absolute bottom-8 z-20 flex gap-0.5 rounded-full border border-cb-gray-200 bg-white px-1.5 py-1 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {REACTIONS.map((r) => (
            <button
              key={r.type}
              type="button"
              onClick={() => {
                onPick(r.type);
                setOpen(false);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none transition-transform hover:scale-125 hover:bg-cb-gray-100"
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
