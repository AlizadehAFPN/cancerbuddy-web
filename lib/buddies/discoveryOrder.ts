/**
 * The list a profile's Previous / Next walk — mobile's `connectState.usersList`.
 *
 * Two lists can fill it, which is the whole point of this module: the discovery
 * results, and the **pending buddy requests**. Opening a sender's profile from a
 * request used to be a dead end on web because only discovery ever wrote here,
 * so a member with eleven requests had to go back to the list eleven times.
 * Mobile seeds the same queue from either source
 * (`ConnectionRequest.tsx:176-184`).
 *
 * Module scope rather than context on purpose: the profile page is a separate
 * route, and this is a navigational convenience — if it is missing (deep link,
 * refresh, arriving from a Buddy ID) the buttons simply do not render.
 */

/** Which list is loaded. Kept so a caller can tell whose queue it is looking at. */
export type NeighbourSource = "discovery" | "requests";

let order: string[] = [];
let source: NeighbourSource = "discovery";

/**
 * Replaces the queue. The last writer wins — walking away from a request into
 * discovery should page through discovery, not back into the requests.
 */
export function setNeighbourQueue(ids: string[], from: NeighbourSource): void {
  order = ids;
  source = from;
}

/** The discovery results, as the list screen finishes each scan. */
export function setDiscoveryOrder(ids: string[]): void {
  setNeighbourQueue(ids, "discovery");
}

export function neighbourSource(): NeighbourSource {
  return source;
}

export interface DiscoveryNeighbours {
  previousId?: string;
  nextId?: string;
  position?: { index: number; total: number };
}

export function getNeighbours(userId: string): DiscoveryNeighbours {
  const index = order.indexOf(userId);
  if (index === -1) return {};
  return {
    previousId: index > 0 ? order[index - 1] : undefined,
    nextId: index < order.length - 1 ? order[index + 1] : undefined,
    position: { index: index + 1, total: order.length },
  };
}

/** Test seam. */
export function resetNeighbourQueue(): void {
  order = [];
  source = "discovery";
}
