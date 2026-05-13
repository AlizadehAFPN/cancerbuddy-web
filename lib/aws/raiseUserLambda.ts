import { Auth } from "aws-amplify";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { ensureAmplifyConfigured } from "./amplifyConfigure";

let cachedClient: LambdaClient | null = null;
let credentialsExpiration = 0;

function decodePayload(payload: Uint8Array | undefined): string {
  if (!payload || payload.byteLength === 0) return "";
  return new TextDecoder("utf-8").decode(payload);
}

async function getLambdaClient(): Promise<LambdaClient> {
  ensureAmplifyConfigured();
  const now = Date.now();
  if (cachedClient && credentialsExpiration > now + 300_000) {
    return cachedClient;
  }

  const currentCredentials = await Auth.currentCredentials();
  const essential = await Auth.essentialCredentials(currentCredentials);
  credentialsExpiration = now + 3_500_000;

  cachedClient = new LambdaClient({
    region: process.env.NEXT_PUBLIC_AWS_PROJECT_REGION,
    credentials: {
      accessKeyId: essential.accessKeyId,
      secretAccessKey: essential.secretAccessKey,
      sessionToken: essential.sessionToken,
    },
  });

  return cachedClient;
}

export function clearLambdaClientCache(): void {
  cachedClient = null;
  credentialsExpiration = 0;
}

/**
 * Read the current user's Cognito ID token (JWT) from Amplify's cached
 * session. Returns null when no user is signed in — callers handle that
 * gracefully; the backend Lambda's Phase A observer simply records
 * `AUTH_NO_TOKEN` and proceeds as before.
 *
 * Note: `Auth.currentSession()` does **not** make a network call when the
 * cached tokens are still valid. Amplify refreshes the tokens internally
 * if they're close to expiry, so this stays fast on the hot path.
 */
async function currentIdToken(): Promise<string | null> {
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    return typeof token === "string" && token ? token : null;
  } catch {
    return null;
  }
}

/**
 * Invokes the same user Lambdas as the mobile app (`raiseUserLambda` in
 * `cancerbuddyapp/src/utils/lambda.ts`): JSON body is `{ type, ...payload }`.
 *
 * The current user's verified Cognito ID token is attached as `idToken` on
 * the request body. The backend uses it to confirm the caller's identity
 * before acting on user-scoped operations (phone verification, account
 * deletion, etc.) — see `users-demo` / `getstream-demo` `modules/_auth.js`.
 * The `idToken` field is always written last so a caller-provided value
 * cannot override the session's verified token.
 */
export async function raiseUserLambda(
  payloadType: string,
  functionName: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const lambda = await getLambdaClient();
  const idToken = await currentIdToken();
  const body = JSON.stringify({
    type: payloadType,
    ...payload,
    ...(idToken ? { idToken } : {}),
  });
  const command = new InvokeCommand({
    FunctionName: functionName,
    Payload: body,
  });

  try {
    const response = await lambda.send(command);
    return decodePayload(response.Payload as Uint8Array | undefined);
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === "ExpiredTokenException") {
      clearLambdaClientCache();
      const fresh = await getLambdaClient();
      const retry = await fresh.send(command);
      return decodePayload(retry.Payload as Uint8Array | undefined);
    }
    throw error;
  }
}
