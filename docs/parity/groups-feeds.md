# Feeds & Groups — mobile vs web parity

Source of truth: `~/cancerbuddyapp`, `src/navigation/app/feeds/FeedsScreens.tsx` and
`src/navigation/groups/GroupsScreens.tsx`, read line by line 2026-08-07 together with
every screen and layout they import.

Target: `~/cancerbuddy-web`, `app/(app)/groups/**`, `components/groups/**`,
`lib/groups/**`.

The Twilio video room itself (`src/screens/groups/twilio-video-room/**`,
`@layouts/Streaming/VideoControls`) is out of scope — it belongs to the Live/Streaming
audit. Where feeds and groups *link into* it, that link is noted.

---

## Summary

- **There is no media in the Groups tab on web — at all.** Mobile can attach a photo,
  a video, a camera capture or a PDF (≤ 20 MB) to a post *and* to a comment, previews
  them in a tray, uploads them to S3, and renders them back as a responsive grid with a
  full-screen swipeable gallery, inline video playback and PDF cards. Web's composer is
  a bare `<textarea>`, and `PostCard` renders every attachment — video and PDF included —
  as a square `<img>`. Comment attachments are parsed into `FeedComment.attachments`
  and then never rendered.
- **The composer lost its rich text.** Mobile uses the 10play TenTap editor with a
  bold / italic / underline toolbar, an "Add link" modal, and paste-autolinking, plus a
  2000-character limit with a counter that appears at 1920. Web has none of those and no
  character limit at all, while still storing and rendering HTML.
- **Moderation is both narrower and technically wrong.** Mobile lets group hosts *and*
  `SUPPORT`-type accounts delete anyone's post and pin one post per group, and it deletes
  through `USERS_LAMBDA` `deleteMessage`. Web's `canModerate` only checks group hosts, and
  `useGroupFeed.removePost` calls `session.userFeed.removeActivity()` — which removes an
  activity from *the caller's own* feed, so a host deleting another member's post is
  expected to fail. "Reply privately" (the host DM path, with a screenshot of the post
  attached) is missing entirely.
- **Nothing in a post is clickable except its actions.** On mobile every avatar and name
  in a post, comment or reply opens `UserInfoScreenGroups` (connect CTA gated by an
  existing connection, snooze and age rules), `HostDetail`, or the group detail when a
  host taps their own group. Web's `PostCard` and `CommentRow` render authors as inert
  text — which also means `FeedUserGallery` and `FeedJournalList`/`FeedJournalDetail`,
  though they exist under `/buddies`, are unreachable from anywhere in Groups.
- **Comment threads are capped and thin.** Web fetches `recentReactionsLimit=25` once and
  never pages (`fetchNextReactions` exists in `lib/groups/feedClient.ts` and is unused),
  so post 25+ comments and the rest are invisible. There is no per-reply paging
  ("VIEW N MORE"), no comment edit, no comment reporting, no reply-to-quote preview, no
  attach button, and comment bodies render as plain text — so HTML written from mobile
  shows up as raw markup.
- **The embedded group widget is gone.** `widget`/`widgetAvailable` are queried and typed
  on web and then never used; mobile renders them as a second tab over the feed with a
  WebView and external-link handling.

---

## Screen-by-screen inventory

### FeedsHome

- **Mobile:** `src/screens/feeds/home.tsx` — the Groups tab landing: joined groups + a live-calendar tab.
- **Web:** `components/groups/GroupsSidebar.tsx`, `app/(app)/groups/layout.tsx`, `app/(app)/groups/page.tsx`, `components/groups/GroupsEmptyState.tsx`

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | Hamburger drawer header | — | ✅ EXISTS | The app shell's sidebar/account sheet stands in; owned by the app-shell audit. |
| 2 | Search field above the tabs, with a clear (✕) button | client-side `searchableGroupsUtil` | ✅ EXISTS | `GroupsSidebar.tsx:176-199`; matches on name, description and sponsor name, same fields as `utils/groups/tools.ts`. |
| 3 | `GROUPS` / `LIVE GROUP CALENDAR` tab switcher with animated underline | — | ⚠️ PARTIAL | Web replaces the switcher with two permanent nav rows (`/groups/calendar`, `/groups/discover`). Documented as deliberate in `GroupsSidebar.tsx:5-10`. |
| 4 | Joined-groups list | AppSync `listUserGroups` (`getGroupsJoinedService`) | ✅ EXISTS | `fetchJoinedGroups` (`lib/groups/groupQueries.ts:225`). |
| 5 | `YOUR LIVE GROUPS` section hoisted above `YOUR GROUPS` | `getLiveGroupsService` | ✅ EXISTS | `GroupsSidebar.tsx:271-305`. |
| 6 | Live badge per group row, kept fresh by subscription | `GET_LIVE_GROUPS_SUSCRIPCION` | ✅ EXISTS | `GroupsProvider.tsx:144-172` subscribes to `onCreateLiveStreamingGroupCustom`. |
| 7 | Live groups the user is *not* in are filtered out of the badges | client filter on `userGroupIdSet` | ✅ EXISTS | Sidebar only badges joined groups by construction. |
| 8 | Muted bell-slash icon on a muted group row | `group.muted` | ✅ EXISTS | `GroupsSidebar.tsx:88-96`. |
| 9 | Verified checkmark on the group avatar | `group.verified` | ✅ EXISTS | `GroupAvatar` `verified` prop. |
| 10 | "Hosted by \<sponsor\>" subtitle | `Sponsor.name` | ✅ EXISTS | |
| 11 | Group `description` shown as the row's secondary line | `group.description` | ⚠️ PARTIAL | Web's row shows only the sponsor line; the description is dropped (`GroupsSidebar.tsx:98-102`). |
| 12 | `NEW` badge on groups with unread pushed posts | `usePushNotification().hasPostMessage` | ❌ MISSING | No new-post badge anywhere in the web sidebar. |
| 13 | Opening a group clears its pending push entries | `setHasPostMessage` | ❌ MISSING | |
| 14 | Tapping a **live** group opens a "Group options" sheet: *Join Live Call* / *View group posts* | `ModalStreaming` | ⚠️ PARTIAL | Web navigates straight to the feed; the live entry point is a `JOIN LIVE` button in the feed header (`GroupFeed.tsx:398-405`). One fewer step, one fewer choice. |
| 15 | Skeleton group list while loading | `SkeletonGroupsList` | ✅ EXISTS | `GroupsSidebar.tsx:249-260`. |
| 16 | Empty state: welcome GIF + "Explore groups" button | `EmptyStateGroupListLayout` | ⚠️ PARTIAL | `GroupsEmptyState.tsx` uses a 💬 emoji instead of the brand GIF; the CTA and destination match. |
| 17 | Live-calendar rendered inline under the second tab | — | ✅ EXISTS | Moved to its own route `/groups/calendar`. |

**Missing on web**

- No `NEW` badge showing which groups have unread posts, and no clearing of that state.
- The live-group "Join Live Call / View group posts" choice sheet.
- Group description on the list row.
- The `GROUPS` / `LIVE GROUP CALENDAR` tab switcher (replaced by nav rows — deliberate).
- The welcome GIF in the empty state.

---

### RecommendedFeeds (the Discover flow that actually ships)

- **Mobile:** `src/screens/feeds/recommended.tsx` → `components/layouts/Groups/GroupsRecommended.tsx` → `GroupsRecommendedList.tsx` → `NoSuggestedGroups.tsx`
- **Web:** `components/groups/DiscoverGroups.tsx` (`/groups/discover`)

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | Heading "What support groups would you like to join?" | — | ✅ EXISTS | Copy differs (`app.groups.discoverHeading`). |
| 2 | Search "Type keywords here" with clear button | client `searchableGroupsUtil` | ✅ EXISTS | Same three match fields. |
| 3 | Full catalogue, paged 1000-at-a-time via `nextToken` | AppSync `listGroups` | ✅ EXISTS | `fetchAllGroups` (`groupQueries.ts:252`), capped at `MAX_PAGES = 50`. |
| 4 | Already-joined groups filtered out | `getUserGroups` | ✅ EXISTS | `DiscoverGroups.tsx:68-80` via `isMember`. |
| 5 | `disabled` groups filtered out | `group.disabled` | ✅ EXISTS | `groupQueries.ts:270`. |
| 6 | Alphabetical sort | `sortListUtil(list,'name')` | ✅ EXISTS | `localeCompare`, base sensitivity. |
| 7 | Lock icon on non-public groups | `isPublic === false` | ✅ EXISTS | `DiscoverGroups.tsx:168-173`. |
| 8 | Row: avatar, verified icon, name, description, "Hosted by \<sponsor\>" | — | ✅ EXISTS | |
| 9 | Row tap opens the **full group detail screen** (`FeedDetail`) with JOIN/NEXT | — | ⚠️ PARTIAL | Web puts a `Join` button on the row that opens `JoinGroupDialog` (a compact sheet with avatar, sponsor, about, code field). There is no full detail page for an unjoined group. |
| 10 | Skeleton list while loading | `SkeletonGroupsList` | ✅ EXISTS | |
| 11 | Empty state: "We are working on creating new groups for you." + the BMCF contact email + **Copy Mail** button + success toast | `NoSuggestedGroups.tsx`, `BONE_MARROW_EMAIL_CONTACT` | ❌ MISSING | Web shows a generic `discoverEmpty` message. No contact email, no copy-to-clipboard. |
| 12 | Error state for a failed catalogue load | — | ✅ EXISTS | Web adds one (mobile has none). |

**Missing on web**

- The "we're building new groups — email us" empty state, its contact address and its Copy Mail button.
- A full group detail view before joining (web goes straight to a join sheet).

---

### RecommendedGroups (legacy affinity screen)

- **Mobile:** `src/screens/groups/recommended-groups/RecommendedGroups.tsx` (+ `GroupItem.tsx`, `recommendedGroups.utils.ts`, `queries/GetRecommendedGroups.ts`)
- **Web:** — none —

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | `RECOMMENDED FOR YOU` / `MORE OPTIONS` sectioned list | `GET_USER_GROUPS_COINCIDENCE` built from the user's interests, hospitals, treatments, diagnoses, city and birth date | ❌ MISSING | No affinity scoring on web. |
| 2 | Coincidence scoring (`COINCIDENCE_RATE = 1` over the affinity buckets) | `cleanGroups` / `allGroupsIds` | ❌ MISSING | |
| 3 | Search across the fetched groups | client | ✅ EXISTS | Covered by Discover. |
| 4 | `groupIdList` stashed in context to drive the detail screen's NEXT button | GroupsProvider | ❌ MISSING | See FeedDetail #12. |
| 5 | "Copy Mail" empty state | clipboard | ❌ MISSING | Same as RecommendedFeeds #11. |
| 6 | `beforeRemove` interception to animate the joined-group counter on the way back | navigation listener | ❌ MISSING | Cosmetic. |

Note: `DiscoverGroups.tsx:5-10` documents skipping this on purpose — the Groups tab no
longer routes here, only the (unused) Groups stack does. Listed for completeness.

---

### FeedDetail / GroupDetail (group detail + join)

- **Mobile:** `src/screens/feeds/group-details.tsx` + `components/layouts/Groups/GroupDetails.tsx` + `ConnectionGroup.tsx` + `elements/modal-private-group/modal-private-group.tsx`; the Groups-stack twin is `src/screens/groups/group-detail/GroupDetail.tsx`
- **Web:** `GroupInfoSheet` in `components/groups/GroupSheets.tsx:254`, plus `components/groups/JoinGroupDialog.tsx`

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | Close (✕), presented as a vertical modal | — | ✅ EXISTS | Sheet with close. |
| 2 | Large vertical group avatar + name | `getGroupById` | ✅ EXISTS | |
| 3 | "N members" subtitle | GetStream `feed.followers()` count | ⚠️ PARTIAL | Web uses AppSync `findTotalUserGroups` (`fetchGroupMemberCount`). Different source from mobile's Stream follower count — the two can disagree. |
| 4 | "View members" button → `ActiveUsersListGroups` | — | ✅ EXISTS | Links to `/groups/[id]/members`. |
| 5 | Lock/secure indicator on the avatar for private groups | `isPublic` | ❌ MISSING | Present in Discover rows, absent from the info sheet. |
| 6 | LIVE badge on the avatar when a session is running | `isLive` param | ❌ MISSING | The feed header has one; the info sheet does not. |
| 7 | `ABOUT` section | `group.about` | ✅ EXISTS | Falls back to `description`. |
| 8 | `HOSTED BY` block, hosts sorted by `hostOrder` | `Host.hosts` | ✅ EXISTS | Sorting reproduced in `groupQueries.ts:183-188`. |
| 9 | Per-host: avatar, name, occupation, **pronoun**, **ambassador flag**, bio | — | ⚠️ PARTIAL | Web shows avatar, name, occupation and a 3-line-clamped bio. Pronoun and the ambassador badge are dropped (`GroupSheets.tsx:340-369`). |
| 10 | Host row → `HostDetail` | — | ✅ EXISTS | `/groups/hosts/[hostId]`. |
| 11 | `SPONSORED BY` — logo image + sponsor description | S3 | ✅ EXISTS | |
| 12 | `JOIN` button | Stream `feed.follow` + `joinToGroup` Lambda | ✅ EXISTS | `lib/groups/membership.ts:22`. |
| 13 | `NEXT` button cycling to the next recommended group in place | `groupState.groupIdList` | ❌ MISSING | No browse-next flow on web. |
| 14 | Private group modal: 6-box code entry UI | `CodeValidationLayout`, ≥6 chars to enable | ⚠️ PARTIAL | Web uses one plain text input; no 6-character minimum gate, only a non-empty check (`JoinGroupDialog.tsx:71`). |
| 15 | Wrong code → error toast + red field state | `CODE_PRIVATE_GROUPS_NO_MATCH` | ⚠️ PARTIAL | Web shows an inline `role="alert"` message; no toast. |
| 16 | **"Ask the host"** link — finds/creates a Stream Chat channel with the host and opens Chat with `type: 'AskToHost'` and the group attached | Stream Chat + `createConnection`/`AcceptConnection` | ❌ MISSING | A user with no code has no way forward on web. |
| 17 | Join toast "You've joined X! You'll find it in your Groups section." | — | ✅ EXISTS | `app.groups.joinedToast`. |
| 18 | Optimistic membership + member-count update | SWR `mutate` | ✅ EXISTS | `addJoinedGroup` / `refreshGroups`. |
| 19 | `joinFirstGroup` analytics event | `emitEvent` | ❌ MISSING | No analytics anywhere in the web Groups module. |
| 20 | Mute / Leave actions | — | ✅ EXISTS | Web folds them into the same info sheet (mobile keeps them in a separate ⋯ menu). |

**Missing on web**

- The `NEXT` button that cycles through recommended groups without leaving the screen.
- "Ask the host" — the only route into a private group when you don't have the code.
- The 6-character code gate and the code-error toast.
- Lock indicator and LIVE badge inside the group detail.
- Host pronoun and ambassador badge.
- The `joinFirstGroup` analytics event.

---

### JoinGroup

- **Mobile:** `src/screens/groups/join-group/JoinGroup.tsx` — registered as `Screens.JoinGroupDetail` but returns `<></>`.
- **Web:** — none —

Dead screen. Nothing to port.

---

### ActivitiesFeed (the group feed that ships)

- **Mobile:** `src/screens/feeds/activities-feed.tsx` + `components/layouts/Groups/GroupHeader.tsx` + `ActivitiesList.tsx`
- **Web:** `components/groups/GroupFeed.tsx` + `lib/groups/useGroupFeed.ts`

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | Back arrow → Feeds Home | — | ✅ EXISTS | `lg:hidden` back button (two-pane on desktop). |
| 2 | Group name in the top bar, cross-fading in once scrolled past 50 px | `Animated` | ⚠️ PARTIAL | Web shows the name permanently; no scroll-linked animation. |
| 3 | Tapping the name or the avatar row opens group detail | — | ✅ EXISTS | Opens `GroupInfoSheet`. |
| 4 | Header avatar row: avatar, verified checkmark, sponsor name as subtitle, LIVE badge, caret | `getGroupByIdService` | ⚠️ PARTIAL | Web shows avatar + name + LIVE badge; the subtitle is the static string "Group info" instead of the sponsor name. |
| 5 | ⋯ overflow menu opening the group actions sheet | `GroupActions` | ⚠️ PARTIAL | Web has no ⋯; mute/leave live inside the group info sheet. |
| 6 | Mute / Unmute group updates, with explanatory copy | `muteOrUnmuteGroupService` → `USERS_LAMBDA` | ✅ EXISTS | `setGroupMuted`, same inverted `muted` convention. |
| 7 | Mute confirmation toast naming the group | — | ✅ EXISTS | |
| 8 | **Leave group is hidden when the current user hosts the group** | `dataGroupById.Host.hosts.some(h => h.id === id)` | ⚠️ PARTIAL | Web shows Leave to every member, hosts included (`GroupSheets.tsx:416-422`). |
| 9 | Leave confirmation "Are you sure you want to leave X?" + `YES, LEAVE` | — | ✅ EXISTS | `ConfirmSheet`. |
| 10 | "Write a post" button opening the full-screen composer | `BtnWritePost` | ⚠️ PARTIAL | Web has an always-visible inline composer card instead of a separate screen. |
| 11 | Post list | `USERS_LAMBDA` `newGetPostByGroup`, `useSWRInfinite` | ✅ EXISTS | `fetchGroupPosts`, `POSTS_PER_PAGE = 30`. |
| 12 | Pinned-first then newest-first ordering | client sort | ✅ EXISTS | `sortPosts` (`posts.ts:198`). |
| 13 | Infinite scroll (`onEndReached`) | offset paging | ✅ EXISTS | `IntersectionObserver`, 400 px root margin. |
| 14 | Pull-to-refresh (`RefreshControl`) | — | ❌ MISSING | Web has no manual refresh; only an error-state Retry button. |
| 15 | Realtime refresh when another member posts | AppSync `ON_CREATE_POST_BY_GROUP` | ✅ EXISTS | `useGroupFeed.ts:125-157`, ignores your own `actorId`. |
| 16 | Auto-retry up to 3× when the Lambda returns an empty page (a known intermittent) | client retry loop | ❌ MISSING | Web renders the "no posts yet" empty state immediately on the first empty answer. |
| 17 | Top spinner, and a footer loader while paging | `LoaderIndicator` | ✅ EXISTS | Skeleton cards. |
| 18 | Empty state "THERE ARE NO POST YET / SOMETHING INTERESTING WILL COME UP SOON" | `NotFoundLayout` | ✅ EXISTS | `noPostsTitle` / `noPostsSub`. |
| 19 | **Widget tabs** — `CustomTabs` labelled from `widget.tab1`/`tab2`; the second renders `widget.url` in a WebView with its own spinner and external-link interception | `group.widgetAvailable`, `group.widget` | ❌ MISSING | Web queries and types `widget`/`widgetAvailable` (`groupQueries.ts:34`, `types.ts:58`) and never renders them. |
| 20 | Scroll back to the top after a new post lands | `scrollToIndex` | ⚠️ PARTIAL | Web refreshes the list but does not scroll. |
| 21 | Notification deep link — `pendingPostId` / `pendingPostFeedId` / `pendingHighlightParentReactionId` auto-open `PostDetail` | push params | ✅ EXISTS | `?post=&feed=&reaction=` (`GroupFeed.tsx:126-147`). |
| 22 | Live entry point from the feed | — | ✅ EXISTS | Web adds a `JOIN LIVE` header button → `/live/[eventId]`; mobile reaches the room from the home list sheet instead. |
| 23 | Non-members cannot reach the feed at all | navigation | ⚠️ PARTIAL | Web deliberately renders a read-only feed with a Join button for non-members (`GroupFeed.tsx:6-8`). Deliberate divergence. |
| 24 | Read state / `hasPostMessage` clearing on entry | push context | ❌ MISSING | |

**Missing on web**

- Pull-to-refresh / any manual refresh of the feed.
- The embedded group widget tab (WebView) — queried but never rendered.
- The empty-page auto-retry that works around the Lambda's intermittent empty response.
- Hiding "Leave group" from hosts.
- The header's scroll-linked title animation and the sponsor-name subtitle.
- Scroll-to-top after posting.

---

### Group Feed (legacy Groups-stack feed)

- **Mobile:** `src/screens/groups/feed/Feed.tsx` (+ `useFeedData.ts`, `FeedActivityList.tsx`, `FeedModals.tsx`, `Feed.utils.ts`), and its header `components/layouts/GroupHeader/GroupHeader.tsx`
- **Web:** `components/groups/GroupFeed.tsx` (the two mobile feeds are merged into one on web)

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | Posts read straight from GetStream rather than the Lambda | `getActivitiesGroup` (Stream feed) | ⚠️ PARTIAL | Web standardises on the Lambda path, matching the shipping `ActivitiesFeed`. Deliberate. |
| 2 | Sponsor logo image rendered in the feed header | S3 `Sponsor.logo` | ❌ MISSING | Web's feed header shows no sponsor logo. |
| 3 | `RECENT ACTIVITY` list caption above the posts | — | ❌ MISSING | |
| 4 | Newly-created post fades and expands in at the top | `Animated` height + opacity | ❌ MISSING | |
| 5 | Posts by deleted users filtered out | `GET_IDS_ALL_USERS` ∩ actors (`Feed.utils.ts`) | ❌ MISSING | Neither web nor the shipping mobile `ActivitiesFeed` does this — flagged so it isn't mistaken for an oversight unique to web. |
| 6 | Mute / Leave modals (`FeedModals.tsx`) | — | ✅ EXISTS | Same copy as `GroupActions`; web covers both. |
| 7 | Leaving decrements the joined-group counter and triggers the home animation | GroupsProvider | ⚠️ PARTIAL | Web removes the group from context; no counter animation. |
| 8 | Pull-to-refresh with a 2 s artificial delay | `RefreshControl` | ❌ MISSING | See ActivitiesFeed #14. |
| 9 | `NO RECENT ACTIVITY` empty state | — | ✅ EXISTS | Equivalent copy. |

---

### Post card (`Post.fragment`) — the cross-cutting one

- **Mobile:** `components/layouts/Groups/post-fragment/Post.fragment.tsx` + `Like.fragment.tsx` + `MessageButton.fragment.tsx` + `hooks/usePostActions.ts` + `hooks/usePostPinning.ts` + `modals/{ReportPost,ConfirmPost,ConfirmPinedPost,EditComment}.modal.tsx` + `components/layouts/Post/FeedMediaAttachments.tsx`
- **Web:** `components/groups/PostCard.tsx` + `PostActionsSheet`/`ConfirmSheet` in `components/groups/GroupSheets.tsx` + `lib/groups/useGroupFeed.ts`

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | Author avatar with the goal-image ring | `userInfo.Goal.image.file` | ✅ EXISTS | `BuddyAvatar goalUrl`. |
| 2 | Author name via `formatName(name, userType)` + `printAge(userType, birth)` | — | ✅ EXISTS | `PostCard.tsx:138-143`. |
| 3 | `Host` badge when the author hosts this group | `userInfo.groupHostId === post.feedId` | ✅ EXISTS | |
| 4 | Ambassador flag on the author | `userInfo.ambassador` | ✅ EXISTS | |
| 5 | Relative post date | `getPostDate(post.time)` | ✅ EXISTS | Web's `postTimestamp` uses a different shorthand (`3m`/`5h`/`2d`/`12 Mar`). |
| 6 | `(Edited)` marker appended in italics | `post.edited` / `data.edited` | ✅ EXISTS | Rendered as `· Edited` in the meta line. |
| 7 | "Pinned post" chip with a pin icon | `latest_reactions.pinned` | ✅ EXISTS | |
| 8 | HTML body rendered with tag styles and link handling | `react-native-render-html` | ✅ EXISTS | `sanitizePostHtml` + `dangerouslySetInnerHTML`; web adds an allowlist sanitiser mobile doesn't need. |
| 9 | Bare URLs in the body auto-linked at render time | `linkifyText` | ❌ MISSING | Web renders only anchors the author explicitly created. |
| 10 | Clamped body with a "show more" that **opens the post detail** | `ReadMore` | ⚠️ PARTIAL | Web clamps to 6 lines and expands in place; it never opens the thread. |
| 11 | Media grid with 1 / 2 / 3 / 4+ layouts and a `+N` overflow tile | `FeedMediaAttachments` | ⚠️ PARTIAL | Web renders a flat 2–3 column square `<img>` grid for *every* attachment. |
| 12 | Video attachments with play overlay and inline playback | `react-native-video` | ❌ MISSING | A video attachment renders as a broken `<img>`. |
| 13 | Full-screen swipeable gallery with `n / total` counter and close | `Modal` + paged `FlatList` | ❌ MISSING | |
| 14 | PDF attachments as full-width download/open cards | `PdfAttachment` | ❌ MISSING | A PDF attachment renders as a broken `<img>`. |
| 15 | Like button with count, optimistic flip, rollback and failure toast | Stream reaction `like` | ✅ EXISTS | `useGroupFeed.toggleLike`. |
| 16 | Like/comment counters shared between the feed and the detail screen | `postActivityStore` | ⚠️ PARTIAL | Web propagates only `commentCount` back from the thread (`onCommentCountChange`); likes taken inside the thread are a no-op (see PostDetails #2). |
| 17 | Comment button with count → post detail | — | ✅ EXISTS | Opens the thread sheet. |
| 18 | ⋯ menu opening the post actions sheet | `ReportPost.modal` | ✅ EXISTS | `PostActionsSheet`. |
| 19 | Menu — **Pin / Unpin post**, top-level posts only | `usePostPinning` + `pinMessageByIdGroup` | ⚠️ PARTIAL | Web's `canModerate` is group-host-only; mobile also grants it to `UserType.SUPPORT`. |
| 20 | Pin-conflict modal: "There's another post pinned…", *Pin this post* / *Keep previous post pinned*, plus "We kept the previous post pinned" toast | `ConfirmPinedPost` | ⚠️ PARTIAL | Web's `ConfirmSheet` offers Cancel/Confirm rather than the two labelled choices, and has no "kept the previous one" toast. |
| 21 | Pin / unpin success toasts | — | ✅ EXISTS | |
| 22 | Menu — **Edit my post** (opens the editor screen) | `EditPost` | ✅ EXISTS | Inline composer in edit mode. |
| 23 | Menu — **Edit my comment / reply** (in-place modal with a plain textarea) | `EditComment.modal` + `editComment` | ❌ MISSING | `lib/groups/posts.ts:413 editComment` exists and is never called from the UI. |
| 24 | Menu — **Delete my post / comment / reply**, with a confirmation naming the type | `ConfirmRemovePost` | ⚠️ PARTIAL | Posts get a confirmation; comments are deleted from an inline link with **no confirmation** (`PostThread.tsx:101-109`). Replies have no delete affordance beyond that. |
| 25 | Menu — **Delete this post** when moderating someone else's | `USERS_LAMBDA` `deleteMessage` (`isPost` flag) | ⚠️ PARTIAL | Web calls `session.userFeed.removeActivity()` (`useGroupFeed.ts:207-214`), which targets the *caller's* feed — a host deleting another member's post is expected to fail. Wrong transport, not just a narrower one. |
| 26 | Menu — **Report post** | `ReportFeed` screen | ✅ EXISTS | `ReportPostSheet`. |
| 27 | Menu — **Report comment / reply** (same sheet, `type: comment`) | — | ❌ MISSING | |
| 28 | Menu — **Reply privately**: find-or-create the Stream Chat channel, screenshot the post with `react-native-view-shot`, open Chat with the image and `type: 'ReplyHost'`. Host/support only, never to another support user, never to yourself | Stream Chat + AppSync connections | ❌ MISSING | Entire flow absent. |
| 29 | Avatar/name tap → `UserInfoScreenGroups`, with the connect CTA gated by an existing connection, `isSnooze`, and `connectAgeRules` | `GET_CONNECTION_BY_REMITENT_RECIPIENT`, `GET_MAIN_USER_DATA` | ❌ MISSING | Web's post author is not interactive at all. |
| 30 | Avatar tap → `HostDetail` when the author is a host of another group | `userInfo.groupHostId` | ❌ MISSING | Same as above. |
| 31 | Avatar tap → group detail when a host taps their own group's post | — | ❌ MISSING | |
| 32 | Skeleton post while the author record resolves | SWR on `getuserInfoService` | ✅ EXISTS | Authors arrive pre-enriched from the Lambda; comment authors via `loadAuthor`. |

**Missing on web**

- Video playback, PDF cards, the full-screen media gallery and the responsive media grid.
- Auto-linking of bare URLs in a post body.
- Editing a comment or a reply.
- Reporting a comment or a reply.
- "Reply privately" to a member (host/support DM with the post attached).
- Any navigation from a post author to their profile, host page or group.
- `SUPPORT`-role moderation rights.
- A working host-deletes-someone-else's-post path (current call is against the wrong feed).
- Confirmation before deleting a comment.
- The two-choice pin-conflict dialog and its "kept the previous post" toast.

---

### NewPostScreen (feeds composer)

- **Mobile:** `src/screens/feeds/NewPostScreen.tsx` (+ `elements/format-toolbar/FormatToolbar.tsx`, `elements/post-media-tray/PostMediaTray.tsx`, `layouts/Chat/ChatAttachmentMenu.tsx`, `layouts/InputFullScreen/ModalAddUrls.tsx`, `hooks/photo/useChatMediaPicker.ts`, `utils/feedMedia.ts`)
- **Web:** `components/groups/PostComposer.tsx` (rendered inline by `GroupFeed`)

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | Full-screen composer reached from the feed header | navigation | ⚠️ PARTIAL | Web uses an always-present inline card at the top of the feed. |
| 2 | Composer header: back arrow, group avatar, group name, POST button | — | ⚠️ PARTIAL | Web has only the submit button; no group identity in the composer. |
| 3 | Rich-text editor with placeholder "What do you want to share with the group?" | 10play TenTap | ⚠️ PARTIAL | Plain `<textarea>`; text is converted to `<p>` HTML by `textToPostHtml`. |
| 4 | **Bold** toolbar button with active state | `editor.toggleBold()` | ❌ MISSING | |
| 5 | *Italic* toolbar button with active state | `editor.toggleItalic()` | ❌ MISSING | |
| 6 | <u>Underline</u> toolbar button with active state | `editor.toggleUnderline()` | ❌ MISSING | |
| 7 | Paperclip attach button on the toolbar | — | ❌ MISSING | |
| 8 | Attach sheet — **Photo** ("Choose from your library") | `useChatMediaPicker.pickPhoto` | ❌ MISSING | |
| 9 | Attach sheet — **Video** ("Share a video from your library") | `pickVideo` | ❌ MISSING | |
| 10 | Attach sheet — **Camera** ("Take a new photo") | `takePhoto` | ❌ MISSING | |
| 11 | Attach sheet — **Document** (PDF, up to 20 MB, with an over-size error toast) | `pickDocument`, `MAX_DOCUMENT_SIZE_MB` | ❌ MISSING | Only the feeds composer offers this; the Groups-stack one does not. |
| 12 | Media tray: hero preview sized to the real aspect ratio, thumbnails, per-item remove, trailing "Add" tile | `PostMediaTray` | ❌ MISSING | |
| 13 | Upload to S3 and attach to the activity | `uploadFeedMedia` | ❌ MISSING | `createPost` accepts an `attachments` argument that nothing ever passes. |
| 14 | "Add link" modal (label + URL) inserting an anchor into the body | `ModalHandleURL` / `ButtonUrl` | ❌ MISSING | |
| 15 | Autolink on paste | `LinkBridge linkOnPaste` | ❌ MISSING | |
| 16 | `href` normalisation before posting (protocol fixing, space stripping) | `replaceHrefWithCustomLinks`, `fixHrefSpaces` | ❌ MISSING | Moot without link authoring. |
| 17 | Character counter appearing at 1920 chars, hard limit 2000, POST blocked over it | `TextCounter` | ❌ MISSING | Web imposes no length limit and shows no counter. |
| 18 | POST disabled while the body is empty **and** no media is attached | — | ✅ EXISTS | Text-only condition. |
| 19 | "The post must not be empty" alert | `Alert.alert` | ✅ EXISTS | Prevented by the disabled button. |
| 20 | Failure toast "Could not create post. Please try again." | `showErrorInToast` | ✅ EXISTS | `app.groups.postError`. |
| 21 | Full-screen loader while posting | `Loader` | ✅ EXISTS | Button spinner. |
| 22 | Analytics: `post` (with account-age timestamp) and `newPost` (with the body) | `emitEvent` | ❌ MISSING | |
| 23 | Feed refresh + return to the feed after posting | `getActivities` | ✅ EXISTS | `feed.refresh()`. |
| 24 | AppSync `createGroupPost` row so other members' subscriptions fire | AppSync | ✅ EXISTS | `posts.ts:289-321`, errors swallowed as on mobile. |
| 25 | ⌘/Ctrl + Enter to submit | — | ✅ EXISTS | Web-only addition. |

**Missing on web**

- Bold, italic and underline.
- Photo, video, camera and PDF attachments, the attach sheet and the media tray.
- The "Add link" modal and paste-autolinking.
- The 2000-character limit and its counter.
- Composer analytics events.
- The group's identity (avatar + name) shown while composing.

---

### NewPost (Groups-stack composer)

- **Mobile:** `src/screens/groups/new-post/NewPost.tsx` (+ `elements/media-preview-strip/MediaPreviewStrip.tsx`)
- **Web:** `components/groups/PostComposer.tsx`

Same as above, with three differences worth recording:

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | Attach sheet without the Document row (photo / video / camera only) | `ChatAttachmentMenu` | ❌ MISSING | |
| 2 | Horizontal `MediaPreviewStrip` instead of the richer tray | — | ❌ MISSING | |
| 3 | Sets `newPostAdded` in context so the feed plays its insert animation | GroupsProvider | ❌ MISSING | Web has no insert animation. |
| 4 | No character counter on this variant | — | ✅ EXISTS | Matches web (both unlimited here). |

---

### EditPostScreen

- **Mobile:** `src/screens/groups/edit-post/EditPost.tsx`
- **Web:** `PostComposer` in edit mode inside `components/groups/GroupFeed.tsx:427-438`

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | Editor pre-filled with `edited_object || object` | route params | ✅ EXISTS | `postHtmlToText(initialHtml)` — HTML formatting is flattened to text on the way in, so editing a formatted post strips its formatting. |
| 2 | Header "Edit post" with the author's avatar | — | ❌ MISSING | |
| 3 | Bold / italic / underline toolbar while editing | `FormatToolbar` | ❌ MISSING | |
| 4 | SAVE disabled while empty + "must not be empty" alert | — | ✅ EXISTS | |
| 5 | `editActivity` sets `edited_object` + `edited` (+ `edited_at` on web) | Stream activity update | ✅ EXISTS | `posts.ts:331`. |
| 6 | Feed refreshed after saving | `getActivities` | ✅ EXISTS | `patchPost`. |
| 7 | Explicit Cancel | back gesture on mobile | ✅ EXISTS | Web adds a Cancel button. |
| 8 | Success toast after saving | — | ✅ EXISTS | Web adds one. |

**Missing on web**

- Formatting toolbar while editing, and preservation of existing formatting when an
  HTML post is opened for edit.

---

### PostDetails (comment thread)

- **Mobile:** `src/screens/feeds/PostDetails.tsx` + `components/CommentItem.tsx`, `ReplyButton.tsx`, `ThreadReplyBar.tsx`; Groups-stack twin `src/screens/groups/post-details/PostDetails.tsx`
- **Web:** `components/groups/PostThread.tsx`

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | The post rendered in full (unclamped) at the top | `newGetReactionsByPost` Lambda | ✅ EXISTS | `PostCard expanded`; web reads the enriched activity from Stream instead of the Lambda. |
| 2 | Like button live on the header post | Stream reaction | ⚠️ PARTIAL | Web passes `onToggleLike={() => {}}` (`PostThread.tsx:310`) — the heart renders but does nothing inside the thread. |
| 3 | ⋯ actions menu on the header post (edit / delete / pin / report / reply privately) | — | ❌ MISSING | `onOpenActions={() => {}}` — no menu in the thread. |
| 4 | Comment list ordered newest-first | `[...comment].reverse()` | ⚠️ PARTIAL | Web renders Stream's own order (oldest of the recent window first). |
| 5 | Comment author: avatar, `formatName` + age suffix, host/ambassador treatment, timestamp | `getuserInfoService` | ⚠️ PARTIAL | Web shows avatar, `formatName` and timestamp only — no age suffix, no host badge, no ambassador badge (`PostThread.tsx:69-89`). |
| 6 | Comment body rendered as HTML (`\n` → `<br>` on send) | `RenderHtml` | ⚠️ PARTIAL | Web renders `comment.text` as plain text with `whitespace-pre-line`, so `<br>` and any markup written on mobile appears literally. |
| 7 | `(Edited)` on comments and replies | `data.edited` | ✅ EXISTS | |
| 8 | Comment / reply media attachments | `data.attachments` | ❌ MISSING | Parsed into `FeedComment.attachments` (`posts.ts:220`) and never rendered. |
| 9 | REPLY affordance under each comment | — | ✅ EXISTS | |
| 10 | `VIEW N REPLIES` / `HIDE` expand-collapse | client | ✅ EXISTS | Toggle with the same count label. |
| 11 | Single-reply comments show their reply expanded by default | client | ✅ EXISTS | `useState(depth > 0 \|\| highlighted)` behaves equivalently for the nested case. |
| 12 | `VIEW N MORE` paging **within** a reply thread, 10 at a time | `pageMap` | ❌ MISSING | Web renders whatever replies came back, all at once. |
| 13 | Comment paging past the first page | `latest_reactions_extra.comment.next` → `groupApiGetNetxComments` | ❌ MISSING | Web fetches `recentReactionsLimit=25` once. `fetchNextReactions` (`feedClient.ts:225`) is written but never called. |
| 14 | Reply bar: "Replying to \<name\>" + the quoted parent text (6 lines) + ✕ to cancel | `ThreadReplyBar` | ⚠️ PARTIAL | Web shows "Reply to \<name\>" with a Cancel link and no quoted text. |
| 15 | Comment composer attach button → photo / video / camera | `ChatAttachmentMenu` | ❌ MISSING | |
| 16 | Pending-media strip inside the comment composer, with per-item remove and an uploading spinner | `MsgSend` + `MediaPreviewStrip` | ❌ MISSING | |
| 17 | Character counter on comments, limit 2000, appears at 1920 | `TextCounter` | ❌ MISSING | |
| 18 | Send enabled by text **or** attached media | — | ⚠️ PARTIAL | Text only. |
| 19 | Double-send guard (ref-based, rejects the second tap in the same frame) | — | ✅ EXISTS | `sending` state guard. |
| 20 | Sending spinner on the send button | — | ✅ EXISTS | |
| 21 | Thread refetched after a successful comment (not spliced) | — | ✅ EXISTS | Same approach, documented in both. |
| 22 | Reply written with `parent` only (Stream drops the link if `activity_id` is also sent) | Stream reactions | ✅ EXISTS | `addReply` (`posts.ts:388`) reproduces the workaround. |
| 23 | Notification highlight: expand the parent comment, scroll it to ~⅓ of the screen | `highlightParentReactionId` | ✅ EXISTS | `scrollIntoView({block:"center"})` + a bone highlight. |
| 24 | Retry-once-then-believe-it on an empty fetch, then "CONTENT NOT FOUND" empty state | double fetch with a 1.2 s gap | ⚠️ PARTIAL | Web shows a generic thread error on the first failure; no second attempt, no dedicated not-found state. |
| 25 | Skeleton post + skeleton comments while loading | `SkeletonPost` | ✅ EXISTS | |
| 26 | Push notifications cleared on focus | `clearPush` | ❌ MISSING | |
| 27 | Comment delete confirmation | `ConfirmRemovePost` | ⚠️ PARTIAL | Web deletes on a single click of an inline "Delete comment" link. |
| 28 | Dedupe of comments arriving from both the refresh and the paged list (Groups-stack twin) | `dedupeCommentsById` | ✅ EXISTS | Not needed — web always refetches wholesale. |
| 29 | Network-status gate before fetching (Groups-stack twin) | `useNetworkStatus` | ❌ MISSING | Minor. |

**Missing on web**

- Comment paging — the thread stops at 25 reactions with no way to load more.
- Per-reply "VIEW N MORE" paging.
- Attaching media to a comment, and rendering media that comes attached.
- Comment character limit and counter.
- The quoted parent text in the reply bar.
- Comment HTML rendering (mobile-authored line breaks show as raw `<br>`).
- Age suffix, host and ambassador badges on comment authors.
- Post actions (⋯) and a working like button inside the thread.
- The "CONTENT NOT FOUND" state and its retry-once behaviour.
- Confirmation before deleting a comment.

---

### ReportPost / ReportGroup

- **Mobile:** `src/screens/feeds/report-post.tsx` (+ `components/layouts/Templates/ReportTemplate.tsx`); the Groups stack mounts `src/screens/buddies/report/Report.tsx` on the same template
- **Web:** `ReportPostSheet` in `components/groups/GroupSheets.tsx:182`

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | Full-screen form with an ✕ close | — | ✅ EXISTS | Rendered as a sheet. |
| 2 | Title "Can you say more?" | — | ✅ EXISTS | `app.groups.reportTitle`. |
| 3 | Anonymity note "Help keep our community safe… completely anonymous." | — | ✅ EXISTS | `app.groups.reportPrompt`. |
| 4 | Reason — *Inappropriate comments* | radio | ✅ EXISTS | `POST_REPORT_REASONS` (`types.ts:154`). |
| 5 | Reason — *Spam* | radio | ✅ EXISTS | |
| 6 | Reason — *Made me feel uncomfortable* | radio | ✅ EXISTS | |
| 7 | Reason — *False profile* | radio | ✅ EXISTS | |
| 8 | Reason — *Other* | radio | ✅ EXISTS | |
| 9 | Choosing *Other* reveals a textarea, hint "(Maximum 1000 characters)", `maxLength=1000` | `Input variant="textarea"` | ❌ MISSING | Web submits the literal string `"Other"` with no detail. |
| 10 | Submit disabled until a reason is chosen **and**, for *Other*, at least 10 characters typed | `disabledButtonState()` | ⚠️ PARTIAL | Web only checks that a reason is selected. |
| 11 | Success toast + dismiss | `REPORT_THANK_YOU` | ✅ EXISTS | |
| 12 | Failure toast | `COMMON_REPORT_POST_GROUP_ERROR_COPY` | ✅ EXISTS | |
| 13 | Payload carries `reportedUser` (the post author), the post body and `type` (`post` \| `comment`) | `reportPostService` | ⚠️ PARTIAL | Web's `createReportPost` sends only `{postId, userId, reason}` (`membership.ts:100`) — moderators lose the author, the content and the kind. |
| 14 | Reachable for comments and replies | `ReportTypes.comment` | ❌ MISSING | Web can only report top-level posts. |

**Missing on web**

- The free-text box for "Other" (and its 10-character minimum).
- The reported user, the post body, and the post/comment type in the report payload.
- Reporting a comment or a reply at all.

---

### HostDetail

- **Mobile:** `src/screens/feeds/host-details.tsx` and `src/screens/groups/host-detail/HostDetail.tsx` (near-identical)
- **Web:** `components/groups/HostDetailScreen.tsx` (`/groups/hosts/[hostId]`)

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | Close / back | — | ✅ EXISTS | |
| 2 | Large avatar + `formatName(host.name)` | `GET_DATA_HOST` | ✅ EXISTS | |
| 3 | Occupation | — | ✅ EXISTS | |
| 4 | Pronoun | `Pronoun.name` | ✅ EXISTS | |
| 5 | Ambassador flag | `host.ambassador` | ✅ EXISTS | |
| 6 | `ABOUT` / bio | — | ✅ EXISTS | |
| 7 | `SPONSORED BY` — the sponsor logo and description of the host's group | `getGroupById(groupHostId)` | ✅ EXISTS | |
| 8 | Loader while fetching | — | ✅ EXISTS | Skeleton. |
| 9 | Not-found state | — | ✅ EXISTS | Web adds one. |
| 10 | Link through to the host's group | — | ✅ EXISTS | Web-only addition. |

The closest thing to full parity in this area.

---

### ActiveUsersListGroups (group members)

- **Mobile:** `src/screens/groups/user-active-list-groups/ActiveUsersListGroups.tsx`
- **Web:** `components/groups/GroupMembers.tsx` (`/groups/[groupId]/members`), `lib/groups/members.ts`

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | Group name as the screen heading | route param `nameGroup` | ✅ EXISTS | Shown in the header sub-line. |
| 2 | `MEMBERS` caption | — | ✅ EXISTS | |
| 3 | Total member count | — | ✅ EXISTS | Web adds a count pill from `findTotalUserGroups`. |
| 4 | Paged list, 20 per page via `nextToken` | AppSync `userGroupsByGroupId` (`GET_ALL_USERS_ACTIVES_GROUP`) | ✅ EXISTS | Web uses 30 per page and an `IntersectionObserver`. |
| 5 | Dedupe by user id across pages | client `Map` | ✅ EXISTS | `seenRef` set. |
| 6 | **The group's own host is excluded from the member list** (`User.groupHostId !== idGroup`) | client filter | ⚠️ PARTIAL | Web lists hosts and tags them with a `Host` badge instead. |
| 7 | Avatar with the goal-image ring | `Goal.image.file` | ✅ EXISTS | |
| 8 | `formatName(name)`, `displayAge(birth)` | — | ✅ EXISTS | |
| 9 | Location "City, ST" | `formatLocation` | ✅ EXISTS | |
| 10 | Diagnosis names listed under the avatar | `Diagnosis.list[].item.name` | ❌ MISSING | Web's member query deliberately omits diagnoses (`members.ts:4-9`); the row shows only location. |
| 11 | Role badge coloured by `userType` | `badgeColor` | ✅ EXISTS | `ROLE_LABELS` / `ROLE_BADGE_CLASS`. |
| 12 | Host badge | `groupHostId` | ✅ EXISTS | |
| 13 | Ambassador badge | — | ✅ EXISTS | |
| 14 | Host row → `HostDetail` | — | ✅ EXISTS | |
| 15 | Member row → `UserInfoScreenGroups` with the connect CTA gated by an existing connection, `isSnooze` and self-check | `GET_CONNECTION_BY_REMITENT_RECIPIENT` | ⚠️ PARTIAL | Web links to `/buddies/[userId]`; the connect gating there belongs to the Buddies audit, but the group-side `showButtons`/`showMaybeLater` params are not reproduced. |
| 16 | Footer spinner while paging | `ActivityIndicator` | ✅ EXISTS | Skeleton rows double as the sentinel. |
| 17 | Loader on first load | — | ✅ EXISTS | |
| 18 | Error state with retry | — | ✅ EXISTS | Web adds one. |
| 19 | Empty state | — | ✅ EXISTS | Web adds one. |

**Missing on web**

- Diagnosis names on member rows.
- Hiding the group's own host from the member list.
- The group-specific connect-CTA parameters when opening a member.

---

### LiveGroupCalendar

- **Mobile:** `src/screens/groups/live-group-calendar/LiveGroupCalendar.tsx` (also embedded as a tab in `feeds/home.tsx`)
- **Web:** `components/groups/LiveCalendar.tsx` (`/groups/calendar`), `lib/groups/liveGroups.ts`

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | Only this month and next are shown | client window | ✅ EXISTS | `buildCalendarMonths` (`liveGroups.ts:111`) reproduces the exact window. |
| 2 | Black month header banner | — | ⚠️ PARTIAL | Web uses a plain uppercase heading, not the black banner. |
| 3 | `YOUR GROUPS` / `MORE GROUP OPTIONS` sections per month | `userGroupIds` | ✅ EXISTS | |
| 4 | Privacy filter — sessions of private groups the user isn't in are hidden | `filterCalendarEventsForMembershipPrivacy` | ✅ EXISTS | `filterCalendarForPrivacy`, same rule. |
| 5 | Calendar waits for real membership before filtering | `groupsReady` | ✅ EXISTS | Keyed on `memberKey`. |
| 6 | **Inactive / archived events filtered out** (`active !== false && !archived`) | client filter | ❌ MISSING | `fetchLiveCalendar` (`liveGroups.ts:37`) filters only on `id` and `scheduledAt` — archived sessions will show. |
| 7 | Sorted by `scheduledAt` ascending | — | ✅ EXISTS | |
| 8 | Card: date, time range (`start`–`start+duration`, default 60 min) | — | ✅ EXISTS | `formatEventWhen`. |
| 9 | Card: group name and event title | — | ✅ EXISTS | Web also renders `description`. |
| 10 | `LIVE` badge with a pulsing dot | `event.status === 'live'` | ⚠️ PARTIAL | Web has the badge, no dot, and derives "live" from `inLive` / the live-groups subscription rather than `status`. |
| 11 | `ENDED` badge | `event.status === 'ended'` | ❌ MISSING | Web only distinguishes LIVE and UPCOMING. |
| 12 | Every card opens the Twilio room regardless of state | navigation | ⚠️ PARTIAL | Web sends live sessions to `/live/[eventId]` and everything else to the group — documented as deliberate in `LiveCalendar.tsx:10-14`. |
| 13 | Loader | — | ✅ EXISTS | Skeleton cards. |
| 14 | Empty state "No upcoming live group sessions." | — | ✅ EXISTS | |
| 15 | Error state with retry | — | ✅ EXISTS | Web adds one (reloads the page). |

**Missing on web**

- Archived / inactive sessions are not filtered out.
- The `ENDED` badge for finished sessions.
- The black month banner and the live dot (cosmetic).

---

### UserInfoScreenGroups

- **Mobile:** `src/screens/buddies/userInfo/UserInfo.tsx`, mounted in both stacks as `FeedScreens.UserInfoScreenGroups` / `Screens.UserInfoGroups`
- **Web:** `/buddies/[userId]` exists, **but nothing in Groups links to it except the member list**

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | Reachable from a post author, a comment author and a reply author | `usePostActions.handleAvatarPress` | ❌ MISSING | Post and comment authors are inert on web. |
| 2 | Reachable from the member list | `ActiveUsersListGroups` | ✅ EXISTS | |
| 3 | `showButtons` / `showMaybeLater` connect CTA computed from connection + snooze + age rules | AppSync | ⚠️ PARTIAL | The buddy profile has its own logic; the group-context parameters are not passed. Detail belongs to the Buddies audit. |
| 4 | Opens as a vertical modal with a close-goes-back behaviour | navigation options | ⚠️ PARTIAL | Web navigates to a full page. |

---

### FeedUserGallery / GroupUserGallery

- **Mobile:** `src/screens/buddies/gallery/GalleryScreen.tsx`, mounted in both stacks
- **Web:** photo grid inside `components/buddies/BuddyProfileScreen.tsx:364`

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | A member's photo gallery opened from within the Groups stack | — | ⚠️ PARTIAL | The gallery exists on the buddy profile, but there is no path to it from a group post or comment (see Post card #29). |

---

### FeedJournalList / FeedJournalDetail

- **Mobile:** `src/screens/buddies/journal/JournalPreviewList.tsx`, `JournalPreviewEntryDetail.tsx`, mounted in both stacks
- **Web:** `app/(app)/buddies/[userId]/journal/page.tsx`, `components/buddies/JournalList.tsx`, `JournalPreview.tsx`

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | A member's journal list opened from within the Groups stack | — | ⚠️ PARTIAL | Route exists; no entry point from Groups. |
| 2 | A single journal entry detail | — | ⚠️ PARTIAL | Same. |

---

### HomeNotificationGroup

- **Mobile:** `src/screens/notifications/HomeNotifications.tsx`, mounted inside the Groups stack as `Screens.HomeNotificationsGroupFeed`
- **Web:** `app/(app)/notifications` (the Updates tab)

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | The notifications screen reachable from inside the Groups stack | navigation | ⚠️ PARTIAL | Web has one notifications route rather than a per-stack copy. Content parity is covered by `docs/UPDATES.md` and the Updates parity doc. |
| 2 | A post/reply notification hands off into the group feed and on to the post thread | `pendingPostId` etc. | ✅ EXISTS | `/groups/[groupId]?post=…&feed=…&reaction=…` (`GroupFeed.tsx:126-147`). |

---

### Chat and the video room, as reached from Groups

Link-outs only; each destination is another audit's territory.

| # | Mobile capability | Data source | Web status | Notes / exactly what differs |
|---|---|---|---|---|
| 1 | `TwilioVideoRoom` mounted in both stacks, entered from the live-group sheet and the calendar | Twilio | ⚠️ PARTIAL | Web routes to `/live/[eventId]` from the feed header and the calendar. The room itself is the Live audit's. |
| 2 | `VideoControls` mounted in the Feeds stack, entered from the group detail's camera/mic permission flow | `react-native-permissions` | ❌ MISSING | The group-detail "join live" path with its permission pre-check has no web equivalent (the code is commented out on mobile too). |
| 3 | `ChatScreen` mounted in both stacks — the destination of "Reply privately" and "Ask the host" | Stream Chat | ❌ MISSING | Neither entry point exists on web, so Groups never reaches Chat. |

---

## Cross-screen gaps

1. **Media is absent end-to-end.** No attach flow (photo / video / camera / PDF), no
   upload, no tray, no grid, no lightbox, no video playback, no PDF cards — for posts
   *and* comments. `createPost` and `addComment` both accept an `attachments` argument
   that nothing passes, and `PostCard` renders every attachment type as an `<img>`, so
   posts made from mobile with video or PDF attachments currently render broken.
2. **Rich text is absent end-to-end.** No bold / italic / underline, no link insertion,
   no paste-autolinking, no `linkifyText` at render. Worse, `postHtmlToText` flattens an
   existing HTML body when a post is opened for edit, so editing a formatted post from
   the web silently destroys its formatting.
3. **No character limits.** Mobile caps posts and comments at 2000 characters with a
   counter from 1920. Web has neither, so a web client can create content the mobile
   editor would have refused.
4. **Author identity is a dead end.** Post and comment authors are not links. That
   removes the route to `UserInfoScreenGroups`, `HostDetail`, the group detail, the
   photo gallery and the journal — five mobile destinations reachable from a single tap
   on an avatar.
5. **Moderation is under-powered and mis-wired.** `SUPPORT` accounts get no moderation
   rights on web; host deletion of another member's post calls
   `userFeed.removeActivity()` instead of the `deleteMessage` Lambda and should fail;
   comments and replies can be neither edited nor reported; deleting a comment has no
   confirmation.
6. **"Reply privately" and "Ask the host" are missing**, so the Groups tab on web never
   opens a chat. Those are the two paths mobile provides for a host to reach a member
   and for a member to reach a host about a private group.
7. **Comment threads are truncated at 25 reactions** with the paging helper already
   written but unused, and reply threads render whatever arrived with no "VIEW N MORE".
8. **The group widget tab is queried and discarded.** `widgetAvailable` and `widget`
   flow all the way into `Group` and are never rendered.
9. **No refresh gestures.** No pull-to-refresh on the feed, no manual refresh anywhere,
   and no auto-retry against the Lambda's known intermittent empty response.
10. **No analytics.** `post`, `newPost`, `comment` and `joinFirstGroup` events are all
    emitted on mobile and none exist on web.
11. **Report payloads are thinner.** Only `{postId, userId, reason}` reaches AppSync —
    no reported user, no post body, no post/comment type, and no free text for "Other".
12. **Several small pieces of state don't exist on web**: the `NEW`-post badge per group,
    the joined-group counter animations, the scroll-linked feed header, the post
    insert animation, and the "kept the previous post pinned" toast.
13. **Deliberate divergences worth keeping recorded** (all documented in the web source):
    tabs → permanent nav rows; the affinity-scored Recommended screen → a flat
    searchable Discover; calendar rows routing by live state rather than always into
    Twilio; non-members getting a read-only feed instead of no feed; and a two-pane
    desktop layout in place of a push/pop stack.
