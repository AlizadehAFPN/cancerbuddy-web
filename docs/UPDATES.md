# Updates tab (`/notifications`)

The web port of mobile's **Updates** tab. Two tabs: a feed of everything that
happened, and the buddy requests waiting for an answer.

Mobile's version lives in
`cancerbuddyapp/src/screens/notifications/HomeNotifications.tsx`, with the
requests half in `src/screens/requestBuddies/HomeRequestBuddies.tsx`. Read
those before changing anything here.

---

## 1. Where the data comes from

`searchNotifications` on AppSync — an OpenSearch-backed query over the
`Notifications` table. Notifications are written server-side by the users
Lambda and the SQS pipeline; **no client ever writes one**, and this screen
performs no mutations at all beyond accepting or dismissing a buddy request.

The sentence a member reads is `typeNotification`, composed when the row is
written. Both apps print it verbatim. That is why "Posted in" reads as a
fragment until the group name renders underneath it, and why `COMMENT` rows
arrive already carrying their group in parentheses. Do not try to build these
strings client-side; they are not ours.

### `type` values in production

Swept from 800 live rows:

| `type` | share | has group | `typeNotification` example |
|---|---|---|---|
| `POST` | 94% | yes | `Posted in` |
| `COMMENT` | 2% | yes | `(Multiple Myeloma Group): Sev commented on your post` |
| `MESSAGE` | 1% | no | `Sent you a message` |
| `FRIEND_REQUEST` | <1% | no | `Maggie sent you a friend request` |
| `BUDDY` | <1% | no | `You are now buddies with Tom` |
| `LIKE` | <1% | yes | `Liked your post on` |
| `REPLY` | <1% | yes | `Replied to your comment on` |
| `NEWUSER` | <1% | yes | `Sev joined your Fitness & Wellness. Tap to see` |

Mobile's router has a `case 'COMMENT_REPLY'`. **No row carries that value** —
the real ones are `COMMENT` and `REPLY`, which fall through mobile's `default`.
`routing.ts` names them explicitly and lands in the same place.

---

## 2. The `read` flag is dead, and why that shapes the screen

**Every notification in the table has `read: false`.** All 10,000 in the search
index and all 1,000 sampled straight from DynamoDB. The pipeline is live —
notifications arrive by the minute — so this is not stale data.

The cause is in the users Lambda (`users-demo`, `modules/notifications.js`):

```js
const readAllNotificationsByUser = async (idUser) => {
  await ddb.update({
    TableName: GetTableName("Notifications"),
    Key: { userId: idUser },          // ← the table's key is `id`
    UpdateExpression: 'SET #read = :readValue',
    ExpressionAttributeValues: { ':readValue': true },
  }).promise();
}
```

Three independent faults:

1. **Wrong key.** `Notifications-…-demo` has partition key `id` and **no GSIs**
   (433,539 items). `Key: { userId }` is not a valid key, so DynamoDB answers
   `ValidationException`.
2. **Wrong argument.** `index.js` calls `readAllNotificationsByUser(rest)`,
   where `rest` is the remaining event object — `{ userId: "…" }`, an object,
   not the string the function treats it as.
3. **Wrong operation.** `ddb.update` changes exactly one item by primary key.
   "Mark all of a user's notifications read" needs a query and a write per row,
   and with no index on `userId` finding them means scanning 433k items.

The error is swallowed twice — `.catch(ErrorHandler)` in the Lambda, and a
`try/catch` that only `console.error`s in mobile — so it fails silently on
every call.

### What this means here

- The web **does not call that Lambda.** Pretending to mark things read while
  nothing happens is worse than not claiming to.
- The web **omits mobile's `read: {eq: false}` filter.** Today that filter is a
  no-op and both apps return identical rows (verified: 1014 vs 1014 on a real
  account). Omitting it means the web keeps its history if the Lambda is ever
  fixed, instead of emptying itself after one visit.
- There is **no unread styling and no unread count**, because there is no data
  for one. The Updates badge counts buddy requests instead.

### Fixing the Lambda later

Fixing it in isolation **would change the mobile app for current users**: their
Updates list filters on `read: false`, so the first working call would empty
it. Any fix has to ship with a change to mobile's query. It also needs a GSI on
`userId`, or the scan cost is prohibitive.

---

## 3. Divergences from mobile

Each of these is a deliberate decision, not an oversight.

| # | Mobile | Web | Why |
|---|---|---|---|
| 1 | De-duplicates rows with `Map.set(createdAt, row)` | De-duplicates by `id` | Two notifications written in the same millisecond collapse into one. On a real account's feed that discards ~2% of it (400 rows → 392). Ids are unique by construction. |
| 2 | Queries `read: {eq: false}` | No `read` filter | See §2. Identical output today; survives a Lambda fix. |
| 3 | Calls `readNotifications` on every render where the list changes | Never calls it | See §2. |
| 4 | Renders negative ages on clock skew (`-1h`) | Clamps to `Just Now` | Same information without the glitch. |
| 5 | Requests live only under Updates | Also on `/buddies` | The web already shipped them there. Both render the same `RequestCard` through the same `useRequests` hook. |
| 6 | Opens `PostDetail`, a dedicated screen | Opens the `PostThread` sheet over the group feed | Same content — one post and its comments. The web already had the sheet; a second route would have duplicated it. |

Everything else matches, including the quirks:

- **"Just Now" covers two minutes.** The check is `minutes > 1`, so 0 and 1
  both read "Just Now" and "2m" is the first number shown.
- **Hours never round.** 90 minutes is "1h"; 23h59m is "23h".
- **"Last 30 days" is the last bucket.** Mobile's final `return` repeats that
  category, so a six-month-old notification sits under it reading "26w".
  Reproduced. Adding an "Older" bucket is a five-line change in `grouping.ts`
  if that heading is judged misleading enough to fix.

---

## 4. Files

| File | Role |
|---|---|
| `lib/notifications/types.ts` | Row shape and the `type` union |
| `lib/notifications/fetch.ts` | The query, pagination, id-based merge |
| `lib/notifications/grouping.ts` | Buckets and relative ages |
| `lib/notifications/routing.ts` | Notification → destination |
| `lib/notifications/useNotifications.ts` | First page, more pages, refresh |
| `components/notifications/UpdatesScreen.tsx` | The screen and its two tabs |
| `components/notifications/NotificationRow.tsx` | One row |
| `components/notifications/RequestsPanel.tsx` | The requests tab |
| `app/(app)/notifications/layout.tsx` | Scoped `BuddiesProvider` |
| `lib/buddies/usePendingRequestCount.ts` | The nav badge |

`BuddiesProvider` is scoped to this route rather than hoisted to the app
layout: it pages through the user's whole connection map, and Chat, Groups and
Profile have no reason to pay for that scan. The two screens each hold an
instance and refetch on entry.

---

## 5. Deep links into a group

Clicking a post notification opens `/groups/{id}?post=…&feed=…&reaction=…`.
`GroupFeed` reads those and opens the post's thread; `reaction` expands and
scrolls to one comment (mobile's `highlightParentReactionId`).

Only the ids are needed — `PostThread` refetches and replaces every other
field, exactly as mobile hands `PostDetail` a bare `{id, feedId}`. Without the
parameters none of this runs and the feed renders as before.

`parentReactionId` is currently null on every production row, so the highlight
path is built for parity but unexercised.

---

## 6. Tests

Written per step, run against live production data. They live in the session
scratchpad rather than the repo — there is no test runner here yet.

| Step | Coverage | Result |
|---|---|---|
| Data layer | Filter, ordering, pagination, id uniqueness, on an account with 1014 notifications | 11/11 |
| Grouping | Every boundary, plus a differential against a transcription of mobile's moment arithmetic over 200,000 ages | 39/39 |
| Routing | Every branch of `handleDetail`, then replayed over 1000 live rows — zero dead ends | 21/21 |
| Deep link | Ids round-tripped through URL and back on 973 real notifications, including ids with spaces, `&`, `/` and unicode | 19/19 |
| Badge | Count query vs list query on 12 real accounts, including a deleted sender | 7/7 |

---

## 7. Known gaps

- **`next build` cannot run** while `lib/live/` and `components/live/`
  reference 123 `app.live.*` i18n keys that don't exist in
  `lib/i18n/locales/en.ts`. Unrelated to this feature; `tsc` and ESLint are
  clean across every file here.
- **Not verified in a browser.** No browser automation is available in this
  environment, so the screen has been type-checked, linted and tested at the
  data layer, but not seen rendering.
