import { Amplify } from "aws-amplify";

let configured = false;

/**
 * One-time Amplify configuration for the browser. Mirrors `cancerbuddyapp`
 * `src/aws-exports.js` / `index.js` — use the same Cognito pool, AppSync API,
 * and identity pool as the mobile app via `NEXT_PUBLIC_*` env vars.
 */
export function ensureAmplifyConfigured(): void {
  if (typeof window === "undefined" || configured) return;
  if (!process.env.NEXT_PUBLIC_AWS_USER_POOLS_ID) return;

  const s3Bucket =
    process.env.NEXT_PUBLIC_AWS_USER_FILES_S3_BUCKET?.trim() || "";
  const s3Region =
    process.env.NEXT_PUBLIC_AWS_USER_FILES_S3_BUCKET_REGION?.trim() || "";

  Amplify.configure({
    aws_project_region: process.env.NEXT_PUBLIC_AWS_PROJECT_REGION,
    aws_cognito_identity_pool_id:
      process.env.NEXT_PUBLIC_AWS_COGNITO_IDENTITY_POOL_ID,
    aws_cognito_region: process.env.NEXT_PUBLIC_AWS_COGNITO_REGION,
    aws_user_pools_id: process.env.NEXT_PUBLIC_AWS_USER_POOLS_ID,
    aws_user_pools_web_client_id:
      process.env.NEXT_PUBLIC_AWS_USER_POOLS_WEB_CLIENT_ID,
    aws_appsync_graphqlEndpoint:
      process.env.NEXT_PUBLIC_AWS_APPSYNC_GRAPHQLENDPOINT,
    aws_appsync_region: process.env.NEXT_PUBLIC_AWS_APPSYNC_REGION,
    aws_appsync_authenticationType:
      process.env.NEXT_PUBLIC_AWS_APPSYNC_AUTHENTICATION_TYPE ??
      "AMAZON_COGNITO_USER_POOLS",
    aws_appsync_apiKey: process.env.NEXT_PUBLIC_AWS_APPSYNC_API_KEY,
    // NOTE: Amplify keeps Cognito tokens in its default storage (localStorage)
    // on purpose. We do NOT use `Auth.cookieStorage`: that wrote the full
    // id/access/refresh JWT bundle into cookies on every request, which on the
    // shared `localhost` origin pushed the request headers past Node's ~16 KB
    // limit and made the dev server answer with `431 Request Header Fields Too
    // Large` (an empty body → blank page). Nothing reads these tokens
    // server-side yet (proxy.ts session check is a stub), so cookies bought us
    // nothing. When server-side auth is wired up, set a single minimal session
    // cookie instead of persisting the whole Amplify token bundle.
    ...(s3Bucket && s3Region
      ? {
          Storage: {
            AWSS3: {
              bucket: s3Bucket,
              region: s3Region,
            },
          },
        }
      : {}),
  });

  configured = true;
}
