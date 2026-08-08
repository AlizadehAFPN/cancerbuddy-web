/**
 * Which groups have posts the member has not opened yet — the `NEW` badge.
 *
 * Mobile keeps a list of push payloads in memory (`hasPostMessage`), badges any
 * group whose id appears in it (`GroupsList.tsx:81-84`), and drops that group's
 * entries when the group is opened (`feeds/home.tsx:98`). This is the same rule
 * with one deliberate difference: it is **persisted**.
 *
 * The difference is not gratuitous. A phone keeps the app process alive for
 * days, so in-memory state survives; a browser tab is closed and reopened
 * constantly, and a marker that vanished on every reload would be a badge nobody
 * ever saw. Group ids are the only thing stored — no message bodies, nothing
 * that identifies a person.
 *
 * Storage is best-effort throughout: private mode, a full quota or a blocked
 * origin degrade this to mobile's in-memory behaviour rather than throwing on a
 * push.
 */

const STORAGE_KEY = "cb.groups.unread";

/** Read once, then kept in sync — `localStorage` reads are synchronous I/O. */
let groups: Set<string> | null = null;
const listeners = new Set<() => void>();

function load(): Set<string> {
  if (groups) return groups;
  groups = new Set<string>();
  if (typeof window === "undefined") return groups;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      for (const id of parsed) if (typeof id === "string" && id) groups.add(id);
    }
  } catch {
    /* unreadable or blocked — start empty */
  }
  return groups;
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...load()]));
  } catch {
    /* the badge still works for this session */
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeToUnreadGroups(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** A push arrived for this group's feed. */
export function markGroupUnread(groupId: string | null | undefined): void {
  const id = (groupId ?? "").trim();
  if (!id) return;
  const set = load();
  if (set.has(id)) return;
  set.add(id);
  persist();
  emit();
}

/** The member opened the group, or one of its posts. */
export function clearGroupUnread(groupId: string | null | undefined): void {
  const id = (groupId ?? "").trim();
  if (!id) return;
  const set = load();
  if (!set.delete(id)) return;
  persist();
  emit();
}

export function hasUnread(groupId: string | null | undefined): boolean {
  const id = (groupId ?? "").trim();
  return !!id && load().has(id);
}

/** Stable snapshot for `useSyncExternalStore` — same identity until it changes. */
export function unreadGroupIds(): ReadonlySet<string> {
  return load();
}

/** Test seam. */
export function resetUnreadGroups(): void {
  groups = new Set<string>();
  persist();
  emit();
}
