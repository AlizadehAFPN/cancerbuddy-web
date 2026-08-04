/**
 * Journal entries.
 *
 * An entry is a note the user writes for themselves, optionally shared on their
 * public profile via `visibleToPublic`.
 *
 * **Two things to know before changing this.**
 *
 * 1. Privacy here is a *query filter*, not an access control — reading someone
 *    else's journal simply adds `visibleToPublic: {eq: true}` to the same
 *    `listJournals` field. Whether the deployed AppSync schema also enforces an
 *    owner rule is not visible from either client repo. This module therefore
 *    never treats the filter as a boundary, and the web never queries another
 *    user's journal without it.
 * 2. Mobile's create/update-text path sends `userJournalId` while its visibility
 *    toggle sends `journalUserId`. Only one of those can be the real foreign
 *    key. The toggle here sends neither — just `id` and `visibleToPublic`,
 *    which is sufficient and can't be the wrong name.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";

export interface JournalEntry {
  id: string;
  text: string;
  createdAt: string;
  visibleToPublic: boolean;
}

const MAX_PAGES = 20;

const LIST_MY_JOURNAL = /* GraphQL */ `
  query getMyJournal($id: ID!, $token: String) {
    listJournals(
      filter: { userJournalId: { eq: $id } }
      limit: 1000000
      nextToken: $token
    ) {
      items {
        id
        text
        createdAt
        visibleToPublic
      }
      nextToken
    }
  }
`;

const CREATE_ENTRY = /* GraphQL */ `
  mutation createJournalEntry($input: CreateJournalInput!) {
    createJournal(input: $input) {
      id
    }
  }
`;

const UPDATE_ENTRY = /* GraphQL */ `
  mutation updateJournalEntry($input: UpdateJournalInput!) {
    updateJournal(input: $input) {
      id
    }
  }
`;

const DELETE_ENTRY = /* GraphQL */ `
  mutation deleteJournalEntry($input: DeleteJournalInput!) {
    deleteJournal(input: $input) {
      id
    }
  }
`;

/**
 * Every entry the user has written, newest first.
 *
 * Paged to exhaustion — mobile's public-journal query has no pagination at all,
 * so a prolific journaller's older public entries silently vanish there. The
 * web reads them all rather than reproducing that.
 */
export async function fetchMyJournal(userId: string): Promise<JournalEntry[]> {
  const entries: JournalEntry[] = [];
  let token: string | undefined;
  let pages = 0;

  do {
    const { data } = await executeAppSyncGraphql<{
      listJournals: {
        items?: JournalEntry[] | null;
        nextToken?: string | null;
      } | null;
    }>({
      query: LIST_MY_JOURNAL,
      variables: { id: userId, token: token ?? null },
      authWithUserPool: true,
    });

    entries.push(...(data?.listJournals?.items ?? []).filter((e) => e?.id));
    token = data?.listJournals?.nextToken ?? undefined;
    pages += 1;
  } while (token && pages < MAX_PAGES);

  return entries.sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  );
}

const LIST_PUBLIC_JOURNAL = /* GraphQL */ `
  query getPublicJournal($id: ID!, $token: String) {
    listJournals(
      filter: { userJournalId: { eq: $id }, visibleToPublic: { eq: true } }
      limit: 1000000
      nextToken: $token
    ) {
      items {
        id
        text
        createdAt
        visibleToPublic
      }
      nextToken
    }
  }
`;

/**
 * Another member's public journal entries, newest first.
 *
 * The `visibleToPublic` filter is always present — see the module note on why
 * it is treated as a display rule the web must honour rather than as the
 * boundary that protects private entries.
 *
 * Mobile's equivalent query has no `limit` or pagination, so a prolific
 * journaller's older public entries silently disappear there. This pages
 * properly, which means the web can show entries the phone doesn't.
 */
export async function fetchPublicJournal(
  userId: string,
): Promise<JournalEntry[]> {
  const entries: JournalEntry[] = [];
  let token: string | undefined;
  let pages = 0;

  do {
    const { data } = await executeAppSyncGraphql<{
      listJournals: {
        items?: JournalEntry[] | null;
        nextToken?: string | null;
      } | null;
    }>({
      query: LIST_PUBLIC_JOURNAL,
      variables: { id: userId, token: token ?? null },
      authWithUserPool: true,
    });

    entries.push(...(data?.listJournals?.items ?? []).filter((e) => e?.id));
    token = data?.listJournals?.nextToken ?? undefined;
    pages += 1;
  } while (token && pages < MAX_PAGES);

  return entries.sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  );
}

export async function createJournalEntry(params: {
  userId: string;
  text: string;
}): Promise<string> {
  const { data } = await executeAppSyncGraphql<{
    createJournal: { id: string } | null;
  }>({
    query: CREATE_ENTRY,
    variables: {
      input: { text: params.text, userJournalId: params.userId },
    },
    authWithUserPool: true,
  });

  const id = data?.createJournal?.id;
  if (!id) throw new Error("createJournal returned no id");
  return id;
}

export async function updateJournalText(params: {
  userId: string;
  entryId: string;
  text: string;
}): Promise<void> {
  await executeAppSyncGraphql({
    query: UPDATE_ENTRY,
    variables: {
      input: {
        id: params.entryId,
        text: params.text,
        userJournalId: params.userId,
      },
    },
    authWithUserPool: true,
  });
}

/** Toggles whether an entry appears on the user's public profile. */
export async function setJournalVisibility(params: {
  entryId: string;
  visibleToPublic: boolean;
}): Promise<void> {
  await executeAppSyncGraphql({
    query: UPDATE_ENTRY,
    variables: {
      input: {
        id: params.entryId,
        visibleToPublic: params.visibleToPublic,
      },
    },
    authWithUserPool: true,
  });
}

export async function deleteJournalEntry(entryId: string): Promise<void> {
  await executeAppSyncGraphql({
    query: DELETE_ENTRY,
    variables: { input: { id: entryId } },
    authWithUserPool: true,
  });
}
