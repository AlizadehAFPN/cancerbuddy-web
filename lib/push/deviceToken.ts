/**
 * Registering the browser's FCM token in `UserDeviceToken`.
 *
 * ## Read this before turning it on
 *
 * **Writing is disabled**, and must stay disabled until the backend work below
 * lands. `NEXT_PUBLIC_PUSH_TOKEN_REGISTRATION` is the switch and it defaults
 * off; with it off, nothing in this file issues a mutation. That is deliberate,
 * not unfinished — see `docs/PUSH.md` § "Why the web token is not registered".
 *
 * The short version: a web token in that table today cannot deliver a single
 * push, and can only do harm.
 *
 * ### What the schema actually is (introspected 2026-08-08, live endpoint)
 *
 * ```
 * type UserDeviceToken { token: String!  userID: ID!  createdAt  updatedAt }
 * CreateUserDeviceTokenInput { token: String!  userID: ID! }
 * DeleteUserDeviceTokenInput { token: String! }
 * ```
 *
 * Four fields. **No platform, provider or device column** — so nothing reading
 * the table can tell a browser token from a phone one.
 *
 * ### Why that matters
 *
 * FCM tokens are scoped to the Firebase project that minted them. Web push runs
 * on this app's **own** Firebase project because nobody on the team can open the
 * mobile one (`docs/PUSH.md`). Whatever sends these notifications holds the
 * *mobile* project's credentials, so a web token handed to it is answered by FCM
 * with `SENDER_ID_MISMATCH`. Registering it therefore delivers **zero** pushes
 * while adding a token that is guaranteed to fail.
 *
 * ### Why it cannot hurt the mobile app, and where the one real risk is
 *
 * Verified rather than assumed:
 *
 *  - The table's primary key is the **token string** (`DeleteUserDeviceTokenInput`
 *    takes `token` alone). One token, one row.
 *  - A web token and a phone token are different strings from different Firebase
 *    projects, so they can never collide.
 *  - Mobile's dedupe deletes rows matching `token == mine AND userID != me`
 *    (`cancerbuddyapp/src/context/auth/useAuth.ts:82-115`), and its logout
 *    deletes `token == mine AND userID == me` (`:161-200`). Neither can select a
 *    web row, and a web write cannot select a phone row.
 *
 * So no other member is reachable, and no phone row is touched. The residual
 * risk is narrow and self-inflicted: if the sender iterates a user's tokens and
 * aborts on the first failure, **that one member** could stop receiving push on
 * their own phone. Nobody else. Empirically 19 of the first 1000 rows already
 * belong to accounts holding 2–5 tokens (mobile never removes its own stale
 * ones), and mobile push works today — so the sender evidently tolerates dead
 * tokens. "Evidently" is not "provably", which is why this stays off.
 *
 * ### What unblocks it
 *
 *  1. Add a `platform` column to `UserDeviceToken` (`ios` | `android` | `web`).
 *  2. Give the sender this project's Firebase service account as a second
 *     credential.
 *  3. Have the sender pick credentials by `platform` — and skip, rather than
 *     abort on, a token it cannot send to.
 *
 * Then set the env var. This file already writes the row, dedupes it and removes
 * it on sign-out; only step 1's extra field needs adding to `REGISTER`.
 *
 * ### One more thing to check first
 *
 * `USERS_LAMBDA`'s `login` / `logout` verbs may own this row themselves — mobile
 * sends its FCM token to `login` (`signup.ts:8-38`) *and* writes the row from the
 * client. Read that Lambda before enabling this, or the two will double-write.
 * Web's `runLoginBootstrap` already sends `token: undefined`, so it cannot be
 * creating a row today; whether it *deletes* on an undefined token is the
 * question to answer.
 */

import { API, graphqlOperation } from "aws-amplify";

/* ── Queries, byte-identical to mobile's ───────────────────────────────── */

/** `token == mine AND userID != me` — rows this token holds under other accounts. */
const FIND_TOKEN_ON_OTHER_ACCOUNTS = /* GraphQL */ `
  query findTokenOnOtherAccounts($token: String!, $userID: ID!) {
    listUserDeviceTokens(
      filter: { token: { eq: $token }, userID: { ne: $userID } }
      limit: 100
    ) {
      items {
        token
        userID
      }
    }
  }
`;

/** `token == mine AND userID == me` — is it already registered to this account? */
const FIND_MY_TOKEN = /* GraphQL */ `
  query findMyToken($token: String!, $userID: ID!) {
    listUserDeviceTokens(
      filter: { token: { eq: $token }, userID: { eq: $userID } }
      limit: 1
    ) {
      items {
        token
      }
    }
  }
`;

const REGISTER = /* GraphQL */ `
  mutation createDeviceToken($input: CreateUserDeviceTokenInput!) {
    createUserDeviceToken(input: $input) {
      userID
      token
    }
  }
`;

const UNREGISTER = /* GraphQL */ `
  mutation deleteDeviceToken($input: DeleteUserDeviceTokenInput!) {
    deleteUserDeviceToken(input: $input) {
      token
    }
  }
`;

/* ── The pure part ─────────────────────────────────────────────────────── */

export interface DeviceTokenRow {
  token: string;
  userID: string;
}

export interface TokenReconciliation {
  /** Rows to delete, each keyed by token — the table's actual primary key. */
  deletes: { token: string }[];
  /** The row to create, or null when it is already there. */
  create: { token: string; userID: string } | null;
}

/**
 * What has to happen for `token` to belong to `userID` and nobody else.
 *
 * Pure, and the reason this is a separate function: it is the piece that
 * *deletes*, so it is the piece worth being able to reason about exhaustively.
 * It only ever emits deletes for rows it was handed — rows the caller found by
 * querying for **this exact token** — so it can never propose deleting a token
 * it has not seen, which is what makes a phone row unreachable from here.
 *
 * Mobile's equivalent is spread across `createOrUpdateFCMToken`
 * (`useAuth.ts:80-129`) with the same three steps and no test.
 */
export function reconcileDeviceToken(params: {
  token: string;
  userID: string;
  /** Rows holding this token under *other* accounts. */
  foreignRows: readonly DeviceTokenRow[];
  /** Whether this token is already registered to this account. */
  alreadyMine: boolean;
}): TokenReconciliation {
  const { token, userID, foreignRows, alreadyMine } = params;

  const deletes = foreignRows
    /* Belt and braces: a filter the server got wrong must not become a delete
       of somebody's live row. Only this exact token is ever removable. */
    .filter((row) => row.token === token && row.userID !== userID)
    .map((row) => ({ token: row.token }));

  return {
    deletes,
    create: alreadyMine ? null : { token, userID },
  };
}

/* ── The switch ────────────────────────────────────────────────────────── */

/**
 * Off unless explicitly enabled. Read at call time rather than module load so a
 * test can flip it without re-importing.
 */
export function tokenRegistrationEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PUSH_TOKEN_REGISTRATION === "true";
}

/* ── The effectful part ────────────────────────────────────────────────── */

async function run<T>(query: string, variables: Record<string, unknown>) {
  return (await API.graphql(graphqlOperation(query, variables))) as {
    data?: T;
  };
}

/**
 * Make this browser's token belong to this account.
 *
 * @returns what it did, so a caller (or a test) can assert on it. `skipped`
 * means the switch is off — which is the state this ships in.
 */
export async function registerDeviceToken(params: {
  token: string;
  userID: string;
}): Promise<
  | { status: "skipped"; reason: "disabled" | "incomplete" }
  | { status: "registered"; deleted: number; created: boolean }
  | { status: "failed" }
> {
  const token = params.token?.trim();
  const userID = params.userID?.trim();
  if (!token || !userID) return { status: "skipped", reason: "incomplete" };
  if (!tokenRegistrationEnabled()) {
    return { status: "skipped", reason: "disabled" };
  }

  try {
    const [foreign, mine] = await Promise.all([
      run<{ listUserDeviceTokens: { items: DeviceTokenRow[] } }>(
        FIND_TOKEN_ON_OTHER_ACCOUNTS,
        { token, userID },
      ),
      run<{ listUserDeviceTokens: { items: { token: string }[] } }>(
        FIND_MY_TOKEN,
        { token, userID },
      ),
    ]);

    const plan = reconcileDeviceToken({
      token,
      userID,
      foreignRows: foreign.data?.listUserDeviceTokens.items ?? [],
      alreadyMine: (mine.data?.listUserDeviceTokens.items ?? []).length > 0,
    });

    for (const input of plan.deletes) {
      await run(UNREGISTER, { input });
    }
    if (plan.create) {
      await run(REGISTER, { input: plan.create });
    }

    return {
      status: "registered",
      deleted: plan.deletes.length,
      created: Boolean(plan.create),
    };
  } catch (err) {
    console.error("[push] device token registration failed:", err);
    return { status: "failed" };
  }
}

/**
 * Drop this browser's row on sign-out, so a shared computer stops receiving the
 * previous member's notifications. Scoped to this exact token, as mobile's
 * logout is (`useAuth.ts:161-200`).
 */
export async function unregisterDeviceToken(params: {
  token: string;
  userID: string;
}): Promise<{ status: "skipped" | "removed" | "absent" | "failed" }> {
  const token = params.token?.trim();
  const userID = params.userID?.trim();
  if (!token || !userID) return { status: "skipped" };
  if (!tokenRegistrationEnabled()) return { status: "skipped" };

  try {
    const mine = await run<{
      listUserDeviceTokens: { items: { token: string }[] };
    }>(FIND_MY_TOKEN, { token, userID });

    const row = mine.data?.listUserDeviceTokens.items?.[0];
    if (!row) return { status: "absent" };

    await run(UNREGISTER, { input: { token: row.token } });
    return { status: "removed" };
  } catch (err) {
    console.error("[push] device token removal failed:", err);
    return { status: "failed" };
  }
}
