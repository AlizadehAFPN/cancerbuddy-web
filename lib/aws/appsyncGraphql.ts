import { API, Auth } from "aws-amplify";
import { ensureAmplifyConfigured } from "@/lib/aws/amplifyConfigure";

function normalizeGraphqlErrors(
  raw: unknown,
): { message?: string; errorType?: string }[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map((e) => {
    if (!e || typeof e !== "object") return {};
    const o = e as Record<string, unknown>;
    return {
      message: typeof o.message === "string" ? o.message : undefined,
      errorType: typeof o.errorType === "string" ? o.errorType : undefined,
    };
  });
}

/** Amplify throws `{ errors }`; axios uses `response.data.errors`. */
function errorsFromAmplifyGraphqlCatch(
  err: unknown,
): { message?: string; errorType?: string }[] | null {
  if (!err || typeof err !== "object") return null;
  const direct = normalizeGraphqlErrors((err as { errors?: unknown }).errors);
  if (direct) return direct;
  const ax = err as { response?: { data?: { errors?: unknown } } };
  const nested = normalizeGraphqlErrors(ax.response?.data?.errors);
  return nested;
}

function isAppSyncUnauthorized(err: unknown): boolean {
  if (
    errorsFromAmplifyGraphqlCatch(err)?.some(
      (e) => e.errorType === "UnauthorizedException",
    )
  ) {
    return true;
  }
  if (err && typeof err === "object") {
    const r = (err as { response?: { status?: number } }).response;
    if (r?.status === 401) return true;
    const s = (err as { status?: number }).status;
    if (s === 401) return true;
  }
  return /401|UnauthorizedException|Unauthorized/i.test(String(err));
}

/**
 * Some AppSync APIs keep **API_KEY** as the default authorizer but still evaluate
 * Cognito on `@aws_cognito_user_pools` resolvers when **both** `x-api-key` and a
 * valid JWT are present (gateway accepts the request, field auth uses the token).
 */
async function appSyncGraphqlFetchWithApiKeyAndJwt<TData>(options: {
  endpoint: string;
  query: string;
  variables: Record<string, unknown>;
  apiKey: string;
  authorization: string;
}): Promise<{ data?: TData }> {
  const res = await fetch(options.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": options.apiKey,
      Authorization: options.authorization,
    },
    credentials: "omit",
    body: JSON.stringify({
      query: options.query,
      variables: options.variables,
    }),
  });

  let body: {
    data?: TData;
    errors?: { message?: string; errorType?: string }[];
  };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    throw new Error(`AppSync returned non-JSON (HTTP ${res.status}).`);
  }

  if (body.errors?.length) {
    const e = body.errors[0];
    throw Object.assign(
      new Error(`${e?.errorType ?? "GraphQLError"}: ${e?.message ?? "Request failed"}`),
      { errors: body.errors, status: res.status },
    );
  }

  if (!res.ok) {
    const msg = body.errors?.[0]?.message ?? res.statusText;
    throw Object.assign(new Error(`AppSync HTTP ${res.status}: ${msg}`), {
      status: res.status,
    });
  }

  return { data: body.data };
}

type GraphqlAuthModeArg =
  | "API_KEY"
  | "AWS_IAM"
  | "OPENID_CONNECT"
  | "AMAZON_COGNITO_USER_POOLS"
  | "AWS_LAMBDA";

async function appSyncGraphqlViaAmplify<TData>(options: {
  query: string;
  variables: Record<string, unknown>;
  authMode: GraphqlAuthModeArg;
  /** When set, merged after pool headers — use ID JWT if AppSync owner uses `sub`. */
  authToken?: string;
}): Promise<{ data?: TData }> {
  try {
    const response = (await API.graphql({
      query: options.query,
      variables: options.variables,
      authMode: options.authMode,
      ...(options.authToken ? { authToken: options.authToken } : {}),
    })) as { data?: TData; errors?: { message?: string; errorType?: string }[] };
    if (response.errors?.length) {
      const e = response.errors[0];
      throw Object.assign(new Error(e?.message ?? "GraphQL error"), {
        errors: response.errors,
      });
    }
    return { data: response.data };
  } catch (err) {
    const parsed = errorsFromAmplifyGraphqlCatch(err);
    if (parsed?.length) {
      const e = parsed[0];
      throw Object.assign(
        new Error(`${e?.errorType ?? "GraphQLError"}: ${e?.message ?? "Request failed"}`),
        { errors: parsed },
      );
    }
    if (err instanceof Error) throw err;
    throw new Error(String(err));
  }
}

/**
 * AppSync HTTP calls with the same auth as `cancerbuddyapp` + Amplify `API.graphql`
 * when no `authMode` is passed: use **default** `aws_appsync_authenticationType` from env.
 *
 * When the API default is `API_KEY`, unauthenticated reads use `x-api-key`.
 * Pass `authWithUserPool: true` for owner-scoped mutations. Tries, in order:
 * 1) **`x-api-key` + Cognito JWT** (common when default auth is `API_KEY` but resolvers
 *    still need the user identity), 2–4) Amplify `API.graphql` user-pool / IAM modes.
 */
export async function executeAppSyncGraphql<TData = unknown>(options: {
  query: string;
  variables: Record<string, unknown>;
  /**
   * Owner-scoped mutations (`createPicture`, `updateUser`, …). See module doc above.
   */
  authWithUserPool?: boolean;
}): Promise<{ data?: TData; errors?: { message?: string; errorType?: string }[] }> {
  const endpoint = process.env.NEXT_PUBLIC_AWS_APPSYNC_GRAPHQLENDPOINT;
  if (!endpoint) {
    throw new Error("NEXT_PUBLIC_AWS_APPSYNC_GRAPHQLENDPOINT is not configured.");
  }

  if (options.authWithUserPool) {
    ensureAmplifyConfigured();
    const session = await Auth.currentSession();
    const idToken = session.getIdToken().getJwtToken();
    const accessToken = session.getAccessToken().getJwtToken();
    if (!idToken?.trim() || !accessToken?.trim()) {
      throw new Error("Missing Cognito tokens — sign in may not have completed.");
    }

    const apiKey = process.env.NEXT_PUBLIC_AWS_APPSYNC_API_KEY?.trim();

    const attempts: Array<() => Promise<{ data?: TData }>> = [];

    if (apiKey) {
      attempts.push(() =>
        appSyncGraphqlFetchWithApiKeyAndJwt<TData>({
          endpoint,
          query: options.query,
          variables: options.variables,
          apiKey,
          authorization: idToken,
        }),
      );
      attempts.push(() =>
        appSyncGraphqlFetchWithApiKeyAndJwt<TData>({
          endpoint,
          query: options.query,
          variables: options.variables,
          apiKey,
          authorization: accessToken,
        }),
      );
    }

    attempts.push(
      () =>
        appSyncGraphqlViaAmplify<TData>({
          query: options.query,
          variables: options.variables,
          authMode: "AMAZON_COGNITO_USER_POOLS",
          authToken: idToken,
        }),
      () =>
        appSyncGraphqlViaAmplify<TData>({
          query: options.query,
          variables: options.variables,
          authMode: "AMAZON_COGNITO_USER_POOLS",
        }),
      async () => {
        await Auth.currentCredentials();
        return appSyncGraphqlViaAmplify<TData>({
          query: options.query,
          variables: options.variables,
          authMode: "AWS_IAM",
        });
      },
    );

    let lastErr: unknown;
    for (const run of attempts) {
      try {
        return await run();
      } catch (e) {
        lastErr = e;
        if (!isAppSyncUnauthorized(e)) break;
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error(String(lastErr ?? "AppSync authentication failed."));
  }

  const authType =
    process.env.NEXT_PUBLIC_AWS_APPSYNC_AUTHENTICATION_TYPE ??
    "AMAZON_COGNITO_USER_POOLS";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (authType === "API_KEY") {
    const key = process.env.NEXT_PUBLIC_AWS_APPSYNC_API_KEY;
    if (!key?.trim()) {
      throw new Error(
        "NEXT_PUBLIC_AWS_APPSYNC_API_KEY is not configured (required when authentication type is API_KEY).",
      );
    }
    headers["x-api-key"] = key;
  } else {
    const session = await Auth.currentSession();
    /** Matches `@aws-amplify/api-graphql` `_headerBasedAuth` for `AMAZON_COGNITO_USER_POOLS`. */
    const token = session.getAccessToken().getJwtToken();
    if (!token?.trim()) {
      throw new Error("Missing Cognito access token — sign in may not have completed.");
    }
    headers.Authorization = token;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    credentials: "omit",
    body: JSON.stringify({
      query: options.query,
      variables: options.variables,
    }),
  });

  let body: {
    data?: TData;
    errors?: { message?: string; errorType?: string }[];
  };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    throw new Error(`AppSync returned non-JSON (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    const msg = body.errors?.[0]?.message ?? res.statusText;
    throw new Error(`AppSync HTTP ${res.status}: ${msg}`);
  }

  if (body.errors?.length) {
    const e = body.errors[0];
    throw new Error(
      `${e?.errorType ?? "GraphQLError"}: ${e?.message ?? "Request failed"}`,
    );
  }

  return body;
}
