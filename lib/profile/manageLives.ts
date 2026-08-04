/**
 * Scheduling live sessions — the host-only section of the profile.
 *
 * A host is bound to exactly one group through `User.groupHostId`; every
 * session they can manage belongs to it. Without that field there is nothing to
 * manage, which is the empty state rather than an error.
 *
 * Creating goes through `USERS_LAMBDA` because the Lambda also provisions the
 * Twilio room and chat channel; editing and deleting are plain AppSync
 * mutations. Joining the video itself is not part of the web app.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";

export interface LiveSession {
  id: string;
  groupId: string;
  groupName?: string | null;
  title: string;
  description?: string | null;
  /** ISO timestamp. */
  scheduledAt?: string | null;
  /** Minutes. */
  duration?: number | null;
  status?: string | null;
  /** `false` means the host has hidden it from members. */
  active?: boolean | null;
  archived?: boolean | null;
  inLive?: boolean | null;
  twilioRoomName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

function usersLambdaName(): string {
  const v = process.env.NEXT_PUBLIC_USERS_LAMBDA?.trim();
  if (!v) throw new Error("NEXT_PUBLIC_USERS_LAMBDA is not set.");
  return v;
}

const GET_HOST_GROUP = /* GraphQL */ `
  query getHostGroup($userId: ID!) {
    getUser(id: $userId) {
      id
      groupHostId
    }
  }
`;

const LIST_SESSIONS = /* GraphQL */ `
  query listLiveSessions($groupId: ID!) {
    listLiveStreamingGroups(filter: { groupId: { eq: $groupId } }) {
      items {
        id
        groupId
        groupName
        title
        description
        status
        archived
        active
        scheduledAt
        duration
        twilioRoomName
        inLive
        createdAt
        updatedAt
      }
    }
  }
`;

const GET_SESSION = /* GraphQL */ `
  query getLiveSession($id: ID!) {
    getLiveStreamingGroup(id: $id) {
      id
      groupId
      groupName
      title
      description
      status
      archived
      active
      scheduledAt
      duration
      inLive
    }
  }
`;

const UPDATE_SESSION = /* GraphQL */ `
  mutation updateLiveStreamingGroup($input: UpdateLiveStreamingGroupInput!) {
    updateLiveStreamingGroup(input: $input) {
      id
      title
      description
      duration
      scheduledAt
      active
      updatedAt
    }
  }
`;

const DELETE_SESSION = /* GraphQL */ `
  mutation deleteLiveStreamingGroup($input: DeleteLiveStreamingGroupInput!) {
    deleteLiveStreamingGroup(input: $input) {
      id
    }
  }
`;

/** The group this host runs, or null if they aren't bound to one. */
export async function fetchHostGroupId(userId: string): Promise<string | null> {
  const { data } = await executeAppSyncGraphql<{
    getUser: { groupHostId?: string | null } | null;
  }>({ query: GET_HOST_GROUP, variables: { userId }, authWithUserPool: true });
  return data?.getUser?.groupHostId ?? null;
}

/**
 * Sessions for a group, minus the ones that have finished or been archived —
 * the same filter mobile applies before splitting into visible and hidden.
 */
export async function fetchLiveSessions(
  groupId: string,
): Promise<LiveSession[]> {
  const { data } = await executeAppSyncGraphql<{
    listLiveStreamingGroups: { items?: LiveSession[] | null } | null;
  }>({ query: LIST_SESSIONS, variables: { groupId }, authWithUserPool: true });

  const all = (data?.listLiveStreamingGroups?.items ?? []).filter((s) => s?.id);
  const current = all.filter((s) => s.status !== "ended" && !s.archived);

  return current.sort((a, b) =>
    (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""),
  );
}

export async function fetchLiveSession(id: string): Promise<LiveSession | null> {
  const { data } = await executeAppSyncGraphql<{
    getLiveStreamingGroup: LiveSession | null;
  }>({ query: GET_SESSION, variables: { id }, authWithUserPool: true });
  return data?.getLiveStreamingGroup ?? null;
}

export interface CreateLiveParams {
  groupId: string;
  groupName?: string;
  title: string;
  description?: string;
  /** ISO timestamp. */
  scheduledAt: string;
  duration?: number;
}

/**
 * Creates a session. The Lambda double-encodes its body often enough that the
 * response is unwrapped defensively before its status is read.
 */
export async function createLiveSession(
  params: CreateLiveParams,
): Promise<{ liveId?: string }> {
  const raw = await raiseUserLambda(
    LambdaPayloadType.CREATE_LIVE,
    usersLambdaName(),
    params as unknown as Record<string, unknown>,
  );

  let parsed: unknown = raw;
  for (let i = 0; i < 3 && typeof parsed === "string"; i += 1) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new Error("The scheduling service returned an unreadable response.");
    }
  }

  const body = (parsed ?? {}) as { statusCode?: number; message?: string; liveId?: string };
  if (typeof body.statusCode === "number" && body.statusCode >= 400) {
    throw new Error(body.message ?? "Failed to create the live session.");
  }
  return { liveId: body.liveId };
}

export async function updateLiveSession(params: {
  id: string;
  title: string;
  description?: string;
  duration: number;
  scheduledAt?: string;
  active: boolean;
}): Promise<void> {
  await executeAppSyncGraphql({
    query: UPDATE_SESSION,
    variables: {
      input: {
        id: params.id,
        title: params.title,
        description: params.description?.trim() || null,
        duration: params.duration || 0,
        scheduledAt: params.scheduledAt || null,
        active: params.active,
      },
    },
    authWithUserPool: true,
  });
}

export async function deleteLiveSession(id: string): Promise<void> {
  await executeAppSyncGraphql({
    query: DELETE_SESSION,
    variables: { input: { id } },
    authWithUserPool: true,
  });
}

/* ── Display helpers ────────────────────────────────────────────────────── */

/** `<input type="datetime-local">` value ⇄ ISO. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function localInputToIso(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function formatSessionWhen(session: LiveSession): string {
  if (!session.scheduledAt) return "";
  const start = new Date(session.scheduledAt);
  if (Number.isNaN(start.getTime())) return "";

  const date = start.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const mins = session.duration ?? 0;
  return mins ? `${date} · ${time} · ${mins} min` : `${date} · ${time}`;
}
