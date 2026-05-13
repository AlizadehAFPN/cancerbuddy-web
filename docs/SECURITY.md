# Security Hardening — Progress & Roadmap

> **Resuming in a future session?** Read this file end-to-end, then say:
> *"I'm continuing the security hardening from `docs/SECURITY.md`. What's next?"*
>
> The very first thing to do is check CloudWatch for Phase A signals (see the
> "Phase B pre-flight checklist" below). Don't write any new code until you
> know whether Phase A has been clean for 5–7 days.

---

## 1. Context

CancerBuddy (`cancerbuddy-web`) is a Next.js 16 web app that shares its
backend — Cognito User Pool, AppSync GraphQL API, S3 bucket, and two Lambdas
(`users-demo`, `getstream-demo`) — with the existing React Native mobile
app (`cancerbuddyapp`).

**Hard constraint:** no change can break the live mobile app. Every backend
change is rolled out in two phases — observe first, then enforce.

The user-facing flow being hardened is `/hosts-register` (a multi-step
"register as host" application). The auditing covers signup, login,
storage, network calls, and the supporting Lambda backend.

### Threat model — what we're defending against

| ID  | Threat                                                                                                                                         | Severity   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| C-1 | Any signed-in user can impersonate any other user by editing the `userId` in the Lambda payload (the Lambdas don't verify the caller's sub).   | CRITICAL   |
| C-2 | The AppSync API key `da2-xypsacztpfgmrl4uqwqpoqjn5e` is bundled into every shipped JS file. If any AppSync mutation accepts `@aws_api_key`, an attacker can mutate user data with no auth at all. | HIGH       |
| C-3 | Profile photos uploaded with Amplify Storage default access level (`public/*` prefix on S3 bucket `files155829-demo`) may be world-readable.   | MEDIUM     |
| C-4 | AppSync API keys expire (max 1 year). No rotation schedule.                                                                                    | LOW (but eventual breakage if ignored) |
| W-1 | PII (name, DOB month+year, email, phone, bio) sitting in `localStorage` indefinitely on shared machines.                                       | HIGH (web) |
| W-2 | Raw password persisted to `sessionStorage` between credentials → OTP steps.                                                                    | HIGH (web) |
| W-3 | Verbose debug logging (`logHostApplyStep`) dumped Stream chat tokens and Cognito sub to the browser console.                                   | HIGH (web) |
| W-4 | No Content-Security headers (HSTS, X-Frame-Options, Referrer-Policy, etc.).                                                                    | MEDIUM     |
| W-5 | Open-redirect surface via `proxy.ts ?from=` query param.                                                                                       | MEDIUM     |
| W-6 | Raw Cognito error messages surfaced to users (enumeration / internal-detail leakage).                                                          | MEDIUM     |

---

## 2. Phase 1 — Web Client Hardening ✅ DONE

Closes W-1 through W-6. All changes verified with `tsc --noEmit`,
`eslint`, and `next build` (all pass). No functional UX regression.

### Files added

- **`lib/host-signup/store.ts`** — Zustand store with `sessionStorage`
  persist middleware. Holds the host-signup draft, Cognito pool username,
  Twilio Verify phone-SID. Password is in-memory only — excluded via
  `partialize` so it never touches any storage backend. A `pagehide`
  listener wipes the in-memory password when the user leaves the tab.
- **`lib/signup/store.ts`** — Parallel store for the regular signup flow.

### Files modified

- **`lib/host-signup/storage.ts`** — Thin function-API wrapper over the
  Zustand store. Public signatures unchanged so consumers don't have to
  change.
- **`lib/signup/storage.ts`** — Same.
- **`lib/host-signup/cognitoHostSignupService.ts`** — Phone SID moved to
  store. `describeCognitoFailure` returns a generic message in production
  (verbose only in dev) so AWS internal codes don't leak to users.
- **`lib/host-signup/hostEnrollmentFinalize.ts`** — Re-validates photo
  size before the S3 upload (defence-in-depth against a manually
  constructed `File`). All debug logging removed.
- **`lib/host-signup/bootstrapSupportChannel.ts`** — All debug logging
  removed; kept the same error semantics.
- **`next.config.ts`** — Adds global response headers:
  `Strict-Transport-Security` (2y + includeSubDomains),
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy`
  that disables camera/mic/geolocation/etc., and `Cross-Origin-Opener-Policy: same-origin`.
  CSP is intentionally **not** set yet — Amplify's runtime needs a
  carefully crafted CSP that won't trip on Cognito/AppSync/S3 endpoints.
  Plan a `Content-Security-Policy-Report-Only` rollout later.
- **`proxy.ts`** — `safeReturnPath()` uses the WHATWG `URL` parser to
  normalise the `?from=` query value and rejects anything whose origin
  differs from the request's. Closes scheme-relative, backslash-bypass,
  percent-encoded, and control-char vectors in one rule.
- **`lib/aws/raiseUserLambda.ts`** — **Required by Phase A on the Lambda
  side.** Fetches the current Cognito ID token via `Auth.currentSession()`
  and attaches it as `idToken` to every Lambda invocation. Token is
  written **last** in the body spread so callers can't override it.
  Defensive: if `currentSession()` throws, the call still proceeds without
  `idToken` (the Lambda's Phase A observer logs `AUTH_NO_TOKEN` and
  proceeds; Phase B will reject).

### Files deleted

- **`lib/host-signup/hostApplyDebugLog.ts`** — Completely removed.
  No more `[host-registration]` debug strings in any production bundle.

### Dependency added

- `zustand@^5.0.13`

### Threats closed by Phase 1

- W-1 PII at rest in `localStorage` → ✅ Now `sessionStorage` via Zustand;
  dies on tab close.
- W-2 Password in `sessionStorage` → ✅ In-memory only, `pagehide`-wiped.
- W-3 Tokens/IDs in console → ✅ All debug logging removed.
- W-4 Security headers → ✅ Headers set globally.
- W-5 Open-redirect surface → ✅ URL-parser whitelist.
- W-6 Verbose Cognito errors → ✅ Generic in production.

---

## 3. Phase A — Lambda Identity Observer ✅ DONE (DEPLOYED)

Closes the *observation* side of C-1. Does **not** enforce — that's Phase B.
Both Lambdas (`users-demo` and `getstream-demo`) now extract and verify
the Cognito ID token from the request payload, compare it against the
body-supplied `userId`, and log any mismatch. They do not block.

### What's deployed in each Lambda

1. **`aws-jwt-verify@^4.0.1`** installed into `node_modules/`. Installed
   via CloudShell because the AWS Lambda console code editor's "Deploy"
   button does **not** run `npm install`. See "CloudShell command" below
   if you ever need to re-run this.

2. **New file `modules/_auth.js`** (identical content in both Lambdas).
   Exports `verifiedCallerSub(event, params)`. Returns the Cognito User
   Pool `sub` (UUID) from whichever source is available, in priority
   order:
   - `event.identity.sub` (AppSync Cognito-User-Pools-authed call — AppSync
     pre-verifies)
   - `params.idToken` / `params.cognitoIdToken` / `params.id_token`
     (direct invoke — JWT verified against `AUTH_COGNITO_USERPOOLID`)
   Returns `null` when nothing is available. The verifier is built lazily
   so a missing env var becomes a per-invocation error, not a cold-start
   crash.

3. **`index.js` observer block** in each Lambda. Inserted right after the
   existing parameter-extraction `console.log`s, **before** the main
   `switch`. Reads:
   ```js
   try {
     const verifiedSub = await verifiedCallerSub(event, params);
     // (for getstream-demo: verifiedCallerSub(event, event) — payload is flat)
     const bodyUserId = params.userId || params.userID || params.cognitoId || params.userid;
     if (verifiedSub && bodyUserId && verifiedSub !== bodyUserId) {
       console.warn("AUTH_MISMATCH", { actionType, verifiedSub, bodyUserId });
     } else if (bodyUserId && !verifiedSub) {
       console.warn("AUTH_NO_TOKEN", { actionType, bodyUserId });
     }
   } catch (e) {
     console.warn("AUTH_OBSERVER_ERROR", { message: e && e.message });
   }
   ```

### CloudShell command (reference, for re-runs)

```bash
set -euo pipefail
FN_NAME="users-demo"   # or getstream-demo
WORK=/tmp/$FN_NAME-$$
mkdir -p "$WORK" && cd "$WORK"
URL=$(aws lambda get-function --function-name "$FN_NAME" --query 'Code.Location' --output text)
curl -sS -o function.zip "$URL"
unzip -q function.zip
npm install --omit=dev aws-jwt-verify@^4.0.1
rm -f function.zip
zip -rq function-updated.zip . -x "function-updated.zip"
aws lambda update-function-code \
  --function-name "$FN_NAME" \
  --zip-file fileb://function-updated.zip \
  --no-cli-pager
```

### Initial CloudWatch observations (just after deploy)

- Mobile direct invokes producing `AUTH_NO_TOKEN`: ✅ expected.
- AppSync API_KEY-auth queries (`findTotalUserGroups` etc.) producing no
  warning: ✅ correct (no `userId` in payload).
- No `AUTH_MISMATCH` observed.
- No `AUTH_OBSERVER_ERROR` observed.
- Cold-start init: 1393ms (`users-demo`), 836ms (`getstream-demo`).
  Acceptable; the heavier `users-demo` already had many dependencies.

---

## 4. Phase B — Lambda Enforcement 🟡 TO DO

This is the change that *actually closes C-1*. Until it lands, an attacker
with a valid signed-in session can still call the Lambda with someone
else's `userId` and have the Lambda act on it.

### Pre-flight checklist

Run these CloudWatch Insights queries **for the last 7 days**, on both
log groups: `/aws/lambda/users-demo` and `/aws/lambda/getstream-demo`.

**Query 1 — must be zero:**
```
fields @timestamp, @message
| filter @message like /AUTH_MISMATCH/
| sort @timestamp desc
```
If non-zero, **stop**. Paste the log line to Claude and figure out which
flow is misaligned before flipping enforcement.

**Query 2 — must be zero:**
```
fields @timestamp, @message
| filter @message like /AUTH_OBSERVER_ERROR/
| sort @timestamp desc
```
If non-zero, the verifier is failing. Likely cause: `AUTH_COGNITO_USERPOOLID`
env var missing on the Lambda, or the Lambda is in a private VPC without
internet egress to `cognito-idp.us-east-1.amazonaws.com`.

**Query 3 — should be trending toward zero from web, plateauing from mobile:**
```
fields @timestamp, @message
| filter @message like /AUTH_NO_TOKEN/
| stats count() by bin(1d)
```
After the web deploy lands, **web-originated `AUTH_NO_TOKEN` should be 0**.
If web is still producing them, the `raiseUserLambda.ts` patch isn't
deployed. Mobile-originated `AUTH_NO_TOKEN` won't reach 0 until the
mobile app ships an `idToken`-attaching release.

### Mobile app prerequisite

For Phase B to not break mobile, the **mobile `raiseUserLambda`** must
ship the equivalent of:

```ts
const session = await Auth.currentSession();
const idToken = session.getIdToken().getJwtToken();
const body = JSON.stringify({ type, ...payload, idToken });
```

Do **not** flip Phase B until either:
1. Mobile usage of `AUTH_NO_TOKEN` is at or near zero (most users updated), or
2. You implement the hybrid Phase B+ described below.

### The Phase B diff

In **each** Lambda's `index.js`, replace the Phase A observer block with:

```js
const verifiedSub = await verifiedCallerSub(event, params);
// (getstream-demo: verifiedCallerSub(event, event))
if (!verifiedSub) {
  return {
    statusCode: 401,
    body: JSON.stringify({ error: "Unauthenticated" }),
  };
}
// Force the verified sub into every alias downstream code reads from.
params.userId   = verifiedSub;
params.userID   = verifiedSub;
params.cognitoId = verifiedSub;
```

For **`getstream-demo` specifically**, also reassign the local `userId`
that the rest of the handler reads:

```js
const userId = verifiedSub; // overrides event.cognitoId
```

### Optional: hybrid Phase B+ (gentler rollout if mobile lags)

If the mobile update is slow to roll out, use this variant instead — it
closes the impersonation hole **without** breaking clients that haven't
yet attached an `idToken`:

```js
const verifiedSub = await verifiedCallerSub(event, params);
const bodyUserId = params.userId || params.userID || params.cognitoId;
if (verifiedSub && bodyUserId && verifiedSub !== bodyUserId) {
  // Mismatch is always rejected — this is the C-1 fix.
  return { statusCode: 403, body: JSON.stringify({ error: "Identity mismatch" }) };
}
if (verifiedSub) {
  params.userId = verifiedSub;
  params.userID = verifiedSub;
  params.cognitoId = verifiedSub;
}
// Else: no verified token → fall through with body's userId (legacy clients).
```

Once mobile usage of `AUTH_NO_TOKEN` reaches near-zero, replace this with
the strict version above.

---

## 5. Phase C — AppSync Schema Directives 🟡 TO DO

Closes C-2.

### What to do

1. AWS Console → AppSync → CancerBuddy API → Schema.
2. For every `Mutation.*` field and every owner-scoped query (e.g.
   `getUser` when used in a path that returns owner-only data), confirm
   `@aws_cognito_user_pools` is present.
3. Remove `@aws_api_key` from all mutations and owner-scoped queries.
4. Keep `@aws_api_key` on truly public read-only queries (e.g. listing
   groups before sign-in, public host directories).

### Safe rollout (additive first)

AppSync fields can have multiple auth directives. Do it in two passes:

**Pass 1 — add (no breakage possible):**
```graphql
type Mutation {
  updateUser(input: UpdateUserInput!): User
    @aws_api_key                # ← keep for now
    @aws_cognito_user_pools     # ← add this
}
```
Deploy. Test mobile end-to-end. If mobile still works (it should, because
Amplify mobile defaults to user-pool auth for mutations), proceed.

**Pass 2 — subtract:**
```graphql
type Mutation {
  updateUser(input: UpdateUserInput!): User
    @aws_cognito_user_pools     # API key removed
}
```

### Verification

AppSync console → Queries → set auth mode to `API_KEY` → attempt:
```graphql
mutation { updateUser(input: { id: "some-other-users-id", bio: "test" }) { id } }
```
Must fail with `Unauthorized`. If it returns a User, C-2 is still open.

### Risk to mobile

Minimal. Confirm by searching the mobile repo for `authMode:` or by
inspecting `aws-exports.js` — mobile should already be using
`AMAZON_COGNITO_USER_POOLS` for mutations.

---

## 6. Phase D — S3 Bucket Policy 🟡 TO DO

Closes C-3.

### What to do

1. S3 console → bucket `files155829-demo` → Permissions.
2. **Block all public access** = ON.
3. Bucket policy:
   - `s3:GetObject` on `public/*` allowed only to the Cognito **authenticated**
     role (the IAM role attached to authenticated identity-pool users).
     Not `Principal: "*"`. Not the unauth role, unless you intentionally
     want unauthenticated photo viewing.
   - `s3:PutObject` allowed only to the authenticated role.

### Verification

Open a profile photo URL in incognito mode (signed out). Must return
`AccessDenied`. If it returns the image, C-3 is still open.

### Risk to mobile

Only if mobile shows profile photos to **unauthenticated** users
(e.g. landing screens, share previews). Audit the mobile repo for any
`<Image source={{ uri: ... }}>` from `files155829-demo` that runs in a
pre-signin screen. If none exist, the change is safe.

---

## 7. Phase E — API Key Rotation 🟡 TO DO

Closes C-4 (and is a good standing practice regardless).

### What to do

1. AppSync console → API → Settings → API Keys → "Create API Key"
   (365-day expiry). You now have two active keys.
2. Update mobile `aws-exports.js` → new key → ship a mobile release.
3. Update web `.env` → `NEXT_PUBLIC_AWS_APPSYNC_API_KEY` → new key →
   deploy web.
4. Wait 2–4 weeks for the bulk of mobile users to update.
5. Watch the old key's CloudWatch usage metric. When near zero, delete
   the old key in AppSync console.

### Cadence

Set a calendar reminder every 6 months. Don't let it silently expire.

---

## 8. Side-findings (informational, not in critical path)

1. **`users-demo` logs full request payloads** — the existing
   `console.log('PARAMS:', JSON.stringify(params))` includes phone numbers,
   OTP codes, FCM tokens, full names. Anyone with CloudWatch read access
   on this Lambda sees every signup attempt. **Fix when convenient:**
   replace with selective logging (action name + hashed user id).

2. **Lambdas are on Node.js 14** — End-of-life since November 2023.
   `aws-jwt-verify` and existing dependencies all support Node 18 and 20.
   Plan upgrade.

3. **`raiseUserLambda` credential cache** — Caches IAM credentials for
   58 minutes against a typical 60-minute lifetime. Edge-case clock skew
   could cause an expired-token error mid-request; the existing
   `ExpiredTokenException` retry handles it, but worth confirming the
   retry path actually fires under load.

---

## 9. Quick reference

### File paths

- **Web hardening:** `lib/aws/raiseUserLambda.ts`, `lib/host-signup/*`,
  `lib/signup/*`, `next.config.ts`, `proxy.ts`
- **Lambda code (in AWS console editor):** each of `users-demo` and
  `getstream-demo` contain `index.js`, `package.json`, and
  `modules/_auth.js`
- **CloudWatch log groups:** `/aws/lambda/users-demo`,
  `/aws/lambda/getstream-demo`

### Cloud resources

- **Cognito User Pool ID:** `us-east-1_yVzsuMa7D`
- **Cognito Identity Pool ID:** `us-east-1:51280d64-86f7-4894-a36e-81f18a6e0beb`
- **AppSync endpoint:** `at5szmf3dvdnlcb33ajb43vmgm.appsync-api.us-east-1.amazonaws.com`
- **AppSync API key (current, public — bundled to clients):**
  `da2-xypsacztpfgmrl4uqwqpoqjn5e`
- **S3 bucket:** `files155829-demo` (us-east-1)
- **Lambda env var that `_auth.js` depends on:** `AUTH_COGNITO_USERPOOLID`
  (both Lambdas have it via Amplify Params)

### Status snapshot (last updated end of session 1)

| Phase | Status      | Verifies   | Notes |
| ----- | ----------- | ---------- | ----- |
| 1     | ✅ Done     | tsc, eslint, `next build`, manual UX | Web client hardening |
| A     | ✅ Deployed | CloudWatch shows expected `AUTH_NO_TOKEN` from mobile, zero `AUTH_MISMATCH`/`AUTH_OBSERVER_ERROR` | Both Lambdas observing |
| B     | 🟡 Pending  | Pre-flight queries above must all pass | **Wait 5–7 days from web deploy** |
| C     | 🟡 Pending  | API_KEY mutation attempt must fail | After Phase B |
| D     | 🟡 Pending  | Incognito photo URL must 403 | After Phase B |
| E     | 🟡 Pending  | Old key usage drops to ~0 before deletion | After Phase C |

### Web-side commit summary

The web hardening + `idToken` work is one cohesive change set in the
current branch. `next build` succeeds, all routes prerender, no console
output in production bundles. Ready to deploy whenever the user is.
