"use client";

import { reactionEmoji } from "@/lib/chat/reactions";
import type { UIReaction } from "@/lib/chat/useChannelMessages";

/**
 * A single combined reaction chip: the distinct emojis grouped together with
 * the total count. Highlighted when you've reacted. Tapping is handled by the
 * parent (toggles your reaction, or opens the picker to add one).
 */
export default function ReactionPills({
  reactions,
  onClick,
}: {
  reactions: UIReaction[];
  onClick: () => void;
}) {
  if (reactions.length === 0) return null;
  const total = reactions.reduce((sum, r) => sum + r.count, 0);
  const mine = reactions.some((r) => r.mine);

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 shadow-sm transition-colors",
        mine ? "border-cb-black" : "border-cb-gray-200 hover:bg-cb-gray-50",
      ].join(" ")}
    >
      <span className="flex gap-1 items-center text-sm leading-none">
        {reactions.map((r) => (
          <span key={r.type}>{reactionEmoji(r.type)}</span>
        ))}
      </span>
      <span className="text-xs font-medium text-cb-gray-600">{total}</span>
    </button>
  );
}
