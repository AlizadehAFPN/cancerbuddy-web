/**
 * Why a profile's action bar looks the way it does — and what to tell the
 * member about it.
 *
 * Two rules that web was missing, both of them safety logic rather than
 * cosmetics:
 *
 *  1. **Snooze and the age bracket gate the Connect action itself**, not just
 *     the discovery query. Web filtered snoozed accounts out of discovery and
 *     nowhere else, so a snoozed member opened from a group's member list — or
 *     from a Buddy ID — still showed a live Connect button. Mobile asks the
 *     question on the profile, every time (`ConnectionButtonBar.tsx:39`).
 *  2. **The explanation persists.** Mobile shows a `FeedbackCard` under the name
 *     ("You are waiting to connect with Ada…", the age-rule sentence) for as long
 *     as the profile is open. Web had toasts, which are gone in four seconds and
 *     never arrive at all when the profile is opened from a link.
 *
 * Both are pure functions here so the profile screen, the Buddy-ID ladder and
 * their tests share exactly one definition.
 */

import { connectAgeRulesBuddySearching } from "@/lib/buddies/age";
import type { ConnectionEntry } from "@/lib/buddies/types";

/**
 * Whether the action bar appears at all.
 *
 * Mobile's disjunction, verbatim:
 * `showButtons || isBuddy || isPendingConnection || isAlreadyBuddy`, where
 * `showButtons` is itself `ageRule && !connection && !isSnooze && !self`
 * (`usePostActions.ts:74`, `useValidateRules.ts:209-224`).
 *
 * The second half is what keeps an existing relationship reachable: someone who
 * snoozed *after* you connected is still someone you can open a chat with, and
 * a request you already sent is still one you can cancel. Only a **new** invite
 * is refused.
 */
export function showConnectAction(input: {
  viewerId?: string | null;
  viewerBirth?: string | null;
  target: {
    id: string;
    isSnooze?: boolean | null;
    birth?: string | null;
  };
  connection?: ConnectionEntry | null;
}): boolean {
  if (input.connection) return true;

  const viewerId = (input.viewerId ?? "").trim();
  if (viewerId && viewerId === input.target.id) return false;
  if (input.target.isSnooze === true) return false;

  return connectAgeRulesBuddySearching(input.viewerBirth, input.target.birth);
}

/* ── The feedback banner ────────────────────────────────────────────────── */

/**
 * The four contexts a profile can be opened in, as mobile's Buddy-ID ladder
 * classifies them (`useValidateRules.ts:95-133,209-224`).
 */
export type ConnectionContext = "none" | "pending" | "accepted" | "ageRule";

/**
 * Banner keys. `alreadyBuddies` is mobile's `alredyBuddies` with the typo
 * corrected — this one is a web-only query parameter, not shared data, so the
 * spelling is ours to fix.
 */
export type ProfileNotice =
  | "sentInvite"
  | "alreadyBuddies"
  | "ageRule"
  | "snoozeAccount";

export const PROFILE_NOTICES: ProfileNotice[] = [
  "sentInvite",
  "alreadyBuddies",
  "ageRule",
  "snoozeAccount",
];

export function isProfileNotice(value: string | null): value is ProfileNotice {
  return !!value && (PROFILE_NOTICES as string[]).includes(value);
}

export interface NoticeDecision {
  notice: ProfileNotice | null;
  /**
   * Mobile's `showButtons` navigation parameter. False does **not** hide the
   * whole bar — an existing pending or accepted connection still shows its own
   * control, per {@link showConnectAction} — it withholds a *new* invite.
   */
  showActions: boolean;
}

export function noticeForConnectionContext(
  context: ConnectionContext,
): NoticeDecision {
  switch (context) {
    case "ageRule":
      return { notice: "ageRule", showActions: false };
    case "pending":
      return { notice: "sentInvite", showActions: false };
    case "accepted":
      return { notice: "alreadyBuddies", showActions: true };
    default:
      return { notice: null, showActions: true };
  }
}

/** The context a connection entry puts a profile in. */
export function connectionContextFor(
  connection?: ConnectionEntry | null,
): ConnectionContext {
  if (!connection) return "none";
  return connection.status === "connected" ? "accepted" : "pending";
}
