/**
 * Connection reads and mutations for the Buddies tab.
 *
 * A `Connection` row is the single source of truth for the relationship between
 * two people, and its `id` doubles as the Stream channel id once accepted — so
 * "accept a request" means *update the row, then create the channel with that
 * same id*. Mobile does exactly this in `ConnectionRequest.tsx`; keeping the
 * ordering identical is what lets a conversation started on one client show up
 * on the other.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { getS3ImageUrl, type S3FileRef } from "@/lib/aws/s3Image";
import type {
  ConnectionMap,
  NamedRef,
  PendingRequest,
  UserTypeName,
} from "@/lib/buddies/types";

const RESULT_LIMIT = 1000000;
const MAX_PAGES = 200;
/**
 * Page size for the index-backed connection reads.
 *
 * Small on purpose: every row an index returns already belongs to this user, so
 * there is nothing to over-fetch. The scan-based version needed a huge limit to
 * have any chance of finding the user's rows, which is what made it fragile.
 */
const CONNECTION_PAGE_SIZE = 100;

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_:-]/g, "");
}

/* ── Incoming requests ──────────────────────────────────────────────────── */

/** `{ items: [{ <key>: { id, name } }] }` — the shape every relation comes in. */
interface RawRelation<K extends string> {
  items?: ({ [P in K]?: { id?: string | null; name?: string | null } | null })[] | null;
}

interface RawRemitent {
  id: string;
  name?: string | null;
  bio?: string | null;
  birth?: string | null;
  userType?: string | null;
  ambassador?: boolean | null;
  State?: { stateAbbreviation?: string | null } | null;
  Interests?: RawRelation<"interest"> | null;
  Hospitals?: RawRelation<"hospital"> | null;
  Treatments?: RawRelation<"treatment"> | null;
  Diagnosis?: RawRelation<"diagnosis"> | null;
  Goal?: { image?: { file?: S3FileRef | null } | null } | null;
  ProfilePic?: { file?: S3FileRef | null } | null;
}

/** Flattens one relation list to `{id, name}` pairs, dropping unresolved rows. */
function namedRefs<K extends string>(
  relation: RawRelation<K> | null | undefined,
  key: K,
): NamedRef[] {
  return (relation?.items ?? [])
    .map((row) => row?.[key])
    .filter((item): item is { id?: string | null; name?: string | null } => !!item)
    .map((item) => ({ id: item.id ?? "", name: item.name ?? "" }))
    .filter((ref) => !!ref.id);
}

interface RawPendingRow {
  id: string;
  createdAt?: string | null;
  Remitent?: RawRemitent | null;
}

const PENDING_REQUESTS = (userId: string, nextToken?: string) => /* GraphQL */ `
  query getConnectionsByRecipient {
    byRecipientId(
      connectionRecipientId: "${safeId(userId)}",
      filter: { accepted: { eq: false }, ignored: { eq: false } },
      limit: 50
      ${nextToken ? `, nextToken: "${nextToken}"` : ""}
    ) {
      items {
        id
        createdAt
        Remitent {
          id
          name
          bio
          birth
          userType
          ambassador
          State { stateAbbreviation }
          Interests { items { interest { id name } } }
          Hospitals { items { hospital { id name } } }
          Treatments { items { treatment { id name } } }
          Diagnosis { items { diagnosis { id name } } }
          Goal { image { file { key bucket region } } }
          ProfilePic { file { key bucket region } }
        }
      }
      nextToken
    }
  }
`;

/**
 * Ids only — what the navigation badge needs.
 *
 * A separate query from `PENDING_REQUESTS` on purpose: that one pulls each
 * sender's profile and then signs an S3 URL per avatar, which is the right
 * cost for a screen full of cards and the wrong one for a number rendered next
 * to a nav icon on every page.
 */
const PENDING_REQUEST_IDS = (userId: string, nextToken?: string) => /* GraphQL */ `
  query countConnectionsByRecipient {
    byRecipientId(
      connectionRecipientId: "${safeId(userId)}",
      filter: { accepted: { eq: false }, ignored: { eq: false } },
      limit: 50
      ${nextToken ? `, nextToken: "${nextToken}"` : ""}
    ) {
      items {
        id
        Remitent { id }
      }
      nextToken
    }
  }
`;

/**
 * How many buddy requests are waiting.
 *
 * Counts the same rows `fetchPendingRequests` would render — including the
 * filter for senders whose account is gone — so the badge can never promise a
 * request the list doesn't show.
 */
export async function fetchPendingRequestCount(userId: string): Promise<number> {
  let count = 0;
  let nextToken: string | undefined;
  let pages = 0;

  do {
    const { data } = await executeAppSyncGraphql<{
      byRecipientId: {
        items?: { id: string; Remitent?: { id?: string } | null }[] | null;
        nextToken?: string | null;
      } | null;
    }>({
      query: PENDING_REQUEST_IDS(userId, nextToken),
      variables: {},
      authWithUserPool: true,
    });

    const page = data?.byRecipientId;
    count += (page?.items ?? []).filter((r) => !!r?.Remitent?.id).length;
    nextToken = page?.nextToken ?? undefined;
    pages += 1;
  } while (nextToken && pages < MAX_PAGES);

  return count;
}

/**
 * Buddy requests waiting on the user, newest first. Rows whose `Remitent` has
 * been deleted are dropped — mobile filters these out too, otherwise the list
 * renders empty cards for accounts that no longer exist.
 */
export async function fetchPendingRequests(
  userId: string,
): Promise<PendingRequest[]> {
  const rows: RawPendingRow[] = [];
  let nextToken: string | undefined;
  let pages = 0;

  do {
    const { data } = await executeAppSyncGraphql<{
      byRecipientId: { items?: RawPendingRow[] | null; nextToken?: string | null } | null;
    }>({
      query: PENDING_REQUESTS(userId, nextToken),
      variables: {},
      authWithUserPool: true,
    });

    const page = data?.byRecipientId;
    rows.push(...(page?.items ?? []));
    nextToken = page?.nextToken ?? undefined;
    pages += 1;
  } while (nextToken && pages < MAX_PAGES);

  const valid = rows.filter((r) => !!r?.Remitent?.id);

  const requests = await Promise.all(
    valid.map(async (row): Promise<PendingRequest> => {
      const r = row.Remitent!;
      const [profilePicUrl, goalImageUrl] = await Promise.all([
        getS3ImageUrl(r.ProfilePic?.file),
        getS3ImageUrl(r.Goal?.image?.file),
      ]);
      return {
        id: row.id,
        createdAt: row.createdAt ?? "",
        remitent: {
          id: r.id,
          name: r.name ?? "",
          bio: r.bio ?? null,
          birth: r.birth ?? null,
          userType: (r.userType ?? "PATIENT") as UserTypeName,
          ambassador: r.ambassador === true,
          stateAbbreviation: r.State?.stateAbbreviation ?? null,
          interests: namedRefs(r.Interests, "interest"),
          hospitals: namedRefs(r.Hospitals, "hospital"),
          treatments: namedRefs(r.Treatments, "treatment"),
          diagnosis: namedRefs(r.Diagnosis, "diagnosis"),
          profilePicUrl,
          goalImageUrl,
        },
      };
    }),
  );

  return requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ── Connection map (who am I already talking to?) ──────────────────────── */

interface RawConnectionRow {
  id: string;
  accepted?: boolean | null;
  userID?: string | null;
}

/**
 * Both directions of the connection map, read through their GSIs.
 *
 * These used to be `listConnections` with the user id in the `filter`. That is a
 * table **scan**: DynamoDB applies `limit` before the filter, so a large table
 * returns a page of mostly-unrelated rows and the caller's own connections can
 * fall outside it entirely. The visible symptom was someone you were already
 * connected to still showing a live Connect button.
 *
 * `byRemitentId` / `byRecipientId` take the id as the index key, so every row
 * returned belongs to this user and a small bounded page is enough. `ignored` and
 * the existence check stay as filters — cheap, because they now apply to an
 * already-narrow result set.
 */
const CONNECTIONS_RECEIVED = (userId: string, nextToken?: string) => /* GraphQL */ `
  query connectionsReceive {
    byRecipientId(
      connectionRecipientId: "${safeId(userId)}",
      filter: {
        connectionRemitentId: {attributeExists: true},
        ignored: {ne: true}
      },
      limit: ${CONNECTION_PAGE_SIZE}${nextToken ? `, nextToken: "${nextToken}"` : ""}
    ) {
      items { id accepted userID: connectionRemitentId }
      nextToken
    }
  }
`;

const CONNECTIONS_SENT = (userId: string, nextToken?: string) => /* GraphQL */ `
  query connectionsSend {
    byRemitentId(
      connectionRemitentId: "${safeId(userId)}",
      filter: {
        connectionRecipientId: {attributeExists: true},
        ignored: {ne: true}
      },
      limit: ${CONNECTION_PAGE_SIZE}${nextToken ? `, nextToken: "${nextToken}"` : ""}
    ) {
      items { id accepted userID: connectionRecipientId }
      nextToken
    }
  }
`;

const BLOCKED_USERS = (userId: string, nextToken?: string) => /* GraphQL */ `
  query blockedUsers {
    listBlockedUsers: listConnections(filter: {
      connectionRemitentId: {eq: "${safeId(userId)}"},
      blocked: {eq: true}
    }, limit: ${RESULT_LIMIT}${nextToken ? `, nextToken: "${nextToken}"` : ""}) {
      items { userID: blockedUser }
      nextToken
    }
  }
`;

async function collectConnections(
  build: (nextToken?: string) => string,
  dataKey: string,
): Promise<RawConnectionRow[]> {
  const all: RawConnectionRow[] = [];
  let nextToken: string | undefined;
  let pages = 0;

  try {
    do {
      const { data } = await executeAppSyncGraphql<
        Record<string, { items?: RawConnectionRow[] | null; nextToken?: string | null } | null>
      >({ query: build(nextToken), variables: {}, authWithUserPool: true });

      const page = data?.[dataKey];
      all.push(...(page?.items ?? []));
      nextToken = page?.nextToken ?? undefined;
      pages += 1;
    } while (nextToken && pages < MAX_PAGES);
  } catch (err) {
    console.error(`[buddies] ${dataKey} query failed:`, err);
  }

  return all;
}

/**
 * Every person the user has an open relationship with, in both directions,
 * mapped to `pending` or `connected`. Discovery subtracts these so you never
 * see someone you already invited, and the profile page uses it to decide
 * between the Connect / Pending / Connected buttons.
 */
export async function fetchConnectionMap(userId: string): Promise<ConnectionMap> {
  const [received, sent] = await Promise.all([
    collectConnections((t) => CONNECTIONS_RECEIVED(userId, t), "byRecipientId"),
    collectConnections((t) => CONNECTIONS_SENT(userId, t), "byRemitentId"),
  ]);

  const map: ConnectionMap = {};
  for (const row of [...received, ...sent]) {
    if (!row?.userID) continue;
    map[row.userID] = {
      status: row.accepted ? "connected" : "pending",
      connectionId: row.id,
    };
  }
  return map;
}

export async function fetchBlockedUserIds(userId: string): Promise<string[]> {
  const rows = await collectConnections(
    (t) => BLOCKED_USERS(userId, t),
    "listBlockedUsers",
  );
  return [...new Set(rows.map((r) => r.userID).filter((v): v is string => !!v))];
}

/**
 * Is either side of this pair blocking the other?
 *
 * `fetchBlockedUserIds` only answers "who have *I* blocked" — it filters on
 * `connectionRemitentId: me`. That misses the direction that matters just as
 * much: someone who blocked *you* would still get a live Connect button on their
 * profile. Mobile asks the pair question with an `or` over both directions
 * (`cancerbuddyapp/src/graphql/queries/user/user-connections.ts:9-21`), and this
 * is that query.
 */
const BLOCKED_PAIR = (viewerId: string, otherId: string) => /* GraphQL */ `
  query blockedPair {
    listBlockedUsers: listConnections(filter: {
      or: [
        { connectionRemitentId: {eq: "${safeId(viewerId)}"}, connectionRecipientId: {eq: "${safeId(otherId)}"}, blocked: {eq: true} },
        { connectionRemitentId: {eq: "${safeId(otherId)}"}, connectionRecipientId: {eq: "${safeId(viewerId)}"}, blocked: {eq: true} }
      ]
    }, limit: 1) {
      items { id }
    }
  }
`;

export async function isPairBlocked(
  viewerId: string,
  otherId: string,
): Promise<boolean> {
  if (!viewerId || !otherId || viewerId === otherId) return false;
  try {
    const { data } = await executeAppSyncGraphql<{
      listBlockedUsers: { items?: { id?: string }[] | null } | null;
    }>({
      query: BLOCKED_PAIR(viewerId, otherId),
      variables: {},
      authWithUserPool: true,
    });
    return (data?.listBlockedUsers?.items?.length ?? 0) > 0;
  } catch (err) {
    console.error("[buddies] blocked-pair check failed:", err);
    // Fail open rather than hiding a profile on a transient network error; the
    // action bar's other guards still apply.
    return false;
  }
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

/**
 * Every connection mutation selects **both** participant ids, and that is
 * load-bearing rather than tidiness.
 *
 * AppSync evaluates a subscription's `filter` against the fields the *mutation*
 * returned, not against the stored row. `updateConnection` used to return only
 * `{id, accepted}`, so the `or: [remitent, recipient]` filter on
 * `onUpdateConnection` could never match and the subscription would have been
 * silently dead. Mobile documents the same trap at
 * `cancerbuddyapp/src/graphql/suscriptions/connections.ts:13-16`.
 */
const CREATE_CONNECTION = /* GraphQL */ `
  mutation createConnectionUser($input: CreateConnectionInput!) {
    createConnection(input: $input) {
      id
      connectionRecipientId
      connectionRemitentId
    }
  }
`;

const ACCEPT_CONNECTION = /* GraphQL */ `
  mutation acceptConnectionUser($input: UpdateConnectionInput!) {
    updateConnection(input: $input) {
      id
      accepted
      ignored
      connectionRecipientId
      connectionRemitentId
    }
  }
`;

const DELETE_CONNECTION = /* GraphQL */ `
  mutation removeConnectionUser($input: DeleteConnectionInput!) {
    deleteConnection(input: $input) {
      id
      connectionRecipientId
      connectionRemitentId
    }
  }
`;

/** Sends a buddy request. Returns the new connection (and future channel) id. */
/**
 * An open (unaccepted, unignored) request already sent from one user to another.
 *
 * Read through `byRemitentId` rather than a filtered `listConnections`, for the
 * same reason the connection map is — a scan can miss the row and then the guard
 * would wave a duplicate through.
 */
const EXISTING_PENDING_REQUEST = (
  fromUserId: string,
  toUserId: string,
  nextToken?: string,
) => /* GraphQL */ `
  query userHasSentAnInvitation {
    byRemitentId(
      connectionRemitentId: "${safeId(fromUserId)}",
      filter: {
        connectionRecipientId: {eq: "${safeId(toUserId)}"},
        ignored: {eq: false},
        accepted: {eq: false}
      },
      limit: ${CONNECTION_PAGE_SIZE}${nextToken ? `, nextToken: "${nextToken}"` : ""}
    ) {
      items { id }
      nextToken
    }
  }
`;

export async function findExistingPendingRequest(
  fromUserId: string,
  toUserId: string,
): Promise<string | null> {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return null;
  const rows = await collectConnections(
    (t) => EXISTING_PENDING_REQUEST(fromUserId, toUserId, t),
    "byRemitentId",
  );
  return rows.find((r) => r?.id)?.id ?? null;
}

/**
 * Sends a buddy request, or returns the existing one.
 *
 * The pre-flight check exists because two rapid taps, or a retry after a dropped
 * response, otherwise create a second pending row for the same pair — and nothing
 * in either client cleans that up. Mobile has the same guard
 * (`UserInfoConnect.tsx:166-168`) but only on a screen nothing navigates to, so
 * the shipped mobile app has this hole too. Built on web as a data-integrity fix
 * rather than a parity gap, at the product owner's direction.
 */
export async function createConnectionRequest(params: {
  fromUserId: string;
  toUserId: string;
}): Promise<string> {
  const existing = await findExistingPendingRequest(
    params.fromUserId,
    params.toUserId,
  );
  if (existing) return existing;

  const { data } = await executeAppSyncGraphql<{
    createConnection: { id: string } | null;
  }>({
    query: CREATE_CONNECTION,
    variables: {
      input: {
        connectionRemitentId: params.fromUserId,
        connectionRecipientId: params.toUserId,
        ignored: false,
        accepted: false,
      },
    },
    authWithUserPool: true,
  });

  const id = data?.createConnection?.id;
  if (!id) throw new Error("Connection was not created.");
  return id;
}

export async function acceptConnection(connectionId: string): Promise<void> {
  await executeAppSyncGraphql({
    query: ACCEPT_CONNECTION,
    variables: { input: { id: connectionId, accepted: true } },
    authWithUserPool: true,
  });
}

/** Used for both "Maybe later" on a request and cancelling one you sent. */
export async function deleteConnection(connectionId: string): Promise<void> {
  await executeAppSyncGraphql({
    query: DELETE_CONNECTION,
    variables: { input: { id: connectionId } },
    authWithUserPool: true,
  });
}

/**
 * Hides someone from your discovery results for good. Mobile calls this from
 * the swipe-to-delete action on a recommendation; it writes a `blocked`
 * Connection row rather than deleting anything.
 */
export async function hideUserFromDiscovery(params: {
  currentUserId: string;
  hiddenUserId: string;
}): Promise<void> {
  await executeAppSyncGraphql({
    query: CREATE_CONNECTION,
    variables: {
      input: {
        connectionRemitentId: params.currentUserId,
        blockedUser: params.hiddenUserId,
        blocked: true,
      },
    },
    authWithUserPool: true,
  });
}
