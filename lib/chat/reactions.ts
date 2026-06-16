/**
 * Reaction set. Stream requires the reaction `type` to be alphanumeric
 * (no emoji), so we send a name and map it to an emoji for display. Unknown
 * types (e.g. reactions created by other clients) fall back to the raw type.
 */
export const REACTIONS = [
  { type: "like", emoji: "👍" },
  { type: "love", emoji: "❤️" },
  { type: "haha", emoji: "😂" },
  { type: "wow", emoji: "😮" },
  { type: "sad", emoji: "😢" },
  { type: "pray", emoji: "🙏" },
] as const;

const EMOJI_BY_TYPE: Record<string, string> = Object.fromEntries(
  REACTIONS.map((r) => [r.type, r.emoji]),
);

export function reactionEmoji(type: string): string {
  return EMOJI_BY_TYPE[type] ?? type;
}
