# Updates & Notifications — mobile vs web parity

Audit date: 2026-08-07.
Mobile source of truth: `~/cancerbuddyapp` (React Native).
Web target: `~/cancerbuddy-web` (Next.js App Router).

Paths in this document are repo-relative: mobile paths start `src/…` and belong
to `cancerbuddyapp`; web paths start `app/…`, `components/…`, `lib/…`,
`public/…` and belong to `cancerbuddy-web`.

---

## Summary

The **in-app Updates screen is close to complete**. Both apps read the same
`searchNotifications` query, bucket rows the same way with the same headings and
the same age arithmetic, route every production notification type to an
equivalent destination, and carry the buddy-requests tab with working
accept/dismiss. `docs/UPDATES.md` already documents six deliberate divergences,
and every one of them checks out against the mobile source.

The **push subsystem is where parity breaks down**, and it breaks structurally
rather than cosmetically:

1. Mobile registers its FCM token in **two** places — Stream
   (`client.addDevice`) *and* the AppSync `UserDeviceToken` table
   (`createOrUpdateFCMToken`, `src/context/auth/useAuth.ts:80-145`). Web only
   does the first. Every push mobile receives that is *not* a Stream chat
   message — buddy requests, new posts, live-session alerts — is addressed to a
   token in that table. Web has no row there, so those pushes cannot reach a
   browser at all.
2. `docs/PUSH.md` states only `message.new` is enabled on the `web` Stream
   provider, which independently caps the browser at chat notifications.
3. The service worker's router (`public/firebase-messaging-sw.js:85-90`) knows
   exactly one destination — `messaging` channel → `/chat/{id}` — and sends
   everything else to `/groups`. Mobile's router
   (`src/context/push-notification/push-notification.provider.tsx:366-435`) has
   seven branches.

Consequences that are *not* about push at all, and are the more actionable
in-app gaps: the Updates list has **no live refresh** (mobile refetches whenever
a push lands, `src/screens/notifications/HomeNotifications.tsx:139-141`), there
is **no app-icon badge** anywhere on web, and visiting `/notifications` does
**not** clear delivered OS notifications the way mobile's
`notifee.cancelAllNotifications()` does
(`src/screens/notifications/HomeNotifications.tsx:110-115`).

Two smaller findings worth correcting regardless of priority:

- `lib/notifications/fetch.ts:83` comments that the page size 20 is "Mobile's
  page size. Kept identical so scroll behaviour matches." **Mobile's page size is
  10** (`src/screens/notifications/HomeNotifications.tsx:65` and `:242`). The
  comment is wrong; the value is arguably better, but it is a divergence and is
  not recorded in `docs/UPDATES.md`.
- `components/notifications/NotificationRow.tsx:53` renders the sender through
  `formatName()`, which truncates to a title-cased first name. Mobile's
  `ListNotification.tsx:60` prints `name` verbatim. A notification from "Dr.
  Sarah Chen" reads "Dr." on web.

Neither app has: per-notification-type icons, unread styling, swipe-to-dismiss,
or a mark-all-read affordance. Those are absent by symmetry, not gaps.

---

## Notification type matrix

`type` is the routing discriminator. `typeNotification` is the **sentence**, and
it is composed server-side when the row is written — neither client builds it,
and both print it verbatim. Frequencies come from the 800-row production sweep
recorded in `docs/UPDATES.md` §1.

**There are no per-type icons in either app.** The only imagery on a row is the
sender's avatar plus two badges (SUPPORT-verified, ambassador). Mobile draws
those from bitmaps (`@images/verified.png`, `@images/check-ambassador.png`,
`ListNotification.tsx:61-72`); web draws a generic `✓` circle for both
(`NotificationRow.tsx:25-35`), so the two badges are visually identical there.

| Type | Copy / icon | Tapping goes to (mobile) | Web renders it? | Web tap target | Notes |
|---|---|---|---|---|---|
| `POST` (94%) | `"Posted in"` + group name on the next line. No icon. | `default` branch → `ActivitiesFeed(dataGroup, pendingPostId, pendingPostFeedId)`, which forwards to `PostDetail` (`HomeNotifications.tsx:308-334`) | ✅ | `/groups/{groupId}?post=…&feed=…` — opens the `PostThread` sheet (`lib/notifications/routing.ts:69-84`) | Deliberate: web uses the existing sheet rather than a second route. `docs/UPDATES.md` §3 row 6. |
| `COMMENT` (2%) | e.g. `"(Multiple Myeloma Group): Sev commented on your post"`. No icon. | falls through `default` (mobile has no `case 'COMMENT'`) | ✅ | same as `POST` | Web names the case explicitly (`routing.ts:70`); same destination. |
| `REPLY` (<1%) | `"Replied to your comment on"` | `default` | ✅ | same, plus `&reaction={parentReactionId}` when present | `parentReactionId` is null on every production row today, so the highlight path is built but unexercised. |
| `LIKE` (<1%) | `"Liked your post on"` | `default` | ✅ | same as `POST` | — |
| `MESSAGE` (1%) | `"Sent you a message"` | if `group.id` → group feed; else `ChatScreen(channelId = activityId)` (`HomeNotifications.tsx:266-282`) | ✅ | `/groups/{id}` or `/chat/{activityId}` (`routing.ts:44-50`) | Exact port, including reading the channel id out of `activityId`. |
| `FRIEND_REQUEST` (<1%) | `"Maggie sent you a friend request"` | **no navigation** — `setActiveTab('Tab2')` switches to the Buddies Request tab (`HomeNotifications.tsx:294-296`) | ✅ | `{kind:"requests"}` → switches to the requests tab in place (`routing.ts:60-61`, `NotificationRow.tsx:107-113`) | Both avoid opening a post: `activityId`/`feedId` hold the Connection id here. |
| `BUDDY` (<1%) | `"You are now buddies with Tom"` | `UserInfo(userId = remitent.id, showButtons, openVertical)` (`HomeNotifications.tsx:299-307`) | ✅ | `/buddies/{remitent.id}` (`routing.ts:64-67`) | — |
| `NEWUSER` (<1%) | `"Sev joined your Fitness & Wellness. Tap to see"` | `ActiveUsersListGroups(idGroup, nameGroup)` (`HomeNotifications.tsx:283-288`) | ✅ | `/groups/{groupId}/members` (`routing.ts:52-55`) | Mobile passes `nameGroup` too; the web members page reads the name from the group itself. |
| `COMMENT_REPLY` | — | mobile has `case 'COMMENT_REPLY'` (`HomeNotifications.tsx:308`) that falls straight into `default` | n/a | n/a | **Dead branch.** No production row carries this value. Confirmed in `docs/UPDATES.md` §1. Not reproduced on web, correctly. |
| *(unknown / future type)* | whatever the server writes | mobile `default` → group feed or `PostDetail` | ⚠️ | web `default` → group deep link, **but returns `{kind:"none"}` when there is no group** (`routing.ts:74`) | Mobile's `default` has a group-less fallback to `PostDetail` with `{id: activityId, feedId}` (`HomeNotifications.tsx:325-333`). Web drops it. Every current row has a group, so this only bites a future type. |

Rows whose `remitent` is null are **hidden in both apps** — mobile inside
`ordenarCategorias` (`HomeNotifications.tsx:216-220`), web inside
`toNotification` (`lib/notifications/fetch.ts:88`).

---

## Screen-by-screen inventory

### 1. Updates home — the "All" tab

**Mobile:** `src/screens/notifications/HomeNotifications.tsx` (registered as
`UpdateScreenE.Home` in `src/navigation/updates/UpdatesScreens.tsx:21-28`) —
the notification feed, bucketed by age, plus the tab strip that holds the buddy
requests.
**Web:** `app/(app)/notifications/page.tsx` → `components/notifications/UpdatesScreen.tsx`.

| # | Mobile capability | Data source | Web status | Notes |
|---|---|---|---|---|
| 1 | Two tabs: `All` / `Buddies Request` | local state `activeTab` (`:54`), `CustomTabs` (`:353-360`) | ✅ | `UpdatesScreen.tsx:167-179`. Label is "Buddy requests" vs mobile's "Buddies Request". |
| 2 | Count badge on the requests tab | `usePendingConnections().length` (`:358`) | ⚠️ | Web hides the badge at 0 (`UpdatesScreen.tsx:85`); mobile's `CustomTabs` renders the pill unconditionally, showing "0". Cosmetic. |
| 3 | Query the feed | `GET_NOTIFICATIONS` → `searchNotifications` (`src/graphql/queries/notifications.ts`) | ✅ | `lib/notifications/fetch.ts:31-80`, same fields. |
| 4 | `read: {eq: false}` filter on the query | `notifications.ts:3` | ⚠️ | Deliberately omitted (`fetch.ts:35`). No-op today because nothing ever sets `read`; keeps history if the Lambda is fixed. `docs/UPDATES.md` §2. |
| 5 | Page size | `limit: 10` (`:65`, `:242`) | ⚠️ | Web uses **20** (`fetch.ts:83`) while its comment claims the value is mobile's. Undocumented divergence. |
| 6 | Infinite scroll | `onEndReached` + `fetchMore` (`:233-247`, `:422-425`) | ✅ | IntersectionObserver sentinel, `rootMargin: 400px` (`UpdatesScreen.tsx:117-131`). |
| 7 | Duplicate suppression across pages | `Map.set(createdAt, row)` (`:127-132`) | ⚠️ | Web merges by `id` (`fetch.ts:158-164`). Better — mobile discards ~2% of a real feed. `docs/UPDATES.md` §3 row 1. |
| 8 | Pull-to-refresh | `refreshing` / `onRefresh` on the FlatList (`:338-347`, `:423-424`) | ⚠️ | Web has an explicit refresh **button** in the header (`UpdatesScreen.tsx:151-163`); no pull-to-refresh gesture on touch devices. |
| 9 | Bucket into New / Today / Yesterday / Last 7 days / Last 30 days | `categorizarNotificaciones` + `ordenarCategorias` (`:148-231`) | ✅ | `lib/notifications/grouping.ts`, same boundaries and headings, including "Last 30 days" being the terminal bucket. |
| 10 | Relative age string (`Just Now` / `2m` / `5h` / `3d` / `9w`) | same (`:163-199`) | ✅ | `grouping.ts:49-63`, including the "Just Now covers two minutes" and "hours never round" quirks. |
| 11 | Negative ages on clock skew | mobile renders `-1h` | ⚠️ | Web clamps to `Just Now` (`grouping.ts:50`). Deliberate; `docs/UPDATES.md` §3 row 4. |
| 12 | Sort newest-first within a bucket | `:224-226` | ✅ | `grouping.ts:105-110`. |
| 13 | Mark notifications read | `raiseUserLambda(READ_NOTIFICATIONS)` on every render where `notifications` changes (`:92-108`) | ❌ | Web never calls it. Deliberate — the Lambda writes to a key the table doesn't have and fails silently on every call. `docs/UPDATES.md` §2. |
| 14 | Unread counter / unread row styling | — | n/a | Neither app has it; there is no data for one. |
| 15 | Mark-all-read affordance | — | n/a | Neither app exposes a button; mobile fires the (broken) Lambda implicitly on view. |
| 16 | Refetch when a push arrives | `useEffect(refetch, [hasPostMessage])` (`:139-141`) | ❌ | Web has **no live refresh** of the feed. There is no AppSync subscription on `Notifications` and no push hook. A new notification appears only after the refresh button or a remount. |
| 17 | Clear the OS notification tray on entry | `notifee.cancelAllNotifications()` (`:110-115`) | ❌ | Web leaves delivered OS notifications on screen after visiting `/notifications`. |
| 18 | First-load spinner | `Loader` (`:370-371`) | ✅ | Skeleton rows instead (`UpdatesScreen.tsx:44-58`). |
| 19 | Load-more indicator | full-screen `Loader` when `isLoadingMore` (`:351`) | ✅ | Footer text "Loading more…" (`UpdatesScreen.tsx:227-231`) — less intrusive. |
| 20 | Error state with retry | `:373-381` | ✅ | `UpdatesScreen.tsx:186-194`, with real copy instead of mobile's "Check Metro / device logs" developer message. |
| 21 | Empty state | `EmptyUpdatesLayout` — illustration + "Your updates will appear here." (`src/components/layouts/EmptyUpdates/EmptyUpdatesLayout.tsx`) | ⚠️ | Same headline, plus a sub-line, but **no illustration** (`UpdatesScreen.tsx:195-203`). |
| 22 | End-of-list message | — | web-only | "That's everything." (`UpdatesScreen.tsx:232-236`). Addition, not a gap. |
| 23 | Header: hamburger + contextual "Find new buddies" button when requests exist | `HamburgerHeader` (`UpdatesScreens.tsx:26`, `HamburgerHeader.tsx:108-109`) | ⚠️ | Web has a persistent sidebar/bottom bar and a page `<h1>`; no contextual CTA in the Updates header. Functionally reachable, visually different. |
| 24 | Snooze gate — a snoozed account sees `SnoozeLayout` instead of Updates | `UpdatesNavigation.tsx:16-18` | ❌ | Web has no snooze gate on `/notifications`. `isSnooze` is read across the web app for *other* members (`lib/buddies/*`, `lib/groups/members.ts`) but never applied to the viewer's own shell. |
| 25 | `ConnectProvider` around the Updates stack (feeds the profile "Next" carousel) | `UpdatesNavigation.tsx:21` | ❌ | See row 12 of the requests table below. |
| 26 | Swipe-to-dismiss a row | — | n/a | Neither app. |

**Missing on web**

- ❌ Live refresh of the feed when a notification arrives (mobile: `refetch` on `hasPostMessage`).
- ❌ Clearing delivered OS notifications when the screen opens.
- ❌ `readNotifications` mutation (deliberate, documented — the Lambda is broken).
- ❌ Snooze gate on the route.
- ❌ `ConnectProvider` carousel context.
- ⚠️ Pull-to-refresh gesture (button only).
- ⚠️ Empty-state illustration.
- ⚠️ Page size 10 vs 20, with a comment claiming they match.
- ⚠️ Requests badge hidden at zero.
- ⚠️ Contextual header CTA.

---

### 2. One notification row

**Mobile:** `src/components/elements/list-notifications/ListNotification.tsx`
(+ `ListNotifications.styles.ts`) — avatar, name, badges, age, sentence, group.
**Web:** `components/notifications/NotificationRow.tsx`.

| # | Mobile capability | Data source | Web status | Notes |
|---|---|---|---|---|
| 1 | Sender avatar from S3 | `useSWR(getS3ImageUtil)` (`:29-32`), `BMAvatar` (`:44`) | ✅ | `BuddyAvatar` at 46px (`NotificationRow.tsx:42-47`); URLs resolved during fetch (`fetch.ts:90-93`). |
| 2 | Initial-letter fallback when there is no photo | `:46-52` | ✅ | Handled inside `BuddyAvatar`. |
| 3 | Goal image on the avatar | queried but **not rendered** by the row | web-only | Web passes `goalUrl` (`NotificationRow.tsx:45`), so web rows show a goal chip mobile does not. Addition. |
| 4 | Sender name | `props.name`, printed whole (`:60`) | ⚠️ | Web calls `formatName()` (`NotificationRow.tsx:53`) → title-cased **first token only**, and without the `userType` argument, so HOST/SUPPORT names are truncated too. "Dr. Sarah Chen" → "Dr.". |
| 5 | SUPPORT "verified" badge | `@images/verified.png` (`:61-66`) | ⚠️ | Generic `✓` circle (`NotificationRow.tsx:55-57`). |
| 6 | Ambassador badge | `@images/check-ambassador.png` (`:67-72`) | ⚠️ | The **same** generic `✓` circle (`:58-60`) — indistinguishable from verified except by tooltip. |
| 7 | Relative age beside the name | `props.transformTime` (`:73-78`) | ✅ | `relativeTime(createdAt, now)` (`:62-64`), with `now` frozen per fetch so a list can't drift mid-render. |
| 8 | The `typeNotification` sentence, verbatim | `:80-86` | ✅ | `:67-71`. |
| 9 | Group name on its own line | `props.groupType` (`:87-94`) | ✅ | `:73-77`. |
| 10 | Divider between rows, suppressed on the last | `last` prop (`:57`) | ✅ | `divide-y` on the list (`UpdatesScreen.tsx:211`). |
| 11 | Whole row is tappable | `TouchableOpacity` (`:39`) | ✅ | `<Link>` / `<button>` (`NotificationRow.tsx:99-113`). |
| 12 | Row with no destination | still tappable; mobile's `default` can dead-end | ⚠️ | Web renders a plain `<div>` with a title attribute (`:115-119`) so the cursor never promises a destination. Improvement. |
| 13 | Per-type icon | none | n/a | Neither app. |
| 14 | Unread dot / bold styling | none | n/a | Neither app — no `read` data exists. |
| 15 | Per-row actions (accept, join, dismiss) | none — the row only navigates | n/a | Neither app. `FRIEND_REQUEST` rows send you to the requests tab to act. |

**Missing on web**

- ⚠️ Full sender name (first-name truncation is wrong for this surface).
- ⚠️ Distinct verified vs ambassador iconography.

---

### 3. Buddy requests tab

**Mobile:** `src/screens/requestBuddies/HomeRequestBuddies.tsx`, rendered inline
as Tab2 of `HomeNotifications` (`:432`); rows are
`src/components/elements/connection-request/ConnectionRequest.tsx`.
**Web:** `components/notifications/RequestsPanel.tsx` + `RequestCard` from
`components/buddies/RequestsSection.tsx`, data from `lib/buddies/useRequests.ts`.

| # | Mobile capability | Data source | Web status | Notes |
|---|---|---|---|---|
| 1 | List pending requests | `usePendingConnections` → `FETCH_GET_CONNECTIONS` (SWR) | ✅ | `fetchPendingRequests` (`lib/buddies/connections.ts:136`), paged. |
| 2 | Drop rows whose sender was deleted | `filter(item.Remitent !== null)` (`HomeRequestBuddies.tsx:38`) | ✅ | `connections.ts:158`. |
| 3 | Newest first | inline sort (`:143-149`) | ✅ | Sorted in `fetchPendingRequests`. |
| 4 | Realtime subscription for incoming requests | `<Connect subscription={GetPendingConnectionsSuscription}>` (`:97-112`) | ✅ | `onCreateConnectionByRecipientId` in `useRequests.ts:31-34,100-123`. |
| 5 | Refetch on screen focus | `useFocusEffect` (`:43-48`) | ✅ | Provider is route-scoped and re-reads on entry (`app/(app)/notifications/layout.tsx`). |
| 6 | Accept → `AcceptConnection` | `ConnectionRequest.tsx:98-105` | ✅ | `acceptConnection` in `useRequests.ts:161`. |
| 7 | Accept → create the 1:1 Stream channel keyed on the connection id, named "<them> <me>" | `:137-163` | ✅ | `useRequests.ts:131-155`, identical naming rationale. |
| 8 | Accept → skip creation if a channel for the pair already exists | `queryChannels({members:{$eq:[…]}})` (`:141-149`) | ✅ | `useRequests.ts:141-146`. |
| 9 | Dismiss ("Maybe later") → `RemoveConnectionUser` | `:100` | ✅ | `dismiss` in `useRequests.ts`. |
| 10 | Success toasts for both actions | `Toast.show` (`:83-95`) | ✅ | `sonner` toasts (`RequestsPanel.tsx:44-66`). |
| 11 | Optimistic removal of the answered row | `removeConnectionById` (`usePendingConnections.ts:18-27`) | ✅ | `busyIds` + local removal in `useRequests`. |
| 12 | Avatar tap → the sender's profile **with a "Next" carousel** over the other pending requests | `handleAvatarPress` seeds `ConnectProvider` with `usersList` (`:172-200`) | ⚠️ | Web links the **name** to `/buddies/{id}` (`RequestsSection.tsx:62-67`); the avatar is not a link and there is no carousel — no web equivalent of `ConnectProvider`. |
| 13 | Row shows the shared-interest sentence | `getLabelCoincidencies(Remitent.id, userInfo)` (`:60-63,215`) | ❌ | Web shows the sender's `bio` instead (`RequestsSection.tsx:88-92`). No "you both …" line anywhere in the requests UI. |
| 14 | Row shows name + age | `displayAge(Remitent.birth)` (`:210`) | ✅ | `ageSuffix()` (`RequestsSection.tsx:66`). |
| 15 | Row shows role badge | `showRoleBadge` on `AvatarInfoLayout` (`:221`) | ✅ | `ROLE_LABELS` pill (`:69-78`). |
| 16 | Row shows ambassador badge | `isAmbassador` (`:218`) | ✅ | `:79-83`. |
| 17 | Row shows the goal icon and an "In remission" badge | `iconFile`, `badgeText="In remission"` (`:213-214`) | ⚠️ | Goal image is on the avatar (`goalUrl`), but there is **no "In remission" badge** on the web card. |
| 18 | Per-row busy/loading overlay | `Loader` (`:254`) | ✅ | Buttons disable on `busy`. |
| 19 | Skeleton / spinner while the list loads | `ActivityIndicator` (`:87-91`) | ✅ | `RequestsPanel.tsx:22-39`. |
| 20 | Empty state: illustration + copy + "find new buddies" CTA | `EmptyBuddiesRequest.tsx` | ⚠️ | Same copy and a CTA linking to `/buddies` (`RequestsPanel.tsx:78-96`), **no illustration**. |
| 21 | Error state | none — mobile silently renders nothing | ✅ | Web shows an error banner (`RequestsPanel.tsx:70-76`). Addition. |
| 22 | `AsyncStorage` `idConnect` / `isRemove` side effects | `:68-77` | n/a | Mobile cruft consumed nowhere meaningful; correctly not ported. |
| 23 | Requests also reachable from a second surface | mobile: a dedicated `Buddies` tab (`TabsNavigator.RequestBuddies`) | ✅ | Web: `/buddies` renders the same `RequestCard` through the same hook. `docs/UPDATES.md` §3 row 5. |

**Missing on web**

- ❌ Shared-interest ("coincidences") line on the request card.
- ⚠️ Profile "Next" carousel seeded from the pending requests.
- ⚠️ Avatar itself is not a link (name is).
- ⚠️ "In remission" badge.
- ⚠️ Empty-state illustration.

---

### 4. `HomeUpdates` — the standalone requests screen

**Mobile:** `src/screens/updates/HomeUpdates.tsx`, registered as
`UpdateScreenE.HomeUpdates` (`UpdatesScreens.tsx:29-37`).
**Web:** `— none —`

| # | Mobile capability | Data source | Web status | Notes |
|---|---|---|---|---|
| 1 | Full-screen buddy-requests list (a duplicate of Tab2) | `usePendingConnections` | n/a | **Dead on mobile.** Its only caller is `GetHomeNewBuddies` (`HomeNotifications.tsx:144-146`), which is defined and never invoked. |
| 2 | — | — | n/a | The screen would also crash if it were reached: line 24 builds `listConnections` from `data`, which is not declared until line 27 — a temporal-dead-zone `ReferenceError` on first render. |

**Missing on web** — nothing. Do not port this screen; it is unreachable and
broken upstream.

---

### 5. Leaf screens the Updates stack routes into

Audited only for *how Updates enters them* and any Updates-specific behaviour.

| # | Mobile leaf (stack name) | Entered from Updates by | Web equivalent | Status | Notes |
|---|---|---|---|---|---|
| 1 | `ChatScreen` (`UpdateScreenE.Chat`) | `MESSAGE` row with no group; mobile passes `type: 'ListNotifications'` alongside `channelId` (`HomeNotifications.tsx:277-281`) | `app/(app)/chat/[channelId]/page.tsx` | ✅ | The `type` marker only drives mobile's back-navigation; irrelevant on web where the URL is the state. |
| 2 | `UpdatesPostDetail` (`UpdateScreenE.PostDetail`) | group-less post rows, and via `ActivitiesFeed` for grouped ones; carries `highlightParentReactionId` and a `timestamp` cache-buster | `PostThread` sheet over `/groups/[groupId]` | ✅ | Deliberate substitution, `docs/UPDATES.md` §3 row 6 and §5. `reaction` query param carries the highlight. |
| 3 | `ActiveUsersListGroups` | `NEWUSER` rows | `app/(app)/groups/[groupId]/members/page.tsx` | ✅ | — |
| 4 | `UserInfoUpdates` (`UpdateScreenE.UserInfo`) | `BUDDY` rows, and the request-card avatar | `app/(app)/buddies/[userId]/page.tsx` | ⚠️ | Mobile passes `showButtons`, `showNext`, `openVertical`, `connectionId`, `connectionName`. Web takes none of these — no carousel, no connection-scoped action buttons. |
| 5 | `GalleryUpdates` | only from `UserInfo` inside the Updates stack | buddy profile gallery in `components/buddies/BuddyProfileScreen.tsx` | ✅ | Not reachable directly from a notification in either app. |
| 6 | `UpdatesJournalListPreview` / `UpdatesJournalDetail` | only from `UserInfo` | `app/(app)/buddies/[userId]/journal/page.tsx` | ✅ | Same — reached through the profile, not a notification. |
| 7 | `UpdatesUserInfoScreenGroups` | from the members list opened by a `NEWUSER` row | `app/(app)/buddies/[userId]/page.tsx` | ✅ | Mobile registers it separately only to get a vertical card transition. |
| 8 | `UpdatesHostDetail` | from a post opened via a notification | `app/(app)/groups/hosts/[hostId]/page.tsx` (`HostDetailScreen`) | ✅ | — |
| 9 | `EditPost` | from a post opened via a notification, when the viewer is the author | edit action on `PostCard` | ✅ | Web edits in place rather than on a route; same capability. |

**Missing on web**

- ⚠️ The `showNext` / `connectionId` / `connectionName` profile parameters, which
  on mobile turn a profile opened from Updates into a reviewable queue.

---

### 6. Updates entry in the navigation chrome

**Mobile:** `src/components/elements/tab-bar/tab-bar.tsx` + `TabItem.tsx`.
**Web:** `lib/navigation/appNav.tsx`, `components/app-shell/AppShell.tsx`.

| # | Mobile capability | Data source | Web status | Notes |
|---|---|---|---|---|
| 1 | A bell icon entry for Updates | `TabsConfiguration.tsx:44-46` (`phosphor` `Bell`) | ✅ | `appNav.tsx:56-61` (`lucide` `Bell`), label "Notifications". |
| 2 | Numeric badge on the Updates entry | `notificationCount` — incremented per foreground push since the app opened, reset to 0 when the tab is pressed (`tab-bar.tsx:138-150`, `:182-193`; rendered `TabItem.tsx:71-82`) | ⚠️ | Web badges the **pending buddy-request count** instead (`AppShell.tsx:36-41`, `lib/buddies/usePendingRequestCount.ts`). Different number, deliberately: mobile's is a session-local push tally that a browser reload cannot reconstruct, and there is no unread state to count. |
| 3 | Badge hidden while the tab is focused | `!isFocused &&` (`TabItem.tsx:71`) | ❌ | Web keeps the count visible on `/notifications`. Minor. |
| 4 | Separate `Buddies` tab with its own request badge, cleared on visit | `TabItem.tsx:83-95` | ⚠️ | Web merges both into the one Notifications badge; `/buddies` has no badge of its own. |
| 5 | Updates tab hidden for SUPPORT accounts | `TabsNavigator.tsx:31-33` filters `TabsNav.HomeNotifications` | ⚠️ | That filter names `HomeNotifications`, but the registered tab is `TabsNav.Updates` (`TabsScreens.tsx:24-25`) — so the filter never matches and **mobile shows Updates to SUPPORT accounts anyway**. Web also shows it (`primaryNavFor` only strips `/profile`). Same end behaviour; both are arguably wrong. |
| 6 | Chat unread badge | `client.getUnreadCount` (`tab-bar.tsx:90-106`) | ✅ | `totalUnread` from `useStreamChat` (`AppShell.tsx:24`). |

**Missing on web**

- ❌ Suppressing the badge while the Updates screen is open.
- ⚠️ Mobile's push-since-open counter (deliberate substitution, documented).

---

## Push subsystem parity

Mobile's push code is spread across `index.js`,
`src/context/push-notification/push-notification.provider.tsx`,
`src/hooks/useLocalNotifications.ts`, `src/notifications/config.ts`,
`src/utils/requestPermissions.ts`, `src/context/auth/useAuth.ts`,
`src/context/stream/StreamProvider.tsx`, `src/utils/lambda.ts`,
`src/utils/enrollment/signup.ts` and `src/hooks/useGroupPost.ts`.
(`src/notifications/` itself contains only `config.ts` — 23 lines.)

Web's lives in `lib/push/config.ts`, `lib/push/pushClient.ts`,
`components/push/PushBridge.tsx`, `components/push/PushSettingsCard.tsx`,
`public/firebase-messaging-sw.js` and `app/manifest.ts`.

### Registration & token lifecycle

| # | Item | Mobile | Web | Status |
|---|---|---|---|---|
| 1 | Mint an FCM token | `messaging().getToken()` in `StreamProvider.tsx:122` | `getToken(messaging, {vapidKey, serviceWorkerRegistration})` (`pushClient.ts:388-396`) | ✅ |
| 2 | Register with Stream | `client.addDevice(token,'firebase',id)` (`StreamProvider.tsx:125`) | `addDevice(token,'firebase',userId, providerName)` (`pushClient.ts:421`) | ✅ — web must pass the 4th argument because it runs on its own Firebase project (`docs/PUSH.md`). |
| 3 | Re-register on token rotation | `messaging().onTokenRefresh(...)` re-adds and re-saves (`StreamProvider.tsx:129-134`) | ❌ | No `onTokenRefresh` listener. Web only re-registers on load via `PushBridge` (`:40-43`). A token that rotates mid-session goes unregistered until the next page load. |
| 4 | Persist the token in the AppSync `UserDeviceToken` table | `createOrUpdateFCMToken` — de-dupes the token across accounts, then `CREATE_USER_DEVICE_TOKEN` (`useAuth.ts:80-145`) | ❌ | **No web equivalent anywhere.** This is the table the backend push pipeline reads; without a row, non-Stream pushes cannot address a browser. |
| 5 | Send the token to `USERS_LAMBDA` on login | `signup.ts:9-28` | ❌ | Web sends `token: undefined` (`lib/user-signup/userEnrollmentFinalize.ts`). Deliberate and documented (`docs/PUSH.md` §Divergences 1) — no permission exists at signup time — but it means the Lambda never learns the browser's token, ever. |
| 6 | Send the token to `USERS_LAMBDA` on logout | `logOutAccountLambda` (`lambda.ts:232-240`) | ❌ | Web logout (`AccountSheet.tsx:62-73`) calls `unregisterPushDevice` + `disconnectStream` + `signOut`; there is no logout Lambda call at all. |
| 7 | Remove the device from Stream on logout | `clientInstance.removeDevice(token, userId)` (`useAuth.ts:276-278`) | `unregisterPushDevice()` (`pushClient.ts:334-344`, called at `AccountSheet.tsx:68`) | ✅ |
| 8 | Delete the `UserDeviceToken` row on logout | `deleteCurrentFCMTokenOnSessionClose` (`useAuth.ts:161-200`) | ❌ | Follows from #4. |
| 9 | Member-facing opt-out | none — mobile has no in-app switch | web-only | `cb.push.optOut` in `localStorage` + the Settings card (`PushSettingsCard.tsx`). Addition. |
| 10 | Degrade safely when unconfigured | n/a | `getPushConfig()` returns null and every entry point reports `unconfigured` (`config.ts:71-77`) | ✅ |

### Permissions

| # | Item | Mobile | Web | Status |
|---|---|---|---|---|
| 11 | When permission is requested | automatically on provider mount — `initPermission()` (`push-notification.provider.tsx:219` → `src/notifications/config.ts:3-6`) | only from the Settings toggle (`PushSettingsCard.tsx:41-49`) | ⚠️ Deliberate; browser norms penalise prompt-on-load. `docs/PUSH.md` §Divergences 2. |
| 12 | Re-ask when previously denied | `checkNotificationPermission()` re-requests on `DENIED` (`useLocalNotifications.ts:14-20`) | ❌ | A page cannot re-prompt once blocked; web shows instructions instead (`PushSettingsCard.tsx:117-121`). Platform limit, not an oversight. |
| 13 | Guidance when the member declines | toast: "You can change your push notifications settings under the 'Settings' app…" (`utils/requestPermissions.ts:14-18`) | ✅ | `app.push.blocked` copy. |
| 14 | Observe permission changed outside the app | none | web-only | `PermissionStatus.change` via `useSyncExternalStore` (`pushClient.ts:180-208`). Addition. |
| 15 | Handle "unsupported" platforms | n/a | `unsupported` state + manifest so iOS PWA installs work (`app/manifest.ts`) | ✅ web-only. |

### Channels, presentation, badges

| # | Item | Mobile | Web | Status |
|---|---|---|---|---|
| 16 | Android notification channel | `cancerbuddy_notifications`, `AndroidImportance.HIGH`, badge + default sound (`useLocalNotifications.ts:32-38`) | n/a | No channel concept in the web Push API. |
| 17 | Android small icon | `smallIcon: 'cancerbuddy'` (`:49`) | ⚠️ | Web uses `/icons/icon-192.png` for both `icon` and `badge` (`firebase-messaging-sw.js:35,66-68`) — the BMCF lockup, which `docs/PUSH.md` notes is unreadable at badge size. |
| 18 | iOS foreground presentation (alert + badge + sound) | `CONFIG_NOTIFICATIONS_IOS` (`src/notifications/config.ts:8-15`) | n/a | — |
| 19 | iOS notification categories | `setCategories([{id:'default'}])` (`config.ts:17-23`) | n/a | No actionable categories are defined, so nothing is lost. |
| 20 | Collapse repeated pushes from one conversation | none — mobile stacks them | web-only | `tag` + `renotify` (`firebase-messaging-sw.js:58-70`). Addition. |
| 21 | App-icon badge increments per notification | `notifee.incrementBadgeCount(1)` on display (`useLocalNotifications.ts:58`) | ❌ | Web never calls `navigator.setAppBadge`. An installed PWA shows no count. |
| 22 | App-icon badge cleared on tap | `setBadgeCount(0)` in three places (`index.js:113`, `push-notification.provider.tsx:146,154,368`) | ❌ | Follows from #21. |
| 23 | App-icon badge cleared when the app is foregrounded | `useAppStateEvents(() => removeBadgeCount())` (`push-notification.provider.tsx:94-96`) | ❌ | Follows from #21. |
| 24 | Cancel *all* related connect notifications when one is tapped | `cancelConnectNotifications` (`push-notification.provider.tsx:118-147`) | ❌ | Web closes only the clicked notification (`firebase-messaging-sw.js:140`). |
| 25 | Cancel the single tapped notification | `cancelSingleNotification` (`:150-155`) | ✅ | `event.notification.close()`. |

### Foreground handling

| # | Item | Mobile | Web | Status |
|---|---|---|---|---|
| 26 | Foreground message listener | `messaging().onMessage` → `handleLocalNotification` (`push-notification.provider.tsx:220-222`) | ⚠️ | Web cannot use `onMessage()` — the hand-written worker never feeds it. The worker posts `cancerbuddy:push` to a focused client instead (`firebase-messaging-sw.js:113-127`), consumed by `subscribeForegroundPush` (`pushClient.ts:358-376`). Different mechanism, documented, works. |
| 27 | What the member sees in the foreground | an actual OS notification via `notifee.displayNotification` (`useLocalNotifications.ts:40-57`) | ⚠️ | An in-app `sonner` toast with an "Open" action (`PushBridge.tsx:53-60`). No OS banner. |
| 28 | Suppress the alert for the conversation already on screen | not done — mobile always displays | web-only | `PushBridge.tsx:50-52` skips a push whose `channelId` matches the open chat route. Addition. |
| 29 | Only a *focused* tab is treated as foreground | n/a | `clients.matchAll(...).find(c => c.focused)` (`firebase-messaging-sw.js:113-118`) | ✅ A background tab still gets an OS banner. |
| 30 | Tag the notification with its kind (`chat` / `group` / `live_notify` / `connect`) | `handleLocalNotification` (`:437-469`) | ❌ | Web has no equivalent classification; the worker reads only `channel_type`. |
| 31 | Invalidate the connection cache on a connect push | `invalidateConnectionMap()` (`:461`) | ⚠️ | No push-driven invalidation on web, but `useRequests` holds a live AppSync subscription, so the requests list self-heals. The wider connection map does not. |
| 32 | Mark a group as having a new post from a foreground push | `useGroupPost` → `GroupsActionTypes.EXTENDED_PAYLOAD` / `badgeForGroups` (`src/hooks/useGroupPost.ts:13-38`) | ❌ | No per-group "new post" badge driven by push on web. |
| 33 | Feed the Updates tab-bar badge from foreground pushes | `setHasPostMessage` (`:264,299,451,456,467`) | ❌ | See nav table row 2. |
| 34 | Refetch the Updates list when a push lands | `HomeNotifications.tsx:139-141` | ❌ | See Updates-home table row 16. |

### Background & cold start

| # | Item | Mobile | Web | Status |
|---|---|---|---|---|
| 35 | Background message handler | `messaging().setBackgroundMessageHandler` (`index.js:127`, empty body) | `self.addEventListener("push", …)` (`firebase-messaging-sw.js:95`) | ✅ Web's does the real work; mobile's real background work is in `notifee.onBackgroundEvent`. |
| 36 | Background tap handler | `notifee.onBackgroundEvent` (`index.js:51-115`) | `notificationclick` (`firebase-messaging-sw.js:139-169`) | ✅ |
| 37 | Warm-start tap handler | `messaging().onNotificationOpenedApp` (`push-notification.provider.tsx:158-160`) | same `notificationclick` | ✅ |
| 38 | Cold-start tap handler | `messaging().getInitialNotification()` + a `pendingNav` queue that waits for auth and nav readiness, with 1.5s timeouts (`:161-169`, `:199-206`) | ✅ | Web has no equivalent race: the worker focuses or opens a tab at a URL (`:144-167`) and `AuthGuard` handles the rest. Structurally simpler and more reliable. |
| 39 | Reuse an already-open window rather than opening a second app instance | n/a | `clients.matchAll` → `focus()` + `navigate()` (`:152-164`) | ✅ web-only. |
| 40 | De-duplicate repeat processing of one notification | `lastProcessedNotifRef` keyed on eventId/activityId/channelId (`:110`, `:371-375`) | n/a | Not needed — one `notificationclick` per notification. |

### Deep-link routing from a tap

Mobile: `handleActions` (`push-notification.provider.tsx:366-435`) plus the
Android background copy in `index.js:51-115`.
Web: `targetPath(data)` (`firebase-messaging-sw.js:85-90`), mirrored in
`pushClient.ts:369`.

| # | Payload | Mobile destination | Web destination | Status |
|---|---|---|---|---|
| 41 | `data.type === 'CHAT_MESSAGE'` + `channelId` | `Buddies → ChatScreen(channelId)` (`:376-378`) | `/chat/{channel_id}` | ✅ |
| 42 | legacy `data.channel` (JSON blob with `id`) | same, after `JSON.parse` (`:379-381`, `:227-235`) | ❌ | Web reads only `channel_type` + `channel_id`. A legacy-shaped payload lands on `/groups`. |
| 43 | `data.type === 'FRIEND_REQUEST'` | Buddies (requests) tab, after cancelling every connect notification (`:382-390`, `:412-435`) | ❌ | Web → `/groups`. Should be `/notifications` (requests tab). |
| 44 | `data.type === 'BUDDY'` | same as #43 | ❌ | Web → `/groups`. |
| 45 | `data.activityId` **and** `data.feedId` | `ActivitiesFeed` with `pendingPostId` → the post's detail, honouring `parentReactionId` (`:391-395`, `:292-331`) | ❌ | Web → `/groups`. The information to build `/groups/{feedId}?post={activityId}&reaction=…` is present in the payload and unused. |
| 46 | `data.type === 'POST'` (no `activityId`) | the group's activity feed (`:396-399`, `:258-290`) | ❌ | Web → `/groups` (the group list, not the group). |
| 47 | `data.type === 'LIVE_NOTIFY'` | `TwilioVideoRoom` with `{eventId, groupId, groupName, eventTitle, chatChannelId}`; cold start uses `CommonActions.reset` (`:400-402`, `:340-364`, `:43-79`) | ❌ | Web → `/groups`, even though `/live/[eventId]` exists. |
| 48 | any other `data.type` | Buddies (requests) tab (`:403-405`) | ❌ | Web → `/groups`. |
| 49 | `data.activityId` alone | post detail (`:406-408`) | ❌ | Web → `/groups`. |
| 50 | `livestream` channel push | mobile renders the live chat | ⚠️ | Web has no destination; `/groups` fallback is deliberate and documented. `/notifications` would now be a better catch-all than when that comment was written (`firebase-messaging-sw.js:80-83` still calls `/notifications` "a placeholder" — that is stale). |
| 51 | Dismiss modals / action sheets before navigating | `dismissActionSheets()` + `closeAllModals()` on every branch | n/a | Web navigation unmounts overlays. |

### What actually reaches a browser today

| # | Item | Mobile | Web | Status |
|---|---|---|---|---|
| 52 | Stream `message.new` push | enabled on the default Firebase provider | enabled on the `web` provider (`docs/PUSH.md` §Enabling an event type) | ✅ |
| 53 | Other Stream event types (`message.updated`, `reaction.new`, `notification.reminder_due`) | off | off | ✅ symmetric. |
| 54 | Backend-originated pushes (new post, buddy request, buddy accepted, new group member, live starting) | delivered to the FCM token held in `UserDeviceToken` | ❌ | No web token is ever written to that table (#4). Every notification type in the matrix above **except `MESSAGE`** therefore exists in the in-app Updates list on web but can never arrive as a browser notification. |
| 55 | Stream only pushes to a member with no active connection | pre-existing | ⚠️ | An open CancerBuddy tab marks the member online and suppresses push to their **phone** too. Documented in `docs/PUSH.md` §Limits. Not introduced by web, but worth tracking. |

---

## Cross-screen gaps

Ordered by impact.

1. **Web is invisible to the backend push pipeline.** (#4, #54.) Mobile writes
   its FCM token to the AppSync `UserDeviceToken` table; web does not. Until it
   does, a browser can receive chat messages and nothing else — no buddy
   requests, no new posts, no live-session alerts — regardless of what the
   service worker knows how to route. This is one mutation plus the
   dedupe-across-accounts logic already written in
   `src/context/auth/useAuth.ts:80-145`.

2. **The service worker routes one payload shape out of nine.** (#42-#49.) Every
   destination it would need already exists as a web route: `/chat/[channelId]`,
   `/groups/[groupId]`, `/groups/[groupId]/members`, `/buddies/[userId]`,
   `/live/[eventId]`, `/notifications`. `targetPath()` is ~5 lines today and
   `lib/notifications/routing.ts` is the finished map of the same decisions —
   the two want to be one function. Worth doing even before #1, because the
   `livestream` fallback comment (`firebase-messaging-sw.js:80-83`) is already
   stale: `/notifications` is a real screen now.

3. **No app-icon badge at all.** (#21-#23.) Mobile increments on every displayed
   notification and zeroes on tap and on foreground. `navigator.setAppBadge` /
   `clearAppBadge` are available in installed PWAs on Chrome/Edge and would
   mirror this in a few lines.

4. **The Updates list is not live.** Mobile refetches whenever a push arrives;
   web refetches only on the header button or a remount. The requests tab *is*
   live (AppSync subscription), which makes the asymmetry visible inside one
   screen — a request appears in the badge and the second tab while the first
   tab still shows yesterday's feed.

5. **Visiting `/notifications` leaves the OS tray untouched.** Mobile calls
   `notifee.cancelAllNotifications()` on mount. Web has the registration in hand
   (`registration.getNotifications()` → `close()`); it just never does it.

6. **Token rotation mid-session goes unhandled.** (#3.) Mobile listens to
   `onTokenRefresh`; web re-registers only on load, so a rotation during a long
   session silently stops delivery until the next reload.

7. **`formatName` on notification rows.** First-name truncation is right for
   buddy cards and wrong here — the sentence beside it often repeats the full
   name the row just truncated ("Maggie sent you a friend request" under a
   heading reading "Maggie" is fine; "Dr." under "(Multiple Myeloma Group): Dr.
   Sarah Chen commented on your post" is not).

8. **Verified and ambassador badges are the same glyph.** Mobile ships two
   distinct marks; web draws `✓` for both and distinguishes them only by
   `title`. Applies to `NotificationRow` specifically.

9. **The page-size comment in `lib/notifications/fetch.ts:83` is false.** Mobile
   pages at 10, web at 20. Either fix the comment or the value; do not leave a
   comment asserting a match that does not exist.

10. **No snooze gate on `/notifications`.** Mobile swaps the whole Updates stack
    for `SnoozeLayout` when the viewer is snoozed
    (`src/navigation/updates/UpdatesNavigation.tsx:16-18`). The web app reads
    `isSnooze` for other members everywhere but never for the viewer.

11. **Request-card content gaps.** The shared-interest line
    (`getLabelCoincidencies`) is absent, the "In remission" badge is absent, and
    the avatar is not a link. The "Next" carousel (`ConnectProvider`) has no web
    counterpart at all, which also affects profiles opened from `BUDDY`
    notifications.

12. **Empty states lost their illustrations** on both tabs. Mobile shows
    `AllSetPatient` and `BMCF_Caregiver`; web is text-only.

13. **A future notification type without a group dead-ends on web.** Mobile's
    `default` falls back to `PostDetail` using `activityId`/`feedId`; web
    returns `{kind:"none"}`. Safe today, brittle when the server adds a type.

14. **Neither app clears the Updates badge correctly for SUPPORT accounts** —
    mobile's intent to hide the whole tab for them is defeated by a mismatched
    enum member (`TabsNavigator.tsx:31-33` names `HomeNotifications`, the tab is
    registered as `Updates`). Web shows it too. Flagging so the web choice is
    made on purpose rather than by copying a bug.

---

### Tally

Counted across the inventory tables and the type matrix — one classification per
audited item, no double counting from the "Missing on web" summaries.

- ❌ **30** missing items
- ⚠️ **27** partial items
- ✅ **68** items at parity

Of the ❌ items, 12 are push-routing branches or token-lifecycle steps that
collapse into cross-screen gaps #1 and #2 above, and 3 are the app-badge trio;
the remaining 15 are independent.
