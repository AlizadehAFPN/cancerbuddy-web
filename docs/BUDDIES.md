# Buddies & requests (`/buddies`)

The web port of mobile's **Buddies** and **RequestBuddies** tabs. Discovery's
architecture — the ids-then-batched-profiles pipeline and the two deliberate
filter divergences — is documented in `lib/buddies/discoveryFetch.ts`; this file
records the **Phase 4 parity sweep** and the decisions inside it that are not
obvious from the code.

Mobile sources: `cancerbuddyapp/src/screens/buddies/**`,
`src/screens/requestBuddies/**`, `src/hooks/useValidateRules.ts`.

---

## 1. Snooze and the age bracket gate the profile, not just the query

Web filtered snoozed accounts out of the **discovery query** and nowhere else.
Every other route to a profile — a group's member list, a Buddy ID, a post
author, a shared link — therefore showed a live Connect button for someone who
had opted out of new connections, or for someone in a different age bracket.

`showConnectAction` (`lib/buddies/connectContext.ts`) is mobile's disjunction
from `ConnectionButtonBar.tsx:39`:

```
showButtons || isBuddy || isPendingConnection || isAlreadyBuddy
```

The second half is load-bearing and easy to drop: snooze must not strand an
**existing** relationship. Someone who snoozed after you connected is still
someone you can open a chat with, and a request you already sent is still one you
can cancel. Only a *new* invite is refused.

Which age rule matters here: the **looser** `connectAgeRulesBuddySearching`, not
the strict `connectAgeRules` Phase 3 ported for post authors. The strict one has
exactly two call sites on mobile and this is not one of them.

---

## 2. The explanation persists — `?notice=`

Mobile shows a `FeedbackCard` under the name for as long as the profile is open.
Web had toasts, which is the wrong shape twice over: a toast is gone before the
profile finishes loading, and it never fires at all when the profile is opened
from a link rather than from the action that caused the state.

Four keys, copy taken verbatim from mobile's `TOAST_COPY_MESSAGES_SCANNER` so a
member who scans a QR on the phone and opens the link in a browser reads the same
sentence: `sentInvite`, `alreadyBuddies`, `ageRule`, `snoozeAccount`.

Two producers, which is how mobile does it too:

- **Explicit** — the Buddy-ID ladder passes what it learned
  (`/buddies/<id>?notice=ageRule`), the way `useValidateRules` passes a `message`
  navigation param. `isProfileNotice()` guards the value, so a URL cannot inject
  copy.
- **Derived** — a pending invite speaks for itself, so the profile shows
  `sentInvite` on *every* route in, matching mobile's `UserInfo.tsx:197`.

`alreadyBuddies` is deliberately **not** derived. Mobile shows it as a toast from
the scanner path only, and a permanent "you two are already Buddies!" banner on
every buddy's profile would be noise. The Buddy-ID sheet passes it explicitly,
which is exactly where mobile shows it.

### The age rule opens the profile; snooze does not

This is the one place Phase 1's implementation had drifted. Mobile's ladder:

| Guard | What mobile does |
|---|---|
| not found / invalid | toast, stay |
| snoozed | toast, **stay** |
| yourself | toast, go to your own profile |
| age bracket | **open the profile** with `showButtons:false` and the reason |
| otherwise | open it, with pending/accepted context attached |

Phase 1 treated the age case as an inline error. It is more use to open the
profile: an error next to a Buddy ID tells you nothing about who you just looked
up. Both entry points (`BuddyIdSheet`, `/profile/buddy-id`) now run the shared
hook rather than a private copy of the ladder — the sheet had its own, which is
how the two drifted apart in the first place.

---

## 3. Pending is a state, not a button that withdraws

Web rendered "Withdraw invite" and deleted the connection on a single click. A
mis-click cancelled an invite the other person might have been about to accept,
with no undo and no confirmation.

Mobile's flow, reproduced in `components/buddies/ProfileActionBar.tsx`:

1. the primary button reads **Pending** and carries an info affordance
2. tapping it opens an *informational* dialog — GOT IT / CANCEL REQUEST
3. CANCEL REQUEST opens a **second** dialog — "Are you sure…" / YES, CANCEL REQUEST
4. only that second confirm deletes anything

A test pins the invariant that matters: `onCancelRequest` is referenced exactly
once in the whole component, from the second dialog's confirm.

**Maybe later** — declining *their* request from their profile — only exists when
the profile was opened from a request card, because the incoming connection's id
is the only thing that identifies which row to delete. Both request surfaces pass
it as `?connectionId=`, as mobile passes it as a navigation param.

---

## 4. A request card says what you have in common

The card's subtitle was the sender's **bio**. Mobile computes the shared
categories against the viewer (`utils/coincidences.ts`) and shows
"New York, interests, medical center" — different information entirely, and the
information that answers "why is this stranger writing to me?".

`matchSummary()` already existed for discovery cards and was simply never called
here. Two changes made it possible:

- The pending-requests query now selects the sender's Interests, Hospitals,
  Treatments and Diagnosis, and `PendingRequest.remitent` types them as
  **required** — a card that quietly fell back to nothing would read as two
  people with nothing in common.
- `matchSummary` takes a structural `MatchSubject` rather than a full
  `BuddyProfile`, because a request's sender carries only those four categories.

While the viewer's own relations load the subtitle is `…`, which is what mobile
renders.

---

## 5. Previous / Next works from a request

`lib/buddies/discoveryOrder.ts` only ever held the discovery list, so opening a
sender's profile from a request was a dead end — a member with eleven requests
went back to the list eleven times. `setNeighbourQueue(ids, source)` takes either
list; both request surfaces seed it with every pending sender on click. Last
writer wins, so walking from a request into discovery pages through discovery.

---

## 6. The ambassador badge does something

The AMBASSADOR pill was a static `<span>` on four surfaces, so the whole
programme was invisible to anyone who had not already been told about it. It is
now a button opening mobile's `ModalAmbassador`:

- **someone else's badge** → what an ambassador is, a link to the Google Form
  (mobile's URL verbatim), and "learn more"
- **your own** → the thank-you variant with DISMISS and no form link

"Learn more" is a four-step ladder and the order matters:
`createSupportConnection` (who is my support contact) → find-or-create our 1:1
channel → `ambassadorMessage` → open the conversation.

**The verb is `ambassadorMessage`.** The constant is named
`CREATE_AMBASSADOR_MESSAGE` and the Lambda rejects that string. A test asserts
the literal.

`fetchSupportUserId` was extracted from `lib/host-signup/bootstrapSupportChannel.ts`
rather than written again — that Lambda's envelope is double-encoded often enough
that a second parser would be a second thing to get wrong.

---

## 7. Sharing the app shared the wrong link

Both share surfaces — the discovery empty state and the account sheet — copied
`window.location.origin`: the web app's front page, the one place a friend cannot
install the app from. Mobile shares the store link held in Contentful
(`appStoreLinkCollection.items[0].appLink`) and renders it as a QR.

`getShareUrl()` proxies through `/api/contentful/app-link` (the delivery token
stays on the server, as with ads) and falls back to the foundation's website
exactly as mobile's Copy Link does. The QR uses the same `qrcode` canvas
renderer as `/profile/buddy-id`.

---

## 8. Photos open

The PHOTOS grid was inert — thumbnails and nothing else, where mobile pushes a
full `GalleryScreen`. Three fixes: newest-first order (mobile's `orderDates`,
which is why `createdAt` is in the query), a dialog viewer with Escape and arrow
keys, and a **count of photos that failed to sign** instead of dropping them
silently. A gallery that is quietly two short reads as "they only posted three".

---

## 9. One item was already built

`buddy-recommendation-dismiss` claimed "there is no way to, and it returns on
every load". Both halves were already false: `BuddyCard` has a dismiss control
behind a confirmation, `hideUserFromDiscovery` writes the same `blocked: true`
connection row mobile's `omitConnectionUser` writes, and `fetchBlockedUserIds`
screens it out of the next scan. Pinned with tests rather than rebuilt.
