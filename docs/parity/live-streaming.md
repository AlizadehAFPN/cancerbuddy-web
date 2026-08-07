# Live, Streaming & Video Rooms — mobile vs web parity

Source of truth: `~/cancerbuddyapp` (React Native). Target: this repo.
All paths are repo-relative to their own app.

## Summary

There are **two** live systems in the mobile codebase, and only one of them
matters for parity.

1. **AWS IVS broadcast** (`src/screens/streaming/HomeStreaming.tsx` →
   `src/components/layouts/Streaming/VideoControls.tsx`). Reached only from the
   `Live` bottom tab. That tab is **hard-disabled for every user**, and the
   screens behind it have been gutted: the video surface is a plain black
   `<View>`, chat is a no-op, and the camera ref is never attached to anything.
   It is dead code. The web app does not port it, and should not.
2. **Twilio Video room** (`src/screens/groups/twilio-video-room/`). This is the
   live feature that actually ships on mobile, reached from the Groups home
   calendar tab, from a live group row, and from a push notification. This is
   what "parity" means.

Against the Twilio room, the web port is **substantially complete and in most
places ahead of mobile**. `docs/LIVE.md` is accurate about the room itself.
Every in-room control mobile has, web has, plus screen share, device pickers,
network-quality bars, dominant-speaker highlighting, reconnect states, a
participants panel, and retryable chat.

The gaps are **not in the room**. They are in everything that surrounds it:

- **The LIVE badge query is wrong on web** and marks essentially every group
  live. This is the single highest-severity finding in this area.
- **No push deep-link into the room.** Web sends the "we're live" push and then
  drops its own recipients on `/groups`.
- **The calendar shows sessions that mobile hides** (`active: false`, archived)
  and never shows an `ENDED` state.
- **A host cannot open their own session** from `/profile/lives`.
- Scheduling loses the date/time guard rails mobile has.

Counts across this document: **31 ❌ MISSING**, **12 ⚠️ PARTIAL**.
Of those, 13 ❌ are features neither platform has (recording, RSVP, raise hand,
reactions, waiting room, replay, promote-to-host, capacity, event detail, host
profile link, month/week calendar views, countdown, moderation of hosts) — they
are listed because the brief asks for them, and they are marked
"**both**" so they are not mistaken for regressions.
**18 ❌ and 12 ⚠️ are true web-vs-mobile gaps.**

---

## Is Live shipped on mobile?

**No. The `Live` bottom tab is unconditionally hidden for every user, and the
code behind it is a stub.**

`src/navigation/tabs/TabsNavigator.tsx:30-42`:

```tsx
{TabsScreens.map(route =>
  (userType === UserType.SUPPORT &&
    (route.name === TabsNav.Profile ||
      route.name === TabsNav.HomeNotifications)) ||
  route.name === TabsNav.Live ? null : (
    <Tab.Screen … />
  ),
)}
```

Read the ternary carefully. The `SUPPORT` clause is user-type dependent; the
`route.name === TabsNav.Live` clause is **not**. It is OR-ed in at the top
level, so `Live` returns `null` for every user type, always. The screen is
registered (`TabsScreens.tsx:31-34`) and the icon exists
(`TabsConfiguration.tsx:60-62`), but it is never mounted.

The screens behind that tab are also non-functional, which is corroborating
evidence that this path was abandoned rather than temporarily hidden:

| Evidence | File:line |
| --- | --- |
| Video surface is a bare black `<View>`, not an IVS view | `layouts/Streaming/VideoControls.tsx:72,150-153` |
| `BroadcastLayout` renders a black `<View>` and nothing else | `layouts/Streaming/BroadcastLayout.tsx:31-39` |
| Chat send is an empty function: `// Chat messaging not available` | `layouts/Streaming/VideoControls.tsx:42-44` |
| `messages` has no setter — permanently `[]` | `layouts/Streaming/VideoControls.tsx:37` |
| Send button hard-disabled: `isSendDisabled={true}` | `layouts/Streaming/VideoControls.tsx:106` |
| Camera button is a no-op: `onPressCamera={() => {}}` | `layouts/Streaming/VideoControls.tsx:102` |
| "GO LIVE" calls `cameraViewRef.current?.start?.()` on a ref attached to nothing | `layouts/Streaming/HeaderVideoControlsHost.tsx:155` |
| Camera-flip control commented out (`TODO: Add disable video`) | `layouts/Streaming/FooterVideoControls.tsx:82-108` |
| Viewer count commented out (`TODO: COMMING SOON`) | `layouts/Streaming/HeaderVideoControlsHost.tsx:135-143` |

The `startStreaming` / `finishedStreaming` Lambda calls against
`LIVE_STREAM_LAMBDA` still exist (`services/streaming/streaming.ts:12-59`) and
the live-streaming reducer/context is still compiled in, but nothing reachable
invokes them.

### What this means for parity

Ignore `StreamingScreens`, `HomeStreaming`, `VideoControls`, `BroadcastLayout`,
`FooterVideoControls`, `HeaderVideoControlsHost`, `HeaderVideoControlViewer`,
`FloatComments`, `StaticComments` and the IVS Lambdas. **Not porting them is
correct**, and the web repo correctly contains no equivalent.

The **shipped** live surface on mobile is the Twilio room, registered twice
(`navigation/app/feeds/FeedsScreens.tsx:148-149`,
`navigation/groups/GroupsScreens.tsx:164-165`) and reached from three places:

| Entry | File:line |
| --- | --- |
| Groups home → "LIVE GROUP CALENDAR" tab → tap a row | `screens/feeds/home.tsx:159-165`, `live-group-calendar/LiveGroupCalendar.tsx:166-174` |
| A live group row → `ModalStreaming` → "Join Live Call" | `layouts/Groups/GroupsList.tsx:87-101` |
| Push notification (warm **and** cold start) | `context/push-notification/push-notification.provider.tsx:45-67,340-364` |

The rest of this document compares against those.

---

## In-room control matrix

Mobile column = `screens/groups/twilio-video-room/TwilioVideoRoom.tsx` +
`useTwilioRoom.ts`. Web column = `components/live/**` + `lib/live/**`.

| Control | Mobile | Web | Notes |
| --- | --- | --- | --- |
| Join room | ✅ auto on mount, `useTwilioRoom.ts:144-151` | ✅ after pre-join | Web adds a device-check step (`PreJoin.tsx`) — documented divergence, needed for browser permission + autoplay gestures |
| Pre-join / device check | ❌ | ✅ `PreJoin.tsx` | Web-only |
| Leave room | ✅ options sheet, `TwilioVideoRoom.tsx:583-596` | ✅ control bar **and** options sheet | Web puts it on the bar too |
| Camera on/off | ✅ `useTwilioRoom.ts:444-458` | ✅ `useLiveRoom.ts:516-542` | Both unpublish + stop the track |
| Microphone on/off | ✅ `useTwilioRoom.ts:428-442` | ✅ `useLiveRoom.ts:544-570` | |
| Join muted, camera off | ✅ `useTwilioRoom.ts:353-357` | ✅ `useLiveRoom.ts:329-347` | Matched on purpose |
| Camera flip (front/back) | ❌ **both** — no `flipCamera` call anywhere | ❌ n/a on desktop | Web's camera picker (`DeviceMenu`) covers the real need |
| Speaker / audio-output | ⚠️ `toggleSpeaker` exists and is returned (`useTwilioRoom.ts:460-465,519`) but **no UI calls it** | ✅ speaker picker + `setSinkId` (`RemoteAudio.tsx:54-61`) | Mobile ships dead code; web is ahead but Chromium-only |
| Screen share | ❌ | ✅ hosts only, `useLiveRoom.ts:572-608` | Web-only, documented |
| Grid layout | ✅ sectioned Hosts/Participants, `TwilioVideoRoom.tsx:261-307` | ✅ same sections, `LiveStage.tsx:97-132` | |
| Stage / speaker view | ❌ | ✅ `LiveStage.tsx:136-171` | Web-only; default on `md`+ |
| Layout toggle | ❌ | ✅ control bar + options sheet | Web-only |
| Pin a tile | ❌ | ✅ `LiveRoom.tsx:262-276` | Web-only |
| Fullscreen one tile | ✅ per-tile button, `TwilioVideoRoom.tsx:173-178,417-419` | ⚠️ **pin-to-stage only** | No true fullscreen; the browser Fullscreen API is never called |
| Dynamic tile sizing 1/2/3-up | ✅ `TwilioVideoRoom.tsx:75-78,278-288` | ✅ `LiveStage.tsx:35-43` | Different formula, same intent |
| Participant list panel | ❌ (grid is the list) | ✅ `ParticipantsPanel.tsx` | Web-only, documented |
| Participant count in header | ✅ `TwilioVideoRoom.tsx:367-371` | ✅ `LiveHeader.tsx:56-58` | |
| Camera-off avatar/initials | ✅ `TwilioVideoRoom.tsx:148-165` | ✅ `VideoTile.tsx:107-123` | |
| Per-tile name label | ✅ first name, `TwilioVideoRoom.tsx:118` | ✅ first name, `identity.ts:37-40` | Same parser |
| Per-tile HOST badge | ⚠️ local only (`"You (Host)"`); remote tiles unbadged | ✅ every tile, `VideoTile.tsx:147-151` | |
| Per-tile mic-muted icon | ❌ | ✅ `VideoTile.tsx:143-145` | |
| Per-tile network quality | ❌ requested, never rendered (`TwilioVideoRoom.tsx:717`) | ✅ `NetworkQualityBars.tsx` | |
| Dominant-speaker highlight | ❌ requested, no handler (`TwilioVideoRoom.tsx:716`) | ✅ yellow ring, `VideoTile.tsx:79-81` | |
| Reconnecting state | ❌ no `reconnecting`/`reconnected` handlers | ✅ header + per-tile, `useLiveRoom.ts:429-433` | Mobile just drops you out |
| Chat during the live | ✅ full-screen overlay, `TwilioVideoRoom.tsx:442-505` | ✅ docked rail `lg`+, overlay below | Same Stream `livestream` channel |
| Chat unread count | ⚠️ dot when `chatMessages.length > 0` (`TwilioVideoRoom.tsx:532`) — not unread | ✅ real count, `useLiveChat.ts:255,353` | |
| Chat send failure visible | ❌ optimistic, silent on failure (`useTwilioRoom.ts:491-505`) | ✅ marked + retryable | |
| Jump-to-latest in chat | ❌ | ✅ `LiveChatPanel.tsx:197-210` | |
| Raise hand | ❌ **both** | ❌ **both** | Zero hits in either repo |
| Reactions / emoji in room | ❌ **both** | ❌ **both** | Web has chat reactions, but nothing in `components/live/**` |
| Host: mute a participant's mic | ✅ `mute_audio` | ✅ `mute_audio` | |
| Host: disable a participant's camera | ✅ `mute_video` | ✅ `mute_video` | |
| Host: remove from live | ✅ `remove` | ✅ `remove` | |
| Host: block from live | ✅ `block` | ✅ `block` | |
| Host: end live for everyone | ✅ + `Alert` confirm (`useTwilioRoom.ts:472-481`) | ✅ + `ConfirmSheet` | |
| Host: notify group members | ✅ `TwilioVideoRoom.tsx:557-578` | ✅ `LiveRoom.tsx:326-349` | Identical Lambda payload |
| Host: promote to host | ❌ **both** | ❌ **both** | `hostIds` is server-owned |
| Host: moderate another host | ❌ **both**, by design | ❌ **both**, `LiveRoom.tsx:256-260` | Matched on purpose |
| Moderation entry point | long-press a tile only (`TwilioVideoRoom.tsx:216-220`) | ✅ tile `⋯` **and** participants panel | Web-only improvement, documented |
| Moderation received: mic drops | ✅ `useTwilioRoom.ts:200-206` | ✅ `LiveRoom.tsx:171` | |
| Moderation received: camera drops | ✅ | ✅ `LiveRoom.tsx:172` | |
| Moderation notice de-duplication | ✅ 3 mechanisms (`useTwilioRoom.ts:173-198`) | ✅ same 3, ported | |
| Recording | ❌ **both** | ❌ **both** | The only "recording" string on web is prose in `useLiveRoom.ts:14` |
| Waiting room / lobby | ❌ **both** | ❌ **both** | Web's pre-join is a device check, not a moderated gate |
| Capacity limit (client-side) | ❌ **both** | ❌ **both** | Server-side only |
| Permission prompts | ✅ on first toggle, w/ settings alert (`useTwilioRoom.ts:435-439`) | ✅ on first toggle, 4 translated failure kinds (`localTracks.ts:39-67`) | Web distinguishes denied/missing/busy |
| Keep screen awake | ✅ `useKeepAwake()` | ✅ `useWakeLock.ts` | |
| Background/foreground handling | ❌ no `AppState` listener in the Twilio room | ⚠️ wake lock re-acquires on `visibilitychange`; nothing else | Neither pauses media on background |
| Blocked-user refusal (403) | ✅ `useTwilioRoom.ts:314-318` | ✅ + terminal, retry hidden | |
| Session-already-ended pre-check | ❌ | ✅ `session.ts:80-82`, `LiveRoom.tsx:149` | Web-only |
| Duplicate-identity (2nd tab) | ❌ | ✅ `useLiveRoom.ts:443-452` | Web-only |
| Autoplay-blocked recovery | ❌ n/a | ✅ banner, `LiveRoom.tsx:502-511` | Web-only |
| Error screen + retry / go back | ✅ `LiveStreamErrorScreen.tsx` | ✅ `LiveErrorScreen.tsx` | Web hides retry on terminal failures |
| Loading / "Joining …" state | ✅ `TwilioVideoRoom.tsx:354-358` | ✅ `LiveRoom.tsx:473-484` | |
| Empty stage state | ❌ (falls back to own tile) | ✅ "Waiting for others…", `LiveStage.tsx:85-93` | |

---

## Screen-by-screen inventory

### 1. Live video room

**Mobile:** `src/screens/groups/twilio-video-room/TwilioVideoRoom.tsx` (+
`useTwilioRoom.ts`, `twilio-video-room.styles.ts`) — the Twilio group room:
join, camera/mic, grid, chat, host moderation.
**Web:** `components/live/LiveRoom.tsx` and siblings, routed at
`app/(app)/live/[eventId]/page.tsx`.

| # | Mobile capability | Data source | Web status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Mint a room token, learn `isHost` / `hostIds` | `getTwilioToken` → `USERS_LAMBDA` | ✅ | `liveService.ts:95-133`, byte-identical payload |
| 2 | Room name `live-<eventId>` | derived client-side | ✅ | `session.ts:50-52` |
| 3 | Identity `"<userId>::<name>"`, `\|` fallback | token Lambda | ✅ | `identity.ts:17-34`, same parser |
| 4 | Connect with `dominantSpeakerEnabled` + network quality | Twilio SDK | ✅ | `useLiveRoom.ts:329-347`, also adds a bandwidth profile |
| 5 | Grid, hosts section first | `room.participants` | ✅ | |
| 6 | Fullscreen a single tile | local state | ⚠️ | Pin-to-stage instead; no fullscreen button, no Fullscreen API |
| 7 | Camera / mic toggles with lazy permission | `ensureAvPermission` | ✅ | |
| 8 | Speaker toggle | `toggleSoundSetup` | ⚠️ | Mobile never wires it to UI; web ships a real output picker |
| 9 | Live chat on `livestream/live-<id>` | Stream Chat | ✅ | `useLiveChat.ts` |
| 10 | Host bubble styling (white) vs own (bone) | Stream message `isHost` | ✅ | Exact colours preserved, `LiveChatPanel.tsx:47` |
| 11 | Moderation: mute/camera/remove/block | `moderateLive` → `USERS_LAMBDA` | ✅ | |
| 12 | Moderation signal handling + 3 de-dupes | Stream `message.new` | ✅ | |
| 13 | Drop a removed participant locally | client state | ✅ | `useLiveRoom.ts:238-245` |
| 14 | End live for everyone | `endLive` → `USERS_LAMBDA` | ✅ | |
| 15 | Notify group members | `notifyGroupLive` → `NOTIFICATIONS_LAMBDA` | ✅ | |
| 16 | Keep awake | `useKeepAwake` | ✅ | |
| 17 | Blocked user 403 → error screen | token Lambda | ✅ | |
| 18 | Retry a failed connection | local | ✅ | Web additionally suppresses retry on 4xx |
| 19 | Return to the group on leave | navigation stack | ✅ | `backHref`, `LiveRoom.tsx:126` |

**Missing on web**

- ❌ **A true per-tile fullscreen control.** Mobile has an explicit expand button
  on every tile (`TwilioVideoRoom.tsx:173-178`) and a dedicated fullscreen
  renderer (`:381-420`). Web's pin-to-stage keeps the filmstrip and control bar
  on screen, so it is not the same thing, and on the `grid` layout below `md`
  there is no way to make one participant large at all.
- ❌ **Room chrome is competing with the app shell.** `app/(app)/layout.tsx` and
  `components/app-shell/AppShell.tsx:41-56` render the sidebar and the bottom
  bar unconditionally; there is no pathname opt-out for `/live`. On a phone
  browser the room loses 4rem to `pb-16` (`AppShell.tsx:47`) and sits next to an
  app tab bar, where mobile gives the room the whole screen. `PushBridge` is
  also live inside the room, so an unrelated chat push toasts over the call.
- ⚠️ **No `AppState`/visibility media handling on either side**, but this bites
  harder on web: a backgrounded tab keeps publishing camera and mic.

---

### 2. Live group calendar

**Mobile:** `src/screens/groups/live-group-calendar/LiveGroupCalendar.tsx`,
rendered as the second tab of the Groups home (`screens/feeds/home.tsx:159-165`).
**Web:** `components/groups/LiveCalendar.tsx`, routed at
`app/(app)/groups/calendar/page.tsx`.

| # | Mobile capability | Data source | Web status | Notes |
| --- | --- | --- | --- | --- |
| 1 | List every scheduled session | `getLiveCalendar` → `USERS_LAMBDA` | ✅ | `liveGroups.ts:39-46`, same Lambda |
| 2 | Two-month window (this + next) | client | ✅ | `liveGroups.ts:112-133`, same logic |
| 3 | Month headers | client | ✅ | |
| 4 | Split "YOUR GROUPS" / "MORE GROUP OPTIONS" | membership | ✅ | `liveGroups.ts:158-162` |
| 5 | Hide private groups the user isn't in | `getGroupById().isPublic` | ✅ | `liveGroups.ts:55-83`, ported faithfully |
| 6 | Hide `active === false` and `archived` rows | client filter, `LiveGroupCalendar.tsx:192-194` | ❌ | **Not implemented on web** — see below |
| 7 | `LIVE` status badge | `event.status` | ✅ | Web keys off `inLive` instead |
| 8 | `ENDED` status badge | `event.status === 'ended'` | ❌ | Web renders only LIVE / UPCOMING |
| 9 | Date + time range on each card | client | ✅ | `formatEventWhen`, same format |
| 10 | Group name on each card | Lambda row | ✅ | |
| 11 | Session title on each card | Lambda row | ✅ | Mobile swaps the two visually (`LiveGroupCalendar.tsx:151,155` puts `groupName` in the title slot); web puts the title first, which is the sane reading |
| 12 | Description on the card | Lambda row | ✅ | Web-only addition |
| 13 | Tap a row → join the room | navigation | ⚠️ | Web links to the room **only while a session is live**; otherwise to the group. Deliberate (`docs/LIVE.md:160`) |
| 14 | Loading state | `<Loader/>` | ✅ | Skeleton cards |
| 15 | Empty state | text | ✅ | Title + subtitle |
| 16 | Error state | toast | ✅ | Web shows an inline error card + retry, better than a toast |
| 17 | Month / week grid views | — | ❌ **both** | Both are month-grouped lists only |
| 18 | Event detail screen | — | ❌ **both** | Tapping joins or navigates; there is no detail view |
| 19 | RSVP / "interested" | — | ❌ **both** | Zero hits in either repo |
| 20 | Host profile link from an event | — | ❌ **both** | |
| 21 | Countdown / "starts in" | — | ❌ **both** | |
| 22 | Replay / VOD of a past session | — | ❌ **both** | Nothing records |

**Missing on web**

- ❌ **Hidden and archived sessions leak onto the calendar.** Mobile filters
  before rendering:

  ```js
  // LiveGroupCalendar.tsx:192-194
  const visible = events.filter(e => e.active !== false && !e.archived);
  ```

  On web, `fetchLiveCalendar` filters only `e?.id && e?.scheduledAt`
  (`lib/groups/liveGroups.ts:45`), and neither `filterCalendarForPrivacy` nor
  `buildCalendarMonths` looks at those fields. The `LiveCalendarEvent` interface
  (`lib/groups/types.ts:73-88`) **does not even declare `active` or `archived`**,
  so the data is discarded at the type boundary. A host who toggles "Active
  session" off in `/profile/lives` still has that session advertised to every
  member on the web calendar. This is a privacy-adjacent regression, not
  cosmetic.
- ❌ **No `ENDED` badge.** Mobile's `StatusBadge`
  (`LiveGroupCalendar.tsx:119-136`) renders a grey `ENDED` pill. Web's row shows
  `LIVE` or `UPCOMING` only, so a finished session in the current month reads as
  upcoming.

---

### 3. LIVE badges elsewhere in the app

**Mobile:** `src/screens/feeds/home.tsx:44-86` + `layouts/Groups/GroupsList.tsx`.
**Web:** `lib/groups/GroupsProvider.tsx` consumed by `GroupsSidebar.tsx`,
`GroupFeed.tsx`, `LiveCalendar.tsx`.

| # | Mobile capability | Data source | Web status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Query which groups are live | `listLiveStreamingGroups(filter: {inLive: {eq: true}}, limit: N)` — `graphql/queries/live-groups.ts:5` | ❌ | **Web drops the filter and the limit** — see below |
| 2 | Refresh badges in real time | AppSync subscription `onCreateLiveStreamingGroupCustom` | ✅ | `GroupsProvider.tsx:35-43,136-165`, same subscription, used as a refetch trigger |
| 3 | Restrict badges to the user's own groups | `home.tsx:83-86` | ❌ | Web badges any group, including ones the user isn't in |
| 4 | LIVE pill on a group row | client | ✅ | `GroupsSidebar.tsx:147,156-166`, `GroupFeed.tsx:383-387` |
| 5 | Sort live groups to the top | `GroupsList.tsx:58-65` | ✅ | Sidebar splits into live / rest |
| 6 | Tapping a live group offers "Join Live Call" vs "View group posts" | `ModalStreaming` — `GroupsList.tsx:87-101` | ⚠️ | Web has a "Join live" button in the group header instead (`GroupFeed.tsx:396-404`); no chooser sheet, and the button only appears **after** opening the group |
| 7 | Subscription error surfaces | silent | ✅ | Also silent on web (`GroupsProvider.tsx:158-160`) — matched |

**Missing on web**

- ❌ **The LIVE badge query is missing its filter, so almost every group shows as
  live.** Mobile:

  ```graphql
  # cancerbuddyapp/src/graphql/queries/live-groups.ts:5
  listLiveStreamingGroups(filter: { inLive: { eq: true } }, limit: ${resultLimit})
  ```

  Web (`lib/groups/groupQueries.ts:126-136`):

  ```graphql
  listLiveStreamingGroups {
    items { id  groupId  inLive }
  }
  ```

  No `filter`, no `limit`. `liveGroupIds` then treats every returned row as live
  (`GroupsProvider.tsx:215-218`) — it selects `inLive` and never tests it:

  ```ts
  const liveGroupIds = useMemo(
    () => new Set(liveGroups.filter((g) => g.groupId).map((g) => g.groupId)),
    [liveGroups],
  );
  ```

  Consequences, all of which are user-visible:
  1. Every group with **any** `LiveStreamingGroup` row — i.e. any group that has
     ever had a session scheduled — wears a permanent red LIVE pill in the
     sidebar and in the group header.
  2. `GroupFeed` shows a permanent "Join live" button
     (`GroupFeed.tsx:396-404`), which sends members into a room the token Lambda
     will refuse.
  3. `liveEventIdFor` is first-wins over an unordered list
     (`GroupsProvider.tsx:220-231`), so even when a group genuinely *is* live,
     the id handed to `/live/[eventId]` may be a different, unrelated session.
  4. `LiveCalendar.tsx:210-215` falls back to `liveEventIdFor(event.groupId)`
     whenever `event.inLive !== true`, so calendar rows inherit the same wrong
     id.
  5. Without `limit`, the query is unbounded where mobile caps it.

  Note `docs/LIVE.md:31-33` already states the intended contract — "`inLive` on
  that row is what turns the LIVE badges on across the app" — so this is an
  implementation slip against the repo's own documentation, not a design choice.
- ❌ **Badges are not scoped to the user's groups.** Mobile narrows to joined
  groups before badging (`home.tsx:83-86`); web does not.
- ⚠️ **No "Join Live Call / View group posts" chooser.** Mobile intercepts the
  tap on a live group row with `ModalStreaming`
  (`layouts/Groups/ModalStreaming.tsx`) so joining the call is one tap from the
  list. On web you must open the group first, then find the header button.

---

### 4. Push notification → live room

**Mobile:** `src/context/push-notification/push-notification.provider.tsx`.
**Web:** `— none —` (`public/firebase-messaging-sw.js`, `lib/push/pushClient.ts`,
`components/push/PushBridge.tsx` have no live branch).

| # | Mobile capability | Data source | Web status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Extract `eventId`/`groupId`/`chatChannelId` from the payload | `extractLiveParams`, `:69-81` | ❌ | |
| 2 | Warm-start: nested navigate into the room | `:352-362` | ❌ | |
| 3 | Cold-start: atomic `CommonActions.reset` into the room | `buildLiveDeepLinkState`, `:45-67` | ❌ | |
| 4 | Fallback to the Live tab when params are missing | `:342-346` | ❌ | n/a — no Live tab on web |
| 5 | De-duplicate by `eventId` | `:371-377` | ❌ | |
| 6 | Sensible back-target after deep link | `:41-43` | ❌ | |

**Missing on web**

- ❌ **The entire live deep-link.** `firebase-messaging-sw.js:76-91` routes
  `channel_type === "messaging"` to `/chat/{id}` and **everything else to
  `/groups`**, with no read of `eventId`. `lib/push/pushClient.ts` never carries
  an event id (`ForegroundPush` is `title`/`body`/`path`/`channelId`), and
  `PushBridge.tsx:49-62` just pushes `push.path`.
- ❌ The asymmetry is the sharp edge: `LiveRoom.tsx:326-349` lets a web host fire
  `notifyGroupLive`, so the web app **sends** the push that mobile deep-links
  from and then strands its own web recipients on `/groups` with no indication
  which group went live. This is documented as intentional in `docs/PUSH.md:249`
  but predates the live room existing; it is worth re-deciding.
- ❌ No live case in the in-app Updates tab either — `lib/notifications/routing.ts:41-85`
  handles `MESSAGE`, `NEWUSER`, `FRIEND_REQUEST`, `BUDDY`, `POST`, `COMMENT`,
  `REPLY`, `LIKE`, and `NotificationKind` (`lib/notifications/types.ts:33-41`)
  has no live member.

---

### 5. Manage lives — host scheduling

**Mobile:** `src/screens/profile/manage-lives/ManageLives.tsx`,
`ManageLivesCreate.tsx`, `ManageLivesDetail.tsx` (three screens), entered from
`screens/profile/homeProfile/HomeProfile.tsx:120-131`.
**Web:** `components/profile/ManageLivesScreen.tsx` at `/profile/lives` (one
screen, list + side editor).

Scoped here to the **lifecycle** only; the profile agent owns the form details.

| # | Mobile capability | Data source | Web status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Entry gated on `userType === HOST` | `HomeProfile.tsx:120` | ✅ | `ManageLivesScreen.tsx:94,228` |
| 2 | Resolve the host's group via `User.groupHostId` | AppSync | ✅ | `manageLives.ts:116-121` |
| 3 | List sessions for that group | `listLiveStreamingGroups(filter groupId)` | ✅ | Same selection set |
| 4 | Drop `status === 'ended'` and archived | client | ✅ | `manageLives.ts:135` |
| 5 | Active / Hidden tabs with counts | client | ⚠️ | Web hides the filter entirely when `hiddenCount === 0` (`ManageLivesScreen.tsx:285`); mobile always shows both tabs with counts |
| 6 | Status pill LIVE NOW / SCHEDULED / ENDED | `inLive`, `status` | ⚠️ | Web renders LIVE / HIDDEN / SCHEDULED — no ENDED (ended rows are filtered out on both, so this is cosmetic) |
| 7 | Create a session | `createLive` → `USERS_LAMBDA` | ✅ | Same Lambda, same payload |
| 8 | Edit title/description/schedule/duration | `updateLiveStreamingGroup` | ✅ | |
| 9 | Toggle `active` (hide from members) | `updateLiveStreamingGroup` | ✅ | Switch on mobile, checkbox on web |
| 10 | Delete a session, with confirm | `deleteLiveStreamingGroup` | ✅ | `ConfirmSheet` |
| 11 | Date picker with `minimumDate = now` | `LiveScheduleField.tsx:111` | ❌ | Web uses a bare `<input type="datetime-local">` with no `min` |
| 12 | Date picker with `maximumDate = +1 year` | `LiveScheduleField.tsx:57-62,112` | ❌ | No `max` on web |
| 13 | Time picker in 15-minute steps | `minuteInterval={15}` — `:346,384` | ❌ | No `step` on web |
| 14 | Duration chips 15/30/45/60/90/120 | `DEFAULT_DURATION_OPTIONS:34-41` | ✅ | Identical set (`ManageLivesScreen.tsx:38`) |
| 15 | "Ends at HH:MM" live preview | `LiveScheduleField.tsx:174-185` | ❌ | Not rendered on web |
| 16 | Pull-to-refresh the list | `RefreshControl` — `ManageLives.tsx:234-239` | ❌ | Web reloads only after a save |
| 17 | Created / last-updated timestamps on detail | `ManageLivesDetail.tsx:259-260,441-449` | ❌ | Not shown on web |
| 18 | Re-fetch the session fresh on open | `ManageLivesDetail.tsx:113-134` | ⚠️ | Web opens the editor from the list row it already has (`fetchLiveSession` exists in `manageLives.ts:142-147` but is never called) |
| 19 | Open the room for a session you scheduled | — | ❌ **both**, but see below | |

**Missing on web**

- ❌ **A host cannot join their own session from `/profile/lives`.** The screen
  renders a `liveNow` pill (`ManageLivesScreen.tsx:45-52`) and then offers no
  link to `/live/{id}`. Its only navigations are to `/profile`. Mobile is no
  better here, but mobile hosts have the `ModalStreaming` path from the group
  list; on web the host has to go to `/groups`, open the group, and rely on the
  header button — which, per §3, currently appears whether or not anything is
  live.
- ❌ Schedule guard rails: no `min`, no `max`, no 15-minute step, no "Ends at"
  preview. All four exist in `LiveScheduleField.tsx` on mobile. A web host can
  schedule a session in 1998.
- ❌ No pull-to-refresh / manual refresh. A session that goes live while the
  screen is open never updates its pill.
- ⚠️ Stale documentation in two files that now contradicts the shipped app:
  `lib/profile/manageLives.ts:10` — "Joining the video itself is not part of the
  web app" — and `lib/groups/liveGroups.ts:5-6` — "Joining the video room itself
  is deliberately not implemented here". Both predate `/live/[eventId]` and will
  mislead the next reader.

---

### 6. AWS IVS broadcast (mobile-only, dead)

**Mobile:** `src/screens/streaming/HomeStreaming.tsx`,
`src/components/layouts/Streaming/**`, `src/services/streaming/streaming.ts`,
`src/context/live-streaming/**`.
**Web:** `— none —`

| # | Mobile capability | Data source | Web status | Notes |
| --- | --- | --- | --- | --- |
| 1 | One-tap "START LIVE video" ad-hoc broadcast | `startStreaming` → `LIVE_STREAM_LAMBDA` | ❌ | Unreachable on mobile — tab hidden |
| 2 | Host-only: find the group you host | `GET_MAIN_USER_DATA` + joined groups | ❌ | Unreachable |
| 3 | Block iPhone SE with an explainer modal | `isIphoneSE()` — `HomeStreaming.tsx:29-37` | ❌ | Unreachable; irrelevant on web |
| 4 | GO LIVE / END with an elapsed timer | `useTimer` | ❌ | Unreachable; stub |
| 5 | Auto-end the broadcast on backgrounding | `AppState` — `HeaderVideoControlsHost.tsx:50-60` | ❌ | Unreachable; stub |
| 6 | Post "I'm live" to the group feed | `addActivityUser` — `:154` | ❌ | Unreachable |
| 7 | Draggable picture-in-picture video | `VideoLayout.tsx` `PanResponder` | ❌ | Unreachable; renders a black box |
| 8 | Viewer: floating comments over the video | `FloatComments` | ❌ | Unreachable; `messages` is always `[]` |
| 9 | Viewer: "View group posts" / "Exit Live Group" sheet | `HeaderVideoControlViewer.tsx:86-121` | ❌ | Unreachable |

**Missing on web** — nothing that should be built. Every row above is dead code
behind a disabled tab. **Not porting this is the correct decision** and should
be recorded as such so a future audit doesn't reopen it.

The one idea worth salvaging: rows 1 and 6 describe an **ad-hoc "go live now"**
flow that needs no pre-scheduled event. Neither platform has a working version
today — both now require a `LiveStreamingGroup` row to exist first. That is a
product gap on *both* platforms, not a web regression.

---

## Live event lifecycle (create → schedule → notify → join → end → replay)

| Step | Mobile | Web | Verdict |
| --- | --- | --- | --- |
| **1. Create** | Host taps `+` on `ManageLives` → `ManageLivesCreate` → `createLiveSession` (`services/streaming/live-groups.ts:59-86`) → `createLive` on `USERS_LAMBDA`. The Lambda provisions the Twilio room `live-<liveId>`, the Stream `livestream` channel `live-<liveId>`, and the DynamoDB row in one step. | `/profile/lives` → side editor → `createLiveSession` (`lib/profile/manageLives.ts:163-186`) → **same Lambda, same payload**. | ✅ parity |
| **2. Schedule** | `LiveScheduleField` — separate date and time pickers, `min = now`, `max = +1 year`, 15-minute steps, duration chips, "Ends at" preview. | One `<input type="datetime-local">` + duration chips. | ⚠️ four guard rails lost (see §5, rows 11-15) |
| **3. Publish to members** | Row appears on the Groups-home calendar tab once `active !== false && !archived`. | Row appears at `/groups/calendar` — **but `active`/`archived` are never checked**, so hidden sessions publish too. | ❌ regression (§2 row 6) |
| **4. Discover it's happening** | AppSync subscription refreshes `listLiveStreamingGroups(filter: inLive eq true)`; LIVE pill on the group row; tap → `ModalStreaming` → room. | Same subscription, but the query has **no `inLive` filter**, so pills and "Join live" buttons appear for groups that aren't live. | ❌ regression (§3 row 1) |
| **5. Notify** | Host in the room → options sheet → `notifyGroupLive` → `NOTIFICATIONS_LAMBDA` → FCM to every member. | Identical call from `LiveRoom.tsx:326-349`. | ✅ send parity |
| **5b. Receive the notification** | Push tapped → warm or cold-start deep link straight into `TwilioVideoRoom` with `eventId`, `groupId`, `chatChannelId`. | Push tapped → **`/groups`**. `firebase-messaging-sw.js:76-91` has no live branch. | ❌ missing entirely |
| **6. Join** | Tap → straight into the room; permissions requested lazily on the first camera/mic toggle. | `/live/[eventId]` → session fetched by id → ended-check → pre-join device screen → join. | ✅ + web-only hardening |
| **6b. Who is a host** | `getTwilioToken` returns `isHost` + `hostIds`; the client never decides. | Identical. | ✅ parity |
| **7. In session** | See the in-room matrix. | See the in-room matrix. | ✅ web ahead |
| **8. Moderate** | Long-press → sheet → `moderateLive`; the Lambda enforces and writes a signal onto the Stream channel; the target's client reacts. | Tile `⋯` or participants panel → same Lambda, same two-channel mechanism, same three de-duplications. | ✅ parity, better entry points |
| **9. End** | Host → "End Live for Everyone" → `Alert` confirm → `endLive` → disconnect → back. | Options sheet → `ConfirmSheet` → `endLive` → disconnect → `/groups/{groupId}`. | ✅ parity |
| **9b. Others learn it ended** | Twilio disconnects them; `onRoomDidDisconnect` calls `goBack()` with no explanation. | `onDisconnected` distinguishes clean vs error and shows "the session ended" or a duplicate-identity notice. | ✅ web ahead |
| **10. After it ends** | The row keeps `status: 'ended'`; the calendar shows a grey `ENDED` badge; `ManageLives` filters it out. | The row is filtered out of `/profile/lives`; the calendar shows **no ended state**; `hasSessionEnded` blocks re-entry to the room. | ⚠️ calendar gap only |
| **11. Replay / VOD** | ❌ nothing is recorded | ❌ nothing is recorded | ❌ **both** — no recording exists anywhere in either codebase |

---

## Cross-screen gaps

Ordered by how much damage each one does.

1. ❌ **`LIST_LIVE_GROUPS` is missing `filter: { inLive: { eq: true } }` and
   `limit`.** `lib/groups/groupQueries.ts:126-136` vs
   `cancerbuddyapp/src/graphql/queries/live-groups.ts:5`. Every group that has
   ever had a session scheduled shows a permanent LIVE pill and a permanent
   "Join live" button, and `liveEventIdFor` hands out an arbitrary event id. Fix
   the query, and separately make `liveGroupIds` test `inLive` so a schema change
   can't silently reintroduce this (`GroupsProvider.tsx:215-218`).

2. ❌ **The calendar publishes sessions the host hid.** `active` and `archived`
   are dropped at the type boundary (`lib/groups/types.ts:73-88`) and never
   filtered (`lib/groups/liveGroups.ts:45`). Mobile filters at
   `LiveGroupCalendar.tsx:192-194`. Add both fields to `LiveCalendarEvent` and
   apply the same predicate.

3. ❌ **No push deep-link into the live room.** `firebase-messaging-sw.js:76-91`
   routes every non-`messaging` push to `/groups`. Web hosts can fire
   `notifyGroupLive`, so the app produces a notification it cannot act on. At
   minimum route a live payload to `/live/{eventId}`; at minimum-minimum route it
   to `/groups/{groupId}` so the recipient lands somewhere relevant.

4. ❌ **LIVE badges are not scoped to the user's own groups.** Mobile narrows to
   joined groups (`screens/feeds/home.tsx:83-86`) before badging anything.

5. ❌ **Hosts have no route into their own session.** `/profile/lives` shows a
   `LIVE NOW` pill and no link. Add `/live/{session.id}` to the row when
   `inLive` is true.

6. ❌ **The live room renders inside the full app shell.** Sidebar and bottom bar
   are always present (`components/app-shell/AppShell.tsx:41-56`), `<main>`
   keeps `pb-16` on mobile (`:47`), and `PushBridge` toasts over the call. There
   is no pathname opt-out for `/live`. Mobile gives the room the whole screen.

7. ❌ **Scheduling has no date/time guard rails** — no `min`, no `max`, no
   15-minute step, no "Ends at" preview. All four exist in mobile's
   `LiveScheduleField.tsx`.

8. ❌ **No `ENDED` state on the calendar.** Mobile's `StatusBadge`
   (`LiveGroupCalendar.tsx:119-136`) has one; web has LIVE / UPCOMING only, so a
   finished session earlier this month reads as upcoming.

9. ⚠️ **No per-tile fullscreen in the room.** Pin-to-stage is not equivalent, and
   below `md` (grid-only) there is no way to enlarge one participant at all.
   Mobile: `TwilioVideoRoom.tsx:173-178,381-420`.

10. ⚠️ **No "Join Live Call" chooser from a group row.** Mobile intercepts the tap
    with `ModalStreaming` so joining is one tap from the list; web requires
    opening the group first.

11. ⚠️ **`GroupsProvider` is scoped to `/groups/*` only**
    (`app/(app)/groups/layout.tsx:19`), so the live-badge subscription tears down
    the moment someone enters the room, and `LiveRoom` re-fetches the session
    itself. Correct today, but it means nothing in the room knows about sibling
    live sessions, and returning from a call re-runs the whole groups bootstrap.

12. ⚠️ **Two stale doc comments claim the live room doesn't exist on web** —
    `lib/profile/manageLives.ts:10` and `lib/groups/liveGroups.ts:5-6`. Both
    predate `/live/[eventId]`.

13. ⚠️ **No `Active`/`Hidden` tab when nothing is hidden** on `/profile/lives`
    (`ManageLivesScreen.tsx:285`); mobile always shows both with counts, so the
    concept of hiding a session is discoverable there and not here.

14. ⚠️ **Neither platform pauses media on background.** Web's wake lock
    re-acquires on `visibilitychange` (`lib/live/useWakeLock.ts:33-40`) but a
    backgrounded tab keeps publishing camera and microphone. Mobile's Twilio room
    has no `AppState` listener either (the dead IVS screen did —
    `HeaderVideoControlsHost.tsx:50-60`).

15. ❌ **Both platforms: no ad-hoc "go live now".** A session must be scheduled
    first. Mobile's IVS tab was the ad-hoc path and is disabled. Worth raising as
    a product question rather than a web bug.

16. ❌ **Both platforms: no recording, replay/VOD, RSVP, raise hand, in-room
    reactions, waiting room, promote-to-host, capacity limit, event detail
    screen, host profile link from an event, countdown/"starts in", or month/week
    calendar views.** Verified absent in both repos by name in every plausible
    spelling. None of these are web regressions.
