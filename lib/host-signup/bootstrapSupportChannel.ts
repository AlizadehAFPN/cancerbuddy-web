/**
 * Mirrors mobile `HomeBuddies` → `createSupportChannel` when
 * `AsyncStorage.pendingSupportChannel === 'true'` after enrollment (`AllSetNotification`).
 *
 * Flow: `raiseUserLambda(createSupportConnection)` → AppSync `createConnection` +
 * `updateConnection` (accept) → `raiseUserLambda(supportMessage)` (same fields
 * as `cancerbuddyapp` `HomeBuddies`). No Stream `channel.watch` in the browser.
 *
 * **Welcome message in GetStream:** The USERS `supportMessage` Lambda sends the
 * Ava text into `messaging` + `channelID`. The Lambda should upsert the channel
 * and members before `sendMessage` when the channel is not created yet (web);
 * mobile often creates the channel first via `client.channel(...).watch()`.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";

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
  mutation AcceptConnectionUser($input: UpdateConnectionInput!) {
    updateConnection(input: $input) {
      id
      accepted
    }
  }
`;

function usersLambdaName(): string {
  const name = process.env.NEXT_PUBLIC_USERS_LAMBDA?.trim();
  if (!name) throw new Error("NEXT_PUBLIC_USERS_LAMBDA is not configured.");
  return name;
}

type SupportConnectionRow = { supportId?: string };

type SupportConnectionLambdaEnvelope = {
  statusCode?: number;
  body?: unknown;
  errorMessage?: string;
  listConnections?: SupportConnectionRow[];
};

function unwrapJsonString(value: unknown, maxDepth: number): unknown {
  let current: unknown = value;
  for (let i = 0; i < maxDepth; i++) {
    if (typeof current !== "string") break;
    const s = current.trim();
    if (!s) break;
    try {
      current = JSON.parse(s) as unknown;
    } catch {
      break;
    }
  }
  return current;
}

function readListConnectionsFromObject(record: unknown): SupportConnectionRow[] | undefined {
  const unwrapped = unwrapJsonString(record, 4);
  if (!unwrapped || typeof unwrapped !== "object") return undefined;
  const o = unwrapped as Record<string, unknown>;

  const tryRows = (raw: unknown): SupportConnectionRow[] | undefined => {
    if (!Array.isArray(raw) || raw.length === 0) return undefined;
    const rows: SupportConnectionRow[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const idRaw =
        (typeof r.supportId === "string" && r.supportId) ||
        (typeof r.supportID === "string" && r.supportID) ||
        (typeof r.userID === "string" && r.userID) ||
        (typeof r.userId === "string" && r.userId) ||
        "";
      const id = idRaw.trim();
      if (id) rows.push({ supportId: id });
    }
    return rows.length ? rows : undefined;
  };

  const direct = tryRows(o.listConnections);
  if (direct) return direct;

  if (o.data && typeof o.data === "object") {
    const nested = tryRows((o.data as Record<string, unknown>).listConnections);
    if (nested) return nested;
  }

  return undefined;
}

/**
 * API Gateway–style Lambdas often set `body` to a **JSON string** (sometimes
 * double-encoded). Some deployments omit top-level `statusCode` and only put
 * `{ listConnections }` inside `body`. Normalize so we don't skip AppSync
 * `createConnection`.
 */
function extractListConnections(
  parsed: SupportConnectionLambdaEnvelope,
): SupportConnectionRow[] | undefined {
  const fromRoot = readListConnectionsFromObject(parsed);
  if (fromRoot?.length) return fromRoot;

  const fromBody = readListConnectionsFromObject(parsed.body);
  if (fromBody?.length) return fromBody;

  return undefined;
}
/**
 * @returns `true` if a support channel was fully bootstrapped, `false` if the
 *         backend returned success but nothing to wire (same as mobile early exits).
 */
export async function bootstrapSupportChannelAfterEnrollment(options: {
  cognitoUserId: string;
}): Promise<boolean> {
  const userId = options.cognitoUserId.trim();
  if (!userId) return false;

  const raw = await raiseUserLambda(
    LambdaPayloadType.CREATE_SUPPORT_CONNECTION,
    usersLambdaName(),
    { userID: userId },
  );

  let parsed: SupportConnectionLambdaEnvelope;
  try {
    parsed = JSON.parse(raw) as SupportConnectionLambdaEnvelope;
  } catch {
    throw new Error("Support connection service returned invalid JSON.");
  }

  if (
    parsed.statusCode !== undefined &&
    parsed.statusCode !== null &&
    Number(parsed.statusCode) !== 200
  ) {
    const hint = parsed.errorMessage?.trim();
    throw new Error(
      hint
        ? `createSupportConnection failed: ${hint}`
        : "createSupportConnection did not return success.",
    );
  }

  const list = extractListConnections(parsed);
  if (!list?.length) return false;

  const idSupportUser = list[0]?.supportId?.trim();
  if (!idSupportUser) return false;

  const created = await executeAppSyncGraphql<{
    createConnection?: { id: string } | null;
    createConnectionUser?: { id: string } | null;
  }>({
    query: CREATE_CONNECTION,
    variables: {
      input: {
        connectionRemitentId: idSupportUser,
        connectionRecipientId: userId,
        ignored: false,
        accepted: false,
      },
    },
    authWithUserPool: true,
  });

  const connectionId =
    created.data?.createConnection?.id ??
    created.data?.createConnectionUser?.id;
  if (!connectionId) {
    throw new Error("createConnection did not return an id.");
  }

  const accepted = await executeAppSyncGraphql<{
    updateConnection?: { id: string } | null;
    acceptConnection?: { id: string } | null;
    AcceptConnection?: { id: string } | null;
  }>({
    query: ACCEPT_CONNECTION,
    variables: { input: { id: connectionId, accepted: true } },
    authWithUserPool: true,
  });

  const channelId =
    accepted.data?.updateConnection?.id ??
    accepted.data?.acceptConnection?.id ??
    accepted.data?.AcceptConnection?.id;
  if (!channelId) {
    throw new Error("Accept connection did not return an id.");
  }

  const messageRaw = await raiseUserLambda(
    LambdaPayloadType.CREATE_SUPPORT_MESSAGE,
    usersLambdaName(),
    {
      userId,
      channelID: channelId,
      type: LambdaPayloadType.CREATE_SUPPORT_MESSAGE,
    },
  );

  const trimmed = messageRaw.trim();
  if (trimmed) {
    let messageParsed: { statusCode?: number; errorMessage?: string };
    try {
      messageParsed = JSON.parse(trimmed) as typeof messageParsed;
    } catch {
      throw new Error("Support welcome message service returned invalid JSON.");
    }

    /* Lambda returns `new Ok(...)` as 200 or `new NoContent()` as 204 — both
       are valid outcomes (mobile treats empty body similarly). */
    const sc = messageParsed.statusCode;
    if (sc !== undefined && (sc < 200 || sc >= 300)) {
      const hint = messageParsed.errorMessage?.trim();
      throw new Error(
        hint
          ? `supportMessage failed: ${hint}`
          : `supportMessage did not return success (status ${sc}).`,
      );
    }
  }

  return true;
}
