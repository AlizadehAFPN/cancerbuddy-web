/**
 * Mints the current user's Stream Chat credentials.
 *
 * Reuses the exact backend the mobile app uses: the GetStream "LOGIN" Lambda
 * (`NEXT_PUBLIC_GETSTREAM_LAMBDA`, invoked via `raiseUserLambda`). Its response
 * body carries both the public `apiKey` and the user's chat token — so the web
 * needs no extra env var or backend work. See `userEnrollmentFinalize.ts`,
 * which already calls this Lambda at signup.
 */

import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";

export interface StreamCredentials {
  apiKey: string;
  token: string;
}

function getStreamLambdaName(): string {
  const v = process.env.NEXT_PUBLIC_GETSTREAM_LAMBDA?.trim();
  if (!v) throw new Error("NEXT_PUBLIC_GETSTREAM_LAMBDA is not set.");
  return v;
}

/**
 * The Stream Chat **public** API key. Like the mobile app (which reads it from
 * client config), this is a publishable key meant to live in the client — it's
 * NOT the secret. It must match the Stream app that the GetStream Lambda mints
 * tokens for (here: the `getstream-demo` environment).
 */
function getStreamApiKey(): string {
  const v = process.env.NEXT_PUBLIC_GETSTREAM_API_KEY?.trim();
  if (!v) throw new Error("NEXT_PUBLIC_GETSTREAM_API_KEY is not set.");
  return v;
}

export async function fetchStreamCredentials(
  cognitoId: string,
  name: string,
): Promise<StreamCredentials> {
  const apiKey = getStreamApiKey();

  const raw = await raiseUserLambda(LambdaPayloadType.LOGIN, getStreamLambdaName(), {
    cognitoId,
    name,
  });

  let parsed: { statusCode?: number; body?: unknown };
  try {
    parsed = JSON.parse(raw) as { statusCode?: number; body?: unknown };
  } catch {
    throw new Error("GetStream returned an unexpected response.");
  }

  if (parsed.statusCode !== 200 || !parsed.body) {
    console.error("[chat] GetStream lambda non-200:", parsed.statusCode, parsed.body);
    throw new Error("GetStream token request failed.");
  }

  // The Lambda body may itself be a JSON string or an object.
  let body: Record<string, unknown>;
  if (typeof parsed.body === "string") {
    try {
      body = JSON.parse(parsed.body) as Record<string, unknown>;
    } catch {
      body = {};
    }
  } else if (typeof parsed.body === "object") {
    body = parsed.body as Record<string, unknown>;
  } else {
    body = {};
  }

  // The Lambda mints only the chat token. Its field name varies across
  // clients/envs, and it may be nested under `keys` — accept all shapes.
  const nestedKeys =
    body.keys && typeof body.keys === "object"
      ? (body.keys as Record<string, unknown>)
      : undefined;
  const token =
    (typeof body.chatToken === "string" && body.chatToken) ||
    (typeof body.token === "string" && body.token) ||
    (nestedKeys && typeof nestedKeys.chatToken === "string" && nestedKeys.chatToken) ||
    "";

  if (!token) {
    console.error("[chat] GetStream token missing. body keys:", Object.keys(body));
    throw new Error("GetStream response is missing the chat token.");
  }

  return { apiKey, token };
}
