/**
 * Remembers the order of the last discovery result so the profile page can
 * offer Previous / Next, the way mobile's "Next" button walks the list.
 *
 * Module scope rather than context on purpose: the profile page is a separate
 * route, and this is a navigational convenience — if it's missing (deep link,
 * refresh, arriving from a Buddy ID lookup) the buttons simply don't render.
 */

let order: string[] = [];

export function setDiscoveryOrder(ids: string[]): void {
  order = ids;
}

export interface DiscoveryNeighbours {
  previousId?: string;
  nextId?: string;
  position?: { index: number; total: number };
}

export function getDiscoveryNeighbours(userId: string): DiscoveryNeighbours {
  const index = order.indexOf(userId);
  if (index === -1) return {};
  return {
    previousId: index > 0 ? order[index - 1] : undefined,
    nextId: index < order.length - 1 ? order[index + 1] : undefined,
    position: { index: index + 1, total: order.length },
  };
}
