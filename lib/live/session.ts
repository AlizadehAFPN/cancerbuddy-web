/**
 * Loading the session a live room is for.
 *
 * Mobile pushes the whole event onto the navigation stack, so its room screen
 * never fetches. A URL has to survive a refresh and a pasted link, so the web
 * room reads the session by id instead. Callers may still pass what they
 * already know as search params — that's only used to paint the header while
 * the query is in flight.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import type { LiveRoomSession } from "@/lib/live/types";

/**
 * Fields limited to the ones already proven to resolve — this is the same
 * selection `lib/profile/manageLives.ts` uses.
 *
 * `chatChannelId` and `twilioRoomSid` are written to DynamoDB by `createLive`
 * but are not selected by any AppSync query in this repo or the mobile app,
 * so there is no evidence the schema exposes them. Asking for a field the
 * schema doesn't declare fails the *whole* query, which would take the room
 * down; both values are derivable instead (see below).
 */
const GET_LIVE_SESSION = /* GraphQL */ `
  query getLiveRoomSession($id: ID!) {
    getLiveStreamingGroup(id: $id) {
      id
      groupId
      groupName
      title
      description
      status
      inLive
      scheduledAt
      duration
      archived
      active
    }
  }
`;

/**
 * Twilio room name for a session.
 *
 * Both creators — the users Lambda (`lambda-optimization/createLive.js`) and
 * the admin dashboard (`/api/live/create`) — provision the room as
 * `live-<liveId>` with no other branch, and the mobile room derives it the
 * same way. Deriving it is therefore exact, not a guess.
 */
export function roomNameFor(eventId: string): string {
  return `live-${eventId}`;
}

/**
 * Stream channel id for a session. Same reasoning as `roomNameFor`: both
 * creators write `live-<liveId>` unconditionally. A stored value is still
 * preferred when one reaches us (the calendar Lambda returns it), which is the
 * fallback order mobile uses.
 */
export function chatChannelIdFor(session: {
  id: string;
  chatChannelId?: string | null;
}): string {
  const stored = session.chatChannelId?.trim();
  return stored || `live-${session.id}`;
}

/**
 * Whether a session can still be joined at all.
 *
 * The token Lambda is the authority and refuses an ended session with a 4xx —
 * but only at the very end of joining, after someone has already picked a
 * camera and granted permission. Checking the row we already loaded lets the
 * room say so up front instead.
 *
 * Note this deliberately does *not* look at `inLive`. A host joining is what
 * flips that flag, so treating "not live yet" as unjoinable would lock the
 * host out of starting their own session.
 */
export function hasSessionEnded(
  session: Pick<LiveRoomSession, "status" | "archived">,
): boolean {
  return session.status === "ended" || session.archived === true;
}

export async function fetchLiveRoomSession(
  eventId: string,
): Promise<LiveRoomSession | null> {
  const { data } = await executeAppSyncGraphql<{
    getLiveStreamingGroup: LiveRoomSession | null;
  }>({
    query: GET_LIVE_SESSION,
    variables: { id: eventId },
    authWithUserPool: true,
  });
  return data?.getLiveStreamingGroup ?? null;
}
