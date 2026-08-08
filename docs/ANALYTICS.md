# Analytics

What the web app measures, and why each number means what it says.

A port of `cancerbuddyapp/src/analytics/events.ts`. Same event names, same
parameter shapes, three deliberate differences — all below.

---

## Before anything else: nothing is being sent yet

Set **`NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`** and events start flowing. Until
then every emit is logged at debug level and dropped, and that is the state this
ships in.

It is one line in `.env`, from the Firebase console →
Project settings → Your apps → the web app → `measurementId` (`G-XXXXXXXXXX`).
No code change is needed.

### It will not be mobile's property

Web push runs on its **own** Firebase project, because the mobile project
(`cancerbuddy-demo`) belongs to an account nobody on the team can open — the full
ownership hunt is in [PUSH.md](PUSH.md). Analytics inherits that. So "web on the
same funnel as mobile" means:

* the same event names, character for character
* the same parameter names and units
* two GA4 properties, joined at the reporting end

Anyone comparing the two must know that. The event contract is enforced in code
(see below); the joining is a reporting decision nobody here can make.

---

## The transport is a seam

`lib/analytics/transport.ts` resolves, in order:

| | When | Used for |
|---|---|---|
| `window.__cbAnalytics` | a stub is installed | tests, and watching events in a live session |
| Firebase Analytics | `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` is set | production |
| a debug logger | otherwise | today |

The SDK is imported on the first event, not at module load — ~100 kB that touches
`window`, the same reasoning `lib/push/pushClient.ts` documents. Events arriving
before it resolves are dropped rather than queued; a queue would hold the
earliest and most interesting events hostage to a network fetch.

**Nothing here throws, and nothing is awaited by a caller doing something for the
member.** Measuring an action must not be able to break it.

---

## The events

Names are string literals in `lib/analytics/types.ts`, so a typo fails
`tsc --noEmit` rather than producing an event nobody notices is missing.

| Event | When | `timestamp` is | Once per account |
|---|---|---|---|
| `connectWithFirstBuddy` | the channel list first returns any conversation | account age **at the earliest channel** | ✅ |
| `joinFirstGroup` | `joinGroup` completes | account age now | ✅ |
| `chatWithFirstBuddy` | a chat message sends | account age now | ✅ |
| `post` | `createPost` completes | account age now | ✅ |
| `comment` | `addComment` completes | account age now | ✅ |
| `timeToSendMessage` | every chat message | **a clock reading** | — |
| `bmcf_enrollment` | registration finishes | **a clock reading** | — |
| `new_post` | every publish, one event **per word** of the body | — | — |

Declared in the contract but not emitted yet: `openApp`, `openEnrollment`,
`filtersToSearch`, `searchTerms`. They are in the union so their names cannot
drift; `NOT_YET_EMITTED` lists them so their absence is documented rather than
silent.

### `timestamp` means two different things

This is the easiest thing here to get wrong. Mobile is inconsistent and both
behaviours are reproduced:

* The five milestones send **the account's age** —
  `diffMillisecondsDateToNow(getCreatedAt(user.id))`. "Joined their first group
  40 minutes after signing up" is the metric.
* `timeToSendMessage` and `bmcf_enrollment` send `new Date().getTime()`.

Mixing them puts epoch milliseconds into a field the reports read as a duration,
which is why they have separate entry points: `trackMilestone` versus
`trackTimeToSendMessage` / `trackEnrollmentComplete`.

`connectWithFirstBuddy` is a third case: the gap between the account being created
and the **earliest** channel being created — not the age now. A member who made a
buddy on day one still reports one day a year later. Mobile's `Math.min` over
channels, exactly.

### Account age is fetched once

Mobile re-queries `getUser { createdAt }` on every single emit. Here it is cached
per account for the life of the tab — the value cannot change, and an analytics
call has no business adding a round-trip to a path the member is standing in.

A failed lookup resolves to `null` and the event is **skipped**. The obvious
fallback, `timestamp: 0`, would read as "did this the instant they signed up" and
quietly poison the average.

---

## The once-only latch

Five events describe a *first*, so a second one is not a fact about the member.

**Keyed by account — the one deliberate improvement over mobile.** Mobile writes
bare `AsyncStorage` keys (`joinFirstGroup`, `post`). On a phone that is nearly the
same thing, because one person owns the device. A browser is not: a shared laptop,
a clinic machine, or two accounts in one profile, and the second member's first
group join is silently swallowed because the first member's flag is still there.
Every key here carries the Cognito sub.

> This is **not** the onboarding-draft storage the project forbids. What is stored
> is a boolean per account per milestone — no name, no diagnosis, no form answer —
> and the account id it is keyed by is already in localStorage inside the Amplify
> token Cognito puts there.

Every access is wrapped: Safari in private mode throws on `localStorage`, and a
flag is never worth an exception on a path the member is standing in. A throw
reads as "not fired yet", which at worst counts a milestone twice — the harmless
direction.

### Signing in closes the window

A returning member has, by definition, already had their first group and their
first conversation. `cognitoLoginService` marks all five on a `DONE` sign-in,
which is what mobile does in `Login.tsx:41-57` — except that its flags are
device-wide, so on a shared device it also silences the *next* member.

---

## Divergences from mobile

| | Mobile | Web | Why |
|---|---|---|---|
| Latch scope | the device | **the account** | A browser is shared in ways a phone is not. |
| `post` latch | reads the **`comment`** key, writes the `post` key | each milestone reads and writes its own | Mobile's bug: comment first and you can never emit `post` at all. |
| Where events fire | screen handlers | **the actions** (`joinGroup`, `createPost`, `addComment`, the send path) | A second route into posting would otherwise be unmeasured. It also puts them *after* the write — mobile counts a chat message that failed to leave the device. |
| `new_post` split | on a literal `' '` | on any whitespace | Mobile turns a newline-separated body into terms like `"first\\nsecond"`. |
| Account age | re-queried per emit | cached per account | Same value, one round-trip. |
| Property | `cancerbuddy-demo` GA4 | this project's GA4 | Nobody can open the mobile project. |

---

## Files

| File | Role |
|---|---|
| `lib/analytics/types.ts` | The event union, `ONCE_ONLY_EVENTS`, `NOT_YET_EMITTED` |
| `lib/analytics/latch.ts` | Per-account once-only storage |
| `lib/analytics/transport.ts` | Where events go, and the seam |
| `lib/analytics/accountAge.ts` | Cached `createdAt` → age in ms |
| `lib/analytics/emitEvent.ts` | The switch, and the `new_post` fan-out |
| `lib/analytics/index.ts` | `trackMilestone` and friends — what call sites use |
| `lib/analytics/analyticsSweep.test.ts` | Phase 9 acceptance checks |

Call sites: `lib/groups/membership.ts`, `lib/groups/posts.ts`,
`lib/chat/useChannelMessages.ts`, `lib/chat/useChannelList.ts`,
`lib/user-signup/userEnrollmentFinalize.ts`, `lib/login/cognitoLoginService.ts`.

---

## Watching events without a measurement id

```js
window.__cbAnalytics = { track: (n, p) => console.log("📊", n, p) };
```

Paste that in the console and every event prints as it happens. It is the same
seam the tests use.
