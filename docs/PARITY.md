# Mobile → Web feature parity

The complete inventory of what the mobile app (`~/cancerbuddyapp`) does that the web
app does not, produced 2026-08-07 by reading both codebases end to end.

**The point of this document is that you should not have to open the mobile repo
again.** Every mobile screen, sub-screen, form field, filter option, modal, overflow
action, notification type, Lambda verb, analytics event and enum member was
enumerated and matched against its web counterpart. If something is not in here, it
was checked and found to be at parity.

## The documents

| Doc | Area | ❌ missing | ⚠️ partial |
|---|---|---|---|
| [00-navigation-map.md](parity/00-navigation-map.md) | Every mobile route vs every web route — read this first | — | — |
| [buddies.md](parity/buddies.md) | Buddies tab + Request Buddies tab (~350 capabilities) | 71 | 67 |
| [groups-feeds.md](parity/groups-feeds.md) | Groups/Feeds, posts, comments, hosts (256 capabilities, 22 screens) | 69 | 50 |
| [cross-cutting.md](parity/cross-cutting.md) | Shared components, providers, hooks, Lambdas, analytics, enums (~340 items) | 73 | 113 |
| [drawer-settings.md](parity/drawer-settings.md) | Drawer, Settings, Partners, Funders, change-status | 63 | 18 |
| [profile.md](parity/profile.md) | Profile — field-level (301 rows) | 57 | 81 |
| [chat-connections.md](parity/chat-connections.md) | Chat/messaging + the buddy-connection state machine | 40 | 23 |
| [updates-notifications.md](parity/updates-notifications.md) | Updates tab + the push subsystem | 30 | 27 |
| [auth-onboarding.md](parity/auth-onboarding.md) | Sign-in, registration wizard, app status, deep links | 26 | 24 |
| [live-streaming.md](parity/live-streaming.md) | Twilio room, live calendar, event lifecycle | 31 | 12 |
| **Total** | | **460** | **395** |

`❌` = no web equivalent. `⚠️` = exists but behaves, validates, or renders differently
— each row says exactly how.

## How to read a finding

Every screen section carries a table of individually numbered capabilities with the
mobile data source (GraphQL operation, Lambda verb, Stream call, Contentful query)
and a plain-language "Missing on web" list underneath. Deliberate divergences that
were decided on purpose during earlier ports are labelled as such rather than
counted as regressions — do not "fix" those.

## Scope notes that change what parity means

- **The mobile `Live` tab is not shipped.** `src/navigation/tabs/TabsNavigator.tsx`
  returns `null` for it unconditionally, and the IVS screens behind it are gutted
  stubs. Live parity means the **Twilio room** reached from Groups, not a streaming
  tab. See [live-streaming.md](parity/live-streaming.md).
- **The `TabsNavigator` enum values do not match their keys** — three of five tabs
  map to the wrong screen if you read the key. See
  [00-navigation-map.md](parity/00-navigation-map.md).
- **Some mobile screens are unreachable dead code** (`userRecoveryGroup`'s three
  screens, `PrivacyTermsAlertChild`, `PersonalInfoNotification`, mobile's
  `ChatListEmptyState` and `CustomFileAttachment`). They are flagged where they
  appear so nobody ports them.
- **Web is ahead of mobile in places** — per-message timestamps, read receipts, send
  state and retry, message search, journal paging, error states with retry, and
  stated reasons on disabled Save buttons. These are marked `➕` and must survive a
  parity pass.

## Stale documentation found along the way

| File | Problem |
|---|---|
| `docs/signup-flow-plan.md` | Describes a 4-step `/signup` mock with localStorage drafts and social-login stubs. None of that is true any more. |
| `components/app-shell/navState.ts` | Comment says badges are unwired; `AppShell.tsx:36-40` wires them. |
| `lib/push/config.ts` | Docblock says nobody has console access; push is configured and live. |
| `lib/profile/manageLives.ts:10`, `lib/groups/liveGroups.ts:5-6` | Claim the live room is not implemented on web; it is. |
| `public/firebase-messaging-sw.js` | Comment calls `/notifications` a placeholder; it is a real screen. |
| `lib/notifications/fetch.ts:83` | Says page size 20 is "mobile's page size"; mobile pages at 10. |

---

# Verified backlog

Thirteen of the highest-impact findings above were each re-checked by an independent
verifier instructed to **refute** them — reading both repos, hunting for the guard,
wrapper or second call site that would make the claim false. One was refuted
outright. Five came back `PARTLY_WRONG`: the underlying problem is real but the
original mechanism, scope or severity was misstated. **Read the PARTLY_WRONG notes
before acting** — several would otherwise send you to fix the wrong thing.

Everything else in the area docs is unverified single-pass analysis. It was produced
by reading the source rather than guessing, but it has not been adversarially
checked — treat a claim as a strong lead, not a settled fact, until you have opened
the file.

## Verified critical findings

| # | Finding | Verdict | User impact | Severity | Fix |
|---|---|---|---|---|---|
| 1 | **Host post-deletion silently does nothing.** `lib/groups/posts.ts:323-328` deletes via `session.userFeed.removeActivity(activityId)` — and `session.userFeed` is the **caller's own** feed (`lib/groups/feedClient.ts:67`). Mobile's group feed never uses `removeActivity`; it calls the USERS_LAMBDA `deleteMessage` verb unconditionally, for the author's own post *and* for moderation (`ConfirmPost.modal.tsx:35-48`, verb at `types/utils/lambda.ts:28`). **Author self-delete happens to work** — the author is the origin feed, so GetStream cascades to the `to:` target added at `posts.ts:297`. A host deleting a *foreign* post passes an activity id that is absent from their own feed: GetStream returns success, `useGroupFeed.ts:211` optimistically filters the row out, and `GroupFeed.tsx:240` toasts `postDeleted`. Comments are never routed through `deleteMessage` either (mobile sends `isPost:false` + `commentId`). | CONFIRMED | A host "removes" abusive or harmful content from a support group, sees a success toast, and the post is still live for every member — reappearing on their own next refresh. | **critical** | Add `DELETE_MESSAGE: "deleteMessage"` to the Groups block of `lib/aws/lambdaPayload.ts`; rewrite `deletePost` (`lib/groups/posts.ts:323`) to `raiseUserLambda(…usersLambdaName(), {type, feedId: post.feedId, postId: post.id, commentId: post.id, isPost: true})` — the signature must take the `FeedPost`, not a bare id (`feedId` is already on `FeedPost`, `lib/groups/types.ts:126`). Parse `convertResponse.success` **before** the optimistic removal and surface failure instead of toasting success. |
| 2 | **SUPPORT staff lose group-post moderation.** `GroupFeed.tsx:179-182` returns `displayGroup.hosts.some((h) => h.id === userId)` — hosts only; `userType` is not read in the component at all. Mobile grants both `deletePost` and `isHostPost` to `hosts.some(…) \|\| userType === UserType.SUPPORT` (`Post.fragment.tsx:148-149, 157-159`). | CONFIRMED | SUPPORT staff see no delete or pin affordance on group posts on web and must escalate to a group host to remove reported content. | medium | Thread `userType` into `GroupFeed.tsx` (`UserType` already exists at `lib/profile/types.ts:16`) and make it `hosts.some(…) \|\| userType === UserType.SUPPORT`. **Sequence after finding 1** — granting the button first would ship an affordance that silently no-ops. |
| 3 | **Caregiver registration skips Diagnosis + Medical Center.** `app/register/page.tsx:916` routes `cgPatientAge → address` (back-target mirrored at `:515-524`), and `StepDiagnosis.tsx:27` has no CAREGIVER variant, so finalize writes zero diagnosis/hospital/support-org join rows. Mobile walks CGPatientAge(16) → PatientDiagnosis(17) → PatientMedicalCenter(18) → Address(19) and requires diagnosis. **PARTLY_WRONG — scope, not mechanism:** the data is *not* permanently uncollectable; `/profile/medical` (`components/profile/MedicalInfoForm.tsx`) collects all three post-signup in a caregiver "about the patient" mode. Do not build a new capture surface — just make the registration steps reachable. | PARTLY_WRONG | Caregivers land in the app with an empty medical record — the exact fields buddy discovery filters on (`lib/buddies/filterConditions.ts:199-236`) — so they get poor matches until they find the incomplete card in Profile themselves. | high | Route `cgPatientAge → diagnosis`; delete the CAREGIVER back-nav special case; widen `StepDiagnosis` prop to include CAREGIVER and stop the `PATIENT`/`SURVIVOR` coercion at `page.tsx:1115-1122`; reuse `medicalRulesFor` (`lib/profile/medicalInfo.ts:294-311`) for copy/rules. |
| 4 | **/support submits to a mock.** `lib/support/service.ts:9` unconditionally exports `mockSupportService`; `mockService.ts:13-23` takes **zero arguments** and invents `CB-XXXX-XXXX` after a 600 ms timeout. The form then shows a checkmark, "we'll be in touch", the fake ticket id and a Copy-ID button (`SupportForm.tsx:178,186-231`) — an affirmative receipt for a message never transmitted. Mobile POSTs to USERS_LAMBDA type `supportemail` with `{subject, text, userId}`. | CONFIRMED | A patient or caregiver reporting a bug, billing problem or abusive content gets a ticket number to copy while the message is discarded in the browser; no one at CancerBuddy ever receives it. | high | Immediately: guard the mock behind `NODE_ENV !== "production"` and throw otherwise, so the existing `support.form.couldntSend` error shows. Then add `COMMENTS: "supportemail"` to `lib/aws/lambdaPayload.ts` and a real service (mirror `components/auth/HelpDialog.tsx:479-500`); /support is public, so either grant the unauth identity-pool role invoke rights or add `app/api/support/route.ts`. Drop the ticket-id block and the attachment picker (the Lambda has no slot for either). |
| 5 | **No password reset on web.** `app/(auth)/login/page.tsx:368` links to `/forgot-password`, which has no route, no catch-all, and no rewrite — it renders `app/not-found.tsx`. `cognitoLoginService.ts:119` tells NEW_PASSWORD_REQUIRED users to use that very link. The `forgotPasswordAction` stub at `app/actions/auth.ts:66` is **not** in the causal chain — nothing imports it; implementing it alone fixes nothing. | CONFIRMED | A user who forgets their password (or whose Cognito account is in NEW_PASSWORD_REQUIRED) hits a 404 and cannot recover their account on web at all — the only escape is installing the mobile app. | high | Add `app/(auth)/forgot-password/page.tsx` (email step, reusing `forgotPasswordSchema` at `lib/validations.ts:21`) plus a code + new-password step, backed by a new `lib/login/cognitoPasswordResetService.ts` wrapping `Auth.forgotPassword` / `Auth.forgotPasswordSubmit` **client-side** (same Amplify/localStorage context as login). Delete the dead `loginAction`/`forgotPasswordAction` stubs. |
| 6 | **LIVE badges never check `inLive`.** `lib/groups/groupQueries.ts:126-136` omits both mobile's server-side `filter: { inLive: { eq: true } }` and `limit: ${RESULT_LIMIT}` (the constant already exists at line 13 and is used by two sibling queries), and the client filters only on `groupId` truthiness (`:302`). Rows are written at schedule time with `inLive: false` and are flagged, never deleted, when a session ends — so ended/archived sessions are in the set too, and `liveEventIdFor` can hand "Join live" a months-old session id. Second failure mode from the same omission: once the table outgrows AppSync's default page size, a genuinely-live group can get *no* badge. | CONFIRMED | Every group with any past or upcoming session shows a permanent red LIVE pill, occupies the sidebar's "Your live groups" section, inflates the calendar badge, and offers a "Join live" button into an ended or not-yet-started room — so the LIVE signal becomes noise. | high | One-line query fix restoring the filter + `RESULT_LIMIT`; plus defence-in-depth `.filter((g) => g?.groupId && g.inLive === true)` at `groupQueries.ts:302`. No consumer changes — GroupFeed, GroupsSidebar and LiveCalendar all read through `liveGroupIds`/`liveEventIdFor`. Consider `nextToken` paging as `fetchAllGroups` does (`:256-273`). |
| 7 | **Buddy Connect ignores age bracket and snooze.** `components/buddies/BuddyProfileScreen.tsx:447-481` gates Connect only on `!isSelf && !isSupportAccount` — no `connectAgeRulesBuddySearching`, no `isSnooze`; and `components/profile/BuddyIdScreen.tsx:88-99` opens a looked-up profile with no guard, while its sibling `BuddyIdSheet.tsx:64-70` and mobile's `useValidateRules.ts:211` both apply the check. **PARTLY_WRONG — different pairing than claimed:** the missing strict `connectAgeRules` is irrelevant (it guards only mobile's tappable post-author avatar, a surface web lacks). The pairing that actually leaks is **child 7–12 ↔ anyone 13+** via a Buddy-ID or shared profile link, not adult ↔ teen. Browse/discovery is safe (brackets enforced in-query via `birthRules`). | PARTLY_WRONG | An adult holding a 7–12-year-old's Buddy ID or profile link can open `/buddies/<id>` on web and press Connect — a cross-bracket request mobile refuses. The same screen also ignores the target's snooze setting. | medium (child-safety) | Gate the action bar in `BuddyProfileScreen.tsx` on `connectAgeRulesBuddySearching(currentUser?.birth, profile.birth) && !profile.isSnooze` (both fields already on `lib/buddies/profileDetail.ts:186,189`), showing the minor-protection banner instead — this covers every entry point at once. Add the same check to `BuddyIdScreen.tsx:88-99`. Add a server-side assertion before `CREATE_CONNECTION` (`lib/buddies/connections.ts:320`), since every check today is client-side on both platforms. Do **not** port strict `connectAgeRules` unless post authors become tappable. |
| 8 | **Editing a post destroys its formatting.** `PostComposer.tsx:34` seeds a plain textarea via `postHtmlToText` (`lib/groups/sanitizeHtml.ts:107`) and saves through `textToPostHtml` (`:130`, `<p>`/`<br />` only) into the same `edited_object` field mobile reads. Bold, italic, underline, **anchor hrefs** (link text survives, URL discarded), lists, blockquotes and headings are lost for viewers on both platforms. Mitigation worth knowing: the original `object` still holds the formatted HTML after a *first* web edit — a second edit of an already-mobile-edited post destroys it permanently. | CONFIRMED | A member who wrote a formatted post on the phone and fixes a typo from the browser silently wipes their bold, bullets and clickable links for every group member, on both apps, with no undo in the UI. | medium (data loss) | Make `PostComposer` a contentEditable surface seeded with `sanitizePostHtml(initialHtml)` and submitting `sanitizePostHtml(el.innerHTML)`, with a B/I/U toolbar matching mobile's `FormatToolbar`. The `ALLOWED_TAGS` allowlist (`sanitizeHtml.ts:17-20`) already covers exactly what TenTap emits. Interim: detect formatting in `editing.html` at `GroupFeed.tsx:427-438` and require a confirm step, so the loss is at least not silent. |
| 9 | **Unsaved profile edits vanish on in-app navigation.** All four profile forms guard with `beforeunload` only, which does not fire on Next client-side navigation — so the back arrow (`router.push("/profile")` with no dirty check), any sidebar/bottom-bar/account-sheet `next/link`, and browser back all discard edits. Mobile intercepts `beforeRemove` on Personal, Caregiver-Patient, Medical, Interests (plus Languages, which web folds into Personal) and shows the shared "Unsaved changes / YES, Leave" modal. Partial mitigation: web's sticky bar shows an "Unsaved changes" label on Personal, Patient, Medical — but not Interests. | CONFIRMED | A user who fills in a long profile form and then taps the back arrow, a sidebar item, or browser back loses every edit with no warning and must retype the whole form. | medium (data loss) | Port mobile's GuardProvider once rather than patching four forms: `lib/profile/UnsavedChangesProvider.tsx` (`setDirty`, `confirmLeave`) mounted in `app/(app)/layout.tsx`. Forms report dirty instead of registering `beforeunload`; back arrows await `confirmLeave()`. Cover in-app links via `Link`'s `onNavigate` (supported in Next 16.2.4) in Sidebar/BottomBar/AccountSheet, and browser back via a `pushState` sentinel + `popstate`, both inside the provider. Add the missing label to `InterestsForm`. |
| 10 | **Hidden live sessions still publish on the web calendar.** `lib/groups/liveGroups.ts:45` filters only on `id`/`scheduledAt`; mobile filters `e.active !== false && !e.archived` (`LiveGroupCalendar.tsx:192-194`). Reachable entirely within web: hosts hide sessions at `components/profile/ManageLivesScreen.tsx` via `lib/profile/manageLives.ts:187-208`, and `manageLives.ts:135` already applies the `!s.archived` filter the calendar lacks. **PARTLY_WRONG — two corrections:** the fields are *not* "dropped at the type boundary" (`parseCalendarResponse` casts wholesale at `:30,34`, so the values are present at runtime and merely unread — the undeclared type is a symptom, not the cause); and `archived` is defensive only *from the client side* — no client writes it, but production has it `true` on 20 of 23 rows, so something server-side does. The reproducible leak is host-hidden `active: false`, confirmed at 100% of returned rows. | PARTLY_WRONG | A host who hides a live session — including from web's own `/profile/lives` — still sees it published on the web calendar. Verified in production: **every one of the 3 sessions the calendar Lambda returns is host-hidden**, and mobile shows none of them. | high | Add `active`/`archived` to `LiveCalendarEvent` (`lib/groups/types.ts:73-86`) and extend the predicate at `liveGroups.ts:45`. `fetchLiveCalendar` has exactly one caller (`LiveCalendar.tsx:132`), so nothing else regresses. **Blocking unknown RESOLVED** — the Lambda was invoked against production: it returns 3 rows and **all 3 are `active: false`**. It filters `status` but not `active`, so every row the web calendar shows today is a host-hidden session and mobile shows none. Not defensive-only. See *Backend questions* above. |
| 11 | **Web registers no device token with any CancerBuddy backend** — neither the AppSync `UserDeviceToken` row nor the `token` field of the USERS_LAMBDA LOGIN payload (web sends `token: undefined` and skips that lambda entirely on returning logins). Only `client.addDevice` to Stream (`lib/push/pushClient.ts:421`). **PARTLY_WRONG — the client half is not the real blocker.** Web FCM tokens come from Firebase project `cancerbuddy-web-73c0d` (`.env:33-34`) while the backend sender's credential is `cancerbuddy-demo` — FCM rejects a cross-project token (SENDER_ID_MISMATCH/UNREGISTERED), so writing the row changes nothing on its own. Also unproven which sink the pipeline reads: neither repo contains the sender, and mobile feeds both. | PARTLY_WRONG | A browser-only member gets OS notifications for chat messages but never for a buddy request, an acceptance, a new post, a new group member, or a live session starting — a live session can start and end without them being told. | medium | **Backend first, or the client work ships inert.** (1) Give the push sender the `cancerbuddy-web-73c0d` service account and a per-token credential selector (e.g. a `platform` column). (2) Confirm with the backend owner which sink is authoritative. (3) Only then add `lib/push/deviceToken.ts` (create/delete around `pushClient.ts:421`, `:299`, `:340`) and fill in `token` in the two finalize files. (4) Extend `targetPath()` in `public/firebase-messaging-sw.js:85-90` to route POST / FRIEND_REQUEST / LIVE_NOTIFY. (5) Fix the stale header in `lib/push/config.ts` claiming web reuses the mobile Firebase project. |
| 12 | **Shared Buddy ID link has no web landing page.** `BuddyIdScreen.tsx:27-31` generates `https://cancerbuddy.bonemarrow.org/buddyId/<id>` for the QR and share button, and web has no `/buddyId/*` route (verified: no segment, no catch-all, no rewrites, proxy passes through). **PARTLY_WRONG on both mechanism and scope:** that URL is not served by this app — web's `metadataBase` is `cancerbuddy.com` (`app/layout.tsx:51`) while `cancerbuddy.bonemarrow.org` is the mobile app's universal-link host with its own `.well-known` server, so "resolves to `app/not-found.tsx`" is unproven. And mobile shares the byte-identical URL, so this is not a web regression. Real gap: a recipient **without the app** has no landing page — identical on mobile. | PARTLY_WRONG | Someone sent a Buddy ID link who doesn't have the app (e.g. opening it on a laptop) lands somewhere that doesn't show the buddy profile — the same dead end mobile's share button already produces. | low | The DNS question is resolved (see *Backend questions* above). Add `app/(app)/buddyId/[buddyId]/page.tsx` calling the existing `findUserByBuddyId` (`lib/buddies/profileDetail.ts`) and redirecting to `/buddies/<userId>`, porting mobile's self/unknown/signed-out guards. **DNS question RESOLVED** — the host is `35.185.44.232`, not this app, and it serves both `.well-known` files correctly, so mobile deep links are healthy. The feared escalation does not apply. |

## Refuted claims

- **`signout-keeps-push` — "web sign-out only calls `Auth.signOut()`, so push keeps arriving."** Refuted at HEAD: `components/app-shell/AccountSheet.tsx:62-72` already runs `unregisterPushDevice()` → `disconnectStream()` → `signOut()`, in mobile's order. Stream Chat is the only push sender in this product (`docs/PUSH.md:34-36`), so `removeDevice` *is* the stop-push action and web performs it. The mobile-only steps (LOGOUT lambda, `UserDeviceToken` deletion) are no-ops for web, which never writes that row — see finding 9. Do not reopen as written. Two narrow residuals worth a small ticket, not a re-audit: `unregisterPushDevice` early-returns when `currentToken` is null (`pushClient.ts:335`) whereas mobile re-mints at logout, so a page session whose FCM registration never completed stays attached; and web lacks mobile's 4s per-step timeout, so a hanging `removeDevice` can stall the logout UI.

## Suggested order of work

**Jump the queue regardless of size** — items 1 to 4. Item 1 leaves harmful content
live in a support group while telling the host it is gone; item 2 is child safety;
items 3 and 4 destroy user data or fabricate a reply to someone asking for help.

1. **Make host post-deletion actually delete** (findings 1 + 2) — *moderation is broken and reports success*. Half a day: add the `deleteMessage` verb, rewrite `deletePost` to take the `FeedPost`, and check the response before the optimistic removal. The only `critical` item here. Fold finding 2 (SUPPORT moderation) into the same PR immediately after — granting SUPPORT the button first would hand them one that silently no-ops.
2. **Buddy Connect age + snooze gate** (finding 7) — *child safety*. Half a day. Two client gates (`BuddyProfileScreen.tsx`, `BuddyIdScreen.tsx`) are under an hour and close the leak; the server-side assertion before `CREATE_CONNECTION` is a separate half-day and is the only part that actually holds, since both platforms are client-checked today. Ship the client gates immediately, file the server check as a follow-up that also covers mobile.
3. **Kill the fake support receipt** (finding 4, step 1 only) — *fabricated confirmation to a user asking for help*. Under an hour: guard the mock behind `NODE_ENV !== "production"`. An honest error beats a fake ticket number. Do this today; the real backend wiring is item 9.
4. **Unsaved-changes guard** (finding 9) — *data loss*. Real project, 1–2 days: a provider, four form call sites, `onNavigate` on three shell components, and a `popstate` sentinel. Everything after step 1 of the provider is mechanical.
5. **LIVE badge filter** (finding 6). Under an hour for the query filter + client `inLive` guard — both in `lib/groups/groupQueries.ts`, one file, no consumer changes. Highest impact-per-minute item in the list. `nextToken` paging is an optional extra hour.
6. **Live calendar `active`/`archived` filter** (finding 10). Under an hour, and it touches the *same live-groups layer* as item 5 (`lib/groups/liveGroups.ts` + `types.ts`) — batch them into one PR. **No longer gated** — the Lambda was invoked and does not filter `active`; every row it returns is host-hidden, so this is a real leak, not a defensive fix.
7. **Caregiver registration steps** (finding 3). Half to one day, confined to `app/register/` — routing change, back-target deletion, widening `StepDiagnosis` to CAREGIVER, and copy keys. Not data loss (the data is recoverable via `/profile/medical`), but it degrades buddy matching for every caregiver who signs up in the meantime, so it should not sit behind the two-day items.
8. **Forgot-password flow** (finding 5). Real project, 1–2 days: two new screens, a Cognito reset service, and copy. Self-contained under `app/(auth)/` and `lib/login/`, so it parallelizes cleanly with the groups work above. Delete the dead `app/actions/auth.ts` stubs in the same PR.
9. **Real support backend** (finding 4, remaining steps). Real project, ~2 days, and *blocked on an infra decision*: /support is public, so either the unauth identity-pool role gets invoke rights or a server route is added. Also requires product calls on the ticket-id promise and the attachment picker (the mobile Lambda supports neither).
10. **Rich-text post editing** (finding 8) — *data loss, but bounded*. The interim warning at `GroupFeed.tsx:427-438` is under an hour and stops silent destruction — do that alongside item 5 if you are already in the groups files. The contentEditable composer with a B/I/U toolbar is a real 1–2 day project; sequence it here.
11. **Web push for non-chat notifications** (finding 11). *Blocked on backend work not in either repo* — the sink question is now answered (`UserDeviceToken` for group/live/buddy notifications, GetStream for chat), but the schema has **no platform column** and the Firebase projects differ, so both must land first. Do not start the client half until then; it will be inert and will look fixed. Open the backend conversation now, in parallel with everything above, so it is unblocked by the time the queue reaches it.
12. **Buddy ID landing page** (finding 12). *Unblocked.* The route itself is under an hour (`findUserByBuddyId` already exists). **Resolved:** the host is separate from this app and serves both `.well-known` files, so mobile deep links are healthy and no escalation is needed.
13. **Logout push residuals** (refuted `signout-keeps-push`). Under an hour: re-mint the token in `unregisterPushDevice` when `currentToken` is null, and wrap the three logout steps in a bounded `withTimeout`. Batch with item 11's client work.

## Backend questions — answered against production

The verification pass left four questions it could not answer from the two repos.
All four were resolved on 2026-08-07 by querying the live AWS backend read-only
(AppSync via the app's own API key; the `getLiveCalendar` Lambda via Cognito
unauthenticated credentials — the same path the web app uses). No mutations were
issued. **These answers change two severities and cancel one escalation.**

### Q1 — Does the `getLiveCalendar` Lambda already filter `active`? → **No.**

Invoked live. It returns **3 rows, and every one has `active: false`.** The Lambda
does filter by `status` (only `scheduled`; the 20 `ended` rows never leave it) but it
does **not** filter `active`. So finding 10 is not defensive-only — it is the
opposite: **100% of what the web calendar shows today is a session a host
deliberately hid.** Mobile's `active !== false && !archived` predicate shows **zero**
of them. Severity raised from `medium` to `high`; the blocking unknown is closed.

Full-table context (`listLiveStreamingGroups`, 23 rows, no paging): `inLive` is
`false` on **all 23** — no session is live anywhere in production right now — yet
web's unfiltered query badges **3 distinct groups** with a permanent red LIVE pill
and a "Join live" button. Finding 6 confirmed against production data.

### Q2 — Which server answers `cancerbuddy.bonemarrow.org`? → **Not this app, and it is healthy.**

Resolves to `35.185.44.232`, distinct from `cancerbuddy.com`. It serves **both**
`/.well-known/assetlinks.json` (200, `application/json`) and
`/.well-known/apple-app-site-association` (200). **Mobile deep links are fine — the
escalation flagged under finding 12 is a false alarm, do not chase it.** `/buddyId/<id>`
returns 404 on that host, so the only real gap is a landing page for a recipient who
does not have the app — identical on mobile. Finding 12 stays `low`.

### Q3 — Which sink does the push pipeline read? → **Both, split by notification class.**

Settled by mobile's own comment at `src/context/auth/useAuth.ts:159-160`: deleting
the `UserDeviceToken` row on logout *"aplicará únicamente a grupos, por lo que es
necesario eliminar el device de getstream para que no lleguen push de los mensajes"* —
it applies **only to groups**, so the GetStream device must be removed separately to
stop message pushes. Therefore:

| Notification class | Sender | Token sink |
|---|---|---|
| Chat messages | Stream Chat | GetStream device registry |
| Group posts, live starting, buddy requests | `notifications-demo` Lambda | `UserDeviceToken` (AppSync/DynamoDB) |

The table is live and actively written: **3,427+ rows across 3,191 distinct users,
most recent write the same day this was checked.** Web registers with Stream only —
which is exactly why chat push works and nothing else does. Finding 11 confirmed,
with the mechanism now named.

### Q4 — Can the sender target a web token today? → **No, and it structurally cannot.**

`UserDeviceToken` has exactly four fields — `token`, `userID`, `createdAt`,
`updatedAt`. **There is no platform or provider column**, so even once web writes a
row, the sender has no way to know that token needs the web Firebase credential
rather than the mobile one. The projects genuinely differ: mobile is
`cancerbuddy-demo` (sender id `940113338836`, from `android/app/google-services.json`)
while web is `cancerbuddy-web-73c0d` (`.env`). This confirms finding 11's fix order —
**backend and schema first, client last** — and pins down the schema change required:
add a discriminator column before any client work.

### How to re-run these checks

AppSync accepts the app's own API key from `.env`
(`NEXT_PUBLIC_AWS_APPSYNC_GRAPHQLENDPOINT` + `NEXT_PUBLIC_AWS_APPSYNC_API_KEY`) for
read queries. Lambda invocation works through Cognito unauthenticated credentials:
`aws cognito-identity get-id --identity-pool-id $NEXT_PUBLIC_AWS_COGNITO_IDENTITY_POOL_ID`
then `get-credentials-for-identity`, then `aws lambda invoke --function-name users-demo`
with `{"type":"getLiveCalendar"}`. Keep to reads — `notifications-demo` **sends real
pushes to real users** and must not be invoked to explore.

## Corrections owed to the area docs

The verification pass found wording in the area docs that overstates or misstates a
mechanism. Fix these when you touch the corresponding code, so a later reader is not
misled: `parity/live-streaming.md` (§3 row 1, `:263-277`, `:500`, `:508-511`),
`parity/auth-onboarding.md` (`:283`, `:316-321` assert an unverified 404 outcome),
`parity/cross-cutting.md` (`:375`, `:601` overstate the age-rule gap),
`parity/groups-feeds.md` (`:282`, `:369`), `lib/push/config.ts` header, and the
unchecked mock-service box at `docs/signup-flow-plan.md:220`.
