import { UserType, type UserTypeValue } from "@/lib/profile/types";

/**
 * Who may moderate a group's posts.
 *
 * Mobile grants the pin/unpin and delete affordances to a group's own hosts **or**
 * any `SUPPORT` account — the same disjunction drives both `deletePost` and
 * `isHostPost` in `cancerbuddyapp/src/components/layouts/Groups/post-fragment/Post.fragment.tsx:148-149,157-159`.
 * Web checked hosts only, so SUPPORT staff had to escalate to a host to remove
 * reported content.
 *
 * Kept as a pure function rather than inline in the component so the rule has one
 * definition and a machine-checkable acceptance test.
 */
export function canModerateGroup(input: {
  userId?: string | null;
  userType?: UserTypeValue | null;
  hosts?: ReadonlyArray<{ id?: string | null }> | null;
}): boolean {
  if (input.userType === UserType.SUPPORT) return true;
  return isHostOfGroup(input);
}

/**
 * Whether this account hosts *this* group.
 *
 * Deliberately not `userType === "HOST"`: a HOST-typed account is not a host of
 * every group, and a PATIENT-typed account can host one. Mobile asks the same
 * question the same way — `dataGroupById?.Host?.hosts?.some(h => h?.id === id)`
 * in `cancerbuddyapp/src/components/layouts/Groups/GroupHeader.tsx:112`.
 */
export function isHostOfGroup(input: {
  userId?: string | null;
  hosts?: ReadonlyArray<{ id?: string | null }> | null;
}): boolean {
  const { userId, hosts } = input;
  if (!userId || !hosts) return false;
  return hosts.some((h) => h?.id === userId);
}

/**
 * A host cannot leave the group they host — mobile hides the row entirely behind
 * `!isGroupHost` (`GroupActions.tsx:44`). Leaving would orphan the group, and
 * nothing in either client can undo it.
 *
 * Mute stays available to hosts; only Leave is withheld.
 */
export function canLeaveGroup(input: {
  userId?: string | null;
  hosts?: ReadonlyArray<{ id?: string | null }> | null;
}): boolean {
  return !isHostOfGroup(input);
}

/**
 * Whether "Reply privately" appears on a post, comment or reply.
 *
 * Mobile guards it with the same disjunction twice, once in each branch of the
 * actions modal (`ReportPost.modal.tsx:178-183,265-270`):
 *
 * ```
 * (userType === HOST || userType === SUPPORT)
 *   && userInfo.userType !== SUPPORT
 *   && post.actor !== userId
 * ```
 *
 * Note it keys off the viewer's **account type**, not on hosting *this* group —
 * so a host of another group also gets the row. That is mobile's rule and it is
 * kept, because the destination is a direct message, not a moderation action on
 * this group's content. Support accounts never receive one (they have their own
 * inbox), and nobody messages themselves.
 */
export function canReplyPrivately(input: {
  viewerType?: string | null;
  authorType?: string | null;
  viewerId?: string | null;
  authorId?: string | null;
}): boolean {
  const viewerIsStaff =
    input.viewerType === UserType.HOST || input.viewerType === UserType.SUPPORT;
  if (!viewerIsStaff) return false;
  if (input.authorType === UserType.SUPPORT) return false;

  const viewerId = (input.viewerId ?? "").trim();
  const authorId = (input.authorId ?? "").trim();
  if (!viewerId || !authorId) return false;
  return viewerId !== authorId;
}
