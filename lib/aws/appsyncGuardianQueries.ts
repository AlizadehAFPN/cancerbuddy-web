/**
 * AppSync operations for guardian consent verification.
 *
 * These calls are made before the user has completed Cognito sign-up, so they
 * use a direct API-KEY fetch instead of the standard `executeAppSyncGraphql`
 * helper (which falls back to Cognito tokens when the default auth type is
 * AMAZON_COGNITO_USER_POOLS). Matches the mobile app's `API.graphql` calls in
 * `PrivacyTermsGuardianOTP.tsx`, which also run pre-authentication.
 */

const GET_GUARDIAN_CODE = /* GraphQL */ `
  query getGuardian($id: ID!) {
    getGuardian(id: $id) {
      code
    }
  }
`;

const UPDATE_GUARDIAN_CODE_USED = /* GraphQL */ `
  mutation updateGuardian($input: UpdateGuardianInput!) {
    updateGuardian(input: $input) {
      id
      codeUsed
    }
  }
`;

async function appSyncGuardianFetch<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const endpoint = process.env.NEXT_PUBLIC_AWS_APPSYNC_GRAPHQLENDPOINT;
  const apiKey = process.env.NEXT_PUBLIC_AWS_APPSYNC_API_KEY;
  if (!endpoint) throw new Error("NEXT_PUBLIC_AWS_APPSYNC_GRAPHQLENDPOINT is not configured.");
  if (!apiKey) throw new Error("NEXT_PUBLIC_AWS_APPSYNC_API_KEY is not configured.");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": apiKey,
    },
    credentials: "omit",
    body: JSON.stringify({ query, variables }),
  });

  const body = (await res.json()) as {
    data?: T;
    errors?: { message?: string }[];
  };

  if (body.errors?.length) {
    throw new Error(body.errors[0]?.message ?? "AppSync error");
  }
  if (!res.ok) {
    throw new Error(`AppSync HTTP ${res.status}`);
  }
  return body.data as T;
}

/**
 * Retrieves the numeric OTP code stored on the guardian record.
 * Returns null if the guardian record doesn't exist or an error occurred.
 */
export async function getGuardianCode(guardianId: string): Promise<number | null> {
  try {
    const data = await appSyncGuardianFetch<{
      getGuardian: { code: number } | null;
    }>(GET_GUARDIAN_CODE, { id: guardianId });
    return data.getGuardian?.code ?? null;
  } catch {
    return null;
  }
}

/**
 * Marks the guardian OTP code as used after successful verification.
 * Best-effort — mirrors the mobile app's fire-and-forget pattern.
 */
export async function markGuardianCodeUsed(guardianId: string): Promise<void> {
  try {
    await appSyncGuardianFetch(UPDATE_GUARDIAN_CODE_USED, {
      input: { id: guardianId, codeUsed: true },
    });
  } catch {
    /* best-effort — same as mobile */
  }
}
