/**
 * Syncing many-to-many profile fields (languages, interests, diagnoses…).
 *
 * These live in join tables, so saving a selection is a diff, not an update:
 * rows the user added get created, rows they removed get deleted, and rows that
 * were already there are left alone. Mobile does this in
 * `utils/manyToManyMutations.ts`; the important detail carried over is that a
 * **delete targets the join-row id**, while a **create targets the catalogue
 * id** — mixing the two silently deletes nothing.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";

/** An existing join row: its own id plus the catalogue entry it points at. */
export interface JoinRow {
  id: string;
  targetId: string;
}

export interface JoinTableConfig {
  /** e.g. `createLanguageUser` */
  createMutation: string;
  /** e.g. `deleteLanguageUser` */
  deleteMutation: string;
  /** Input type name, e.g. `CreateLanguageUserInput`. */
  createInputType: string;
  deleteInputType: string;
  /** Field on the create input that carries the catalogue id, e.g. `languageID`. */
  targetKey: string;
  /** Field carrying the owning user, e.g. `userID`. */
  ownerKey?: string;
}

function createDoc(config: JoinTableConfig): string {
  return /* GraphQL */ `
    mutation createJoinRow($input: ${config.createInputType}!) {
      ${config.createMutation}(input: $input) {
        id
      }
    }
  `;
}

function deleteDoc(config: JoinTableConfig): string {
  return /* GraphQL */ `
    mutation deleteJoinRow($input: ${config.deleteInputType}!) {
      ${config.deleteMutation}(input: $input) {
        id
      }
    }
  `;
}

export interface SyncResult {
  created: number;
  deleted: number;
  failures: number;
}

/**
 * Brings a join table in line with `selectedIds`.
 *
 * Failures are counted rather than thrown: one catalogue row failing to attach
 * shouldn't discard the rest of a save the user already committed to. The count
 * lets the caller warn instead of claiming success.
 */
export async function syncJoinTable(params: {
  userId: string;
  existing: JoinRow[];
  selectedIds: string[];
  config: JoinTableConfig;
}): Promise<SyncResult> {
  const { userId, existing, selectedIds, config } = params;

  const selected = new Set(selectedIds.filter(Boolean));
  const existingByTarget = new Map(existing.map((row) => [row.targetId, row]));

  const toCreate = [...selected].filter((id) => !existingByTarget.has(id));
  const toDelete = existing.filter((row) => !selected.has(row.targetId));

  let failures = 0;

  await Promise.all(
    toCreate.map(async (targetId) => {
      try {
        await executeAppSyncGraphql({
          query: createDoc(config),
          variables: {
            input: {
              [config.ownerKey ?? "userID"]: userId,
              [config.targetKey]: targetId,
            },
          },
          authWithUserPool: true,
        });
      } catch (err) {
        failures += 1;
        console.error(`[profile] ${config.createMutation} failed:`, err);
      }
    }),
  );

  await Promise.all(
    toDelete.map(async (row) => {
      try {
        await executeAppSyncGraphql({
          query: deleteDoc(config),
          // Deletes address the join row itself, never the catalogue entry.
          variables: { input: { id: row.id } },
          authWithUserPool: true,
        });
      } catch (err) {
        failures += 1;
        console.error(`[profile] ${config.deleteMutation} failed:`, err);
      }
    }),
  );

  return { created: toCreate.length, deleted: toDelete.length, failures };
}

/* ── Configurations, mirroring the mobile mutations ─────────────────────── */

export const LANGUAGES_JOIN: JoinTableConfig = {
  createMutation: "createLanguageUser",
  deleteMutation: "deleteLanguageUser",
  createInputType: "CreateLanguageUserInput",
  deleteInputType: "DeleteLanguageUserInput",
  targetKey: "languageID",
};

export const INTERESTS_JOIN: JoinTableConfig = {
  createMutation: "createInterestUser",
  deleteMutation: "deleteInterestUser",
  createInputType: "CreateInterestUserInput",
  deleteInputType: "DeleteInterestUserInput",
  targetKey: "interestID",
};
