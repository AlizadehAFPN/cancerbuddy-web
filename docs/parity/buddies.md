# Buddies + Request Buddies — mobile vs web parity

Audit of the mobile `BuddiesScreens` stack (`src/navigation/buddies/BuddiesScreens.tsx`) and the
separate `RequestBuddies` bottom tab (`src/navigation/requestBuddies/`), against the web app.

**A naming trap, read this first.** On mobile the tab labelled **Buddies** is *not* discovery — its
home screen (`BuddiesScreen.Home` → `src/screens/buddies/homeBuddies/HomeBuddies.tsx`) is the **Stream
chat channel list**. Discovery lives one push deeper on `BuddiesScreen.Recommended`, and the *separate*
**RequestBuddies** bottom tab (Handshake icon) holds incoming buddy requests.

The web maps this differently and deliberately:

| Mobile | Web |
| --- | --- |
| `Buddies` tab home (chat list) | `/chat` |
| `BuddiesScreen.Recommended` (discovery) | `/buddies` (results section) |
| `RequestBuddies` tab (requests list) | `/buddies` (requests section, pinned above results) + `/notifications` |
| `BuddiesScreen.UserInfo` / `UserInfoConnect` | `/buddies/[userId]` |
| `BuddiesScreen.Adds` | `/buddies/ad/[adId]` |
| `BuddiesScreen.JournalList` / `JournalEntryDetail` | `/buddies/[userId]/journal` |

Statuses below use ✅ EXISTS / ⚠️ PARTIAL / ❌ MISSING.

---

## Summary

- **Rich media in chat is the largest gap by far.** You cannot send a video from web (it is not even
  in the file picker's `accept` list) and a received video renders as a plain download row. There is no
  camera capture, no image lightbox (photos open as raw files in a browser tab), and no PDF experience
  at all — no in-app viewer, no download progress, no save-to-device, no size limit, no error toasts.
  The whole "Add to message" sheet with its four labelled options is gone.
- **The `ReplyHost` / `AskToHost` attachment family does not exist on web.** No post card, no group
  card, no "GO TO COMMENT" / "GO TO GROUP" buttons, no "COMMENT NOT FOUND" state, neither pre-filled
  composer message, and no `REPLYMESSAGE` notification lambda. Web's chat route accepts only
  `channelId`, so none of the context params that drive this can even arrive.
- **No QR scanner anywhere on web.** Mobile's quick-search row has five entry points; web has four.
  `SCAN QR` (`BuddiesScreen.QrIdentificationBuddies` with `screen: 'SCANQR'`) has no web equivalent —
  documented as intentional in `components/profile/BuddyIdScreen.tsx:10-12`. Gone with it: the whole
  `useValidateRules` post-scan ladder (already-buddies / pending-invite / age-rule outcomes).
- **The profile action bar is thinner than mobile's.** No `Maybe later` button, no `Pending` info
  modal (`GOT IT` / `CANCEL REQUEST` → second confirm), no tappable ambassador badge →
  `ModalAmbassador` (with its "BECOME AN AMBASSADOR" external form link), no blocked-profile guard,
  and no full-screen photo gallery behind the PHOTOS block.
- **The buddy-request card shows the wrong subtitle.** Mobile computes *shared coincidences*
  (`utils/coincidences.ts` → "Interests, Medical center, Diagnosis"); web shows the sender's free-text
  `bio` instead (`components/buddies/RequestsSection.tsx:88-92`) even though `matchSummary()` already
  exists and is used on discovery cards.
- **Two interaction-model risks worth flagging:** the message action menu is **hover-only**, so touch
  browsers have no path to edit/delete/copy/react; and a **frozen conversation is still openable** from
  the list while its kebab menu stays live, both of which mobile blocks.

---

## Screen-by-screen inventory

### BuddiesScreen.Home (HomeBuddies) — the chat channel list

- **Mobile:** `src/screens/buddies/homeBuddies/HomeBuddies.tsx` — Stream `ChannelList` for every 1:1
  conversation, with a debounced two-branch server search, plus two pieces of session bootstrap.
- **Web:** `app/(app)/chat/page.tsx`, `components/chat/ConversationList.tsx`,
  `components/chat/ChatEmptyState.tsx`

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 1 | Channel list of all `messaging` channels where the user is a member | Stream `ChannelList`, `filters: {type:'messaging', members:{$in:[id]}}` (`HomeBuddies.tsx:400-409`) | ✅ | `lib/chat/useChannelList.ts`, hand-rolled instead of the Stream UI kit. |
| 2 | Sort by `has_unread: -1` — **unread conversations float to the top** | Stream `sort` (`HomeBuddies.tsx:404`) | ❌ | Web sorts by `last_message_at` only and documents the choice at `useChannelList.ts:164-166`. |
| 3 | 30-per-page infinite scroll | `CHANNEL_QUERY_PAGE = 30` (`HomeBuddies.tsx:39, 405`) | ✅ | `useChannelList.ts:8`; web additionally caps at `MAX_OFFSET = 1000` (`:10, 72-75`), mobile has no cap. |
| 4 | Search box with clear button | `SearchInput` (`HomeBuddies.tsx:392-397`) | ✅ | `ConversationList.tsx:112-130`. |
| 5 | Search minimum 2 characters | `SEARCH_MIN_CHARS = 2` (`HomeBuddies.tsx:40, 365`) | ✅ | `useConversationSearch.ts:9`. |
| 6 | Search debounce 500 ms (300 ms when clearing) | `SEARCH_DEBOUNCE_MS = 500` (`HomeBuddies.tsx:41, 366-379`) | ⚠️ | Web debounces at 350 ms (`useConversationSearch.ts:10`). |
| 7 | Search branch A: channel-name `$autocomplete`, paginated across every page | `client.queryChannels` (`HomeBuddies.tsx:296-308`) | ✅ | `useConversationSearch.ts:106-115`. |
| 8 | Search branch B: `queryUsers($autocomplete)` → `queryChannels($in peerIds)` so last-name search works | `HomeBuddies.tsx:310-332`, capped at 100 users | ✅ | `useConversationSearch.ts:119-146` — up to 300 users. Web exceeds mobile. |
| 9 | Local in-memory fallback over `client.activeChannels` when both branches fail | `channelMatchesSearchQuery` (`HomeBuddies.tsx:44-55, 342-345`) | ✅ | `useConversationSearch.ts:186-192`, plus an instant local pre-filter that also matches last-message text. |
| 10 | Full-text search over **message bodies** | — (mobile matches channel + member names only) | ✅ | Web-only third branch, `client.search()` (`useConversationSearch.ts:151-181`). Web extra. |
| 11 | "Unread only" filter chip | — | ✅ | Web-only (`ConversationList.tsx:93-107`). Web extra. |
| 12 | Row: avatar + goal-image overlay, initials fallback | `ChatListMessagesPreview.tsx:182-195` | ✅ | `ChatAvatar.tsx:32-50`. |
| 13 | Row: Support "verified" badge | `ChatListMessagesPreview.tsx:210-215` (`verified.png`) | ✅ | `RoleBadges.tsx:13-18` (lucide `BadgeCheck`). Different art. |
| 14 | Row: Ambassador badge | `ChatListMessagesPreview.tsx:216-221` | ✅ | `RoleBadges.tsx:19-24` (lucide `Award`). |
| 15 | Row: green "Host" pill | `ChatListMessagesPreview.tsx:222-231` | ⚠️ | Rendered (`RoleBadges.tsx:25-29`), but **derived from a different field** — mobile uses `!!userData.groupHostId` (`ChatListMessagesPreview.tsx:66`), web uses `userType === "HOST"` (`lib/chat/contactProfile.ts:92`). A host whose `userType` isn't `HOST` gets the badge on mobile and not on web. |
| 16 | Row: preview truncation — first line before `\n`, else first 20 chars + `" ... "` | `ChatListMessagesPreview.tsx:144-152` | ⚠️ | Web uses CSS single-line `truncate` (`ConversationListItem.tsx:80-88`). |
| 17 | Row: `"You're connected! Tap to chat."` for an empty channel | `ChatListMessagesPreview.tsx:163` | ✅ | `t("app.chat.connected")`. |
| 18 | Row: preview goes **bold** when unread | `ChatListMessagesPreview.tsx:237` | ⚠️ | Web changes colour only; the timestamp goes bold instead (`ConversationListItem.tsx:71, 81-84`). |
| 19 | Row: unread count badge | `ChatListMessagesPreview.tsx:261-278` | ✅ | Web caps at `99+`. Web extra. |
| 20 | Row: yellow "NEW" chip on a message-less channel | `ChatListMessagesPreview.tsx:280-289` | ✅ | `ConversationListItem.tsx:62-65`. |
| 21 | Row: relative timestamp | `formateDateChat()` (`ChatListMessagesPreview.tsx:251-260`) | ✅ | `listTimestamp()` (`lib/chat/helpers.ts:96-106`). |
| 22 | **Frozen channel is greyed out AND not tappable** | `onPress={() => !channel?.data?.frozen && …}` (`ChatListMessagesPreview.tsx:170`) | ❌ | Web only dims the row (`opacity-60`); the `<Link>` still opens it (`ConversationListItem.tsx:38, 44`). |
| 23 | Skeleton while the Stream client connects | `SkeletonChat` (`HomeBuddies.tsx:385-387`) | ✅ | `ConversationList.tsx:186-200`. |
| 24 | Empty state | `NotFoundLayout('')` (`HomeBuddies.tsx:383`) — shows the *search-miss* copy even for a genuinely empty list | ✅ | Web has proper separate copy for "no conversations" vs "no matches" (`ConversationList.tsx:140-159`). Web extra. |
| 25 | Illustrated empty state with a **"Find new buddies"** CTA | `ChatListEmptyState.tsx:17-30` — **dead code**, overridden at `HomeBuddies.tsx:383` | ⚠️ | Not shipped on mobile either; web's text-only empty state is not a regression. |
| 26 | "Searching…" in-flight indicator | — | ✅ | Web-only (`ConversationList.tsx:151-157`). Web extra. |
| 27 | Connection error + Retry on the list | — (mobile renders the skeleton forever) | ✅ | Web-only (`ConversationList.tsx:140-145`). Web extra. |
| 28 | Global unread badge on the nav/tab | `client.getUnreadCount(id)` → `channel_type[0].channel_count` = **count of unread channels** (`tab-bar.tsx:96-101`) | ⚠️ | Web uses `total_unread_count` = **count of unread messages** (`StreamChatProvider.tsx:82-84, 110-114`). Same badge, different number. |
| 29 | Stream client auto-reconnect: 3 attempts, 1s/2s/4s backoff, silent | `ChatProviderLayout.tsx:8-9, 54-65` | ⚠️ | Web makes one attempt with a 15 s timeout and then surfaces a manual **Retry** (`StreamChatProvider.tsx:56-59, 75-79`). |
| 30 | Phone-verification modal auto-opens once if `getUser.phone` is empty | `GET_USER_PHONE` + `ModalVerifyYourPhone` (`HomeBuddies.tsx:117-136`) | ❌ | No phone-verification prompt anywhere in the web app shell. |
| 31 | Support-channel bootstrap: reads `pendingSupportChannel`, calls `connectChannelSupport`, creates a `Connection`, accepts it, watches the channel, then fires `CREATE_SUPPORT_MESSAGE` | `HomeBuddies.tsx:138-235` | ❌ | A user who signed up expecting a support conversation never gets one on web. |
| 32 | Network-status guard — clears the unread count and skips filters when offline | `useNetworkStatus` (`HomeBuddies.tsx:237-244`) | ❌ | |
| 33 | Header is the hamburger/drawer header | `HamburgerHeader` (`BuddiesScreens.tsx:35`) | ✅ | Sidebar / `AccountSheet`. |
| 34 | Two-pane master–detail layout | — | ✅ | Web-only (`app/(app)/chat/layout.tsx:16-33`) with a "Select a conversation" placeholder. Web extra. |

**Missing on web**

- The chat list is **not sorted unread-first** — mobile floats unread conversations to the top.
- A **frozen conversation can still be opened** from the list; mobile makes the row inert.
- The **Host badge** is computed from `userType === "HOST"` rather than mobile's `groupHostId`, so it
  appears on a different set of people (and, because the same flag hides the conversation kebab menu,
  the wrong people get menu access too).
- The nav unread badge counts **messages**, not **conversations** — a different number from mobile's.
- Stream reconnection is manual (one attempt + Retry button) rather than mobile's silent 3-attempt
  backoff.
- No phone-verification modal for users without a phone number on file.
- No support-channel bootstrap — the "talk to support" conversation mobile auto-creates after signup
  is never created on web.
- No offline/network-status handling.
- Minor: search debounces at 350 ms not 500 ms; the unread preview is coloured rather than bold; the
  20-character preview truncation rule is replaced by CSS ellipsis.

---

### BuddiesScreen.Recommended — discovery

- **Mobile:** `src/screens/buddies/recommended/Recommended.tsx` — the discovery screen: quick-search
  row, active-filter chips, and a two-section list (`RECOMMENDED FOR YOU` / `MORE OPTIONS`).
- **Web:** `components/buddies/BuddiesScreen.tsx` (+ `BuddyGrid.tsx`, `BuddyCard.tsx`,
  `lib/buddies/useDiscovery.ts`)

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 1 | Heading "Let's find your next Buddy" + "QUICK SEARCH" label | `SearchBuddy.tsx:85-92` | ✅ | `app.buddies.heading` / `app.buddies.quickSearch`. |
| 2 | Quick filter button **DIAGNOSIS** with count badge | `SearchBuddy.tsx:95-101` | ✅ | `QuickSearchBar.tsx:133-138`. |
| 3 | Quick filter button **LOCATION** with count badge (state + city each count 1) | `SearchBuddy.tsx:102-108` | ✅ | `QuickSearchBar.tsx:120-124` counts identically. |
| 4 | Quick filter button **CUSTOM** with count of every other selected value | `SearchBuddy.tsx:109-115` | ✅ | `QuickSearchBar.tsx:25-48` enumerates the same key set. |
| 5 | Quick filter button **SCAN QR** → `QrIdentificationBuddies` with `screen: 'SCANQR'` | `SearchBuddy.tsx:117-121` | ❌ | No camera/QR decode on web at all. |
| 6 | Quick filter button **BUDDY ID** → `QrIdentificationBuddies` with `screen: 'SEARCHID'` | `SearchBuddy.tsx:122-126` | ✅ | `BuddyIdSheet.tsx` (a sheet, not a route). |
| 7 | Removable chips row for every selected filter, one chip per value | `FiltersSelectedLayout.tsx` + `useFiltersSelected` | ✅ | `FilterChipsRow.tsx`. |
| 8 | Chip X removes exactly that value | `FiltersSelectedLayout.tsx:47` | ✅ | `removeChip()` in `lib/buddies/filterChips.ts`. |
| 9 | "Clear all" affordance | — (mobile only has per-chip X + the Filter screen's Clear All) | ✅ | Web adds a `Clear all` button next to the chips (`FilterChipsRow.tsx:65-71`). Web extra. |
| 10 | Two sections: `RECOMMENDED FOR YOU` (shares a diagnosis) then `MORE OPTIONS` | `recommended-fetcher.ts:78-120`, `userIntersection.ts:152-159` | ✅ | `BuddyGrid.tsx:123-141`; same recommended/rest split. |
| 11 | Section header shows the section title | `RecommendedLayout.tsx:195-204` | ✅ | Web also shows a per-section count. Web extra. |
| 12 | Infinite scroll — `onEndReached` grows the page | `RecommendedLayout.tsx:205-206`, `pagintationSections` | ✅ | `BuddyGrid.tsx:67-82` — IntersectionObserver, 24 per page. |
| 13 | List scrolls back to top when the filter set changes | `RecommendedLayout.tsx:81-95` | ✅ | Web remounts the grid on `filtersKey` (`BuddiesScreen.tsx:239`). |
| 14 | Per-row skeleton while a profile loads | `RecommendedItemSkeleton` / `Skeleton` (`RecommendedItem.tsx:59`) | ✅ | `BuddyCardSkeleton`. |
| 15 | Rows for deleted users are hidden entirely once known-missing | `useUserDataExists` (`RecommendedLayout.tsx:45-50`) | ✅ | `profiles.isMissing(id)` (`BuddyGrid.tsx:104`). |
| 16 | Row content: avatar + goal icon, `Name, age`, role/relationship badge, shared-coincidence labels | `RecommendedItem.tsx:63-78` | ✅ | `BuddyCard.tsx`; `matchSummary()` reproduces the labels. |
| 17 | Ambassador ring/badge on the avatar | `AvatarInfoLayout` `isAmbassador` | ⚠️ | Web shows an "AMBASSADOR" pill next to the name, not an avatar overlay, and it is **not tappable**. |
| 18 | Swipe-left on a row → delete action | `SwipeableItem` (`RecommendedLayout.tsx:53-64`) | ⚠️ | Web uses a hover/focus **X** in the card's top-right (`BuddyCard.tsx:171-182`). Same outcome, different gesture. |
| 19 | Delete confirmation modal: title `SURE_YOU_WANT_TO_DELETE_BUDDIES.title`, body, single CTA | `ModalRemoveBuddie` (`RecommendedLayout.tsx:103-123, 219-250`) | ⚠️ | Web confirms **inline inside the card** (`BuddyCard.tsx:82-112`) rather than in a modal. |
| 20 | Delete writes `omitConnectionUser` with `blocked: true`, then refreshes the list | `RecommendedLayout.tsx:132-144` | ✅ | `hideUserFromDiscovery()` writes the same `blocked: true` connection row. |
| 21 | Full-screen loader while the first fetch runs | `LoaderIndicator` (`Recommended.tsx:244-249`) | ✅ | Six-card skeleton grid. |
| 22 | "No buddies found with these filters." in danger red when filters match nobody | `Recommended.tsx:232-242` | ⚠️ | Web shows `DiscoveryEmptyState` with `emptyFiltered` copy — same intent, no red inline line. |
| 23 | Share modal **auto-opens** when filters match nobody | `openShareModal` + `useEffect` (`Recommended.tsx:168-194`) | ❌ | Web never auto-opens anything; the share action is a button inside the empty state. |
| 24 | Full-screen `Share` screen (QR + copy) when there are no buddies at all and no filters | `Recommended.tsx:215-219` | ⚠️ | Web's `DiscoveryEmptyState.tsx` uses `navigator.share` / clipboard on a `/register` link. No QR. |
| 25 | Back button in the header | `GlobalBackButton` (`Recommended.tsx:212`) | ✅ | n/a — `/buddies` is a top-level tab on web. |
| 26 | Refresh on focus (`useFocusEffect` → `screenMutate`) | `Recommended.tsx:106-119` | ⚠️ | Web has an explicit **Refresh** button (`BuddiesScreen.tsx:205-215`); it does not re-run on route focus. |
| 27 | 5-minute in-memory cache of the age-guarded + diagnosis-peer scans, refreshed in the background | `recommended-fetcher.ts:9-51` | ✅ | `lib/buddies/audience.ts` — same 5-minute TTL and background refresh. |
| 28 | Age-bracket guard: only users inside the viewer's age bracket are ever returned | `Filter.rangeUsers.tsx` (`isSnooze: {ne:true}` + `birth: {between: birthRules(...)}`) | ✅ | `discoveryFetch.ts:201-206` — identical filter including `isSnooze: {ne: true}`. |
| 29 | Blocked users and existing connections subtracted from results | `userIntersection.ts:15-29` | ✅ | `lib/buddies/intersect.ts` via `BuddiesProvider`. |
| 30 | Result count / "N people" readout | — | ✅ | Web-only addition (`BuddiesScreen.tsx:195-204`). Web extra. |
| 31 | Inline **Connect** button on each result row | — | ✅ | Web-only addition (`BuddyCard.tsx:194-204`); mobile requires opening the profile first. Web extra. |
| 32 | Error state + retry for a failed discovery run | none (mobile silently returns `{type:'error', data:[]}`) | ✅ | Web shows an error card with `Try again`. Web extra. |

**Missing on web**

- The **SCAN QR** quick-search button and everything behind it.
- The share modal no longer *auto-opens* when a filter search returns nobody — the user has to press
  a button.
- The empty/share screen has no QR code to show a friend; it copies a `/register` link instead.
- The ambassador badge on a result row is not tappable (mobile opens the ambassador explainer).
- Discovery does not re-run when you navigate back to the tab; you must press **Refresh**.
- The swipe gesture and the confirmation modal are replaced with a hover-X and an inline confirm —
  functionally equivalent, visually different.

---

### BuddiesScreen.Filter — the full "Custom" filter form

- **Mobile:** `src/screens/buddies/filter/Filter.tsx` — a full-screen form; which sections render
  depends on the **viewer's** own userType and age, not the people being searched.
- **Web:** `components/buddies/CustomFilterSheet.tsx`

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 1 | X close button (goBack) | `Filter.tsx:117-125` | ✅ | Sheet close. |
| 2 | **STATUS** radio group: `Currently a patient` / `Survivor` / `Caregiver` | `StatusPatientLayout.tsx:32-36` | ✅ | Web adds a fourth **Anyone** option to clear the choice (`CustomFilterSheet.tsx:47-52`) — mobile has no way to unselect except Clear All. Web extra. |
| 3 | **AGE RANGE** section, only when `displayAge(viewer.birth) >= MAXAGE` | `Filter.tsx:142-151` | ✅ | Same guard (`CustomFilterSheet.tsx:345`). |
| 4 | Section title becomes **CAREGIVER INFO** for caregivers | `Filter.tsx:145-149` | ✅ | `sectionCaregiverInfo`. |
| 5 | `Minimum Age` numeric input (mask `yyyy`) | `AgeRange.tsx:21-28` | ✅ | |
| 6 | `Maximum Age` numeric input (mask `yyyy`) | `AgeRange.tsx:29-36` | ✅ | |
| 7 | **PERSONAL INFORMATION** heading (hidden for caregivers) | `Filter.tsx:152-156` | ⚠️ | Web always shows the heading. |
| 8 | `Gender` dropdown (pronouns, custom order) | `PersonalInfoPatientLayout.tsx:128-145` | ✅ | |
| 9 | `Gender Identity` dropdown (transgender) | `PersonalInfoPatientLayout.tsx:146-164` | ✅ | |
| 10 | `Sexual Orientation` dropdown | `PersonalInfoPatientLayout.tsx:165-183` | ✅ | |
| 11 | `Ethnicity` dropdown | `PersonalInfoPatientLayout.tsx:184-202` | ✅ | |
| 12 | `Language` multi-select + "ADD ANOTHER LANGUAGE" | `PersonalInfoPatientLayout.tsx:203-223` | ✅ | |
| 13 | `State` dropdown | `PersonalInfoPatientLayout.tsx:226-240` | ✅ | Choosing a state clears the city on both. |
| 14 | `City` autocomplete, rendered only once a state is chosen | `PersonalInfoPatientLayout.tsx:241-263` | ✅ | `AsyncSelectField kind="city"` (`CustomFilterSheet.tsx:419-429`). |
| 15 | `Workplace` autocomplete | `PersonalInfoPatientLayout.tsx:266-288` | ✅ | |
| 16 | **RELATIONSHIP TO PATIENT** checkbox group — caregivers only | `Filter.tsx:157-162`, `RelationshipFilterLayout.tsx` | ✅ | Web renders toggle pills instead of checkboxes (`CustomFilterSheet.tsx:443-467`). |
| 17 | **PATIENT INFO** / **MEDICAL INFORMATION** heading depending on viewer type | `Filter.tsx:163-173` | ✅ | |
| 18 | `Diagnosis` multi autocomplete, label swaps for caregivers | `PatientDiagnosisLayout.tsx:165-202` | ✅ | |
| 19 | `Patient minimum age` / `Patient maximum age` — caregivers only | `PatientDiagnosisLayout.tsx:203-238` | ✅ | |
| 20 | `Treatment Status` dropdown — hidden for SURVIVOR viewers | `PatientDiagnosisLayout.tsx:239-263` | ✅ | |
| 21 | Choosing "Pre-treatment" (or clearing status) empties the treatments list | `updateTreatment` (`PatientDiagnosisLayout.tsx:133-149`) | ✅ | `setTreatmentStatus` (`CustomFilterSheet.tsx:246-257`). |
| 22 | `Treatments` multi-select, disabled until a treatment status is chosen (non-survivors) | `validateTreatment` (`PatientDiagnosisLayout.tsx:94-122, 285-288`) | ✅ | `treatmentsDisabled` (`CustomFilterSheet.tsx:259`). |
| 23 | `In remission since` `MM/YYYY` masked input + hint — SURVIVOR viewers only | `PatientDiagnosisLayout.tsx:290-314` | ✅ | `maskMonthYear` (`CustomFilterSheet.tsx:532-547, 624-628`). |
| 24 | `Side effects` (disabilities) multi-select, first item clearable, "ADD" button | `PatientDiagnosisLayout.tsx:315-348` | ✅ | |
| 25 | `Medical Center` multi autocomplete | `MedicalCenterLayout.tsx:24-61` | ✅ | Its own section on web. |
| 26 | `Support Organizations` multi-select, **capped at 3** | `SupportOrganizationsLayout.tsx:32-59` (`limit={3}`) | ✅ | `SUPPORT_ORG_LIMIT = 3` (`CustomFilterSheet.tsx:55, 283-289`). |
| 27 | **OTHER INFORMATION** — "coping with cancer loss" checkbox | `CancerLoss.tsx:34-42` | ✅ | |
| 28 | `Who did you lose?` dropdown, shown only when the checkbox is on; cleared when it is off | `CancerLoss.tsx:23-30, 43-64` | ✅ | `setCancerLoss` (`CustomFilterSheet.tsx:262-268`). |
| 29 | "Currently in college" checkbox, only when `viewerAge >= UNIVERSITY_AGE` and viewer isn't a caregiver | `OtherInformationPatientLayout.tsx:29-31`, `Colleges.tsx:31-41` | ✅ | Same double guard (`CustomFilterSheet.tsx:598`). |
| 30 | `College` autocomplete, shown only when the checkbox is on; cleared when it is off | `Colleges.tsx:22-29, 42-69` | ✅ | `setInCollege` (`CustomFilterSheet.tsx:270-276`). |
| 31 | **Apply** button | `Filter.tsx:194-199` | ✅ | Web disables it until the draft differs from live filters; mobile's `disabled={formik.values === isChange}` never fires (object identity), so mobile's is always enabled. |
| 32 | **Clear All** button, disabled when nothing is selected | `Filter.tsx:202-208` | ✅ | |
| 33 | Filters survive navigating to a profile and back | `ConnectProvider` state | ✅ | Held at `app/(app)/buddies/layout.tsx` in `DiscoveryFiltersProvider`. |
| 34 | Applying re-runs discovery immediately | `mutate(key.startsWith('GET_LIST_BUDDIES_RECOMMENDED'))` (`Filter.tsx:96`) | ✅ | |

**Missing on web**

- The "PERSONAL INFORMATION" heading is always shown; mobile hides it for caregivers. Cosmetic.
- Nothing else — every individual filter field, its conditional visibility rule, its dependent-field
  clearing behaviour, and the support-organization cap of three, are reproduced.

---

### BuddiesScreen.UserInfo / UserInfoConnect — the buddy profile

- **Mobile:** `src/screens/buddies/userInfo/UserInfo.tsx` (478 lines) and
  `src/screens/buddies/userInfo/UserInfoConnect.tsx` (245 lines) — two near-identical screens sharing
  `components/UserInfoContent.tsx`, `components/ConnectionButtonBar.tsx` and
  `hooks/useUserInfoShared.ts`. `UserInfoConnect` is the paging variant reached from Recommended;
  `UserInfo` is the one reached from a request, a deep link or a group.
- **Web:** `components/buddies/BuddyProfileScreen.tsx`

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 1 | X close button (goBack, or → Recommended in `UserInfoConnect`) | `UserInfo.tsx:400-404`, `UserInfoConnect.tsx:201-209` | ✅ | Web has both a `Back` button and an X → `/buddies`. |
| 2 | Skeleton while loading | `UserInfoSkeleton` (`UserInfo.tsx:409-410`) | ✅ | `ProfileSkeleton`. |
| 3 | Large avatar + goal icon overlay | `AvatarInfoLayout` (`UserInfoContent.tsx:75-95`) | ✅ | `BuddyAvatar size={96}`. |
| 4 | `Name, age` title (age omitted for SUPPORT accounts) | `UserInfoContent.tsx:64-78` | ✅ | `ageSuffix()`. |
| 5 | Pronoun, suppressed when "I rather not disclose" | `validationPronoun` (`useUserInfoShared.ts:19-24`) | ✅ | `displayablePronoun` (`profileDetail.ts:222-226`). |
| 6 | Location `City, ST` | `formatLocation` (`UserInfoContent.tsx:80-83`) | ✅ | |
| 7 | "Here to <goal>" line | `UserInfoContent.tsx:85-89` | ✅ | |
| 8 | Role badge (Patient / Survivor / Caregiver / Host / Support) | `showRoleBadge` (`UserInfoContent.tsx:94`) | ✅ | `ROLE_LABELS` + `ROLE_BADGE_CLASS`. |
| 9 | Ambassador check badge on the avatar | `AvatarInfoLayout` `isAmbassador` | ⚠️ | Web renders an "AMBASSADOR" pill, not an avatar overlay. |
| 10 | **Tapping the ambassador badge opens `ModalAmbassador`** — explainer copy, "BECOME AN AMBASSADOR" (opens a Google Form), "learn more", and for your own profile a "DISMISS" variant | `onPressVerify` → `useAmbassadorModal` (`useUserInfoShared.ts:43-85`) | ❌ | Not implemented on web at all. |
| 11 | Ambassador modal can also start a support conversation and fire `CREATE_AMBASSADOR_MESSAGE` | `sendMessages` → `raiseUserLambda(CREATE_AMBASSADOR_MESSAGE, USERS_LAMBDA)` (`useUserInfoShared.ts:50-64`) | ❌ | |
| 12 | Inline **feedback card** banner ("Your invite was sent…", age-rule message, "already buddies") | `FeedbackCard` (`UserInfoContent.tsx:96-98`; `UserInfo.tsx:390-392`) | ❌ | Web uses transient toasts only; there is no persistent banner on the profile. |
| 13 | **ABOUT** section (bio) | `UserInfoContent.tsx:102-114` | ✅ | |
| 14 | Info card: `Diagnosis` | `generateInfoCards` (`UserInfo.utils.tsx`) | ✅ | |
| 15 | Info card: `In remission since` (SURVIVOR) vs `Currently` (everyone else) | `UserInfo.utils.tsx:28-45, 77-90` | ✅ | `buildInfoCards` (`BuddyProfileScreen.tsx:77-107`). |
| 16 | Info card: `Side Effects` | `UserInfo.utils.tsx` | ✅ | |
| 17 | Info card: `Treatment` | `UserInfo.utils.tsx` | ✅ | |
| 18 | Info card: `Medical Center` | `UserInfo.utils.tsx` | ✅ | |
| 19 | Info card: `Support Organization` | `UserInfo.utils.tsx` | ✅ | |
| 20 | Info cards hidden for SUPPORT accounts | `shouldHide` (`UserInfoContent.tsx:46, 117`) | ✅ | `isSupportAccount` guard. |
| 21 | **JOURNAL** preview — most recent public entry, date, 4-line clamp, "Read More" → journal list | `JournalPreviewProfile.tsx` | ⚠️ | Web shows the **newest** entry; mobile's `JournalPreviewProfile` sorts ascending and reads `entries[entries.length - 1]`, i.e. also the newest. Same result. Web adds an entry-count line. |
| 22 | **PHOTOS** block; **tapping it opens the full `GalleryScreen`** | `UserInfoContent.tsx:130-142` → `navigation.navigate(galleryScreen, {userId})` | ⚠️ | Web renders the grid but it is **not clickable** (`BuddyProfileScreen.tsx:369-383`); there is no gallery route and no lightbox. |
| 23 | Route → gallery-screen map so the right stack's gallery opens | `galleryScreen` memo (`UserInfo.tsx:145-158`) | ❌ | n/a on web (no gallery route). |
| 24 | **INTERESTS** badges | `InterestsLayout` (`UserInfoContent.tsx:145-149`) | ✅ | |
| 25 | **PERSONAL BACKGROUND** → Workplace card with a Buildings icon (UserInfo only, not UserInfoConnect) | `UserInfo.tsx:427-438` | ✅ | Web also adds a **College** card in the same section. Web extra. |
| 26 | **SPONSORED BY** block for SUPPORT accounts (image + description) | `UserInfo.tsx:446-453` | ✅ | `BuddyProfileScreen.tsx:425-442`. |
| 27 | Action bar: **Connect** | `ConnectionButtonBar.tsx:64-77` | ✅ | |
| 28 | Connect writes `createConnectionUser` and toasts "Your invite was sent!…" | `UserInfo.tsx:215-233` | ✅ | `useConnectAction.ts`. |
| 29 | Guard: pressing Connect when a connection already exists toasts `CONNECTION_USER_HAS_INVITATION` | `UserInfo.tsx:249-253` | ✅ | `useConnectAction.ts:35-38`. |
| 30 | Optional confirmation modal before sending ("Do you wish to add this new friend?" / "Yes, send invite" / "Cancel") when `params.showConfirmModal` | `confirmConnection` (`UserInfo.tsx:235-247`) | ❌ | Used by the QR/deep-link path; no web equivalent. |
| 31 | Action bar: **Pending** button with an info icon | `ConnectionButtonBar.tsx:80-92` | ⚠️ | Web shows a **Withdraw invite** button directly (`BuddyProfileScreen.tsx:463-472`) — the "Pending" label is gone. |
| 32 | Pressing Pending opens `ModalPendingConnection`: "You've already sent a connection request to this user." with **GOT IT** and **CANCEL REQUEST** | `UserInfo.tsx:265-271` | ❌ | |
| 33 | CANCEL REQUEST opens a **second** confirm: "Are you sure you want to cancel the connection request?" / "YES, CANCEL REQUEST" | `ModalPendingConnection.tsx:80-113` | ❌ | Web withdraws in one click, no confirmation. |
| 34 | Cancelling deletes the connection and pops the screen (or goes Home from the invite route) | `handleCancelConnection` (`UserInfo.tsx:273-282`) | ⚠️ | Web deletes the connection and stays on the profile with a toast. |
| 35 | Action bar: **Connected** (disabled) when already buddies | `ConnectionButtonBar.tsx:95-104` | ⚠️ | Web replaces it with an active **Chat with buddy** button. |
| 36 | Action bar: **Chat** when `params.isBuddy` | `ConnectionButtonBar.tsx:126-134` | ✅ | Web's connected state is exactly this button. |
| 37 | Chat resolution: query Stream for the existing 1:1 channel first, else fall back to `FETCH_CONNECTION_STATUS`, else create the channel with both members and a `"Them Me"` name | `openBuddyChat` (`UserInfo.tsx:332-386`) | ⚠️ | Web routes straight to `/chat/${connection.connectionId}` (`BuddyProfileScreen.tsx:456-460`). If a legacy pair's channel is keyed by a *different* connection id, web lands on a channel that doesn't exist. |
| 38 | Toast "This chat is not available right now. Please try again." when no channel can be resolved | `UserInfo.tsx:361` | ❌ | |
| 39 | Action bar: **Maybe later** (only when `showMaybeLater` and not already buddies) | `ConnectionButtonBar.tsx:117-125` | ❌ | No such button on the web profile. |
| 40 | Maybe later deletes the incoming connection, toasts `MAYBE_LATER_REQUEST_NOTIFICATION(name)` and goes back | `handleMaybeLater` (`UserInfo.tsx:284-300`) | ⚠️ | Only available from the request card on web, never from the profile. |
| 41 | Action bar: **Next** — walks `connectState.usersList` | `handleNext` (`UserInfo.tsx:302-311`) | ✅ | `lib/buddies/discoveryOrder.ts` + `goToNext`. |
| 42 | Every 6th Next (then every 5th) replaces the profile with a partner ad | `PROFILES_VISITED = 5` (`UserInfo.tsx:303-306`) | ✅ | `lib/buddies/adRotation.ts` reproduces the off-by-one deliberately. |
| 43 | **Previous** button | — | ✅ | Web-only addition (`BuddyProfileScreen.tsx:487-498`). Web extra. |
| 44 | Position indicator ("3 of 128") | — | ✅ | Web-only addition. Web extra. |
| 45 | Loading spinner in the button bar while the connection status is unknown | `ConnectionButtonBar.tsx:46-61` | ✅ | Pulsing placeholder (`BuddyProfileScreen.tsx:452-453`). |
| 46 | **Blocked check** on open — `GET_BLOQUED_BY_REMITENT_AND_RECIPIENT`; on a hit, toast "The profile you are trying to reach is not available" and the whole action bar is hidden | `getBlockedUser` (`UserInfo.tsx:201-213, 457`) | ❌ | Web renders a blocked user's profile normally with a working Connect button. |
| 47 | Action bar hidden entirely for SUPPORT accounts | `UserInfo.tsx:457` | ✅ | `!isSupportAccount` guard. |
| 48 | Action bar hidden when the viewer is a group host (`groupHostId`) | `UserInfo.tsx:457` | ❌ | No host-mode suppression on web. |
| 49 | Deep-link `buddyId` resolution: paginated `GET_USER_ID_FROM_BUDDY_ID_TOKEN`, then `setParams({userId})`; toasts "User not found" / "Could not load user" and goes back | `UserInfo.tsx:95-141` | ⚠️ | Web resolves buddy ids in `BuddyIdSheet` / `BuddyIdScreen` before navigating, so `/buddies/[userId]` itself takes no `buddyId` param. |
| 50 | Re-checks connection status on every focus so a stale "Pending" can't stick | `refreshConnectionFor` (`UserInfo.tsx:193-195`), `refetchConnectionStatus` (`UserInfoConnect.tsx:100-104`) | ⚠️ | Web reads the map once per `BuddiesProvider` mount; there is no per-profile re-check on navigation. |
| 51 | Prefetches the **next** user's profile and gallery | `useQueryInmutable` on `nextUser` (`UserInfoConnect.tsx:57-60`) | ❌ | Web fetches on arrival. |
| 52 | Prefetches the partner-ad list | `fetchAds` (`useUserInfoShared.ts:27-40`) | ✅ | `prefetchAds()` (`BuddyProfileScreen.tsx:155-157`). |

**Missing on web**

- Tapping the ambassador badge does nothing — the whole ambassador explainer, its "Become an
  ambassador" form link and its "message support" side effect are absent.
- No **Maybe later** button on the profile.
- No **Pending** state with its info modal and two-step cancel confirmation; web offers a single-click
  "Withdraw invite" instead.
- No inline feedback banner — invite/age/already-buddies messages only appear as toasts that vanish.
- The **PHOTOS** grid is not clickable and there is no full-screen gallery screen.
- No blocked-profile check: a user you blocked (or who blocked you) still renders with a live Connect
  button.
- No "send invite?" confirmation modal for the QR/deep-link entry path.
- Opening chat assumes the channel id equals the connection id; mobile queries Stream first and
  repairs/creates the channel when it doesn't, plus toasts when it can't.
- No action-bar suppression for group-host accounts.
- No per-profile connection-status refresh on navigation, and no next-profile prefetch.

---

### BuddiesScreen.GalleryScreen — full photo gallery

- **Mobile:** `src/screens/buddies/gallery/GalleryScreen.tsx` — a full-screen list of every photo in
  another member's gallery, newest first, with signed S3 URLs.
- **Web:** — none —

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 1 | Dedicated route reached by tapping the PHOTOS block on a profile | `BuddiesScreens.tsx:99-107` | ❌ | No `/buddies/[userId]/gallery` route. |
| 2 | "PHOTOS" heading | `GalleryScreen.tsx:85-91` | ⚠️ | Only on the profile block. |
| 3 | Full list of gallery pictures | `GET_USER_GALLERY_BY_ID` (`GalleryScreen.tsx:28-37`) | ⚠️ | The profile block renders all of them, but small and in a fixed grid. |
| 4 | Signed S3 URL per image (`Storage.get`, 9000 s expiry) | `GalleryScreen.tsx:39-71` | ✅ | `getS3ImageUrl` in `profileDetail.ts`. |
| 5 | Sorted newest-first by `createdAt` | `orderDates` (`GalleryScreen.tsx:75-78`) | ❌ | Web renders in the order `listPictures` returns; no sort. |
| 6 | Full-screen loader while fetching | `Loader` (`GalleryScreen.tsx:81`) | ⚠️ | Covered by the profile skeleton. |
| 7 | Per-image error toast on a failed signed-URL fetch | `showErrorInToast` (`GalleryScreen.tsx:66`) | ❌ | Web silently drops images whose URL fails. |
| 8 | Back button header | `GlobalBackButton` (`BuddiesScreens.tsx:105`) | ❌ | |

**Missing on web**

- The gallery screen does not exist. Photos are visible on the profile but cannot be opened, enlarged,
  or browsed, and they are not sorted newest-first.

---

### BuddiesScreen.JournalList / JournalEntryDetail — another member's journal

- **Mobile:** `src/screens/buddies/journal/JournalPreviewList.tsx` (list) and
  `JournalPreviewEntryDetail.tsx` (single entry), plus `JournalPreviewProfile.tsx` (the card on the
  profile).
- **Web:** `app/(app)/buddies/[userId]/journal/page.tsx` → `components/buddies/JournalList.tsx`, and
  `components/buddies/JournalPreview.tsx`

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 1 | Profile card showing the latest public entry, its date, clamped to 4 lines | `JournalPreviewProfile.tsx:74-96` | ✅ | `JournalPreview.tsx` (`line-clamp-4`). |
| 2 | Card renders nothing when nothing is shared | `entries.length > 0` (`JournalPreviewProfile.tsx:74`) | ✅ | `JournalPreview.tsx:54`. |
| 3 | "Read More →" CTA on the card | `JournalPreviewProfile.tsx:98-106` | ✅ | |
| 4 | Entry count under the card | — | ✅ | Web-only addition. Web extra. |
| 5 | List screen: "JOURNAL" heading | `JournalPreviewList.tsx:76-81` | ✅ | Web also shows the author's avatar and name. Web extra. |
| 6 | Only entries the author marked visible | `GET_JOURNAL_ENTRIES_ONLY_VISIBLE` | ✅ | `fetchPublicJournal`. |
| 7 | Entries sorted newest-first | `orderDates(b.createdAt, a.createdAt)` (`JournalPreviewList.tsx:84`) | ✅ | |
| 8 | Each row: bold US-format date + one-line truncated preview | `JournalPreviewList.tsx:86-104` | ⚠️ | Web shows the **full** entry text in the list rather than a one-line preview. |
| 9 | **Tapping a row opens `JournalEntryDetail`** — a separate screen with the date and the full text | `navigateToEntry` (`JournalPreviewList.tsx:58-63`), `JournalPreviewEntryDetail.tsx` | ⚠️ | No detail route on web; the list already shows everything, so nothing is lost, but the two-level navigation is gone. |
| 10 | Full-screen loader | `Loader` (`JournalPreviewList.tsx:72`) | ✅ | Three-card skeleton. |
| 11 | Route-name → detail-screen map so the right stack's detail opens | `getJournalRoutes` (`JournalPreviewList.tsx:34-44`) | ❌ | n/a — one route on web. |
| 12 | Back button header | `GlobalBackButton` (`BuddiesScreens.tsx:129`) | ✅ | |
| 13 | Empty state when nothing is shared | none — mobile renders a bare "JOURNAL" heading | ✅ | Web shows `journalNoneShared` copy. Web extra. |
| 14 | Error state + retry | none | ✅ | Web-only addition. Web extra. |

**Missing on web**

- No separate journal-entry detail screen. Acceptable — the list shows full entry text — but the
  one-line-preview + tap-to-expand interaction is gone.

---

### BuddiesScreen.Adds + WebView — the partner-resource interstitial

- **Mobile:** `src/screens/buddies/ads/AddsScreen.tsx` + `src/components/layouts/Ads/AdLayout.tsx`,
  and `src/screens/buddies/webview/WebViewScreen.tsx` (a transparent-modal in-app browser).
- **Web:** `app/(app)/buddies/ad/[adId]/page.tsx` → `components/buddies/AdScreen.tsx`

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 1 | Screen takes the entry's `bgColor`, including the safe area | `changeSafeAreaBgcolor(bgColor)` (`AddsScreen.tsx:24-30`) | ✅ | `AdScreen.tsx:199`. |
| 2 | Title, hero image, rich-text description, sponsor logo | `AdLayout.tsx:166-204` | ✅ | `RichText` component. |
| 3 | "SPONSORED BY" label above the logo | `AdLayout.tsx:194-197` | ✅ | Web also adds a "SPONSORED" eyebrow above the title. Web extra. |
| 4 | Inline "Read More" link (underlined) | `AdLayout.tsx:178-193` | ✅ | Opens in a new tab instead of an in-app WebView. |
| 5 | **Favourite star** — filled when favourited | `AdLayout.tsx:139-156` | ✅ | `FavouriteToggle` (`AdScreen.tsx:55-124`). |
| 6 | "add to favorites" button when not favourited | `AdLayout.tsx:148-155` | ✅ | |
| 7 | Favouriting writes `CREATE_FAVORITE_AD`; un-favouriting writes `DELETE_FAVORITE_AD` | `AdLayout.tsx:65-107` | ✅ | `lib/buddies/favoriteAds.ts`. |
| 8 | Favourite state seeded from `GET_FAVORITE_ADS` | `AdLayout.tsx:59-63, 109-121` | ✅ | `fetchFavoriteAds`. |
| 9 | Error toasts on favourite/un-favourite failure | `AdLayout.tsx:82, 103` | ✅ | One toast for both directions on web. |
| 10 | Primary button **MORE RESOURCES** → the Partners drawer screen | `goToTheList` (`AddsScreen.tsx:73-85`), `AdLayout.tsx:208-216` | ⚠️ | Web's primary button is **Read more** (opens the partner URL). Documented in `AdScreen.tsx:14-18` — `/partners` is still a placeholder on web. |
| 11 | Secondary button **Skip** → next buddy, `profilesViewed++` | `handleSkip` (`AddsScreen.tsx:54-71`) | ✅ | `countAdSkip()` + `router.replace`. |
| 12 | `replace` (not push) so Back skips the ad | `navigation.replace` (`AddsScreen.tsx:64`) | ✅ | `router.replace`. |
| 13 | "From list" variant: back arrow, **Read More** primary, **Next** secondary | `AdLayout.tsx:130-138, 208-224` | ⚠️ | Web always renders the back arrow; there is no separate from-list variant. |
| 14 | In-app `WebView` modal for the partner URL | `WebViewScreen.tsx` → `WebViewLayout` | ⚠️ | Web opens a new browser tab (`target="_blank" rel="noopener noreferrer"`). Correct for the platform. |
| 15 | Loading state | `Loader` (`AdLayout.tsx:125`) | ✅ | `AdSkeleton`. |
| 16 | "Resource unavailable" state | none | ✅ | Web-only addition (`AdScreen.tsx:185-196`). Web extra. |

**Missing on web**

- The primary CTA goes to the partner's site rather than the in-app Partners list, because `/partners`
  is still a placeholder. Swap back when it ships.
- No in-app browser — links leave the app in a new tab.

---

### BuddiesScreen.QrIdentificationBuddies — Buddy ID scan / search

- **Mobile:** `src/screens/profile/qrIdentification/QrIdentification.tsx`, driven by
  `params.screen` = `'SEARCHID'` or `'SCANQR'`, with the whole validation ladder in
  `src/hooks/useValidateRules.ts`.
- **Web:** `components/buddies/BuddyIdSheet.tsx` (search only) and
  `components/profile/BuddyIdScreen.tsx` (your own QR + a lookup field)

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 1 | `SEARCHID` mode: type a Buddy ID and look it up | `BuddyIdInput` (`QrIdentification.tsx:64-68`) | ✅ | `BuddyIdSheet.tsx`, formatted as `BI-0000-0000`, submit on Enter. |
| 2 | `SCANQR` mode: camera scanner | `BuddyIdQr` with `showQr={false}` (`QrIdentification.tsx:69-75`) | ❌ | Deliberately not built (`BuddyIdScreen.tsx:10-12`). |
| 3 | Default mode: show **your own** QR code | `BuddyIdQr` with `showQr={true}` (`QrIdentification.tsx:76-82`) | ✅ | `components/profile/BuddyIdScreen.tsx` — same universal-link payload. |
| 4 | Scanner accepts a deep link and extracts the trailing id | `handleReadScanner` (`QrIdentification.tsx:37-59`) | ✅ | `BuddyIdScreen.tsx:91-93` accepts a pasted link. Not in `BuddyIdSheet`. |
| 5 | Info toast `COPY_TOAST_INFO_BUDDY_ID` on first entry | `showInfo` (`QrIdentification.tsx:19-28`) | ❌ | |
| 6 | Validation: unknown id → warning toast `nonExistUser` / `invalidQR` | `useValidateRules.ts:139-166` | ✅ | Inline error (`buddyIdNotFound`). |
| 7 | Validation: snoozed account → alert toast `snoozeAccount` | `useValidateRules.ts:167-174` | ✅ | Inline error (`buddyIdSnoozed`). |
| 8 | Validation: it's you → info toast `myself` **and navigate to your own profile** | `useValidateRules.ts:175-201` | ⚠️ | Web shows an inline "that's you" error but does not navigate to `/profile`. |
| 9 | Validation: age-bracket mismatch → open the profile with the buttons hidden and an `ageRule` banner | `connectAgeRulesBuddySearching` (`useValidateRules.ts:202-217`) | ⚠️ | Web blocks with an inline error and never opens the profile. |
| 10 | Already buddies → info toast `alredyBuddies` + open the profile with `isBuddy: true` (Chat button) | `getValidateConections` (`useValidateRules.ts:97-129`) | ❌ | Web opens the profile; the connection map produces the right button, but the toast is gone. |
| 11 | Invite already pending → open the profile with buttons **hidden** and a `sentInvite` banner | `useValidateRules.ts:121-128` | ❌ | Web shows the normal action bar. |
| 12 | No relationship → open the profile with `showButtons: true, showMaybeLater: false` | `useValidateRules.ts:101-108` | ✅ | |
| 13 | Full-screen loader during validation | `Loader` (`QrIdentification.tsx:62`) | ✅ | Button loading state. |

**Missing on web**

- No QR scanning.
- The three post-lookup outcome messages (already buddies / invite already sent / age-rule) do not
  surface; two of them (age rule, pending invite) also change which buttons the profile shows on
  mobile, and that context is lost.
- Looking up your own id doesn't take you to your profile.

---

### BuddiesScreen.Chat — the conversation screen

- **Mobile:** `src/screens/buddies/chat/ChatScreen.tsx` → `src/components/layouts/Chat/ChatMessagesLayout.tsx`
  and its ~15 sibling components (header, kebab menu, message renderer, reactions, composer,
  attachment menu, media/PDF attachments, post attachments, typing).
- **Web:** `app/(app)/chat/[channelId]/page.tsx` → `components/chat/ActiveConversation.tsx`
  (+ `ChatHeader`, `MessageThread`, `MessageBubble`, `MessageComposer`, `ReactionPicker`,
  `ReactionPills`, `TypingIndicator`, `ReportModal`) and `lib/chat/useChannelMessages.ts`.

**Header**

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 1 | Back arrow, always visible | `ChatMessagesHeader.tsx:126-130` | ⚠️ | Web hides it on desktop (`lg:hidden`) because of the two-pane layout (`ChatHeader.tsx:36-42`). |
| 2 | Context-aware back destination — `ReplyHost` → ActivitiesFeed, `ListNotifications` → Updates, else goBack | `onOut()` (`ChatMessagesHeader.tsx:106-117`) | ❌ | Web always returns to `/chat`. |
| 3 | Avatar + name, 1:1 name vs group `channel.data.name` | `getNameChannelUtil` (`utils/chats.ts:16-22`) | ✅ | `channelDisplay()` (`lib/chat/helpers.ts:36-59`). |
| 4 | **Tapping the header opens the contact's profile** | `redirectToProfile` (`ChatMessagesHeader.tsx:90-104, 132`) | ❌ | Web's header avatar/name are inert, even though `/buddies/[userId]` exists. |
| 5 | Role badges (Support / Ambassador / Host) | `ChatMessagesHeader.tsx:153-174` | ✅ | `RoleBadges`. |
| 6 | Kebab "⋮" overflow button | `ChatMessagesHeader.tsx:181-185` | ✅ | `ChatHeader.tsx:89-96`. |
| 7 | Kebab hidden for Support and Host contacts | `ChatMessagesHeader.tsx:180` | ⚠️ | Same rule (`ChatHeader.tsx:31-32`) but `isHost` comes from a different field — see the chat-list table, row 15. |
| 8 | **Kebab disabled when the channel is frozen** | `disabled={channel.data?.frozen}` (`ChatMessagesHeader.tsx:183`) | ❌ | Web never reads `frozen` in the header; the menu stays live. |
| 9 | Typing indicator | rendered as a bubble in the thread, not the header | ⚠️ | Web puts "typing…" in the header (`ChatHeader.tsx:51-56`). |

**Kebab menu items**

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 10 | Item 1 — **"Remove from my buddies"** / "You won't be able to chat with them." | `ChatMessagesMenuOptionsLayout.tsx:52-60` | ✅ | Same title and sub-line (`ChatHeader.tsx:128-142`). |
| 11 | Divider between the two items | `ChatMessagesMenuOptionsLayout.tsx:61` | ✅ | |
| 12 | Item 2 — **"Block & report"** / "I'm uncomfortable with this user." | `ChatMessagesMenuOptionsLayout.tsx:62-70` | ✅ | `ChatHeader.tsx:144-161`; opens a modal instead of the `Report` route. |
| 13 | Presented as a bottom sheet | `useDialog` (`ChatMessagesMenuOptionsLayout.tsx:27-40`) | ⚠️ | Anchored dropdown on web. |
| 14 | Remove confirmation: header "Remove from my buddies", body "Are you sure you want to remove this person from your buddies? You won't be able to chat with them.", CTA **"YES, REMOVE"** | `ChatMessagesMenuRemoveChannel.tsx:71, 92-101` | ⚠️ | Web confirms inline in the dropdown with shorter copy ("Remove this person from your buddies?" / "Remove") plus an explicit **Cancel** mobile lacks (`ChatHeader.tsx:100-125`). |
| 15 | Remove side-effects: `channel.delete()` → `RemoveConnectionUser` → write `idConnect` / `isRemove` to AsyncStorage so other screens react → goBack | `ChatMessagesMenuRemoveChannel.tsx:30-56` | ⚠️ | Web deletes then removes the connection then routes to `/chat` (`ActiveConversation.tsx:51-61`); **no cross-screen signal** equivalent to the AsyncStorage flags. |
| 16 | Error toast "An error has occurred, please try again later" on a failed remove | `ChatMessagesMenuRemoveChannel.tsx:34-39` | ❌ | Web swallows the error silently (`ActiveConversation.tsx:53-58`). |
| 17 | Mute / block-without-report / archive / pin / mark-unread / clear-history items | — none on mobile | — | Neither app has them; not a gap. |

**Message list & rendering**

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 18 | Inverted virtualised message list, 30 per page | Stream `<MessageList>` (`ChatMessagesLayout.tsx:113-116`) | ✅ | Hand-rolled `MessageThread.tsx` + `useChannelMessages.ts:270-285` (`PAGE = 30`, `id_lt` cursor). |
| 19 | Scroll-position preserved when older messages prepend | Stream internal | ✅ | `MessageThread.tsx:48-58`. |
| 20 | Date separator between days, format `MM/DD/YYYY` | `ChatInlineDateSeparator` (`ChatMessagesLayout.tsx:27-37`) | ⚠️ | Web shows `Today` / `Yesterday` / `Mar 4` (`helpers.ts:109-118`); mobile has no Today/Yesterday wording. |
| 21 | Sticky date header explicitly disabled | `DateHeader={ChatDateEmpty}` (`ChatMessagesLayout.tsx:24`) | ✅ | Web has none either. |
| 22 | Per-message avatars explicitly disabled | `MessageAvatar={ChatMessagesAvatar}` (`ChatMessagesLayout.tsx:25`) | ✅ | |
| 23 | Own vs other bubble alignment and colours | `ChatMessageRenderer.tsx:175` | ✅ | `MessageBubble.tsx:117, 166-171`. |
| 24 | Per-message clock timestamp | — none on mobile | ✅ | Web-only (`MessageBubble.tsx:199`). Web extra. |
| 25 | Auto-linkify `https?://` and bare `www.` URLs | `linkifyText()` (`utils/urls.ts:71-81`) | ✅ | `LinkifiedText` (`MessageBubble.tsx:395-433`); web also strips trailing punctuation, which mobile doesn't. |
| 26 | **Render stored HTML message bodies** via `react-native-render-html` | `ChatMessageRenderer.tsx:178-183` | ❌ | Web only ever renders `message.text`; a message authored with markup shows as raw text. |
| 27 | "(Edited)" marker | `ChatMessageRenderer.tsx:166, 192-196` — inside the bubble | ⚠️ | Web renders `· edited` in the meta row below the bubble. |
| 28 | Link preview / unfurl cards | — none on mobile | — | Neither app has them; not a gap. |
| 29 | Loading-older spinner | deliberately renders nothing (`ChatMessagesLayout.tsx:23, 108`) | ✅ | Web shows a spinner. Web extra. |
| 30 | Deleted messages hidden | Stream internal | ✅ | `useChannelMessages.ts:317` + an optimistic `deletedIds` set so the bubble vanishes instantly. Web extra. |

**Message action menu**

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 31 | **Long-press a bubble** (400 ms) to open "Message options" | `ChatMessageRenderer.tsx:101-124, 172-174` | ❌ | Web reveals its controls **on hover only** (`MessageBubble.tsx:59-113`), so touch-screen web users have no reliable way to reach the menu. |
| 32 | Action — reaction picker row (always present) | `ChatMessageRenderer.tsx:104-110` | ✅ | `ReactionPicker`. |
| 33 | Action — **"Edit message"** / "Update the content of this message." | `ChatMessageActions.tsx:21-33` | ⚠️ | Web has "Edit" with **no description line** (`MessageBubble.tsx:366-375`). |
| 34 | Action — **"Delete message"** / "This message will be permanently removed." | `ChatMessageActions.tsx:35-46` | ⚠️ | Web has "Delete" with no description. |
| 35 | Action — Copy | — none on mobile | ✅ | Web-only (`MessageBubble.tsx:359-365`). Web extra. |
| 36 | Action — Reply / quote / thread / pin / forward / flag | — none on mobile | — | Neither app has them; not gaps. Mobile uses `<MessageList>` without `Thread`. |
| 37 | Edit/Delete shown only on own messages **and not on custom-attachment messages** | `hasCustomAttachments` (`ChatMessageRenderer.tsx:92-96`) | ⚠️ | Web guards on `mine && status === "sent"` (`MessageBubble.tsx:56`); it has no custom-attachment exclusion because it never renders those types. |
| 38 | Delete is a **hard delete** (`deleteMessage(id, true)`) | `ChatMessageRenderer.tsx:116` | ⚠️ | Web soft-deletes (`useChannelMessages.ts:254`) while its confirmation dialog promises "permanently removed". |
| 39 | Delete confirmation dialog | — none; mobile deletes on tap | ✅ | Web adds one (`MessageBubble.tsx:234-287`). Web extra. |
| 40 | Delete failure toast | — silent `catch {}` | ✅ | Web toasts. Web extra. |

**Reactions**

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 41 | Exactly 6 reactions: `like 👍` `love ❤️` `haha 😂` `wow 😮` `sad 😢` `pray 🙏` | `utils/chatReactions.ts:7-14` | ✅ | Byte-identical set in `lib/chat/reactions.ts:6-13`. |
| 42 | Unknown reaction type falls back to the raw type string | `chatReactions.ts:20-22` | ✅ | |
| 43 | Picker highlights the reaction you already gave (yellow filled circle) | `ChatReactionPicker.tsx:22, 48-50` | ❌ | Web's `ReactionPicker` takes no `currentType`, so your existing reaction isn't indicated. |
| 44 | Tapping the same reaction removes it | `toggleReaction` (`ChatMessageRenderer.tsx:70-88`) | ✅ | `useChannelMessages.ts:287-307`. |
| 45 | Combined pill: distinct emoji sorted by count desc + total | `ChatReactionPills.tsx:24-61` | ✅ | `ReactionPills.tsx:18-38`. |
| 46 | Pill outlined black when you've reacted | `ChatReactionPills.tsx:46, 78-80` | ✅ | |
| 47 | Pill aligned to the bubble's side | `ChatReactionPills.tsx:45` | ⚠️ | Web applies `right-2` / `left-2` to a non-positioned element (`MessageBubble.tsx:178`), so the classes are inert and the pill sits in flow. |
| 48 | Tapping the pill removes all your reactions, else opens the full menu | `handlePillPress` (`ChatMessageRenderer.tsx:129-139`) | ⚠️ | Web opens only the reaction picker in the "else" branch. |

**Composer**

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 49 | Multiline autogrowing input, placeholder "Message here..." | `ChatMessagesInput.tsx:356-369` | ⚠️ | Web's placeholder is "Type a message…" (`MessageComposer.tsx:142`). |
| 50 | Send button enabled/disabled on empty text | `ChatMessagesInput.tsx:375-387` | ✅ | |
| 51 | `channel.keystroke()` typing events | `ChatMessagesInput.tsx:96` | ✅ | |
| 52 | `stopTyping()` on send | — not called on mobile | ✅ | Web-only. Web extra. |
| 53 | Enter to send / Shift+Enter newline | n/a on mobile | ✅ | Web-only (`MessageComposer.tsx:135-140`). Web extra. |
| 54 | **Pre-filled text for `type === 'ReplyHost'`** — "Hi {name}, related to your post on \"{group}\", take a look at the responses." | `ChatMessagesInput.tsx:72-74` | ❌ | The web chat route accepts only `channelId`. |
| 55 | **Pre-filled text for `type === 'AskToHost'`** — "Could you provide me with the access code to join the {group} private group?" | `ChatMessagesInput.tsx:74-76` | ❌ | |
| 56 | Frozen channel → non-editable input | `ChatMessagesInput.tsx:364-373` | ✅ | Web replaces the composer with "This conversation is closed." (`MessageComposer.tsx:69-75`) — clearer than mobile. Web extra. |
| 57 | Attach button hidden while editing / when frozen | `ChatMessagesInput.tsx:301` | ✅ | |
| 58 | **Attach button shows a spinner while uploading and is disabled** | `ChatMessagesInput.tsx:338-345` | ❌ | Web has no upload progress or busy state at all (`MessageComposer.tsx:115-122`). |
| 59 | Editing banner "Editing message" with an X to cancel, placeholder "Edit your message..." | `ChatMessagesInput.tsx:305-326, 356` | ✅ | `MessageComposer.tsx:85-101, 142`. |
| 60 | Auto-focus the input when entering edit mode | `ChatMessagesInput.tsx:87-89` | ✅ | |
| 61 | Commit edit via `client.updateMessage` | `ChatMessagesInput.tsx:111-124` | ✅ | |
| 62 | **Analytics on send** — `chatWithFirstBuddy` (with ms since account creation) and `timeToSendMessage` | `ChatMessagesInput.tsx:132-141` | ❌ | No analytics events on the web send path. |
| 63 | `ReplyHost` send attaches `{type:'ReplyHost', post}` and fires `LambdaPayloadType.REPLYMESSAGE` to `USERS_LAMBDA` | `ChatMessagesInput.tsx:155-166, 186-203` | ❌ | |
| 64 | `AskToHost` send attaches `{type:'AskToHost', group}` | `ChatMessagesInput.tsx:167-176` | ❌ | |
| 65 | Optimistic local bubble while sending | — none on mobile | ✅ | Web-only (`useChannelMessages.ts:170-201`). Web extra. |
| 66 | Send failure + "Not sent — tap to retry" | — none on mobile (unhandled throw) | ✅ | Web-only (`MessageBubble.tsx:204-212`). Web extra. |

**Attachments — picking**

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 67 | "Add to message" attachment sheet with four labelled options and hints | `ChatMessagesInput.tsx:296`, `ChatAttachmentMenu.tsx` | ❌ | Web's paperclip opens the OS file dialog directly; no menu, labels, hints, icons or chevrons. |
| 68 | Option **Photo** / "Choose from your library" — compressed to q=0.8, max 1280×1280, forced JPEG | `ChatAttachmentMenu.tsx:42-50`, `useChatMediaPicker.ts:92-104` | ⚠️ | Images can be chosen (`accept="image/*"`) but are uploaded uncompressed and unresized. |
| 69 | Option **Video** / "Share a video from your library" — 1920×1080 compression preset | `ChatAttachmentMenu.tsx:51-59`, `useChatMediaPicker.ts:107-119` | ❌ | Web's `accept` list excludes video entirely (`MessageComposer.tsx:111`). **You cannot send a video from web.** |
| 70 | Option **Camera** / "Take a new photo" | `ChatAttachmentMenu.tsx:60-68`, `useChatMediaPicker.ts:161-173` | ❌ | No camera capture, not even `capture="environment"`. |
| 71 | Option **Document** / "Attach a PDF (up to 20 MB)" — PDF only | `ChatAttachmentMenu.tsx:69-81`, `useChatMediaPicker.ts:122-158` | ⚠️ | Web accepts `application/pdf,.doc,.docx,.txt` — **wider** than mobile — with **no size limit**. |
| 72 | 20 MB limit with the toast "The file is too large. Maximum size is 20 MB." | `useChatMediaPicker.ts:20, 127-130` | ❌ | |
| 73 | File-read and picker-open error toasts | `useChatMediaPicker.ts:141, 154` | ❌ | |
| 74 | Multi-file selection | — single asset per pick on mobile | ✅ | Web-only (`MessageComposer.tsx:110`). Web extra. |
| 75 | Composer text is sent as the attachment's caption | `ChatMessagesInput.tsx:216-218` | ✅ | `MessageComposer.tsx:65`. |
| 76 | Upload sets `original_width` / `original_height` (images), `duration` (video), `file_size` + `mime_type` + `title` (files) | `utils/chatMedia.ts:10-44` | ❌ | Web sets none of these (`useChannelMessages.ts:223-232`), which is why images shift layout on load and file sizes can't be shown. |

**Attachments — rendering**

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 77 | Image thumbnail sized to preserve aspect ratio, capped 240×280, radius 14 | `ChatMediaAttachment.tsx:38-100` | ⚠️ | Web uses `max-h-64 object-cover` with no dimension hints (`MessageBubble.tsx:137-141`). |
| 78 | **Fullscreen image lightbox** — 95% black backdrop, contain-fit, tap-to-dismiss, dedicated close button | `ChatMediaAttachment.tsx:70-91, 237-251` | ❌ | Web wraps the image in `<a target="_blank">`, dumping the raw file into a new browser tab. |
| 79 | **Inline video player** — paused poster frame + 52 px play overlay | `ChatMediaAttachment.tsx:102-164` | ❌ | Web maps any non-image asset to `type: "file"` (`useChannelMessages.ts:78-80`), so a video renders as a generic download row. |
| 80 | Fullscreen video player with native controls | `ChatMediaAttachment.tsx:137-159` | ❌ | |
| 81 | PDF card: 260 px, `FilePdf` icon on a bone chip, 2-line filename, meta line | `PdfAttachment.tsx` | ⚠️ | Web renders an icon + truncated name + a download glyph (`MessageBubble.tsx:143-157`). |
| 82 | PDF meta line states: `PDF` → `PDF · 1.2 MB` → `Downloading… 47%` → `PDF · 1.2 MB · Tap to open` | `PdfAttachment.tsx:283-292` | ❌ | Web shows the name only. |
| 83 | **Download-then-open-in-app** with a live progress bar; never hands the file to a browser | `PdfAttachment.tsx:199-233` | ❌ | Web's link opens the browser. |
| 84 | **In-app fullscreen PDF viewer** (WKWebView / `react-native-pdf`) with a "Loading PDF…" overlay | `PdfAttachment.tsx:65-144` | ❌ | |
| 85 | Separate **save-to-device** action with "Saved to Downloads" / "Already saved to Downloads" toasts and a persisted saved state | `PdfAttachment.tsx:235-281, 327-342` | ❌ | The download glyph on web is decorative — it sits inside the same link. |
| 86 | File size rendered via `formatFileSize()` | `PdfAttachment.tsx:33, 161` | ❌ | Never shown on web (see row 76). |

**Post / group attachments (mobile-only family)**

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 87 | `ReplyHost` post card — author avatar/name/age, post date, Host badge, ambassador flag, post body clamped to 4 lines | `ChatPostAttachment.tsx:93-155` | ❌ | `useChannelMessages.ts:71-83` explicitly ignores app-specific attachment types; the card renders as nothing. |
| 88 | **"GO TO COMMENT"** button → PostDetail | `ChatPostAttachment.tsx:143-153`, `ChatMessagesLayout.tsx:52-62` | ❌ | |
| 89 | "COMMENT NOT FOUND" state when the activity lookup is empty | `ChatPostAttachment.tsx:135-141` | ❌ | |
| 90 | `AskToHost` group card — group name, picture, description, lock icon when the group is not secure | `ChatMessageRenderer.tsx:208-237` | ❌ | |
| 91 | **"GO TO GROUP"** button → FeedDetail with membership-aware params | `ChatMessageRenderer.tsx:227-235`, `ChatMessagesLayout.tsx:65-78` | ❌ | |

**Typing, receipts, states, routing**

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 92 | Typing bubble in the thread (animated dots, positioned above the composer) | `ChatMessagesTyping.tsx:15-39` | ⚠️ | Web puts the dots in the header instead. |
| 93 | Typist's name | not shown on mobile | ⚠️ | Web collects names (`useChannelMessages.ts:148`) but never displays them. |
| 94 | Auto `markRead()` on open | Stream internal | ✅ | `useChannelMessages.ts:127, 139`. |
| 95 | Per-message "Read" receipt | — none on mobile | ✅ | Web-only, on the last own sent message (`MessageBubble.tsx:213-215`). Web extra. |
| 96 | Beginning-of-conversation disclaimer inside a lightbulb `MsgAdvice` card — "This is the beginning of your conversation. For everyone's well-being, remember to leave medical advice to the experts." | `ChatMessagesEmpty.tsx:8-12` | ⚠️ | Web shows "Say hello 👋" + the medical-advice sentence with **no lightbulb card** (`ActiveConversation.tsx:116-120`). |
| 97 | `ReplyHost` variant of that copy drops the medical-advice line | `ChatMessagesEmpty.tsx:9` | ❌ | |
| 98 | Conversation skeleton **including a skeleton header** (back arrow, avatar, name, kebab) plus a date pill and 5 bubbles | `skeleton-chat-messages.tsx:16-145` | ⚠️ | Web's `ThreadSkeleton` is bubbles only; the real header renders immediately with a `"…"` name (`ActiveConversation.tsx:192-205`). |
| 99 | Load error: "Unable to load chat" / "Please check your connection and try again" / **Retry** button, with SWR `errorRetryCount: 3` | `ChatScreen.tsx:32-33, 44-54` | ⚠️ | Web shows "Couldn't load this conversation" with **no sub-line and no Retry** for this branch (`ActiveConversation.tsx:112-113`); Retry exists only for the connection-level error. |
| 100 | Channel fetch with 2 retries and a `watch()` fallback when `queryChannels` is empty | `useStreamChat.ts:17-54` | ⚠️ | Web goes straight to `.watch()` with no retry loop (`useChannelMessages.ts:118-133`). |
| 101 | Open a conversation by `channelId` | `ChatScreen.tsx:18`, `BuddiesScreens.tsx:85-86` | ✅ | `/chat/[channelId]`. |
| 102 | Push-notification deep link into a channel (handles both the new `data.channelId` and the legacy JSON `data.channel` shapes, plus cold start) | `push-notification.provider.tsx:227-246, 371-381` | ⚠️ | Web push exists (`docs/PUSH.md`) but the chat-specific legacy-payload handling and cold-start path are not reproduced here. |
| 103 | Route params `type`, `namePrivatly`, `dataGroup`, `post`, `idHost` | `ChatMessagesInput.tsx:57`, `ChatScreen.tsx:18-19` | ❌ | The web route takes `channelId` only. |

**Missing on web**

- **You cannot send a video, and you cannot play one.** Video is excluded from the file picker and any
  received video renders as a plain file-download row.
- **No camera capture.**
- **No image lightbox** — tapping a photo dumps the raw file into a browser tab.
- **No PDF experience**: no in-app viewer, no download progress, no separate save-to-device action, no
  file size, no 20 MB limit, no error toasts. Conversely web *accepts* doc/docx/txt, which mobile
  doesn't.
- **The entire `ReplyHost` / `AskToHost` post-attachment family is absent** — the post and group cards,
  their "GO TO COMMENT" / "GO TO GROUP" buttons, the "COMMENT NOT FOUND" state, both pre-filled
  composer messages, and the `REPLYMESSAGE` notification lambda.
- **Tapping the conversation header does not open the contact's profile.**
- **The message action menu is hover-only** — on a touch-screen browser there is no way to edit,
  delete, copy or react from the bubble.
- **The kebab menu is not disabled on a frozen channel.**
- No upload spinner or progress on the attach button.
- No reaction-picker highlight for the reaction you already gave.
- No analytics events on send (`chatWithFirstBuddy`, `timeToSendMessage`).
- No error toast when removing a buddy fails; no Retry on a failed conversation load.
- Stored HTML message bodies are not rendered.
- Web soft-deletes messages while telling the user they are permanently removed; mobile hard-deletes.
- No context-aware back navigation, and no `type` / `dataGroup` / `post` route params at all.

---

### BuddiesScreen.Report — report & block a conversation

- **Mobile:** `src/screens/buddies/report/Report.tsx` + `src/components/layouts/Templates/ReportTemplate.tsx`
- **Web:** `components/chat/ReportModal.tsx`, wired from `components/chat/ChatHeader.tsx` /
  `ActiveConversation.tsx`

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 1 | Title "Can you say more?" + anonymity note | `ReportTemplate.tsx:66-76` | ✅ | Equivalent copy. |
| 2 | Reason: `Inappropriate comments` | `ReportTemplate.tsx:34` | ✅ | Same canonical `id` (`ReportModal.tsx:13`). |
| 3 | Reason: `Spam` | `ReportTemplate.tsx:35` | ✅ | |
| 4 | Reason: `Made me feel uncomfortable` | `ReportTemplate.tsx:36-39` | ✅ | |
| 5 | Reason: `False profile` | `ReportTemplate.tsx:40` | ✅ | |
| 6 | Reason: `Other` | `ReportTemplate.tsx:41` | ✅ | |
| 7 | "Other" reveals a textarea, min 10 / max 1000 chars, submit disabled below the minimum | `ReportTemplate.tsx:44-52, 84-95` | ✅ | `OTHER_MIN = 10`, `OTHER_MAX = 1000` (`ReportModal.tsx:20-54`). |
| 8 | Submit **deletes the Stream channel first**, then writes the report | `removeChannel` (`Report.tsx:50-60`) | ⚠️ | Web deliberately inverts the order — `reportConnection()` first, then a best-effort `channel.delete()` — so the block survives a failed delete (`ActiveConversation.tsx:63-86`). Documented and defensible. |
| 8b | Report placeholder text "Type your answer here" | `ReportTemplate.tsx:88` | ⚠️ | Web reuses "Can you say more?" as the textarea placeholder. |
| 8c | Submitting/in-flight state on the submit button | — none on mobile | ✅ | Web disables every control while submitting. Web extra. |
| 9 | Report writes `ReportConnectionUser` with `blocked: true`, `blockedUser`, `blockingReason` | `Report.tsx:62-82` | ✅ | `lib/chat/connections.ts`. |
| 10 | Success toast `REPORT_THANK_YOU` and pop the screen | `Report.tsx:76-77` | ✅ | |
| 11 | Error toast on failure | `Report.tsx:54-58, 80` | ✅ | |
| 12 | X close button | `ReportTemplate.tsx:56-61` | ✅ | Plus Escape-to-close and backdrop click. Web extra. |
| 13 | Full-screen route with a vertical-modal transition | `BuddiesScreens.tsx:91-98` | ⚠️ | A modal dialog on web, not a route. |

**Missing on web**

- Nothing structural. All five reasons and the "Other" 10–1000 char rule are reproduced exactly.

---

## RequestBuddies tab

### TabsNavigator.RequestBuddies (HomeRequestBuddies)

- **Mobile:** `src/screens/requestBuddies/HomeRequestBuddies.tsx` — its own bottom tab; the list of
  incoming buddy requests.
- **Web:** `components/buddies/RequestsSection.tsx` (inside `/buddies`) and
  `components/notifications/RequestsPanel.tsx` (inside `/notifications`)

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
| --- | --- | --- | --- | --- |
| 1 | Its own bottom tab with a Handshake icon | `TabsConfiguration.tsx:63-65` | ⚠️ | Web has no separate tab — requests are a section at the top of `/buddies` (which itself uses the Handshake icon, `lib/navigation/appNav.tsx:54`). |
| 2 | Tab dot badge when there are unseen requests | `TabItem.tsx:83-88` (`hasVisitedRequestBuddiesTab`) | ⚠️ | Web shows a **numeric** badge on `/buddies` (`usePendingRequestCount`) rather than a seen/unseen dot. Arguably better; the "seen" semantics are gone. |
| 3 | "Buddies request" heading + yellow circular count badge | `HomeRequestBuddies.tsx:117-140` | ✅ | `RequestsSection.tsx:180-201`, same yellow pill. |
| 4 | List of requests sorted newest-first | `HomeRequestBuddies.tsx:143-149` | ✅ | `fetchPendingRequests` sorts by `createdAt` desc. |
| 5 | Rows whose `Remitent` is null (deleted account) are filtered out | `HomeRequestBuddies.tsx:38` | ✅ | `connections.ts:158`. |
| 6 | Card: avatar + goal icon | `ConnectionRequest.tsx:206-213` | ✅ | |
| 7 | Card: `First name, age` | `ConnectionRequest.tsx:209-212` | ✅ | |
| 8 | Card: role badge | `showRoleBadge` (`ConnectionRequest.tsx:220`) | ✅ | |
| 9 | Card: ambassador indicator | `isAmbassador` (`ConnectionRequest.tsx:217`) | ✅ | Pill, not avatar overlay. |
| 10 | Card: hardcoded `badgeText="In remission"` | `ConnectionRequest.tsx:214` | ❌ | Not rendered on web. (It is hardcoded on mobile regardless of the sender's status, so this is arguably a mobile bug — flagging it rather than porting it.) |
| 11 | Card subtitle: **shared coincidences** ("Interests, Medical center, Treatment, Diagnosis") computed against the viewer | `getLabelCoincidencies` (`utils/coincidences.ts`; `ConnectionRequest.tsx:60-67, 215`) | ❌ | Web shows the sender's **bio** instead (`RequestsSection.tsx:88-92`). Different information entirely — `matchSummary()` already exists in `lib/buddies/display.ts` and is not used here. |
| 12 | Card subtitle shows `...` while the coincidences resolve | `ConnectionRequest.tsx:215` | ❌ | |
| 13 | **Connect** button → `AcceptConnection` | `ConnectionRequest.tsx:98-104` | ✅ | `useRequests.ts:157-186`. |
| 14 | Accept then creates the Stream channel keyed by the connection id, named `"Them Me"` | `createChannel` (`ConnectionRequest.tsx:137-163`) | ✅ | `useRequests.ts:135-155`, same ordering and same naming rule. |
| 15 | Accept skips channel creation when one already exists for the pair | `ConnectionRequest.tsx:141-149` | ✅ | `useRequests.ts:140-145`. |
| 16 | Accept toast `ACCEPT_REQUEST_NOTIFICATION(firstName)` | `ConnectionRequest.tsx:83-86` | ✅ | `connectedToast`. |
| 17 | **Maybe later** button → `RemoveConnectionUser` | `ConnectionRequest.tsx:238-252` | ✅ | `useRequests.ts:188-203`. |
| 18 | Maybe-later toast `MAYBE_LATER_REQUEST_NOTIFICATION(firstName)` | `ConnectionRequest.tsx:91-94` | ✅ | `dismissedToast`. |
| 19 | Error toast `COMMON_PROCESS_INVITATION_ERROR_COPY` on either action | `ConnectionRequest.tsx:128, 133` | ✅ | |
| 20 | Row removed optimistically from the list after an action | `removeConnectionById` (`usePendingConnections.ts:17-27`) | ✅ | `setRequests(prev => prev.filter(...))`. |
| 21 | Per-card busy/loading overlay | `Loader` (`ConnectionRequest.tsx:254`) | ✅ | Buttons disabled via `busyIds`. |
| 22 | Tapping the card opens the sender's profile | `handleAvatarPress` (`ConnectionRequest.tsx:172-200`) | ✅ | Name links to `/buddies/[userId]`; the whole card is not a target. |
| 23 | Opening from a request seeds `usersList` with **every** pending sender, so **Next** pages through the requests | `allConnectionUserIds` (`ConnectionRequest.tsx:176-184`; `HomeRequestBuddies.tsx:166`) | ❌ | Web's `discoveryOrder` only ever holds the discovery list, so Next/Prev is unavailable from a request. |
| 24 | Opening from a request passes `connectionId` + `connectionName` so the profile can offer **Maybe later** | `ConnectionRequest.tsx:194-196` | ❌ | Follows from the missing Maybe-later button. |
| 25 | Accepting/dismissing resets `profilesViewed` to 0 (ad pacing) | `ConnectionRequest.tsx:180-183` | ❌ | Deliberately not ported — documented in `lib/buddies/adRotation.ts:22-27`. |
| 26 | Live subscription `GetPendingConnectionsSuscription` refetches when a request arrives | `HomeRequestBuddies.tsx:97-112` | ✅ | `ON_CREATE_CONNECTION` in `useRequests.ts:31-41`. |
| 27 | Refetch on focus | `useFocusEffect` (`HomeRequestBuddies.tsx:43-48`) | ⚠️ | Web loads once per mount plus the subscription; no focus refetch. |
| 28 | Loading spinner at the top of the list | `HomeRequestBuddies.tsx:87-91` | ✅ | Two skeleton cards. |
| 29 | **Empty state**: illustration, "You don't have any buddy request yet.", and a **FIND NEW BUDDIES** button that jumps to Recommended | `EmptyBuddiesRequest.tsx` | ❌ | Web hides the section entirely when the list is empty (`RequestsSection.tsx:157`). Reasonable given discovery is directly below, but the CTA and copy are gone. |
| 30 | AsyncStorage bookkeeping (`idConnect`, `isRemove`) used by the tab-bar dot | `handleClear` (`HomeRequestBuddies.tsx:68-77`) | ❌ | No seen/unseen tracking on web. |
| 31 | Header is the hamburger/drawer header | `RequestBuddiesScreens.tsx:29` | ✅ | Sidebar / `AccountSheet`. |
| 32 | Collapse past N requests behind a "Show all" toggle | — | ✅ | Web-only (`COLLAPSED_LIMIT = 6`, `RequestsSection.tsx:174-200`). Web extra. |
| 33 | Error state for a failed request load | none | ✅ | Web-only addition. Web extra. |

**Missing on web**

- The request card's subtitle is the sender's **bio**, not the shared-attribute summary mobile shows.
  This is the single most visible content divergence in this area.
- The hardcoded "In remission" badge is absent (probably correct — flagging it as a known divergence).
- No empty state: no illustration, no "You don't have any buddy request yet." copy, no
  **FIND NEW BUDDIES** CTA.
- Opening a profile from a request gives you no way to page **Next** through the other requests, and
  no **Maybe later** on that profile.
- No seen/unseen state for requests — the badge is a live count, not a "new since you last looked" dot.
- No refetch when returning to the tab (the live subscription mostly covers this).

---

## Screens registered in the Buddies stack but owned by other areas

These are reachable from the Buddies/RequestBuddies stacks but belong to other feature areas; listed
here only so the routing coverage is complete.

| Mobile screen | Registered at | Web equivalent | Status |
| --- | --- | --- | --- |
| `BuddiesScreen.FeedDetail` → `screens/feeds/group-details` | `BuddiesScreens.tsx:38-48` | `/groups/[groupId]` | ✅ (see the Groups audit) |
| `BuddiesScreen.PostDetail` → `screens/feeds/PostDetails` | `BuddiesScreens.tsx:172-180` | Group feed thread view | ✅ (see the Groups audit) |
| `BuddiesScreen.ActivitiesFeed` → `screens/feeds/activities-feed` | `BuddiesScreens.tsx:190-198` | — | see the Groups audit |
| `BuddiesScreen.ActiveUsersListGroups` → `screens/groups/user-active-list-groups` | `BuddiesScreens.tsx:181-189` | `/groups/[groupId]/members` | see the Groups audit |
| `BuddiesScreen.HomeProfile` → `screens/profile/homeProfile` | `BuddiesScreens.tsx:157-160` | `/profile` | see the Profile audit |
| `BuddiesScreen.SuccessPhoneVerification` | `BuddiesScreens.tsx:161-167` | — | ❌ no phone verification on web |
| `BuddiesScreen.PartnerNavigator` → `PartnerFromBuddiesNavigator` | `BuddiesScreens.tsx:168-171` | `/partners` (placeholder) | ⚠️ |
| `BuddiesScreen.UserInfoProfileInvite` | `BuddiesScreens.tsx:150-156` | `/buddies/[userId]` | ✅ same component, different entry |

---

## Cross-screen gaps

Things absent from the whole Buddies area on web, not just one screen:

1. **QR camera scanning.** `BuddyIdQr` / `BuddyIdScanner` and the `SCANQR` mode of
   `QrIdentificationBuddies` have no web counterpart, and neither does the `useValidateRules` ladder
   that runs after a successful scan (already-buddies toast, pending-invite banner, age-rule banner,
   navigate-to-own-profile). Displaying your own QR *is* implemented (`components/profile/BuddyIdScreen.tsx`).

2. **`ModalAmbassador`.** Reached from the ambassador badge on *any* avatar in the mobile app —
   discovery rows, request cards, and profiles. Contains the ambassador explainer, a "BECOME AN
   AMBASSADOR" link to an external Google Form, a "learn more" action, and a path that opens a support
   conversation via `CREATE_AMBASSADOR_MESSAGE`. Web renders the badge as a non-interactive pill
   everywhere.

3. **`ModalPendingConnection`** and its two-step cancel confirmation. Web replaces the whole flow with
   a single "Withdraw invite" button and no confirmation.

4. **`FeedbackCard`** — the inline, persistent banner mobile puts at the top of a profile to explain
   why the action bar looks the way it does ("You already sent an invite", "age rule", "you're already
   buddies"). Web relies entirely on transient toasts.

5. **Full-screen photo gallery** (`GalleryScreen`) and the tap target that opens it. Every mobile
   surface that shows a PHOTOS block routes into it; web shows a dead grid.

6. **Shared-coincidence labels on request cards.** `utils/coincidences.ts` powers the subtitle on
   `ConnectionRequest`; the web equivalent (`matchSummary` in `lib/buddies/display.ts`) is used for
   discovery cards but **not** for request cards, which show `bio` instead.

7. **`EmptyBuddiesRequest`** — the illustrated empty state with the "FIND NEW BUDDIES" CTA. Web hides
   the section instead.

8. **Blocked-user guard on profile open.** `GET_BLOQUED_BY_REMITENT_AND_RECIPIENT` runs on every
   mobile profile open and hides the action bar plus toasts when either side has blocked the other.
   Web's `blockedUserIds` is used to filter *discovery*, but never checked on `/buddies/[userId]`.

9. **Phone-verification prompt** (`ModalVerifyYourPhone`) and the `SuccessPhoneVerification` screen.
   Both are registered in the Buddies stack on mobile; neither exists on web.

10. **Support-channel bootstrap** (`connectChannelSupport` + `CREATE_SUPPORT_MESSAGE`). Mobile creates
    the user↔support conversation on first entry to the Buddies tab when `pendingSupportChannel` is
    flagged. Web never creates it.

11. **In-app WebView.** Every external link in this area opens a new browser tab on web — including
    partner-resource links, chat image attachments and chat PDFs. Correct for the platform for
    partner links; a regression for chat media, which mobile keeps inside the app.

12. **Focus-based revalidation.** Mobile re-runs discovery, the connection map, and the request list on
    `useFocusEffect`. Web loads on mount and offers a manual **Refresh**; live subscriptions cover
    incoming requests but not accepted/withdrawn ones.

13. **Rich chat media.** Video send + playback, camera capture, the image lightbox, and the entire PDF
    download/view/save stack (`ChatMediaAttachment.tsx`, `PdfAttachment.tsx`, `ChatAttachmentMenu.tsx`,
    `useChatMediaPicker.ts`) have no web counterpart. Web also never sets `original_width` /
    `original_height` / `file_size` / `duration` on upload, which is why sizes can't be displayed and
    images shift layout as they load.

14. **App-specific chat attachments** (`ChatPostAttachment.tsx`, the `AskToHost` branch of
    `ChatMessageRenderer.tsx`) and the route params that feed them (`type`, `namePrivatly`,
    `dataGroup`, `post`, `idHost`). `lib/chat/useChannelMessages.ts:71-83` explicitly drops these
    attachment types.

15. **Touch reachability of the message menu.** Mobile long-presses a bubble; web reveals its controls
    on `group-hover` only (`MessageBubble.tsx:59-113`). On a touch-screen browser, edit / delete / copy
    / react are effectively unreachable.

16. **Frozen-channel enforcement.** Mobile blocks the row tap (`ChatListMessagesPreview.tsx:170`) *and*
    disables the header kebab (`ChatMessagesHeader.tsx:183`). Web does neither; it only dims the row.

17. **`isHost` is derived from a different field.** Mobile: `!!userData.groupHostId`. Web:
    `userType === "HOST"` (`lib/chat/contactProfile.ts:92`). This flag drives both the green Host badge
    *and* whether the conversation kebab menu is hidden, so the two clients disagree about which
    contacts can be removed/reported.

18. **Message delete semantics.** Mobile hard-deletes (`deleteMessage(id, true)`); web soft-deletes
    while its confirmation dialog says "This message will be permanently removed."

19. **Analytics.** Mobile emits `chatWithFirstBuddy` and `timeToSendMessage` on send
    (`ChatMessagesInput.tsx:132-141`). Web emits nothing anywhere in this area.

20. **Unread semantics.** The nav badge counts unread **messages** on web
    (`total_unread_count`) and unread **conversations** on mobile
    (`channel_type[0].channel_count`), and the conversation list is not sorted unread-first.
