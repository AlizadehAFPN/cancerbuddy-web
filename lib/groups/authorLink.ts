/**
 * Where tapping the author of a post, comment or reply goes.
 *
 * On web the author was inert text, which quietly removed five destinations that
 * a mobile user reaches from one tap: the member's profile, their photo gallery,
 * their journal, a host's own page, and the group a host runs. All five already
 * exist as web routes — nothing in Groups linked to them.
 *
 * Mobile's branch order is in `usePostActions.handleAvatarPress`
 * (`cancerbuddyapp/src/components/layouts/Groups/post-fragment/hooks/usePostActions.ts:46-89`)
 * and is reproduced exactly:
 *
 *   1. the author hosts a group, and it is **not** this one → the host's page
 *   2. the author hosts a group, and it **is** this one     → the group detail
 *   3. otherwise                                            → their profile
 *
 * The connect decision travels with the link, the way mobile passes
 * `showButtons` as a navigation param — see {@link authorProfileHref}.
 */

import { connectAgeRules } from "@/lib/buddies/age";

export interface AuthorLinkTarget {
  /** The author's user id. */
  authorId?: string | null;
  /** The group this author hosts, if any. */
  groupHostId?: string | null;
  /** The feed the post lives in — equals the group id. */
  postFeedId?: string | null;
}

/**
 * The destination for an author, or null when there is nothing to link to
 * (an author whose record never resolved).
 */
export function authorHref(target: AuthorLinkTarget): string | null {
  const authorId = (target.authorId ?? "").trim();
  const groupHostId = (target.groupHostId ?? "").trim();
  const postFeedId = (target.postFeedId ?? "").trim();

  if (groupHostId) {
    // A host posting somewhere else is a person; posting in their own group they
    // are the group. Mobile draws the line the same way.
    return groupHostId === postFeedId
      ? `/groups/${groupHostId}`
      : `/groups/hosts/${authorId || groupHostId}`;
  }

  return authorId ? `/buddies/${authorId}` : null;
}

export interface ConnectContext {
  viewerId?: string | null;
  viewerBirth?: string | null;
  author: {
    id?: string | null;
    birth?: string | null;
    isSnooze?: boolean | null;
  };
}

/**
 * Mobile's `showButtons` for the profile opened from a post author:
 * `ruleAge && !connections && !isSnooze && userInfo.id !== userId`.
 *
 * The `!connections` half is deliberately **not** here — the profile screen reads
 * the pair's connection itself and is the only place that knows it. What the
 * caller cannot see from the destination is the *strict* age rule, which applies
 * only when arriving from a post, and the author's snooze flag, which the feed
 * has and the profile screen would have to re-fetch.
 */
export function canConnectFromPost(input: ConnectContext): boolean {
  const authorId = (input.author.id ?? "").trim();
  if (!authorId) return false;
  if (authorId === (input.viewerId ?? "").trim()) return false;
  if (input.author.isSnooze === true) return false;
  return connectAgeRules(input.viewerBirth, input.author.birth);
}

/**
 * The profile link for a non-host author, carrying the connect decision.
 *
 * `?connect=0` is the web equivalent of mobile's `showButtons: false` navigation
 * param: the destination suppresses its Connect action rather than offering a
 * request the age rules will not allow. Absent, the profile decides for itself,
 * which is what happens for every other route into it.
 */
export function authorProfileHref(
  target: AuthorLinkTarget,
  context: ConnectContext,
): string | null {
  const href = authorHref(target);
  if (!href || !href.startsWith("/buddies/")) return href;
  return canConnectFromPost(context) ? href : `${href}?connect=0`;
}
