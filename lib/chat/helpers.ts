import type { Channel, UserResponse } from "stream-chat";

export interface ChannelDisplay {
  name: string;
  image?: string;
  /** The other 1:1 member, when there is exactly one. */
  other?: UserResponse;
}

/**
 * Derive what to show for a 1:1 messaging channel: the other member's name and
 * avatar, falling back to the stored channel name. Channel names are created as
 * "BuddyFirst MyFirst" in the mobile app, so they're only a last resort here.
 */
export function channelDisplay(channel: Channel, userId: string): ChannelDisplay {
  const members = Object.values(channel.state?.members ?? {});
  const others = members
    .map((m) => m.user)
    .filter((u): u is UserResponse => !!u && u.id !== userId);

  const other = others[0];
  const fromMembers = others
    .map((u) => u?.name)
    .filter(Boolean)
    .join(", ");

  const stored = (channel.data as { name?: string } | undefined)?.name;
  // 1:1 → the other member's name; group → the stored channel name.
  const name =
    others.length === 1
      ? other?.name || stored || "Conversation"
      : stored || fromMembers || "Conversation";
  const image =
    (other?.image as string | undefined) ||
    ((channel.data as { image?: string } | undefined)?.image as string | undefined);

  return { name, image, other };
}

/** Initials for the avatar fallback. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

/** Exact clock time for message bubbles, e.g. "3:42 PM". */
export function messageTime(v: unknown): string {
  const d = toDate(v);
  return d ? timeFmt.format(d) : "";
}

/** Compact, WhatsApp-style timestamp for the conversation list. */
export function listTimestamp(v: unknown): string {
  const d = toDate(v);
  if (!d) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return timeFmt.format(d);

  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays <= 6) return weekdayFmt.format(d);
  return dateFmt.format(d);
}

/** Day separator label inside a thread, e.g. "Today" / "Mar 4". */
export function dayLabel(v: unknown): string {
  const d = toDate(v);
  if (!d) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return dateFmt.format(d);
}

export function sameDay(a: unknown, b: unknown): boolean {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return false;
  return da.toDateString() === db.toDateString();
}
