/**
 * The two writes behind a status change.
 *
 * Separated from `changeStatus.ts` so the rules stay pure and testable and the
 * mutations stay in one small file that is easy to audit — both of these change
 * what a mobile user sees about themselves.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import {
  buildChangeStatusPayload,
  remissionStampFor,
  type ChangeStatusTarget,
  type ChangeStatusValues,
} from "@/lib/account/changeStatus";

const UPDATE_USER_TYPE = /* GraphQL */ `
  mutation updateUserStatus($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
      userType
      inRemissionSince
    }
  }
`;

/**
 * Path A — Patient ↔ Survivor.
 *
 * One mutation. `inRemissionSince` is stamped when becoming a survivor and
 * cleared when leaving remission, which is what mobile writes
 * (`ChangeStatusLayout.tsx:36-45`).
 *
 * The target comes from the member's **selection**, not from their current
 * type: mobile derives it from `useAuth().userType` and only gets away with it
 * because its picker never routes a caregiver here.
 */
export async function applyStatusPathA(input: {
  userId: string;
  next: ChangeStatusTarget;
}): Promise<void> {
  await executeAppSyncGraphql({
    query: UPDATE_USER_TYPE,
    variables: {
      input: {
        id: input.userId,
        userType: input.next,
        inRemissionSince: remissionStampFor(input.next),
      },
    },
    authWithUserPool: true,
  });
}

function usersLambdaName(): string {
  const v = process.env.NEXT_PUBLIC_USERS_LAMBDA?.trim();
  if (!v) throw new Error("NEXT_PUBLIC_USERS_LAMBDA is not set.");
  return v;
}

/**
 * Path B — Patient ↔ Caregiver.
 *
 * The Lambda rewrites the medical join rows as well as the type, which is why
 * the flow collects them again first: a patient's diagnosis and a caregiver's
 * patient's diagnosis are different records.
 */
export async function applyStatusPathB(
  values: ChangeStatusValues,
  next: ChangeStatusTarget,
): Promise<void> {
  const payload = buildChangeStatusPayload(values, next);
  await raiseUserLambda(
    LambdaPayloadType.CHANGE_USER_TYPE,
    usersLambdaName(),
    payload as unknown as Record<string, unknown>,
  );
}
