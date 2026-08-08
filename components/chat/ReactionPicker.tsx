"use client";

import { SmilePlus } from "lucide-react";
import { REACTIONS } from "@/lib/chat/reactions";
import { t } from "@/lib/i18n";

/** Hover control that opens a compact emoji row to react with. Controlled. */
export default function ReactionPicker({
  open,
  setOpen,
  align,
  currentType,
  onPick,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  align: "left" | "right";
  /**
   * The reaction this member already gave, if any.
   *
   * Required, not optional: the picker showed no selected state at all, so
   * tapping an emoji you had already chosen silently removed it. Making the prop
   * required means a call site that cannot supply it fails to compile rather
   * than quietly reintroducing the ambiguity.
   */
  currentType: string | undefined;
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
          {REACTIONS.map((r) => {
            const mine = r.type === currentType;
            return (
              <button
                key={r.type}
                type="button"
                aria-pressed={mine}
                onClick={() => {
                  onPick(r.type);
                  setOpen(false);
                }}
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none transition-transform hover:scale-125",
                  mine ? "bg-cb-yellow" : "hover:bg-cb-gray-100",
                ].join(" ")}
              >
                {r.emoji}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
