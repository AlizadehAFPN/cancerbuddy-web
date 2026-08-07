/**
 * Firebase Cloud Messaging (web push) configuration, read from the env.
 *
 * Web push reuses the mobile app's Firebase project rather than a new one, so
 * a single Stream configuration serves both clients. Every push notification in
 * this product is sent by Stream Chat — mobile registers its FCM token with
 * `client.addDevice(token, 'firebase', userId)`
 * (`cancerbuddyapp/src/context/stream/StreamProvider.tsx`) and the Stream
 * dashboard holds the `cancerbuddy-demo` service-account credentials that
 * Stream uses to call FCM. The browser does exactly the same registration, so
 * **no server-side or dashboard change is needed** for web push to work.
 *
 * Known values (public by design — they ship in the client bundle, same as the
 * mobile app ships them in `google-services.json`):
 *   projectId          cancerbuddy-demo
 *   messagingSenderId  940113338836
 *
 * Two values can only be produced from the Firebase console, and at the time of
 * writing nobody on the team has access to `cancerbuddy-demo` (see
 * `docs/PUSH.md` for the ownership hunt and how to finish this):
 *   appId     Project settings → Your apps → Add app → Web
 *   vapidKey  Project settings → Cloud Messaging → Web Push certificates
 *
 * The iOS/Android API keys in the mobile config are **not** reusable here:
 * Google restricts them to a bundle id / package name + SHA-1, so a browser
 * request with either key is rejected. Registering the web app produces its
 * own browser key.
 *
 * Until all five are set, `getPushConfig()` returns null and every entry point
 * in `lib/push` reports "unconfigured" instead of throwing. Nothing else in the
 * app is affected.
 */

export interface PushConfig {
  apiKey: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
}

/** Env var name → its value, in the order they appear in `.env`. */
const ENV: Record<keyof PushConfig, string | undefined> = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
};

const ENV_NAMES: Record<keyof PushConfig, string> = {
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
  vapidKey: "NEXT_PUBLIC_FIREBASE_VAPID_KEY",
};

const keys = Object.keys(ENV) as (keyof PushConfig)[];

/**
 * The env var names that are still empty. Empty array → push is configured.
 * Used by the settings UI to log an actionable message for whoever is
 * deploying, without showing infrastructure detail to members.
 */
export function missingPushEnv(): string[] {
  return keys.filter((k) => !ENV[k]?.trim()).map((k) => ENV_NAMES[k]);
}

/** Full config, or null when any value is missing. */
export function getPushConfig(): PushConfig | null {
  if (missingPushEnv().length > 0) return null;
  return keys.reduce((acc, k) => {
    acc[k] = ENV[k]!.trim();
    return acc;
  }, {} as PushConfig);
}

/**
 * Which **Stream** push configuration should deliver to this browser's tokens.
 *
 * A Stream app can hold several Firebase configurations, each with a name (the
 * `Name` field on the dashboard: "used to select this configuration in SDK or
 * API calls"), and a device picks one by passing it to `addDevice`. Web runs on
 * its own Firebase project — the mobile app's project belongs to an account
 * nobody on the team can open (`docs/PUSH.md`) — so web tokens are only
 * deliverable by the configuration holding *our* service account.
 *
 * Undefined when unset, which makes Stream fall back to the app's single
 * Firebase configuration. That is the correct value if web and mobile ever end
 * up on the same Firebase project again.
 */
export function getStreamPushProviderName(): string | undefined {
  return process.env.NEXT_PUBLIC_STREAM_PUSH_PROVIDER_NAME?.trim() || undefined;
}
