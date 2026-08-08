# Auth and registration

Everything between "I have no account" and "I am inside the app": `/register`,
`/login`, `/forgot-password`, and the shared-link landing at `/buddyId/:id`.

Cognito is the only identity store. There is no session cookie, no server-side
session table, and no NextAuth — Amplify's `Auth` holds the tokens in
localStorage (see [SECURITY.md](SECURITY.md) for why cookie storage was
abandoned) and every AppSync call authenticates from there.

> Two files used to suggest otherwise. `lib/auth.ts` exported `getSession`,
> `createSession` and `verifySession` as commented-out intentions, and
> `app/actions/auth.ts` had a `loginAction` that redirected to `/dashboard`.
> Nothing imported either. They were scaffolding from the initial template and
> are gone; if you are looking for "where is the session created", the answer is
> that there isn't one.

---

## Registration

`/register` is one route with a `?step=` query and a forward-only watermark
(`lib/navigation/userStepGate.ts`). `USER_FLOW_ORDER` is the single ordered
list; reachability, Back targets and the progress strip are all derived from it.

### The two branches

Mobile's `enrollmentPath` is **linear** — one array, walked front to back
(`cancerbuddyapp/src/context/enrollment/EnrollmentProvider.utils.tsx:25-32`):

```
… role → CGRelationship → CGPatientAge → Diagnosis → MedicalCenter → Address → …
          └────── caregiver only ──────┘ └───── everyone ──────┘
```

The only jump is at the role step, where `RedirectNextRoleConditionUtil` returns
`1` for a caregiver and `3` for everyone else — that is, non-caregivers *skip the
caregiver pair*. **Nobody skips the medical pair.**

Web read that backwards and sent caregivers from patient age straight to
`address`, so every caregiver who signed up on the web finished with no
diagnosis, no treatment status and no hospital — which is most of what buddy
matching runs on. Both roles now walk `diagnosis → medicalCenter → address`.

Back out of Diagnosis is role-dependent for the same reason (mobile's
`BackDiagnosisCondition` reuses the role calculator): a caregiver returns to
patient age, everyone else to the role picker. `address` is no longer a special
case, because both roles now arrive there from `medicalCenter`.

On the diagnosis screen itself, **`CAREGIVER` behaves as `PATIENT`** — mobile
gates treatment status on `userType !== SURVIVOR` and shows the remission field
to survivors only. `StepDiagnosis` takes the real role now; the
`=== "SURVIVOR" ? … : "PATIENT"` coercion at the call site is what erased the
caregiver before.

### Progress

`lib/user-signup/progress.ts` owns the strip. It is an exhaustive
`Record<UserRegisterStep, number>` rather than a derived list, so adding a step
to the union without ranking it fails `tsc --noEmit` — the previous six-entry
tuple silently left fourteen steps with no strip at all.

`intro`, `loading` and `done` carry a rank to keep the record exhaustive but are
excluded from display: none is a step the member works through.

Both branches share one denominator, as mobile does. A caregiver skips ranks
rather than seeing a different total.

### Resuming a half-finished signup

`startUserSignup` on an email Cognito already knows tries to sign in, and the
`UserNotConfirmedException` branch means "account exists, email never
confirmed". That branch **sends a fresh confirmation code before returning**,
which is mobile's order (`authUtils.ts:28-37`: `resendSignUp` → `markCodeSent`
→ hand off to the OTP screen). It previously returned having sent nothing while
the screen said "enter the code we sent you" and Resend arrived locked behind a
60-second countdown; any code from the abandoned attempt expires in 24 hours.

Resend staying locked on arrival is correct and matches mobile — a code really
was just sent. Both the member and host services route every send through one
`sendConfirmationCode`, and a test pins each file to a single
`Auth.resendSignUp`.

### The phone echo

`verifiedSuccessfully` renders the E.164 number that was verified, which is the
entire content of mobile's screen. It is the last moment a mistyped digit can be
caught with a step to go back to.

---

## Sign-in

`lib/login/cognitoLoginService.ts`: `Auth.signIn`, then the AppSync user row,
then a classification — `DONE`, `RESUME_PHONE`, `RESUME_USER_ROLE`,
`NOT_CONFIRMED`, `WRONG_CREDENTIALS`. The resume statuses land mid-wizard with
`?resumed=1` so the banner there can explain itself.

### The login bootstrap

A `DONE` sign-in also invokes the `login` verb on `USERS_LAMBDA`
(`lib/login/loginBootstrap.ts`). Mobile runs this on **every** login
(`useAuth.ts:225` → `LoginInLambdaUtil`); web only ever ran it once, from
`userEnrollmentFinalize`, so a member who registered on the phone and then
signed in on the web never re-ran it.

Two deliberate differences:

| | Mobile | Web |
| --- | --- | --- |
| FCM token | Passed in the payload | `undefined` — the device registers directly with Stream, see [PUSH.md](PUSH.md) |
| On failure | Aborts the login | Logged, sign-in continues — the Cognito session already exists, and aborting would strand a signed-in member on a login screen |

It runs only for `DONE`, which is also mobile's rule: `logIn` diverts anyone
without a `userType` into the signup stack and never reaches the bootstrap.

---

## Password reset

`/forgot-password`. The login screen had linked here since it was built, and the
route did not exist — the link rendered `app/not-found.tsx`, so the only way back
into an account was to install the mobile app.

Two Cognito calls, the same two mobile makes (`authUtils.ts:126-150`):
`Auth.forgotPassword`, then `Auth.forgotPasswordSubmit`. No Lambda, no AppSync
row, nothing to remember between them but the email. The username is the plain
lowercased email — **not** `resolveUserPoolUsername`, whose stash only exists
inside a signup session that someone resetting their password has not started.

Mobile is one screen that fires the send on focus. Web splits it in two:

1. **email** → send the code
2. **code + new password** → reset, then sign in and route by the login
   service's classification, exactly as mobile signs in on success

A URL has no "on focus" moment; sending on arrival would mail a new code on every
refresh, and asking for the email first is what lets the flow survive a reload.

Three rules worth keeping:

* **An unknown email reaches the same screen as a known one.** Cognito
  distinguishes them; echoing that back would make the form a way to enumerate
  who has an account in a cancer-support community. `UNKNOWN_EMAIL` is returned
  by the service for logging and never reaches the UI.
* **An unconfirmed account is sent to registration instead.** There is no
  verified address to mail a reset code to, and Cognito reports this as a generic
  `InvalidParameterException`.
* **The password rules are the signup rules.** A test asserts the two schemas
  agree on every sample, so a password accepted at signup is never refused at
  reset.

---

## Shared Buddy-ID links

`/buddyId/:buddyId` is the URL the mobile app writes into its QR code and share
sheet (`https://cancerbuddy.bonemarrow.org/buddyId/<id>`), mirrored by
`/profile/buddy-id`. Until it existed, every code this product generates
resolved to a 404 in a browser.

It sits inside the `(app)` route group — the group name is not part of the URL —
so the link lands behind the same auth and providers as everything else. The
guard ladder needs the viewer's own row to apply the age rule.

The ladder itself is `evaluateBuddyIdMatch` in `lib/buddies/useBuddyIdLookup.ts`,
shared with the lookup field and the sheet. What differs per entry point is what
each refusal *does*:

| Outcome | Landing route | The sheet |
| --- | --- | --- |
| `ok` | the profile | the profile |
| `ageRule` | the profile, connect withheld, reason on screen | same |
| `self` | **`/profile`** — mobile navigates Home → Profile | a message, stay put |
| `snoozed` / `notFound` | a node on this page saying so | a message, stay put |

The refusals render here rather than redirecting to `app/not-found.tsx` because
"no such page" is the wrong answer to "that person has paused their account".
The outcome carries a `reason` alongside the copy so callers can branch on it
without matching on message text.
