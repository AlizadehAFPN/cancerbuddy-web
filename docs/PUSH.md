# Web push notifications

Status: **working in development** as of 2026-08-04 (verified end to end: real
chat message → OS notification in Chrome on macOS).

Web does **not** use the mobile app's Firebase project. `cancerbuddy-demo` sits
under an account nobody on the team can open — see
[Who owns the Firebase project](#who-owns-the-firebase-project) — and the two
console-only values web push needs (a Web app registration and a Web Push VAPID
key) cannot be produced from outside it. So web runs on its own Firebase project
(`cancerbuddy-web-73c0d`), registered as a **second, named Firebase
configuration on Stream** called `web`. Mobile keeps using `firebaseV3-demo`,
untouched.

> ### Read this before debugging "no push arrives"
>
> **A new Stream push configuration ships with push turned OFF for every event
> type.** Stream keeps an `enable_push` flag *per provider, per event type*. Until
> `message.new` is enabled for your provider, Stream sends nothing to its devices
> — with no error, no dashboard indicator, and a `200` from every API call you
> can make. `addDevice` succeeds, the device is listed, `check_push` returns
> `device_errors: null`, and nothing ever arrives.
>
> The flag is **not in the JS SDK**. It lives at `POST /push_templates`
> (`enable_push`, `event_type`, `push_provider_type`, `push_provider_name`) — see
> [Enabling an event type](#enabling-an-event-type). On the dashboard it appears
> as the word "Disabled" next to "Default Template", which reads like "no custom
> template" rather than "push is off".
>
> This one flag cost about three hours. Check it first.

---

## How push works in this product

Every notification CancerBuddy sends — mobile and web — is sent by **Stream
Chat**, not by our backend. There is no server-side FCM sender anywhere in the
codebase.

```
                              ┌───────────────────────────────┐
  mobile ─ addDevice(token, 'firebase', userId) ──────────────┐│
                              │  Stream Chat app             ││
                              │  "Bonemarrow-demo"           ││
  browser ─ addDevice(token, 'firebase', userId, 'web') ──────┼┘
                              │                              │
                              │  two Firebase configurations:│
                              │   • <default> → cancerbuddy-  │
                              │     demo service account      │
                              │   • "web"    → our own project│
                              └───────────┬───────────────────┘
                                          │ FCM v1 API
                                          ▼
                              FCM ─→ service worker ─→ OS notification
```

Verified in the mobile app:

| What | Where |
| --- | --- |
| Registers the FCM token with Stream | `cancerbuddyapp/src/context/stream/StreamProvider.tsx:122-131` |
| Removes it on logout | `cancerbuddyapp/src/context/auth/useAuth.ts:196,277` |
| Passes the token to `USERS_LAMBDA` on login/logout | `src/utils/enrollment/signup.ts:12-27`, `src/utils/lambda.ts:234` |
| No `fcmToken` field on the User model | — (so nothing else sends push) |

**Consequence for us: the browser needs no server-side or dashboard work.** The
Firebase credentials already configured on the Stream dashboard deliver to web
tokens exactly as they do to iOS/Android ones. Registering the device is the
whole integration.

## Setup — one-time, ~10 minutes

Why this works: an FCM token is minted per Firebase project, and Stream sends to
a token using the service account of the configuration the device named. So web
can live on a completely separate Firebase project as long as Stream holds that
project's service account under a name web passes to `addDevice`. Verified in the
installed SDK: `addDevice(id, push_provider, userID?, push_provider_name?)`
(`node_modules/stream-chat/dist/types/client.d.ts:681`).

FCM is free — no Blaze plan needed.

1. Create a Firebase project on an account the team controls (e.g.
   `cancerbuddy-web`).
2. **Add app → Web.** Gives `appId` (`1:…:web:…`) and the browser API key.
3. Project settings → **Cloud Messaging** → Web configuration → Web Push
   certificates → **Generate key pair**. Gives `vapidKey`.
4. Project settings → **Service accounts** → **Generate new private key**. Keep
   the JSON; it is a credential.
5. Stream dashboard → Chat → Push → Firebase → add a **second** configuration:
   `Name` = `web`, paste that JSON, Enabled. Leave the existing configuration
   alone.
6. **Enable `message.new` for that configuration** — the step nothing in the UI
   or SDK will prompt you for. See [Enabling an event type](#enabling-an-event-type).
   Skipping it produces total, silent failure.
7. Set the env block below, including `NEXT_PUBLIC_STREAM_PUSH_PROVIDER_NAME=web`
   so it matches the name from step 5.

Adding the second configuration did **not** disturb mobile. Mobile devices
register without a provider name (all 87 of them at the time of writing), and
they kept receiving push after `web` was added — verified with a real message to
a real phone. Deleting the `web` configuration reverts everything instantly if
that ever changes.

Note the iOS/Android API keys in the mobile app's `google-services.json` /
`GoogleService-Info.plist` are **not** reusable for web under any project: Google
restricts them to a package name + SHA-1 / bundle id, so a browser request with
either is rejected.

## Enabling an event type

Not exposed by `stream-chat` — call the REST endpoint through the SDK's raw
`post`. `template` must be the **empty string**: any non-empty template made
Stream's own send path return `500 CheckPush failed with error: ""` for every
shape tried (`{message:{…}}`, `{notification:…,data:…}`, `{title,body}`,
`{webpush:…}`), and none is needed — Stream's default payload already carries
`data.title` and `data.body`.

```js
const client = StreamChat.getInstance(apiKey, apiSecret);

await client.post(client.baseURL + "/push_templates", {
  event_type: "message.new",        // repeat for message.updated, reaction.new, …
  push_provider_type: "firebase",
  push_provider_name: "web",
  enable_push: true,
  template: "",
});

// Read it back:
await client.get(client.baseURL + "/push_templates", {
  push_provider_type: "firebase",
  push_provider_name: "web",
});
```

Only `message.new` is enabled today. The other event types Stream supports
(`message.updated`, `reaction.new`, `notification.reminder_due`) are off, which
matches what members get on mobile.

Note the iOS/Android API keys in the mobile app's `google-services.json` /
`GoogleService-Info.plist` are **not** reusable for web under any project: Google
restricts them to a package name + SHA-1 / bundle id, so a browser request with
either is rejected.

## Environment

```bash
# Public by design — these ship in the client bundle, exactly as the mobile app
# ships its equivalents in google-services.json. All five come from the web's own
# Firebase project, NOT from cancerbuddy-demo.
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_API_KEY=            # browser key, from the Web app registration
NEXT_PUBLIC_FIREBASE_APP_ID=             # 1:…:web:…
NEXT_PUBLIC_FIREBASE_VAPID_KEY=          # Web Push certificate public key

# Must match the Name of the Firebase configuration on the Stream dashboard that
# holds this project's service account. Omit only if web and mobile ever share
# one Firebase project again.
NEXT_PUBLIC_STREAM_PUSH_PROVIDER_NAME=web
```

`lib/push/config.ts` returns null while any of the five Firebase values is empty,
and every entry point degrades to "unconfigured" rather than throwing. The
missing names are logged to the console when someone taps the toggle, so a
misdeploy is diagnosable without a debugger.

## Files

| File | Role |
| --- | --- |
| `lib/push/config.ts` | Reads + validates the five env vars |
| `lib/push/deviceToken.ts` | `UserDeviceToken` registration — **off**, see below |
| `lib/push/pushClient.ts` | Permission, token, `addDevice`/`removeDevice`, foreground listener, state store |
| `public/firebase-messaging-sw.js` | Displays background notifications, routes clicks |
| `components/push/PushBridge.tsx` | Mounted in the authenticated layout: token sync + foreground toasts |
| `components/push/PushSettingsCard.tsx` | The only place that requests permission |
| `app/(app)/settings/page.tsx` | Hosts the card |
| `app/manifest.ts` | Web app manifest — required for iOS push |
| `next.config.ts` | `no-store` + correct `Content-Type` for the service worker |

## Decisions worth knowing

**The service worker does not load the Firebase SDK.** Most FCM tutorials
`importScripts()` the compat SDK from `gstatic.com`. We hand-rolled the ~30 lines
of Push API code instead, because: no third-party script runs with
service-worker privileges on our origin (keeps a future CSP at `script-src
'self'`, consistent with `docs/SECURITY.md`); no version drift between the npm
`firebase` package and a CDN URL nobody remembers to bump; and exactly one
notification per push — the Firebase SW auto-displays messages carrying a
`notification` payload *and* calls `onBackgroundMessage`, which is the classic
source of duplicates. `getToken()` does not need the SDK in the worker; it
subscribes through `registration.pushManager` and we pass the registration
explicitly.

**Foreground pushes travel over our own `postMessage`, not `onMessage()`.** The
Firebase SDK's `onMessage()` is fed by *its* service worker posting to the page.
With a hand-written worker it never fires — it is not an error you can see, the
callback simply stays silent. So the worker checks for a focused window itself
and posts `{type: "cancerbuddy:push", …}` to it, skipping the OS banner;
`subscribeForegroundPush()` in `lib/push/pushClient.ts` listens for that. If the
worker ever goes back to the Firebase SDK, this pairing has to change with it.

**Permission is never requested automatically.** Chrome penalises origins that
prompt on load, and asking a new member for notification access before they have
seen anything is worse than an explicit toggle. `syncPushDevice()` only
re-registers a token that was already granted.

**An opt-out flag lives in `localStorage`** (`cb.push.optOut`). A page cannot
revoke its own permission grant, so without it a member who turns push off would
see the switch flip back on after a reload. (Unrelated to the onboarding-draft
rule — that is about never persisting registration data.)

**Token re-registration on every load.** FCM tokens rotate when browser data is
cleared, the worker is unregistered, or an install sits idle for a long time.
`PushBridge` re-registers once chat is connected, which is why it waits for
Stream `status === "ready"` — `addDevice` needs a connected user.

## Why the web token is not registered

`UserDeviceToken` is the table the app's own notifications read to decide where
to send. Mobile writes its FCM token there on login and removes it on logout.
**Web does not**, and `lib/push/deviceToken.ts` — which implements the whole
thing — ships with its switch off.

This is a decision with a reason, not an unfinished edge.

### What the table actually is

Introspected against the production AppSync endpoint, 2026-08-08:

```graphql
type UserDeviceToken { token: String!  userID: ID!  createdAt  updatedAt }

input CreateUserDeviceTokenInput { token: String!  userID: ID! }
input DeleteUserDeviceTokenInput { token: String! }
```

Four fields. **No platform, provider or device column.** Nothing reading that
table can tell a browser token from a phone one.

### Why registering would deliver nothing

An FCM token is scoped to the Firebase project that minted it. Web push runs on
**this app's own** Firebase project, because nobody on the team can open the
mobile one (see [Who owns the Firebase project](#who-owns-the-firebase-project)).
Whatever sends these notifications holds the *mobile* project's credentials, so a
web token handed to it is answered with `SENDER_ID_MISMATCH`.

Registering it today buys **zero** pushes and adds a token guaranteed to fail.

### Why it cannot hurt the mobile app

Verified rather than assumed:

| Fact | Source |
|---|---|
| The primary key is the token string — one token, one row | `DeleteUserDeviceTokenInput { token: String! }` |
| Web and phone tokens are different strings from different projects | FCM scopes tokens per project |
| Mobile's dedupe deletes `token == mine AND userID != me` | `cancerbuddyapp/src/context/auth/useAuth.ts:82-115` |
| Mobile's logout deletes `token == mine AND userID == me` | `useAuth.ts:161-200` |

So **no web write can select a phone row, and no mobile write can select a web
row.** `reconcileDeviceToken` is a pure function precisely so this is testable,
and a test asserts it refuses to emit a delete for any token but its own.

### The sender was read, not guessed

The Lambda source settles what the client repos could not. `firebase-demo` is the
sender (`sendMulticast` in `modules/notification.js`), fed by `users-demo`
through the `firebase-topic-subscriptions-demo` SQS queue:

```js
tokenArray = tokens.filter(t => t && typeof t === 'string' && t.trim().length > 0);
…
const {failureCount, responses, successCount} = await messaging().sendEach(messages);
```

Three properties, all verified against the deployed package:

1. **Null and empty tokens are filtered out** before anything is sent.
2. **`sendEach` sends one independent message per token** and returns per-token
   responses. A failure on one token cannot affect another — the sender **skips,
   it does not abort.**
3. **Invalid tokens are cleaned up automatically.** A response carrying
   `registration-token-not-registered`, `invalid-registration-token` or
   `invalid-argument` is collected and deleted from `UserDeviceToken` by
   `removeFailedToken`, keyed by token.

Rows are read per recipient (`isValidUser(userId).deviceTokens`), so a send is
"notify user X → read X's tokens → send". **A web token could never affect another
member, and cannot affect its own member's phone delivery either.**

So registering would be *harmless*. It stays off because it would also be
*useless*: a token from this project, handed to a sender holding the mobile
project's credentials, fails with a mismatched-credential error — which is **not**
in the auto-removal list above, so the row would linger and fail on every send
forever. Nothing gained, one permanently failing row added.

### What unblocks it

1. Add a `platform` column (`ios` | `android` | `web`) to `UserDeviceToken`.
2. Give the sender this project's Firebase service account as a second
   credential. `firebase-demo/config/firebase.js` reads **one** set of
   `FIREBASE_*` values from SSM and calls `admin.initializeApp` with them; it
   already takes an app `name`, so a second named app is a small change.
3. Have the sender pick the credential by `platform`.

Step 3 is the only one with any subtlety, and it is smaller than it looks: the
sender already loops per token and already tolerates per-token failure, so the
change is choosing which `admin.app` to send each message through.

Then set `NEXT_PUBLIC_PUSH_TOKEN_REGISTRATION=true`. The client half — dedupe,
create, remove-on-logout — is already written and tested; only the extra field
needs adding to the create input.

> **The `USERS_LAMBDA` `login`/`logout` question is answered**, from the deployed
> package rather than inference:
>
> - **`login({userId, token})` never touches `UserDeviceToken`.** It subscribes the
>   token to the member's group topics via SQS, and calls `setNewIdBuddyId` —
>   `SHA256(userId)` sliced into `BI-xxxx-yyyy`, deterministic, so re-running it
>   always writes the same value. No double-write to worry about, and web's
>   `runLoginBootstrap` cannot create a row.
> - **`logout({userId, token})` does** — `Delete { Key: { token } }`, keyed by the
>   token alone. Web does not call that verb.
>
> One side effect web's call *does* have: `login` enqueues
> `{type:'subscribeToTopic', tokens:[token], topic}` per group, and web sends
> `token: undefined`, so the message carries `tokens:[null]`. The consumer guards
> with `if (!tokens.length || !topic) return`, which `[null]` passes, so
> `subscribeToTopic([null], …)` throws. The handler catches per message and
> carries on — no retry, no dead-letter queue, no effect on any other member — so
> the cost is log noise at sign-in for a member who is in at least one group. The
> one-line backend fix is `tokens.filter(Boolean)` in
> `firebase-demo/modules/subscription.js`, the same filter `sendMulticast` already
> applies a few lines away.

---

## Badge and tray

The app-icon badge and the OS notification tray are kept tidy by the service
worker, because a push arriving with no tab open has no page to run in.

| Moment | What happens | Mobile's equivalent |
|---|---|---|
| A push is shown | badge count +1 | notifee auto-badge |
| The member returns to the tab | badge cleared, tray left alone | `push-notification.provider.tsx:93-95` |
| They open `/notifications` | tray **and** badge cleared | `HomeNotifications.tsx:110-115` |
| They tap a *connect* notification | badge cleared, sibling connect banners swept | `cancelConnectNotifications:117-146` |
| They tap anything else | badge cleared, that one closed | `cancelSingleNotification:149-155` |

Two rules worth keeping:

* **Tapping a buddy request must not sweep chat or live banners.** They point
  somewhere else entirely. Mobile's own comment says so, and `isConnectLike()` in
  the worker is a transcription of its filter.
* **The count is held on the worker, not read back from the tray.** A banner the
  member swiped away is gone from `getNotifications()`, and a badge that silently
  decremented on a swipe would disagree with the list the app is about to show.

Firefox and Safari-on-macOS have no Badging API; the calls are optional-chained
and the notification still arrives. The icon is only *visible* in an installed
PWA.

---

## Divergences from mobile

1. **The `USERS_LAMBDA` login payload still sends `token: undefined`**
   (`lib/user-signup/userEnrollmentFinalize.ts`, `lib/host-signup/hostEnrollmentFinalize.ts`).
   Mobile sends the FCM token there. A member finishing signup has not granted
   notification permission yet, so there is never a token to send at that point;
   registration happens later from the app shell. Left as-is deliberately.
2. **Web asks explicitly; mobile prompts as part of onboarding.** Different
   platform norms — a native permission sheet during onboarding is expected on
   iOS/Android, and penalised on the web.

## Limits to expect

- **Stream only pushes to a member who has no active connection.** An open
  CancerBuddy tab marks them online, and their *phone* stops getting chat push
  too. This is pre-existing behaviour — the web chat already holds a websocket
  (`lib/chat/streamClient.ts`) — not something web push introduces. If it turns
  into a complaint, the fix is to `disconnectUser()` after the tab has been
  hidden for a few minutes; that is a product decision, not a bug.
- **iOS/iPadOS only delivers push to an installed PWA** (16.4+, added to the
  home screen). Hence `app/manifest.ts`. Desktop Chrome/Edge/Firefox and Android
  Chrome work from a normal tab.
- **A focused tab gets a toast, not an OS banner.** The worker looks for a
  focused window and posts to it instead of calling `showNotification`; the
  conversation currently on screen is skipped entirely, since the chat pane
  already renders the message live over the websocket.
- **Stream's payload is data-only, and that is fine.** It carries `data.title`
  ("New message from …") and `data.body` (the message text) rather than an FCM
  `notification` block, which is why the worker reads both `notification.*` and
  `data.*`. Do not try to "fix" this with a custom template: every non-empty
  template on this provider made Stream's send path return `500`.
- **Clicks on a `livestream` notification land on `/groups`.** Stream uses two
  channel types: `messaging` (buddy + group conversations, the only type the web
  app renders) and `livestream` (a live session's chat, mobile-only). A
  livestream push has no web destination, so it falls back to the app home. When
  `/notifications` stops being a placeholder it becomes the better catch-all —
  the rule lives in `public/firebase-messaging-sw.js` → `targetPath()` and is
  mirrored in `lib/push/pushClient.ts`.
- **The manifest icons are the BMCF lockup** rendered from
  `public/images/BMCF_LOGO_SQUARE.svg`. Legible at 512px, mush at the 48px the OS
  uses for a notification badge. A purpose-drawn maskable mark is a design
  follow-up.

## Testing

1. Push needs a secure context. `http://localhost` qualifies — no HTTPS needed
   for desktop testing. For a phone on the LAN, run `next dev --experimental-https`.
2. Log in → `/settings` → **Turn on notifications** → accept the prompt. The
   console logs `[push] device registered for <userId> via provider "web"`. The
   `via provider` part is the bit that matters.
3. **Close every CancerBuddy tab.** Stream does not push to a member it considers
   online, and one open tab keeps the websocket alive. A test with a tab open
   proves nothing.
4. Send yourself a message from a second account.

## Debugging when nothing arrives

Work down this list. It is ordered by how often each one was the answer, and
every entry was a real dead end at some point on 2026-08-04.

1. **Is `enable_push` on for this provider and event type?** See the box at the
   top. This was the actual cause. `GET /push_templates` answers it in one call.
2. **Is the OS letting Chrome show anything?** macOS System Settings →
   Notifications → Google Chrome → *Allow notifications*, and Alert Style not
   "None". This was off for the first hour and silently swallowed every correct
   push, making working configurations look broken. Test it in isolation:
   DevTools → Application → Service workers → the **Push** button sends a fake
   push locally, no network involved. If that shows no banner, stop and fix the
   OS before touching anything else.
3. **Did the push reach the worker?** DevTools → Console → context dropdown →
   the worker, then look for `[push-sw] push received: …`. With every tab closed
   there is no console to read; the trick that finally worked was making the
   worker POST each payload to a dev-only route so it landed in the dev server's
   terminal. That instrumentation has been removed, but it is ~15 lines and worth
   re-adding rather than guessing:

   ```js
   // in the push handler of public/firebase-messaging-sw.js
   if (self.location.hostname === "localhost") {
     event.waitUntil(fetch("/api/push-debug", { method: "POST", body: raw }).catch(() => {}));
   }
   ```

4. **Is Stream even sending?** `POST /check_push` with `skip_devices: false`
   performs a real delivery to every one of the user's devices and returns
   `device_errors`. Note the dashboard's *Test Configurations* button does **not**
   send — it renders the template and returns in ~10ms, so its silence is not
   evidence of anything.
5. **Is the member online?** `client.queryUsers({id})` → `online`. If true, no
   push is sent to any device, web or mobile.
6. **Is the credential the right project?** `GET /app` → the `web` provider's
   `firebase_credentials` must say `"project_id": "cancerbuddy-web-73c0d"`.
7. **Does FCM reach this browser at all?** Firebase console → Messaging → send a
   test message to the token printed by `[push] token (dev, …)`. This bypasses
   Stream completely.

## Who owns the Firebase project

`cancerbuddy-demo` (project number `940113338836`), service account
`firebase-adminsdk-pv6lt@cancerbuddy-demo.iam.gserviceaccount.com`. Apple push
lives under Apple Developer team `KKV72KQ3VK`.

**There is no technical way to look this up.** Google does not expose project
ownership to anyone outside the project's IAM — there is no query by project id,
and the service-account JSON on the Stream dashboard names a machine identity,
not a person. Every remaining route goes through a human record.

Ruled out as of 2026-08-04:

- `farzad@touchzenmedia.com` — `firebase projects:list` shows only
  backtothegarden ×2 and vrenz.
- `bmcf@bonemarrow.org` — "Bone Marrow & Cancer Foundation", owner of the GitLab
  group `cancerbuddy-group`. Has no access either, which is the informative part:
  the project is **not** inside a `bonemarrow.org` organisation, so it sits under
  a contractor's personal Google account.
- GitHub user `GpeUmvel` (id `137814829`) — the app's original developer (initial
  commit 2025-10-03, shipped App Store 2.0.1 on 2025-10-28), so almost certainly
  created the Firebase project and the Apple team. The account is an empty
  contractor throwaway: created 2023-06-26, no name, no email, no company, zero
  public repos, no author emails in its public events. Dead end.
- The two Apple IDs in local Xcode (`alizadeh2023@gmail.com`, `jalal@zown.ca`) —
  neither belongs to team `KKV72KQ3VK`.
- Every repo and its git history — no service-account JSON was ever committed.

Still worth checking, in order of expected value:

1. **Stream dashboard → Organization → Members.** Whoever pasted the
   `cancerbuddy-demo` service-account JSON into Stream had the key, so they are
   almost certainly the Firebase owner — and their real email is in that member
   list.
2. **App Store Connect → team `KKV72KQ3VK` → Users and Access → Account Holder.**
3. **AWS → IAM → Users.** The `users-devtwo` / `getstream-devtwo` Lambdas were
   deployed by someone whose IAM user still exists and is usually named after
   their email.
4. **GitLab `cancerbuddy-group` → Members → Owners**, and the foundation's own
   contract / payment records for the contractor.

⚠️ The `cancerbuddy-demo` service-account private key was pasted into a chat
transcript on 2026-08-04 while inspecting the Stream dashboard. Treat it as
compromised. It **cannot be rotated** without console access — rotation is
Project settings → Service accounts → Generate new private key → paste the new
JSON into Stream → delete the old key under GCP → IAM & Admin → Service Accounts
→ Keys. (Rotation invalidates every registered Firebase device, which self-heals:
both clients re-register on the next load.)

This is the part to escalate to the foundation as asset recovery rather than a
support ticket: whoever holds `cancerbuddy-demo` holds **production mobile push**,
its credential can never be rotated, and if that account is lost mobile push
breaks with no recovery path. Web no longer depends on it.
