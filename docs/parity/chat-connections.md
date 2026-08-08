# Chat & Buddy Connections — mobile vs web parity

Source of truth: `~/cancerbuddyapp` (React Native), read 2026-08-07.
Target: `~/cancerbuddy-web` (Next.js App Router), same date.

Scope: the chat/messaging surface reachable from Buddies, Groups, Updates and
Profile, plus the buddy-connection state machine (send / accept / decline /
cancel / remove / block+report). The Buddies discovery list and its filters are
audited separately.

---

## Summary

The web chat is a **hand-written client on the raw `stream-chat` JS SDK**; mobile
is `stream-chat-react-native` with a fully custom `Message` renderer plugged into
the library's `Channel` / `MessageList` / `ChannelList`. That single architectural
difference explains most of what follows: the web had to reimplement everything
the RN library gives for free (and in several places did it *better* — read
receipts, per-message timestamps, send status, retry, message-body search), while
the RN app gets library chrome the web never built (scroll-to-bottom button,
in-thread unread separator).

The real gaps are not in text messaging — that is close to parity, and in a few
places the web is ahead. They are in three clusters:

1. **Rich media.** Web can send images and documents only. No video, no camera,
   no compression, no size guard, no lightbox, no inline video player, no in-app
   PDF viewer.
2. **Product-specific message types.** Mobile's `AskToHost` and `ReplyHost`
   attachments render as interactive group/post cards with a "GO TO GROUP" /
   "GO TO COMMENT" button, and the three flows that *create* those messages
   (private-group access request, reply-to-host from a post, ambassador intro)
   pre-fill the composer. None of this exists on web — such a message renders as
   bare text with the card silently dropped.
3. **Connection-state liveness and the pending affordance.** Mobile subscribes to
   `onUpdateConnection` / `onDeleteConnection` so a "Pending" button flips to
   "Connected" the moment the other side accepts; web subscribes only to
   `onCreateConnectionByRecipientId`. And mobile's Pending button opens a modal
   ("GOT IT" / "CANCEL REQUEST" → confirm), where web withdraws on a single
   unconfirmed click.

Two other things worth knowing before reading the tables:

* **The Support-channel bootstrap does not exist on web.** Mobile's chat list
  reads a `pendingSupportChannel` flag on entry and, if set, runs
  `CREATE_SUPPORT_CONNECTION` → `createConnection` → `AcceptConnection` →
  `channel.watch()` → `CREATE_SUPPORT_MESSAGE`. The web signup flow *sets* that
  flag (`lib/user-signup/userEnrollmentFinalize.ts:88`,
  `lib/host-signup/hostEnrollmentFinalize.ts:50`) and explicitly leaves the retry
  to mobile. A member who signs up on the web and never opens the app gets no
  Support conversation.
* **Six of the shared components named in the audit brief are not used by chat at
  all** and are therefore out of scope: `msg-send` (group post comments + live
  chat), `emojis` (the Goal picker), `format-toolbar` (post composer), `swipeable`
  (the Recommended buddies list), `read-more-action` (post fragment), `message`
  (dead — nothing imports it). Only `msg-advice`, `typing-animation` and
  `pdf-attachment` are chat components.

**Counts (web-side classifications only — ❌/⚠️ appearing in a Mobile column, or
in the `—` "neither app" rows, are not counted): 40 ❌ MISSING, 23 ⚠️ PARTIAL.**

---

## Chat capability matrix

Legend for the Web column: ✅ present · ⚠️ partial · ❌ missing · `—` not in
either app (listed so the gap is provably absent, not overlooked).

### Client & session

| # | Capability | Mobile | Web | Notes |
|---|---|---|---|---|
| 1 | Stream client connect with a token from the GetStream Lambda | ✅ `ChatProviderLayout.tsx:44-51` | ✅ | `lib/chat/streamToken.ts` calls the same `LOGIN` Lambda. Web reads the API key from `NEXT_PUBLIC_GETSTREAM_API_KEY`; mobile from bundled config. |
| 2 | Singleton client / no duplicate connect | ✅ `isConnectingRef` guard | ✅ | `lib/chat/streamClient.ts` shares an in-flight `connectPromise`. |
| 3 | Auto-retry on connect failure | ✅ 3 attempts, exponential backoff (`ChatProviderLayout.tsx:54-64`) | ⚠️ | Web fails to `status: "error"` after one attempt (15 s timeout) and offers a manual **Retry** button. No automatic backoff. |
| 4 | "Client ready" gate before any query | ✅ `isClientReady = client?.userID === id` | ✅ | `status === "ready"` in `StreamChatProvider`. |
| 5 | Disconnect on logout | ✅ only when switching user | ✅ | `disconnectStream()`. |
| 6 | Total unread → nav badge | ✅ boolean `hasUnreadMessages` + `count` | ✅ | Web is richer: numeric `totalUnread` → `AppShell.tsx:38`. |
| 7 | Analytics on first connect / first message / time-to-send | ✅ `connectWithFirstBuddy`, `chatWithFirstBuddy`, `timeToSendMessage` | ❌ | No `emitEvent` equivalent anywhere in the web chat. |

### Conversation list

| # | Capability | Mobile | Web | Notes |
|---|---|---|---|---|
| 8 | List of the user's 1:1 `messaging` channels | ✅ `HomeBuddies.tsx:400` `<ChannelList>` | ✅ | `lib/chat/useChannelList.ts`. |
| 9 | Pagination / infinite scroll | ✅ library, 30/page | ✅ | Web: 30/page, hard-capped at Stream's offset limit of 1000. |
| 10 | Sort order | ✅ `sort: { has_unread: -1 }` — unread conversations float to the top | ⚠️ | Web sorts strictly by latest non-deleted message (`channelSortTs`). An unread conversation from last week stays buried. Deliberate per the comment at `useChannelList.ts:165`, but it *is* a behaviour divergence. |
| 11 | Avatar photo (from AppSync `getUser` + S3, not Stream) | ✅ `ChatListMessagesPreview.tsx:47-97` | ✅ | `lib/chat/contactProfile.ts`, same query shape, same per-user cache. |
| 12 | Goal image overlaid on the avatar | ✅ | ✅ | `ChatAvatar.tsx` `icon` prop. |
| 13 | Support "verified" badge | ✅ | ✅ | |
| 14 | Ambassador badge | ✅ | ✅ | |
| 15 | Host badge | ✅ | ⚠️ | Detection differs. Mobile: `isHost = !!user.groupHostId`. Web: `isHost = userType === "HOST"` (`contactProfile.ts:92`). A host whose `userType` is `PATIENT` but who has a `groupHostId` shows the pill on mobile and not on web. |
| 16 | Name = other member (1:1) / channel name (group) | ✅ `getNameChannelUtil` | ✅ | `channelDisplay()`. |
| 17 | Last-message preview | ✅ first line, or first 20 chars + `" ... "` | ⚠️ | Web uses CSS truncation (width-dependent, not char-count) and prefixes `"You: "` when the last message is yours — a web-only addition. |
| 18 | "You're connected! Tap to chat." fallback preview | ✅ | ✅ | `en.ts` `app.chat.connected`, identical copy. |
| 19 | Per-row unread count badge | ✅ | ✅ | Web caps at `99+`. |
| 20 | Unread row emphasis | ✅ bolds the preview text | ✅ | Web bolds the timestamp and darkens the preview. |
| 21 | Relative timestamp | ✅ `formateDateChat` | ✅ | Web: today → clock, ≤6 days → weekday, else `Mar 4`. |
| 22 | "NEW" chip when the channel has no messages | ✅ | ✅ | |
| 23 | Frozen channel visually dimmed | ✅ | ✅ | `opacity-60`. |
| 24 | Frozen channel not openable | ✅ `onPress={() => !frozen && redirect()}` (`ChatListMessagesPreview.tsx:170`) | ❌ | Web row stays a live `<Link>`. You can open a frozen conversation. |
| 25 | Search by channel name (`$autocomplete`) | ✅ branch A | ✅ | |
| 26 | Search by participant name across the user directory | ✅ 1 page × 100 users | ✅ | Web paginates 3 × 100 (`MAX_USER_PAGES`). |
| 27 | Search by **message body** | ❌ | ✅ | Web-only branch C: `client.search()` (`useConversationSearch.ts:151`). |
| 28 | Search paginates every result page | ✅ `fetchAllChannelPages` | ✅ | Ported 1:1. |
| 29 | Local fallback when server search fails | ✅ | ✅ | |
| 30 | Search debounce / min chars | ✅ 500 ms / 2 | ✅ | Web 350 ms / 2. |
| 31 | Instant local matches shown while the server search is in flight | ❌ | ✅ | Web-only (`ConversationList.tsx:46`). |
| 32 | "Unread only" filter | ❌ | ✅ | Web-only (`useUnreadChannels.ts`). |
| 33 | List skeleton while loading | ✅ `skeleton-chat.tsx` | ✅ | |
| 34 | List empty state | ✅ GIF + `Hi {name}! Your buddies will appear here.` + **Find new buddies** CTA (`ChatListEmptyState.tsx`) | ⚠️ | Web is text-only ("No conversations yet" / sub-line). No illustration, no name interpolation, **no CTA into discovery**. |
| 35 | List error state + retry | ❌ (mobile renders `NotFoundLayout('')`) | ✅ | Web-only. |
| 36 | Live list updates (new channel / new message / channel deleted) | ✅ | ✅ | Web handles `notification.added_to_channel`, `notification.message_new`, `channel.visible`, `channel.deleted`, `channel.hidden`, `notification.removed_from_channel`. |
| 37 | Auto-create the **Support** channel on first list visit | ✅ `HomeBuddies.tsx:138-235` (`pendingSupportChannel` → `CREATE_SUPPORT_CONNECTION` → create+accept connection → `channel.watch()` → `CREATE_SUPPORT_MESSAGE`) | ❌ | Not implemented on web. The web signup flow sets the flag and defers to mobile. |
| 38 | Phone-verification modal gate on the chat list | ✅ `HomeBuddies.tsx:117-136` | ❌ | Web never prompts for a missing phone number here. |

### Conversation / thread

| # | Capability | Mobile | Web | Notes |
|---|---|---|---|---|
| 39 | Open a channel by id | ✅ `useStream().getChannel` | ✅ | `/chat/[channelId]`. |
| 40 | Channel fetch retry + fallback | ✅ 2 retries, then `client.channel(...).watch()` fallback (`useStreamChat.ts:25-51`) | ⚠️ | Web does one `channel(...).watch()` with no retry (`useChannelMessages.ts:118-133`). |
| 41 | Thread loading skeleton | ✅ `skeleton-chat-messages.tsx` | ✅ | `ThreadSkeleton`. |
| 42 | Thread error state | ✅ "Unable to load chat" + sub-line + **Retry** button (`ChatScreen.tsx:44-54`) | ⚠️ | Web shows the message with no retry action. |
| 43 | Header: avatar + name | ✅ | ✅ | |
| 44 | Header: role badges | ✅ | ✅ | |
| 45 | **Header tap → the contact's profile** | ✅ `redirectToProfile` → `UserInfo` (`ChatMessagesHeader.tsx:90-104`) | ❌ | The web header name/avatar is not a link. There is no way to reach `/buddies/{id}` from inside a conversation. |
| 46 | Header: back | ✅ context-aware (`ReplyHost` → feed, `ListNotifications` → updates, else `goBack`) | ⚠️ | Web always returns to `/chat`, and only below `lg` (desktop keeps the two-pane view). |
| 47 | Overflow menu hidden for Support / Host contacts | ✅ | ✅ | `ChatHeader.tsx:31`. |
| 48 | Overflow menu disabled when the channel is frozen | ✅ `disabled={channel.data?.frozen}` | ❌ | Web leaves Remove / Block & report enabled on a frozen channel. |
| 49 | Typing indicator | ✅ animated three-dot bubble at the top of the message list | ⚠️ | Web shows dots + the word "typing…" in the **header**, not in the thread. Same information, different placement. |
| 50 | `keystroke()` sent while typing | ✅ | ✅ | |
| 51 | `stopTyping()` on send | ❌ | ✅ | Web-only. |
| 52 | Per-message timestamp | ❌ — the custom `Message` renderer prints no time at all | ✅ | Web-only. |
| 53 | Date separators | ✅ `MM/DD/YYYY` pill (`ChatMessagesLayout.tsx:27-37`) | ✅ | Web uses "Today" / "Yesterday" / "Mar 4". |
| 54 | Read receipt on your last sent message | ❌ | ✅ | Web-only: `otherLastReadAt` → "Read". |
| 55 | Sending / failed delivery state | ❌ | ✅ | Web-only. |
| 56 | Retry a failed send | ❌ | ✅ | Web-only. |
| 57 | Optimistic send (bubble appears before the round trip) | ❌ | ✅ | Web-only. |
| 58 | `markRead` on open and on incoming message | ✅ (library) | ✅ | Web calls it explicitly. |
| 59 | Load older messages | ✅ (library) | ✅ | Web: `id_lt` query on scroll-to-top. |
| 60 | Scroll position preserved when older messages prepend | ✅ (library) | ✅ | `MessageThread.tsx:48-58`. |
| 61 | Auto-scroll to newest | ✅ | ✅ | Web pins only when already near the bottom. |
| 62 | Jump-to-latest / scroll-to-bottom button | ✅ `stream-chat-react-native` `MessageList` default, not overridden | ❌ | Web has no button. |
| 63 | In-thread "unread messages" separator | ✅ library default, not overridden | ❌ | |
| 64 | Empty-thread medical-advice notice | ✅ `MsgAdvice` — lightbulb icon + tinted card (`ChatMessagesEmpty.tsx`) | ⚠️ | Web has the **identical copy** (`en.ts` `app.chat.disclaimer`) but renders it as plain grey centred text under "Say hello 👋" — no icon, no card. |
| 65 | `ReplyHost` variant of the empty-thread copy | ✅ (shorter sentence, no medical-advice line) | ❌ | |
| 66 | Rich-text / stored-HTML message rendering | ✅ `RenderHtml` when `message.html` contains anchors | ❌ | Web renders `message.text` only. Any message whose body lives in `html` and not `text` renders **blank** on web (`useChannelMessages.ts:333` filters out messages with no text and no attachments). |
| 67 | Auto-linkify bare URLs in message text | ✅ `linkifyText` (`utils/urls.ts:71`) | ✅ | Web `LinkifiedText`, same `https?://` + `www.` pattern, plus trailing-punctuation trimming. |
| 68 | "(Edited)" marker | ✅ | ✅ | |
| 69 | Frozen conversation → composer locked | ✅ read-only `TextInput`, attach hidden | ✅ | Web replaces the whole composer with "This conversation is closed." |
| 70 | Message grouping by consecutive sender | — | — | Neither. |
| 71 | Sender avatar beside a bubble | — | — | Mobile stubs `MessageAvatar` to `<></>`; web never renders one. |

### Message actions

| # | Capability | Mobile | Web | Notes |
|---|---|---|---|---|
| 72 | Action affordance | ✅ long-press (400 ms) → bottom-sheet modal | ⚠️ | Web uses a hover-revealed `⋯` button (`opacity-0 group-hover:opacity-100`). **On a touch device there is no hover** — the control is reachable only by tapping the invisible hit area. No long-press handler. |
| 73 | Reaction picker, 6 presets | ✅ `like love haha wow sad pray` | ✅ | Identical set and identical `type` strings (`lib/chat/reactions.ts` ↔ `utils/chatReactions.ts`; the mobile file's header says it mirrors the web one). |
| 74 | Picker highlights your current reaction | ✅ `itemSelected` yellow pill | ❌ | Web's picker has no selected state. |
| 75 | Reaction pills (distinct emojis + total, highlighted when yours) | ✅ | ✅ | |
| 76 | Tap pill → remove yours, else open the picker | ✅ | ✅ | Same branch logic. |
| 77 | Edit your own message | ✅ | ✅ | |
| 78 | Edit suppressed on messages with `AskToHost` / `ReplyHost` / post attachments | ✅ `hasCustomAttachments` guard | — | Moot on web: those attachments don't render. |
| 79 | Delete your own message | ✅ | ✅ | |
| 80 | Delete semantics | **hard** delete — `deleteMessage(id, true)` (`ChatMessageRenderer.tsx:116`) | ⚠️ | Web does a **soft** delete — `client.deleteMessage(id)` with no `hardDelete` (`useChannelMessages.ts:254`). The row survives on Stream; the same message deleted from each client leaves different server state. |
| 81 | Delete confirmation | ❌ deletes immediately from the sheet | ✅ | Web-only modal ("Delete message?"). |
| 82 | Copy message text | ❌ | ✅ | Web-only. |
| 83 | Reply / quote / thread | — | — | Neither. Mobile stubs the library's thread affordances by replacing `Message` wholesale. |
| 84 | Forward a message | — | — | |
| 85 | Pin a message | — | — | |
| 86 | Swipe actions on a message | — | — | `swipeable/SwipeableItem` is used by the Recommended buddies list, never by chat. |
| 87 | Message search inside a conversation | — | — | |

### Message types & attachments

| # | Capability | Mobile | Web | Notes |
|---|---|---|---|---|
| 88 | Plain text | ✅ | ✅ | |
| 89 | Emoji in text | ✅ (deliberately bypasses `RenderHtml` on Android so astral chars survive) | ✅ | Native on web. |
| 90 | Attach menu with labelled rows + hints | ✅ Photo / Video / Camera / Document, each with an icon chip and a hint line (`ChatAttachmentMenu.tsx`) | ⚠️ | Web opens the raw OS file dialog from a paperclip. No menu, no per-type guidance. |
| 91 | Send image from library | ✅ | ✅ | |
| 92 | Image compressed before upload | ✅ 1280×1280, quality 0.8, forced JPEG | ❌ | Web uploads the original file untouched — a 12 MB phone photo is uploaded as-is. |
| 93 | Send video | ✅ | ❌ | Web's file input is `accept="image/*,application/pdf,.doc,.docx,.txt"` (`MessageComposer.tsx:111`) — `video/*` is absent. |
| 94 | Video transcode cap | ✅ 1080p H.264/AAC (iOS re-encode fix) | — | |
| 95 | Camera capture | ✅ | ❌ | No `capture` attribute, no camera path. |
| 96 | Send PDF | ✅ PDF only | ✅ | Web additionally allows `.doc/.docx/.txt`. |
| 97 | Document size limit + error toast | ✅ 20 MB, "The file is too large…" | ❌ | Web has no size check at all. |
| 98 | Caption text sent with an attachment | ✅ | ✅ | |
| 99 | Multiple attachments in one message | ❌ one asset per message | ✅ | Web-only (`multiple` on the input). |
| 100 | Busy/uploading indicator | ✅ spinner replaces the paperclip | ❌ | Web shows nothing while an upload is in flight; a large file looks like a no-op. |
| 101 | Inline image with the sender's aspect ratio | ✅ fits to 240×280 using `original_width/height` | ⚠️ | Web uses `max-h-64 … object-cover`, so tall images are cropped and no intrinsic size is sent (`sendImage` result has no `original_width/height`). |
| 102 | Fullscreen image lightbox | ✅ modal with a scrimmed close button | ❌ | Web wraps the image in `<a target="_blank">` — the raw CDN URL opens in a new tab. |
| 103 | Inline video player (paused first frame + play overlay) | ✅ | ❌ | A video attachment reaching the web falls through `mapAttachments` to the generic **file** branch (`asset_url` present) and renders as a download link. |
| 104 | Fullscreen video player with controls | ✅ | ❌ | |
| 105 | PDF card: filename | ✅ | ✅ | |
| 106 | PDF card: file size | ✅ `formatFileSize(file_size)` | ❌ | Web never reads `file_size`. |
| 107 | PDF card: downloaded state / cached local copy | ✅ check-circle once cached | ❌ | |
| 108 | In-app PDF viewer (never hands off to the browser) | ✅ `react-native-pdf` on Android, `WKWebView` on iOS | ❌ | Web opens the URL in a browser tab, which is exactly what mobile deliberately avoids. |
| 109 | `AskToHost` attachment → group card + **GO TO GROUP** | ✅ `ChatMessageRenderer.tsx:208-237` | ❌ | Web's `mapAttachments` keeps only attachments with `image_url`/`thumb_url`/`asset_url`; an `AskToHost` attachment has none, so the card is dropped and the message shows as text alone. |
| 110 | `ReplyHost` / `post` attachment → post card + **GO TO COMMENT** | ✅ `ChatPostAttachment.tsx` (resolves the actor's profile and the Feeds activity, with a "COMMENT NOT FOUND" state) | ❌ | Same drop path. |
| 111 | Pre-filled first message — `AskToHost` | ✅ `"Could you provide me with the access code to join the {group} private group?"` | ❌ | |
| 112 | Pre-filled first message — `ReplyHost` | ✅ `"Hi {name}, related to your post on \"{group}\", take a look at the responses."` | ❌ | |
| 113 | `REPLYMESSAGE` Lambda notification fired after a ReplyHost send | ✅ `ChatMessagesInput.tsx:186-203` | ❌ | |
| 114 | Voice messages | — | — | |
| 115 | GIF / giphy | — | — | |
| 116 | Emoji picker in the composer | — | — | Both rely on the platform keyboard. |
| 117 | Send on Enter (Shift+Enter = newline) | — (mobile is multiline + a send button) | ✅ | Web-only, and correct for the platform. |

### Presence, muting, leaving

| # | Capability | Mobile | Web | Notes |
|---|---|---|---|---|
| 118 | Online / presence dot | — | — | Both query channels with `presence: false`. Nothing in either app renders presence. |
| 119 | Last-seen | — | — | |
| 120 | Mute a conversation | — | — | |
| 121 | Leave / archive a conversation (other than "Remove from my buddies") | — | — | |
| 122 | Group (>2 member) conversations | ✅ name falls back to the channel name | ✅ | Both handle the shape; the product only creates 1:1 channels. |

### Push for messages

| # | Capability | Mobile | Web | Notes |
|---|---|---|---|---|
| 123 | Register the FCM device with Stream | ✅ `client.addDevice(token, 'firebase', id)` | ✅ | Web must additionally pass the provider **name** (its tokens come from a separate Firebase project) — `pushClient.ts:171-176`. |
| 124 | Re-register on token rotation | ✅ `messaging().onTokenRefresh` | ✅ | Web re-mints via `getToken()` on every `syncPushDevice()` (each load once chat is ready). Different mechanism, same effect. |
| 125 | Persist the token to the backend's device-token table | ✅ `createOrUpdateFCMToken` → `UserDeviceToken` rows | ⚠️ | Web does not write this table. `docs/PUSH.md:37,64` concludes Stream is the only sender, which makes this harmless — but mobile's push handler still has a live `type === 'CHAT_MESSAGE'` branch fed by a non-Stream payload, so a backend-originated chat push would not reach a browser. |
| 126 | Notification tap → open the conversation | ✅ nested `navigate` to `BuddiesScreen.Chat` | ✅ | Web SW: `channel_type === "messaging"` → `/chat/{channel_id}`; reuses an open tab. |
| 127 | Foreground push handled without an OS banner | ✅ local notification via notifee | ✅ | Web posts from the SW to the focused tab → Sonner toast, and suppresses it when you're already on that channel (`PushBridge.tsx:51`). |
| 128 | Legacy Stream payload shape (`data.channel` JSON blob) accepted | ✅ | ❌ | The web SW reads `data.channel_id` / `data.cid` only. A legacy-shaped push lands on `/groups`. |

### Entry points into a conversation

| # | Entry point | Mobile | Web | Notes |
|---|---|---|---|---|
| 129 | Conversation-list row | ✅ | ✅ | |
| 130 | Buddy profile → "Chat" | ✅ `openBuddyChat` queries Stream for the existing 1:1 channel first, and **creates** it if the pair were accepted before a channel existed (`UserInfo.tsx:332-386`) | ⚠️ | Web routes straight to `/chat/{connection.connectionId}` (`BuddyProfileScreen.tsx:458`). If the pair's channel is keyed to an *older* connection id — the exact case mobile's comment calls out — the web opens a channel that does not exist, and no channel is created. |
| 131 | Updates / notification row (`MESSAGE`) | ✅ `UpdateScreenE.Chat` with `type: 'ListNotifications'` | ✅ | `lib/notifications/routing.ts:49`. |
| 132 | Push notification | ✅ | ✅ | |
| 133 | Group post → "Reply to host" | ✅ `usePostActions.ts:137-155` (creates + accepts a connection, creates the channel, opens chat with a `ReplyHost` prefill and post attachment) | ❌ | |
| 134 | Private group → "Ask to host" for the access code | ✅ `modal-private-group.tsx:77-96` | ❌ | |
| 135 | Ambassador modal → intro chat | ✅ `ModalAmbassador.tsx:63-76` | ❌ | |
| 136 | Direct URL / deep link by channel id | ✅ nav params | ✅ | Web has a real addressable route. |

### Remove, block, report

| # | Capability | Mobile | Web | Notes |
|---|---|---|---|---|
| 137 | ⋯ → "Remove from my buddies" (+ sub-line) | ✅ | ✅ | Same copy. |
| 138 | Remove confirmation step | ✅ modal, "YES, REMOVE" | ✅ | Web: inline confirm inside the dropdown. |
| 139 | Remove = `channel.delete()` then `deleteConnection` | ✅ | ✅ | `lib/chat/connections.ts:17`. |
| 140 | Remove writes the `idConnect` / `isRemove` AsyncStorage flags for the Recommended list | ✅ | ❌ | No web equivalent; discovery does not learn about the removal until the connection map is refetched. |
| 141 | ⋯ → "Block & report" (+ sub-line) | ✅ | ✅ | Same copy. |
| 142 | Report reason list | ✅ 5 reasons | ✅ | Identical `id` strings, so reports line up across platforms (`ReportModal.tsx:12-18`). |
| 143 | "Other" free text, min 10 / max 1000 | ✅ | ✅ | |
| 144 | Report writes `blocked` / `blockedUser` / `blockingReason` | ✅ `ReportConnectionUser` | ✅ | Byte-identical mutation. |
| 145 | Order of operations | delete channel → report | ⚠️ | Web reverses it deliberately (report → delete) so the block survives a failed channel delete. Documented at `ActiveConversation.tsx:63-65`. |
| 146 | Thank-you confirmation | ✅ toast | ✅ | |
| 147 | Report surface | full screen (`BuddiesScreen.Report`) with a radio group | ⚠️ | Web is a modal sheet. Same fields; different affordance. |
| 148 | Unblock / undo a block | ❌ | ❌ | Neither app can reverse a block from any UI. |

---

## Message types & attachments — how each side actually decodes

**Mobile** (`ChatMessageRenderer.tsx:199-250`) switches on `attachment.type`:

| `type` | Rendered as |
|---|---|
| `image` | `ChatMediaAttachment` → `FastImage` thumbnail + fullscreen modal |
| `video` | `ChatMediaAttachment` → paused `react-native-video` first frame + play overlay + fullscreen player with controls |
| `file` | `ChatMediaAttachment` → `PdfAttachment` (download-and-cache card + in-app viewer) |
| `AskToHost` | group `AvatarInfoLayout` card + a **GO TO GROUP** button |
| `ReplyHost` / anything with a `post` field | `PostAttachmentItem` — resolves the actor profile and the Feeds activity, renders the post HTML, adds a **GO TO COMMENT** button, and shows "COMMENT NOT FOUND" when the activity is gone |
| anything else | `null` |

Upload side (`utils/chatMedia.ts`): images go through `channel.sendImage` (Stream
CDN resize + thumbnail), video and documents through `channel.sendFile`.

**Web** (`useChannelMessages.ts:71-83`) has only two buckets:

```
if ((a.type === "image" || img) && img)  → { type: "image", url: img }
else if (a.asset_url)                    → { type: "file",  url: a.asset_url }
```

Consequences, in order of severity:

1. A **video** message from mobile has `type: "video"` and an `asset_url`, so it
   falls into the file bucket and renders as a grey "download" row. No player, no
   thumbnail, and the filename is whatever the phone called it.
2. An **`AskToHost`** or **`ReplyHost`** attachment has neither `image_url` nor
   `asset_url`, so it produces zero UI attachments. If the message also had no
   text it is filtered out entirely by `useChannelMessages.ts:333` and the bubble
   vanishes. With text (which both flows always have, via the prefill) you see
   the sentence but not the card or the button it refers to.
3. A message stored as `html` with an empty `text` renders blank on web for the
   same reason.

---

## Connection state machine

The `Connection` AppSync row is the single source of truth, and **its `id`
doubles as the Stream channel id** once accepted. Both apps depend on this.

| State | How it's detected | Mobile UI | Available actions | Mutation | Web UI | Status |
|---|---|---|---|---|---|---|
| **none** | no row for the pair | `ConnectionButtonBar` renders **Connect** (`ConnectionButtonBar.tsx:64-77`) | Connect | `createConnectionUser` (`connectionRemitentId`, `connectionRecipientId`, `ignored:false`, `accepted:false`) | **Connect** button on `/buddies/[userId]` | ✅ |
| **status unknown (loading)** | connection map not yet loaded | outlined pill with a spinner | — | — | `h-11` pulsing skeleton pill (`BuddyProfileScreen.tsx:453`) | ✅ |
| **pending — sent by me** | row exists, `accepted:false`, `ignored:false`, `connectionRemitentId === me` | **Pending** button with an info icon; a blue feedback banner ("your invite was sent") sits on the profile | Open the pending modal | — | **Withdraw invite** button | ⚠️ |
| ↳ pending modal | — | `ModalPendingConnection`: "You've already sent a connection request to this user." + **GOT IT** / **CANCEL REQUEST**, then a second confirm sheet ("Are you sure…") | Cancel request | `RemoveConnectionUser` (`deleteConnection`) | **no modal, no confirmation** — one click on "Withdraw invite" deletes the row | ❌ |
| **pending — received** | row exists, `accepted:false`, `ignored:false`, `connectionRecipientId === me` | `ConnectionRequest` card in the Buddies-Requests tab / Updates tab: avatar, `"{Name}, {age}"`, **shared-interest coincidence label**, "In remission" badge, **Connect** / **Maybe later** | Connect, Maybe later, open profile | Connect → `AcceptConnection` (`updateConnection { accepted: true }`) then `client.channel('messaging', connectionId, { members, name: "{Their first} {My first}" }).create()`. Maybe later → `RemoveConnectionUser` | `RequestCard` in `RequestsSection` / `RequestsPanel`: avatar, name+age, role + ambassador badges, **bio**, **Connect** / **Maybe later** | ⚠️ — no coincidence label, no "In remission" badge; shows bio instead |
| ↳ duplicate-channel guard on accept | — | queries Stream for an existing `members: {$eq: [me, them]}` channel first and skips creation if found | — | — | same guard (`useRequests.ts:140-145`) | ✅ |
| ↳ channel naming | — | `"{Their first} {My first}"` so chat search `$autocomplete` matches the other person | — | — | identical | ✅ |
| **connected** | row `accepted:true` | **Connected** (disabled) + a **Chat** button when `isBuddy` | Chat | — (opens the channel) | **Chat with buddy** button | ⚠️ — mobile resolves/creates the channel first (see #130); web assumes `connectionId` is the channel id |
| **declined / "maybe later"** | the row is **deleted**, not flagged | the request disappears; toast "…maybe later" | — | `RemoveConnectionUser` | identical — `deleteConnection` + toast | ✅ |
| **ignored** (`ignored: true`) | reads filter it out (`FETCH_CONNECTION_STATUS` drops `ignored === true`) | never rendered | — | `IgnoreConnection` mutation exists but **is called from nowhere** in the mobile app | web queries filter `ignored: {ne: true}` / `{eq: false}` identically | ✅ (dead on both) |
| **blocked & reported** | row updated `blocked:true`, `blockedUser`, `blockingReason` | reached only from the chat ⋯ menu → full-screen report; channel deleted | Submit report | `ReportConnectionUser` | modal from the chat ⋯ menu; same mutation | ✅ (ordering differs, see #145) |
| **blocked-by-me at profile level** | `listBlockedUsers` has a row | profile shows "The profile you are trying to reach is not available" toast and **hides the whole action bar** (`UserInfo.tsx:457`) | — | `GET_BLOQUED_BY_REMITENT_AND_RECIPIENT` read | **no blocked check on `/buddies/[userId]`** — the action bar renders and you can Connect to someone you blocked | ❌ |
| **hidden from discovery** | a `Connection` row created with `blocked:true` + `blockedUser` and no recipient | mobile's swipe-to-delete on the Recommended list | — | `omitConnectionUser` | `hideUserFromDiscovery()` (`lib/buddies/connections.ts:366`) | ✅ |
| **Support account** | `userType === SUPPORT` | action bar hidden entirely; chat ⋯ menu hidden | — | — | action bar hidden (`isSupportAccount`); chat ⋯ menu hidden | ✅ |
| **viewer is a Host** | `groupHostId` on the signed-in user | **entire action bar suppressed** (`UserInfo.tsx:457`) | — | — | no such suppression on web | ❌ |

### Liveness of the state machine

| Signal | Mobile | Web | Status |
|---|---|---|---|
| `onCreateConnectionByRecipientId` — a request arrives while you're looking | ✅ (Updates screen, requests screen, tab bar) | ✅ `useRequests.ts:31`, `usePendingRequestCount.ts:21` | ✅ |
| `onUpdateConnection` — the other side **accepts**, so Pending → Connected | ✅ `ConnectionMapProvider` | ❌ | ❌ — a web "Pending" button stays Pending until the page is reloaded |
| `onDeleteConnection` — the other side **declines / removes you** | ✅ `ConnectionMapProvider` | ❌ | ❌ |
| Re-check on screen focus | ✅ `useFocusEffect(refreshConnectionFor(targetUserId))` — a per-user server re-read on every profile open | ❌ | ❌ — web reads the connection map once per `BuddiesProvider` mount |
| Invalidate the cached map when a buddy push arrives | ✅ `invalidateConnectionMap()` from the push provider | ❌ | ❌ |
| Guard against double-sending a request | ✅ `FETCH_USER_HAS_SENT_AND_INVITATION` server round-trip before `createConnection` (`UserInfoConnect.tsx:166`) | ⚠️ | Web checks the in-memory map only (`useConnectAction.ts:35`). Two tabs, or a stale map, can create a duplicate row. |
| Paginated, index-backed status read | ✅ `FETCH_CONNECTION_STATUS` walks `byRemitentId`/`byRecipientId` page by page (the comment explains that a plain `listConnections` filter is truncated by DynamoDB before filtering) | ⚠️ | Web's `fetchConnectionMap` uses `listConnections` with `limit: 1000000` + `nextToken` paging — the pattern mobile's comment warns about, mitigated by a very large limit rather than by using the indexes. |

---

## Screen-by-screen inventory

### Conversation list — mobile `HomeBuddies.tsx` → web `app/(app)/chat/layout.tsx` + `components/chat/ConversationList.tsx`

Mobile is a full screen inside the Buddies (icon: "Chat") tab. Web is the **left
pane of a persistent two-pane layout**: at `≥lg` the list and the open
conversation are both visible; below that it collapses to one pane. This is a
deliberate, correct platform adaptation, not a gap.

Present on both: search, avatars with goal overlay, role badges, unread badges,
"NEW" chip, relative timestamps, frozen dimming, infinite scroll, live updates.

Web-only: unread filter, message-body search, instant local matches, list error
state with retry.
Mobile-only: unread-first sort, non-clickable frozen rows, the illustrated empty
state with the "Find new buddies" CTA, the Support-channel bootstrap, the
phone-verification gate.

### Conversation — mobile `ChatScreen.tsx` → `ChatMessagesLayout.tsx` → web `app/(app)/chat/[channelId]/page.tsx` → `ActiveConversation.tsx`

Mobile composition: `ChatMessagesHeader` + Stream `<Channel>` wrapping
`<MessageList Message={RenderAttachment}>` + `ChatMessagesInput`, with the
`MessageAvatar`, `LoadingIndicator` and `DateHeader` slots stubbed to `<></>` and
`InlineDateSeparator` / `TypingIndicator` / `EmptyStateIndicator` replaced.

Web composition: `ChatHeader` + `MessageThread` (which owns scrolling, day
separators and the read mark) + `MessageComposer`, all driven by
`useChannelMessages`.

Because mobile replaces `Message` wholesale, it **loses** everything Stream's
default bubble provides — timestamps, delivery ticks, read state, reply
affordances — which is why the web is ahead on rows 52–57.

### Message composer — mobile `ChatMessagesInput.tsx` (393 lines) → web `MessageComposer.tsx` (158 lines)

The size difference is almost entirely native-picker choreography that has no web
analogue (queueing the pick until the modal has finished animating out, blurring
the input twice on Android so the IME doesn't restore over the field). What the
web is genuinely missing from this file: the prefill logic (rows 111–112), the
`REPLYMESSAGE` Lambda call (113), the upload spinner (100), and the attach menu
(90).

### Message actions — mobile long-press sheet → web hover menu

Mobile sheet: reaction row (6 emojis, current one highlighted) + Edit + Delete,
the last two only for your own messages without custom attachments.
Web menu: Copy (always, when there is text) + Edit + Delete for your own, and a
separate reaction button. **The web menu's discoverability on touch is the open
question** — it is revealed on `group-hover`, which never fires on a phone.

### Report — mobile `screens/buddies/report/Report.tsx` (full screen) → web `components/chat/ReportModal.tsx`

Same 5 reasons with the same canonical `id` strings, same 10/1000 bounds on
"Other", same mutation, same thank-you copy. Only the surface (screen vs modal)
and the ordering of channel-delete/report differ.

### Buddy request card — mobile `elements/connection-request/ConnectionRequest.tsx` → web `components/buddies/RequestsSection.tsx` (`RequestCard`)

Same two actions and the same mutation pair. Mobile shows a computed
shared-interest line (`getLabelCoincidencies`) and an "In remission" badge; web
shows the sender's bio instead.

### Pending-request modal — mobile `elements/modal-pending-connection/ModalPendingConnection.tsx` → web: nothing

Two-step on mobile (informational sheet → confirmation sheet). Web has a single
unconfirmed "Withdraw invite" button.

---

## Cross-screen gaps

Ordered by how much of the product they remove.

1. **The `AskToHost` / `ReplyHost` message type does not exist on web — in either
   direction.** Web can't *create* those messages (three entry points missing,
   rows 133–135), can't *prefill* them (111–112), can't *render* their cards
   (109–110), and can't fire the follow-up notification (113). A group host who
   works from the browser sees a bare sentence where mobile shows a post card with
   a jump-to-comment button. This is the single largest functional hole.

2. **Video is unreachable on web, both ways.** You cannot pick one (row 93) and
   an incoming one renders as a file link (103–104). Combined with rows 92, 95, 97
   and 100, the web attachment story is "images and PDFs, unguarded".

3. **The connection state machine is not live on web.** No `onUpdateConnection`,
   no `onDeleteConnection`, no focus re-read, no push-driven invalidation. Mobile
   went to explicit trouble here — the `AcceptConnection` mutation selects both
   participant ids purely so AppSync's subscription filter matches. On web, a
   member watching a profile while the other side accepts sees "Pending" until
   they reload.

4. **Two dead ends around blocking.** Web's `/buddies/[userId]` never checks
   `listBlockedUsers`, so a blocked person's profile renders a live **Connect**
   button (mobile hides the whole bar and toasts "not available"). And neither
   platform can unblock (row 148) — worth raising as a product question, not just
   a port gap.

5. **The chat pane is a navigational cul-de-sac.** No link from the header to the
   contact's profile (row 45), so from a conversation there is no route to that
   person's diagnosis, journal or gallery. Mobile makes the whole header tappable.

6. **Touch users may not find the message actions.** The `⋯` and reaction
   controls are `opacity-0 group-hover:opacity-100`. With no long-press handler
   and no always-visible affordance, edit/delete/copy/react are effectively
   hidden on phones and tablets — the same devices where the two-pane layout
   already collapses to the mobile experience.

7. **The Support conversation never gets created for a web-only member.** The web
   signup flow sets `pendingSupportChannel` and defers the actual bootstrap to
   mobile's chat list (row 37). Someone who signs up in a browser and never
   installs the app has no Support thread.

8. **Delete semantics diverge.** Mobile hard-deletes, web soft-deletes (row 80).
   The same action taken from the two clients leaves different server state, and
   a message deleted on web is still retrievable through Stream's API.

9. **"Chat with buddy" can open a channel that isn't there.** Web assumes
   `connectionId === channelId` (row 130). Mobile explicitly does not, and the
   comment in `UserInfo.tsx:337-339` names the case: a pair with an older
   connection whose channel was reused. Web will land on a watch that fails and
   show "Couldn't load this conversation" — with no retry (row 42).

10. **Small things that add up in the list:** frozen conversations are still
    openable (24), the empty state has no CTA into discovery (34), and the
    unread-first sort is gone (10) — so on web the way to find unread
    conversations is the new filter chip rather than just looking at the top of
    the list.
