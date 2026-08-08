/**
 * Whether the Connect / Chat / Next action bar shows on a member's profile.
 *
 * Mirrors mobile's single guard at
 * `cancerbuddyapp/src/screens/buddies/userInfo/UserInfo.tsx:457`:
 * `!blocked && userType !== UserType.SUPPORT && !groupHostIdApp`.
 *
 * Note whose value is whose — the two are easy to swap and the bug is silent:
 * `targetUserType` is the *profile being viewed*, `viewerGroupHostId` is the
 * *signed-in account*. A host account browses members to moderate, not to make
 * buddies, so it gets no action bar at all.
 */
export function shouldShowActionBar(input: {
  /** The signed-in account's `groupHostId`; non-null means a host account. */
  viewerGroupHostId?: string | null;
  /** The viewed profile's `userType`. */
  targetUserType?: string | null;
  isSelf?: boolean;
  /** Either direction of a block hides the bar. */
  isBlocked?: boolean;
}): boolean {
  if (input.isSelf) return false;
  if (input.isBlocked) return false;
  if (input.targetUserType === "SUPPORT") return false;
  if (input.viewerGroupHostId?.trim()) return false;
  return true;
}
