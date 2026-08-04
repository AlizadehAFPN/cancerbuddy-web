/**
 * Interests and the "I'm here to…" goal.
 *
 * Interests are a join table diffed on save; the goal is a single foreign key
 * on the user row. Neither has any per-UserType behaviour.
 *
 * Note there is **no cap on interests** — `LIMIT_INTERESTS = 10` in mobile is
 * only the denominator of the completion ring, not a limit the picker enforces.
 * Treating it as a maximum would block selections mobile allows.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { getS3ImageUrl, type S3FileRef } from "@/lib/aws/s3Image";
import {
  INTERESTS_JOIN,
  syncJoinTable,
  type JoinRow,
} from "@/lib/profile/manyToMany";

/* ── Interests ──────────────────────────────────────────────────────────── */

const GET_USER_INTERESTS = /* GraphQL */ `
  query getUserInterests($id: ID!) {
    getUser(id: $id) {
      interests: Interests {
        items {
          id
          interest {
            id
          }
        }
      }
    }
  }
`;

export async function fetchUserInterests(
  userId: string,
): Promise<{ selectedIds: string[]; rows: JoinRow[] }> {
  const { data } = await executeAppSyncGraphql<{
    getUser: {
      interests?: { items?: { id: string; interest?: { id: string } | null }[] };
    } | null;
  }>({
    query: GET_USER_INTERESTS,
    variables: { id: userId },
    authWithUserPool: true,
  });

  const rows: JoinRow[] = (data?.getUser?.interests?.items ?? [])
    .filter((row) => row?.id && row.interest?.id)
    .map((row) => ({ id: row.id, targetId: row.interest!.id }));

  return { selectedIds: rows.map((r) => r.targetId), rows };
}

export async function saveUserInterests(params: {
  userId: string;
  rows: JoinRow[];
  selectedIds: string[];
}): Promise<{ partial: boolean }> {
  const result = await syncJoinTable({
    userId: params.userId,
    existing: params.rows,
    selectedIds: params.selectedIds,
    config: INTERESTS_JOIN,
  });
  return { partial: result.failures > 0 };
}

/* ── Goal ───────────────────────────────────────────────────────────────── */

export interface GoalOption {
  id: string;
  name: string;
  imageUrl?: string;
}

const LIST_GOALS = /* GraphQL */ `
  query listGoals {
    listGoals {
      items {
        value: id
        label: name
        image {
          file {
            key
            region
            bucket
          }
        }
      }
    }
  }
`;

const GET_USER_GOAL = /* GraphQL */ `
  query getUserGoal($id: ID!) {
    getUser(id: $id) {
      userGoalId
    }
  }
`;

const UPDATE_USER_GOAL = /* GraphQL */ `
  mutation updateUserGoal($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
    }
  }
`;

export async function fetchGoalOptions(): Promise<GoalOption[]> {
  const { data } = await executeAppSyncGraphql<{
    listGoals: {
      items?: { value: string; label?: string | null; image?: { file?: S3FileRef | null } | null }[];
    } | null;
  }>({ query: LIST_GOALS, variables: {}, authWithUserPool: true });

  const items = (data?.listGoals?.items ?? []).filter((g) => g?.value);

  return Promise.all(
    items.map(async (g) => ({
      id: g.value,
      name: g.label ?? "",
      imageUrl: await getS3ImageUrl(g.image?.file),
    })),
  );
}

export async function fetchUserGoal(userId: string): Promise<string> {
  const { data } = await executeAppSyncGraphql<{
    getUser: { userGoalId?: string | null } | null;
  }>({ query: GET_USER_GOAL, variables: { id: userId }, authWithUserPool: true });
  return data?.getUser?.userGoalId ?? "";
}

export async function saveUserGoal(
  userId: string,
  goalId: string,
): Promise<boolean> {
  const { data } = await executeAppSyncGraphql<{
    updateUser: { id: string } | null;
  }>({
    query: UPDATE_USER_GOAL,
    variables: { input: { id: userId, userGoalId: goalId || null } },
    authWithUserPool: true,
  });
  return !!data?.updateUser?.id;
}
