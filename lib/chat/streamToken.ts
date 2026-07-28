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
  /** Stream **Chat** token. */
  token: string;
  /**
   * Stream **Feeds** token — reads/writes group activities. Undefined if this
   * environment's Lambda doesn't mint one, in which case the Groups tab can
   * still read posts (those come from `USERS_LAMBDA`) but not post or react.
   */
  feedToken?: string;
  /** Stream **Reactions** token — likes, comments, pins. */
  reactionsToken?: string;
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

  // One Lambda call mints all three tokens — chat, activity feeds, and
  // reactions — exactly as the mobile app stores them (`ChatDataUserKeys`).
  // Field names vary across clients/envs and may be nested under `keys`, so
  // accept every shape rather than assuming one.
  const nestedKeys =
    body.keys && typeof body.keys === "object"
      ? (body.keys as Record<string, unknown>)
      : undefined;

  const pick = (...names: string[]): string => {
    for (const name of names) {
      const direct = body[name];
      if (typeof direct === "string" && direct) return direct;
      const nested = nestedKeys?.[name];
      if (typeof nested === "string" && nested) return nested;
    }
    return "";
  };

  const token = pick("chatToken", "token");

  if (!token) {
    console.error("[chat] GetStream token missing. body keys:", Object.keys(body));
    throw new Error("GetStream response is missing the chat token.");
  }

  return {
    apiKey,
    token,
    feedToken: pick("feedToken") || undefined,
    reactionsToken: pick("reactionsToken") || undefined,
  };
}
