"use client";

import { useEffect, useRef, useState } from "react";
import type { Channel, ChannelFilters, ChannelSort } from "stream-chat";
import { channelSortTs } from "./helpers";
import { useStreamChat } from "./StreamChatProvider";

const PAGE = 30;
const MIN_CHARS = 2;
const DEBOUNCE_MS = 350;
const USER_PAGE = 100;
// Up to 300 name matches resolved — exceeds the mobile app's single 100-user
// query while staying within Stream's offset limits.
const MAX_USER_PAGES = 3;

/**
 * Walk every page of a channel query, invoking `onChannel` for each result so
 * nothing is cut off by Stream's default 30-item page. Mirrors the mobile
 * `fetchAllChannelPages` fix.
 */
async function fetchAllChannelPages(
  client: ReturnType<typeof useStreamChat>["client"],
  filter: ChannelFilters,
  isStale: () => boolean,
  onChannel: (ch: Channel) => void,
): Promise<void> {
  if (!client) return;
  const sort: ChannelSort = [{ last_message_at: -1 }];
  let offset = 0;
  while (true) {
    if (isStale()) return;
    const page = await client.queryChannels(filter, sort, {
      limit: PAGE,
      offset,
      watch: false,
      state: true,
      presence: false,
      message_limit: 1,
    });
    for (const ch of page) onChannel(ch);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
}

/** Local substring match — used only as a fallback when the server fails. */
function channelMatchesLocal(
  channel: Channel,
  userId: string,
  q: string,
): boolean {
  const name = String(
    (channel.data as { name?: string } | undefined)?.name ?? "",
  ).toLowerCase();
  if (name.includes(q)) return true;
  for (const m of Object.values(channel.state?.members ?? {})) {
    const uid = m.user?.id ?? m.user_id;
    if (!uid || uid === userId) continue;
    if (String(m.user?.name ?? "").toLowerCase().includes(q)) return true;
  }
  return false;
}

/**
 * Server-side search across ALL of the current user's conversations, matched by
 * channel name OR by the other participant's name. Participant names are
 * resolved across the entire user directory (not just already-loaded channels),
 * and every result page is fetched so large result sets aren't truncated.
 *
 * Returns `results: null` when no search is active (query under the minimum
 * length), so callers can fall back to the live channel list.
 */
export function useConversationSearch(query: string) {
  const { client, userId, status } = useStreamChat();
  const [results, setResults] = useState<Channel[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchIdRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const mySearchId = ++searchIdRef.current; // also cancels anything in flight
    const isStale = () => searchIdRef.current !== mySearchId;

    if (!client || status !== "ready" || !userId || q.length < MIN_CHARS) {
      // Clear via a task (not synchronously in the effect body) to reset state.
      const clear = setTimeout(() => {
        if (isStale()) return;
        setResults(null);
        setSearching(false);
      }, 0);
      return () => clearTimeout(clear);
    }

    const timer = setTimeout(async () => {
      setSearching(true);

      const seen = new Set<string>();
      const collected: Channel[] = [];
      const push = (ch: Channel | null | undefined) => {
        if (!ch?.cid || seen.has(ch.cid)) return;
        seen.add(ch.cid);
        collected.push(ch);
      };

      // Branch A — my channels whose channel name autocompletes the query.
      const branchA = fetchAllChannelPages(
        client,
        {
          type: "messaging",
          members: { $in: [userId] },
          name: { $autocomplete: q },
        } as ChannelFilters,
        isStale,
        push,
      );

      // Branch B — resolve matching users across the whole directory, then find
      // my channels shared with any of them.
      const branchB = (async () => {
        const peerIds: string[] = [];
        for (let page = 0; page < MAX_USER_PAGES; page++) {
          if (isStale()) return;
          const { users = [] } = await client.queryUsers(
            { id: { $ne: userId }, name: { $autocomplete: q } } as unknown as Parameters<
              typeof client.queryUsers
            >[0],
            {},
            { limit: USER_PAGE, offset: page * USER_PAGE, presence: false },
          );
          for (const u of users) if (u.id && u.id !== userId) peerIds.push(u.id);
          if (users.length < USER_PAGE) break;
        }
        if (!peerIds.length || isStale()) return;
        await fetchAllChannelPages(
          client,
          {
            type: "messaging",
            $and: [
              { members: { $in: [userId] } },
              { members: { $in: peerIds } },
            ],
          } as ChannelFilters,
          isStale,
          push,
        );
      })();

      // Branch C — full-text search of MESSAGE bodies across all my
      // conversations, then resolve the matching channels. Lets a search like
      // "I saw" find conversations by what was said, not just by name.
      const branchC = (async () => {
        let res;
        try {
          res = await client.search(
            { type: "messaging", members: { $in: [userId] } },
            q,
            { limit: 30 },
          );
        } catch {
          return; // message search may be disabled; name branches still work
        }
        if (isStale()) return;
        const cids = Array.from(
          new Set(
            (res.results ?? [])
              .map((r) => r.message?.cid)
              .filter((c): c is string => !!c),
          ),
        );
        if (!cids.length) return;
        await fetchAllChannelPages(
          client,
          {
            type: "messaging",
            members: { $in: [userId] },
            cid: { $in: cids },
          } as ChannelFilters,
          isStale,
          push,
        );
      })();

      const outcomes = await Promise.allSettled([branchA, branchB, branchC]);
      if (isStale()) return;

      // Both server branches failed → degrade to a local scan of loaded channels.
      if (outcomes.every((o) => o.status === "rejected")) {
        const ql = q.toLowerCase();
        for (const ch of Object.values(client.activeChannels)) {
          if (channelMatchesLocal(ch, userId, ql)) push(ch);
        }
      }

      collected.sort((a, b) => channelSortTs(b) - channelSortTs(a));
      setResults(collected);
      setSearching(false);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [client, status, userId, query]);

  return { results, searching, active: query.trim().length >= MIN_CHARS };
}
