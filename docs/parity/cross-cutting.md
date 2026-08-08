# Cross-cutting infrastructure & shared components — mobile vs web parity

Everything that is *not* one screen: the shared element library, the provider
tree, hooks, services, analytics, business-rule utilities, the string
catalogue, enums, constants, and the native capabilities the web cannot have.

Sources read 2026-08-07: `~/cancerbuddyapp/src/**` (mobile, source of truth) and
this repo. `src/_archive/**` was skipped throughout.

Legend: ✅ EXISTS · ⚠️ PARTIAL · ❌ MISSING · 🚫 N/A on web (platform-bound).

---

## Summary

The web app reproduces the mobile app's *screens* far better than its
*infrastructure*. Five things stand out.

1. **There is no analytics layer on web at all.** Mobile ships
   `src/analytics/events.ts` on top of `@react-native-firebase/analytics` and
   fires 12 distinct events, several of them once-per-lifetime funnel markers.
   Web's only Firebase usage is push messaging (`lib/push/config.ts`). Every
   event below is ❌.
2. **The operational kill switches are absent.** Mobile has an AppSync-backed
   `getMaintenanceStatus` query *plus* an `onUpdateMaintenanceStatus`
   subscription that can put the whole app into maintenance or force an update
   at runtime; it also has an offline notice driven by NetInfo. Web has
   neither, so ops has no way to gate web users.
3. **The web has no shared design-system layer for type, skeletons, toggles,
   badges or tabs.** Mobile's `elements/typography` defines 12 named variants
   and 11 colours used by nearly every other element; web has two font-family
   CSS variables and ad-hoc `text-[15px]`-style classes per file. The same is
   true of skeletons (11 bespoke `animate-pulse` blocks), switches, badges and
   tab strips.
4. **Composer capability is the biggest single functional hole.** Mobile's post
   composer has a rich-text toolbar, an image/video/PDF tray, a 2000-character
   counter and an in-app PDF viewer. Web's `PostComposer` is a bare textarea
   with no attachments, no formatting and no length limit.
5. **State freshness.** Mobile revalidates on app foreground
   (`useAppStateEvents`) and subscribes to connection *updates* and *deletes*.
   Web does neither, so an accepted or declined buddy request leaves the web
   button stuck on "Pending" until a hard reload.

Counts across the status columns of this document: **73 ❌ MISSING**,
**113 ⚠️ PARTIAL**, 93 ✅ EXISTS, 35 🚫 N/A. (The Enums table's last column
lists *missing members* rather than a status, so it is excluded from the
tally; its own gaps are called out in the summary below.)

---

## Shared element library

`src/components/elements/**` — 68 directories. `modal-*` directories are broken
out into their own section below.

### A–L

| Mobile element | What it does | Used by | Web equivalent | Status |
|---|---|---|---|---|
| `BuddyIdScanner` | `react-native-vision-camera` QR scanner. Gates on CAMERA permission (toast + `goBack` if denied), de-dupes a repeat scan for 8 s, and after 5 s shows a "tap to activate camera" pane that remounts `<Camera>` via a key bump. | `layouts/BuddyIdQr/BuddyIdQr.tsx` | `components/profile/BuddyIdScreen.tsx` *generates* a QR; `components/buddies/BuddyIdSheet.tsx` takes manual `BI-0000-0000` entry | 🚫 (camera) — manual-entry substitute exists |
| `auto-complete-select` (5 files) | Server-searched typeahead in a full-screen modal. Comma-joined CSV value, **2000 ms** debounce, per-keyword GraphQL query, recursive `nextToken` paging for cities/workplaces. `multiple` adds an ADD button capped at `limitOptionsSelected` (default 10). Can also render as a `BtnFilters` "DIAGNOSIS" pill. | `layouts/PatientDiagnosis`, `layouts/Address`, `layouts/Colleges`, `layouts/MedicalCenter`, `layouts/SearchBuddy/modals/DiagnosticFilter.modal.tsx` | `components/ui/form.tsx` → `AsyncPicker`, `CatalogPicker`, `MultiSelectField` | ⚠️ 300 ms debounce vs 2000; `minChars=2` vs a character whitelist; **no recursive `nextToken` paging** (single call); no 10-item cap |
| `auto-scroll-container` | `KeyboardAwareScrollView` wrapper (`bottomOffset` 120) exporting a module-level scroll ref. | Login, ForgotPassword, MedicalInformation, EnrollmentControls | — | 🚫 |
| `avatar-vertical` | Group header block: big avatar with a LIVE ring + "LIVE" badge, name, and a `View N members` CTA (members only, disabled at 0). Member total and joined groups fetched via SWR. | `screens/groups/group-detail`, `layouts/Groups/GroupDetails.tsx` | `components/groups/GroupAvatar.tsx` + `components/groups/GroupMembers.tsx` | ⚠️ avatar only — no LIVE ring/badge, no inline member-count CTA |
| `avatar` | `BMAvatar`: 6 sizes, per-size radii, image or multi-word initials, a corner goal-icon slot, a *pressable* named icon (`add`/`edit`/`remove`/`verified`/`lock`), and a green presence dot in `tabs` variant. | TabsConfiguration, AvatarInfoLayout, ChatMessagesHeader, ProfilePicLayout, PhotosLayout | `components/buddies/BuddyAvatar.tsx`, `components/chat/ChatAvatar.tsx`, `components/groups/GroupAvatar.tsx` | ⚠️ split into 3 fixed-purpose components; no size scale, no pressable overlay icon, no presence dot |
| `back-button` | `goBack()` arrow that also registers an Android `hardwareBackPress` handler. | Every navigator's `headerLeft` | `components/legal/LegalBackButton.tsx`; `Sheet`'s `onBack` | ⚠️ no app-shell header back button; browser back is relied on |
| `badge` | Colour pill (Blue/Bone/Green/Purple/Yellow), 3 padding sizes. | InterestsBadges, ChatListMessagesPreview, AvatarInfoLayout | `components/chat/RoleBadges.tsx`; local `Badge` in `components/buddies/QuickSearchBar.tsx`; nav badge markup | ⚠️ no shared badge primitive — three ad-hoc implementations |
| `btn-filters` | Vertical icon + caption pressable with an optional count badge above-left. | `layouts/SearchBuddy`, `AutoCompleteSelect` when `isFilterHome` | `QuickButton` inside `components/buddies/QuickSearchBar.tsx` | ✅ (inlined, not extracted) |
| `btn-write-post` | Pill-shaped fake input reading "Write post" that opens the composer. | `layouts/GroupHeader`, `layouts/Groups/GroupHeader.tsx` | `components/groups/PostComposer.tsx` inline in `GroupFeed.tsx` | ⚠️ web shows a live textarea, not a tap-to-open affordance |
| `buddy-id` | Row: "BUDDY ID" label, middle-ellipsised id, SHARE button → toast + native share sheet. | HomeProfile, BuddyIdQr | `components/profile/BuddyIdScreen.tsx` (copy + `navigator.share` with clipboard fallback) | ✅ |
| `button` | `BmButton`: text always uppercased; 4 sizes; 6 colours (primary, primary-alt, secondary, tertiary, tertiary-danger, info) + disabled variants; variant full/start/end; ~36 named phosphor icons; `loading` swaps in `Loader`. | Everywhere | `components/ui/Button.tsx` | ⚠️ 4 variants vs 6 colours (no `tertiary-danger`, no `info`), no icon-name registry, no auto-uppercase, no `iconPosition` |
| `checkbox-group` | Maps a comma-joined string to a list of `Checkbox` rows; check/uncheck splices the CSV. | RelationshipFilter, Colleges, Underage, CancerLoss | `CheckboxField` in `components/ui/form.tsx` (single checkbox only) | ⚠️ no group component, no CSV-value contract |
| `chip` | Black pill, uppercased white label, pressable icon slot. | `layouts/FiltersSelected` | Chips inlined in `components/buddies/FilterChipsRow.tsx` and `MultiSelectField` | ✅ (not extracted) |
| `close-button-header` | Header X: `goBack()` and, unless `simple`, `toggleDrawer()`. | `navigation/drawer/DrawerScreens.tsx` | `Sheet` header close; `AccountSheet` close | ✅ |
| `connection-request` | The buddy-request card + Connect / Maybe later. Connect → `AcceptConnection`, updates `ConnectionMap`, then creates a Stream `messaging` channel **whose id is the connection id**, named `"<their first> <my first>"` — but only after querying for an existing channel between the pair. | `screens/updates/HomeUpdates.tsx`, `screens/requestBuddies/HomeRequestBuddies.tsx` | `components/buddies/RequestsSection.tsx`, `components/notifications/RequestsPanel.tsx`, `lib/buddies/useRequests.ts` | ⚠️ same mutations, same id/name convention, but **no duplicate-channel pre-query** |
| `content-button` | Full-width primary button with a `ContentCircle` on the left and an uppercased CTA. | HomeProfile | — | ❌ |
| `content-circle` | Coloured circle wrapper (yellow/white), 4 sizes. | Only `content-button` | — | ❌ (internal helper) |
| `cta-button` | Pressable row: left icon, title (defaults to danger colour) + description, optional right caret. The action-sheet row of the app. | FeedModals, `layouts/Post`, ChatMessageActions, GroupActions, ReportPost.modal | Action rows inlined in `components/groups/GroupSheets.tsx`, `components/chat/ReportModal.tsx` | ⚠️ no shared row primitive |
| `date-time-picker` | Bottom sheet with collapsible Date/Time sections, a live "Selected Date & Time" preview with `timeZoneName: 'short'`, `minimumDate = now`, Cancel/Confirm writing `toISOString()`. **Dead code — no importer.** | *(none)* | `<input type="datetime-local">` in `ManageLivesScreen.tsx`; `components/auth/MonthYearPicker.tsx` | ⚠️ (mobile side unused) |
| `dialog-container` | **The global dialog host.** Mounted once by `context/modal/DialogProvider.tsx`, driven by `useDialog().setContent/setShowModal`. Slide-up sheet with a cross-fading `customBackdrop`; backdrop press is **deliberately inert** — every dialog is close-button-only. Keyboard avoidance and its own `Toast` host when `type === 'ModalPrivateGroup'`. | DialogProvider (host), DeleteAccount, JournalEditView | `components/ui/Sheet.tsx` | ⚠️ `Sheet` is per-callsite with no provider/global host; Escape **and** backdrop click both close; nesting handled by a module-level sheet stack |
| `dropdown` (7 files) | Simple vs Multiple router; appends `" *"` when `required`; `helpText` only while empty. Native bottom-sheet `FlatList` picker sized `min(56 + items×83 + inset, 70% of screen)`. `dropdown-multiple` keeps a CSV value, **removes already-chosen options from every remaining row's list**, and gates ADD on `limit` (default 10 → `maxLimit = limit - 1`). | PersonalInformation, InterestsLayout, PersonalInfoLayout, PatientDiagnosisLayout, LanguagesLayout | `SelectField` (native `<select>`) + `MultiSelectField` in `components/ui/form.tsx` | ⚠️ no bottom-sheet picker, no "already-picked removed from other rows", no per-row ADD or limit, no required-asterisk/helpText convention |
| `emojis` | `EmojisGroup` renders a 4-column grid of goal options in a **hardcoded 8-item order**; `EmojiItem` resolves its S3 image via SWR; tapping the selected tile clears it. | `screens/profile/goal/Goal.tsx` | `components/profile/GoalForm.tsx` | ⚠️ no hardcoded ordering, no tap-to-deselect. (`components/chat/ReactionPicker.tsx` is a different thing — unicode chat reactions) |
| `feedback-card` | Bone-or-custom-coloured card: body text + `CheckCircle`; text/icon flip white when a colour is supplied. | `screens/buddies/userInfo/components/UserInfoContent.tsx` | `components/ui/ServerAlert.tsx` (alert semantics only) | ⚠️ no success/confirmation card variant |
| `filter-button-header` | Header "FILTER" button → `BuddiesScreen.Filter`. **Dead code.** | *(none)* | The Custom button in `QuickSearchBar.tsx` | ✅ on web (mobile side unused) |
| `format-toolbar` | **B / I / U** bound to a `@10play/tentap-editor` `EditorBridge` (`isBoldActive` → `toggleBold`, etc.) plus an optional paperclip attach button. No headings, lists or links. | groups `NewPost`, groups `EditPost`, feeds `NewPostScreen` | — | ❌ `components/groups/PostComposer.tsx` is a plain textarea; its own docblock says formatting is unbuilt |
| `hamburguer-header` | The app top bar: drawer icon + exactly one contextual CTA chosen from route + `userType` + snooze + pending-connection count → "Find new buddies" / "Explore groups" / "see my qr code" / nothing. Suppressed entirely for `SUPPORT` and `HOST`. | All 7 navigators | `components/app-shell/{Sidebar,BottomBar,AccountSheet}.tsx` + `lib/navigation/appNav.tsx` | ⚠️ drawer→AccountSheet is covered; the route/userType-driven contextual CTA has no counterpart |
| `hint` | Headless: on mount it pushes `<HintContent>` into the **global dialog** and mirrors its `isVisible` prop into `showModal`. The only component that subscribes to `useDialogState()`. Content = title, up to two paragraphs, optional CTA. | Reached through `Input`'s `hint` + `hintDescription` → PersonalInfoLayout, AgeLayout | `Input`'s `hint` prop is inline helper text; `HelpDialog` is a separate support form | ⚠️ no info-icon → explainer-modal pattern |
| `info-card` | Icon + bold title + description + optional `content` slot; alignment flips centre→flex-start when `content` is present. | `layouts/InforCardGroup` | — (nearest: `ServerAlert`, `DiscoveryEmptyState`) | ❌ |
| `input` | Router over text/textarea/password plus heavy autofill hardening. Masks `mm/yyyy`, `mm/dd/yyyy`, `yyyy`, `zipcode` with month clamped to 12 and day to 31; default `maxLength` 300 (password 20). | Login, ForgotPassword, DeleteAccount, ManageLivesCreate, PersonalInformation | `components/ui/Input.tsx` + `Textarea.tsx` (+ `auth/PhoneInput.tsx`, `auth/OtpInput.tsx`) | ⚠️ password eye and error/hint reach parity; **no masks, no maxLength defaults, no autofill polling or required-error grace period** |
| `item-list` | Text row (85% width) + right caret, tappable. | `screens/drawer/Partner/Partner.tsx` | `MenuRow` in `AccountSheet.tsx` | ✅ |
| `journal` (`JournalControl`) | One journal row: tappable date heading + one-line preview + a `Switch` controlling `visibleToPublic` (yellow track when on). | `screens/profile/journal/MyJournalLayout.tsx` | `components/profile/JournalScreen.tsx` (`VisibilitySwitch`); read-only `JournalList.tsx`/`JournalPreview.tsx` | ✅ — web is richer (optimistic toggle with rollback, `role="switch"`, public-count summary) |
| `keyboard-spacer` | View whose height tracks keyboard events. **Dead code, and calls the removed `Keyboard.removeSubscription` API.** | *(none)* | — | 🚫 |
| `link-caret` | Full-width label + right caret. | `screens/settings/home/HomeSettings.tsx` | `AccountSheet` rows, `ProfileHub.tsx` rows | ✅ |
| `link` | Underlined text button; primary/alt/secondary colours, alignment prop, 0.5 opacity when disabled. | LoginWithoutEmail, CodeValidationLayout, EmailVerification | `Button variant="ghost"` / raw `next/link` anchors | ⚠️ no link primitive |
| `list-icon-item` | Icon + title (+ subtitle) row with a bottom rule. Note the `underline` prop is **inverted** — passing it removes the rule. | `navigation/drawer/DrawerMenu.tsx` | `MenuRow` in `AccountSheet.tsx` | ✅ |
| `list-notifications` | One Updates row: S3 avatar via SWR (initial fallback), name + SUPPORT `verified.png` + `check-ambassador.png` + relative time, the `notificationType` sentence, then the group name. | `screens/notifications/HomeNotifications.tsx` | `components/notifications/NotificationRow.tsx` (its docblock names it the port) | ✅ |
| `live-schedule-field` | Manage-Lives scheduling card: Date row, Time row, duration chips, and an "Ends at HH:MM" / "Ends Mon D at HH:MM" preview. Bounds: min = now, max = one year out at 23:59:59.999, `minuteInterval = 15`, durations `[15, 30, 45, 60, 90, 120]`. | ManageLivesCreate, ManageLivesDetail | `components/profile/ManageLivesScreen.tsx` + `lib/profile/manageLives.ts` | ⚠️ same durations and ISO contract; **no min/max bounds, no 15-minute step, no "Ends at" preview**. Neither side has recurrence or timezone selection |
| `loader` | `Loader` = transparent full-screen RN `Modal` with an `ActivityIndicator`; `loader-indicator` = the bare spinner. | auth.provider, status-app.provider, DrawerMenu, DeepLinkNavigation, Recommended | `Spinner` in `Button.tsx`, `AuthGuard` spinner, `ListSkeleton`, `ThreadSkeleton` | ⚠️ no blocking full-screen loader primitive; web prefers skeletons |

### M–Z

| Mobile element | What it does | Used by | Web equivalent | Status |
|---|---|---|---|---|
| `media-preview-strip` | Horizontal 72 px thumbnail strip of pending media with a black/white circular X remove badge; videos get a play overlay. Display only. | groups `NewPost`, and inside `msg-send` (feed/group comment composers, live comments) | — | ❌ web `MessageComposer` sends files straight from `<input type=file>` with no preview |
| `message` | Static bubble: Incoming (white, left) vs Outgoing (bone, right), maxWidth 287; renders `TypingAnimation` instead of text when `isTyping`. | **Dead code** — real chat uses `stream-chat-react-native` | `components/chat/MessageBubble.tsx` (far richer) | ✅ (web superset) |
| `msg-advice` | One-line lightbulb tip row, hideable via `isHidden` (`display: none`, not unmount). | `layouts/Chat/ChatMessagesEmpty.tsx` | — | ❌ `ChatEmptyState.tsx` is a centred placeholder, not an inline tip banner |
| `msg-send` | Comment/message composer bar: paperclip attach, multiline input, send button that turns yellow only when `canSend`. Owns double-send protection via `sendingRef` + a local spinner, dismisses the keyboard, embeds `MediaPreviewStrip`. | feeds `PostDetails`, groups `PostDetails`, `Streaming/StaticComments`, `Streaming/FooterVideoControls` | `components/chat/MessageComposer.tsx` | ⚠️ web has Enter-to-send, edit mode, frozen-channel state, but **no pending-media preview, no upload spinner, no in-flight double-send guard**; and web post comments use `PostComposer.tsx`, which has no attach button at all |
| `pdf-attachment` | PDF card + in-app viewer. First tap downloads to `RNFS.CachesDirectoryPath/pdf-attachments` with live `%` progress; second tap opens a full-screen viewer (WKWebView on iOS, `react-native-pdf` on Android). Separate download button → Android DownloadManager / iOS share sheet. Never hands off to a browser. | `layouts/Post/FeedMediaAttachments.tsx` (full width), `layouts/Chat/ChatMediaAttachment.tsx` (260 px) | `components/chat/MessageBubble.tsx` ~144-158 — a plain `<a target=_blank>` file chip | ⚠️ file chip only: no viewer, no progress, no size label, no saved state, and **no PDF handling in the groups feed at all** (`PostCard.tsx` renders attachments as `<img>`, so a PDF shows as a broken image) |
| `percent-circle` | SVG completion ring + `NN%` label. Animation is **commented out** — renders statically. Radius `120 / 2π`, stroke 2. | HomeProfile — 7 instances (personal, medical, patient, gallery, interests, goal, journal) | `components/profile/ProgressRing.tsx` via `ProfileHub.tsx` | ✅ web is better: clamps 0-100, animates the dash, turns green at 100 %, `role="img"` |
| `phone-number-input` | Country-code field (`react-native-country-picker-modal`, emoji flags, `excludeCountries` blocklist) + masked national number (`maskPhone`, hint `(e.g. 999-999-9999)`). Emits `+{callingCode} {number}`; validity = `number.length > 0`. Defaults to US/+1. | `layouts/PhoneVerification`, `layouts/VerificationPhone/ModalSavePhoneNumber.tsx` | `components/auth/PhoneInput.tsx` (`DIAL_COUNTRIES` from `lib/host-signup/constants.ts`) | ✅ web is stronger (keyboard-navigable listbox, filter by name/ISO2/dial, error/hint slots); no input mask though |
| `post-media-tray` | Attachment tray for the post composer. 1 item → hero card fit to true aspect ratio, capped at **190 px** tall; 1 PDF → file row with `PDF · size`; 2+ → 104 px thumb strip with a dashed "Add" tile. Videos render a paused muted first frame + duration pill; tap opens a full-screen preview. | `screens/feeds/NewPostScreen.tsx` | — | ❌ `components/groups/PostComposer.tsx` is a bare textarea; no attachments at all |
| `progress-bar` | 4 px `react-native-progress` bar on a gray track, `current/100`, yellow fill. | EnrollmentControls, ForgotPassword, SetupNewPassword, change-status-controls | `RegisterShell.tsx` / `HostRegisterShell.tsx` segmented step strip | ⚠️ equivalent signup progress, but as an inline segmented strip, not a reusable percentage bar |
| `qr-share` | QR of the **app-store download link fetched from Contentful** (`appStoreLinkCollection.items[0].appLink`, via SWR), 280 px default, plus a "COPY LINK" button + success toast. Falls back to `BONE_MARROW_WEBSITE`. | `screens/drawer/share/Share.tsx` | `AccountSheet.handleShare()` — shares `window.location.origin` via `navigator.share`, clipboard fallback | ⚠️ no QR, no Contentful lookup, different payload. (`BuddyIdScreen.tsx` does render a QR, but of `{UNIVERSAL_DEEP_LINK}/buddyId/{buddyId}` — a different feature) |
| `radio-button-group` | Hollow circle + filled dot radio, label to the right. **Dead code**; `radio-button-group-styles.ts` is a 0-byte file. Screens use `react-native-simple-radio-button` instead. | *(none)* | `RadioGroup` in `components/ui/form.tsx` (chip pills) | ⚠️ visual style differs (pills vs dots) |
| `radio-group` | Two variants. Default `Radio` = 70×70 image tile + bold primary + secondary text. `minimal` switches to `RadioAlt` = small circle dot. Does a focus/blur dance (1 s timeout) to dismiss the keyboard on select. | change-status-select, UserRoleLayout, `Templates/SubjectTemplate`, `Templates/ReportTemplate` | `StepUserRole.tsx` (card role picker) / `RadioGroup` in `form.tsx` | ⚠️ web's shared `RadioGroup` is pill-only; the illustrated-tile variant exists only bespoke in `StepUserRole.tsx`, and there's no `minimal` switch |
| `read-more-action` | HTML truncation + READ MORE / READ LESS. Truncates at **200 chars**, or **350** if the HTML contains an `<a href="http…">`; if the body has **more than 4 `<br>`** it keeps only the first 4 lines instead. | `layouts/Groups/post-fragment/Post.fragment.tsx` | `components/groups/PostCard.tsx` ~200-213 (`line-clamp-6` + "load more" at `html.length > 400`); `JournalPreview.tsx` uses `line-clamp-4` | ⚠️ different threshold, CSS clamp instead of char slicing, and **no collapse back** (`showFull` is one-way) |
| `scrollview-container` | ScrollView padded by `BottomTabBarHeightContext`. **Dead code.** | *(none)* | — | 🚫 |
| `search` | Pill search field (48 px, gray100, radius 25) with internal state and an optional X clear; self-clears when `clearButton` flips false. | feeds `home`, HomeBuddies, RecommendedGroups, GroupsList, GroupsRecommendedList | `SearchField` in `components/ui/form.tsx` | ✅ |
| `skeleton-content` | 5 shimmer variants: content (avatar + 2 blocks), line, post, chat (5 conversation rows), chat-messages (full chat screen). | feeds `PostDetails`, ChatScreen, HomeBuddies, RecommendedLayout/Item, GroupHeader | Only `ListSkeleton` in `form.tsx` is shared. The rest are local: `ConversationList`, `ActiveConversation`, `GroupFeed`, `BuddyCard`, `BuddiesScreen`, `UpdatesScreen`, `BuddyProfileScreen` + more | ⚠️ same surfaces covered, but **no shared skeleton library** — each is a bespoke `animate-pulse` div |
| `swipeable` | Swipe-left to reveal a red Delete panel (Trash + "Delete"). Hardcoded `ITEM_HEIGHT = 100`. | `layouts/Recommended/RecommendedLayout.tsx` (remove buddy / dismiss recommendation) | — (`lib/buddies/connections.ts:363` only *mentions* the swipe action in a comment) | ❌ web would need a hover/menu delete affordance |
| `switch` | Label + native RN `Switch` in a space-between row. Carries stale RN props (`thumbTintColor`, `onTintColor`). | `layouts/Snooze/snooze-switch.tsx` | `VisibilitySwitch` inside `components/profile/JournalScreen.tsx:44-79` | ⚠️ web toggle exists but is private to one file, **not extracted to `components/ui/`**, and there is no snooze toggle at all |
| `tab-bar` | The main bottom navigation plus badge orchestration: Stream unread count (debounced 500 ms on `message.new`/`message.read`, refetched 1 s after focus), an AppSync `Connect` subscription for pending connections, push-driven post count, snooze mode (disables every tab, greys the icons), and route-specific tap behaviour (Chat resets to `BuddiesScreen.Home`, Groups does a `CommonActions.reset`, Updates zeroes the count). | `navigation/tabs/TabsNavigator.tsx` | `components/app-shell/{BottomBar,Sidebar}.tsx` driven by `lib/navigation/appNav.tsx` | ⚠️ same 5 tabs and same SUPPORT filtering. Badges **are** wired on web (`AppShell.tsx:36-40`: Stream `totalUnread` for chat, `usePendingRequestCount` for Updates) but the `buddies` badge key is declared and never populated; no snooze disable, no tab-reset-to-root behaviour |
| `tabs-groups` | Exactly-two-tab switcher. Default = underlined tabs; `updates` mode = borderless tabs where tab 2 carries a count badge (yellow when active, `#E5E5E5` when not). | `screens/notifications/HomeNotifications.tsx`, `layouts/Groups/ActivitiesList.tsx` | local `TabButton` in `components/notifications/UpdatesScreen.tsx` | ⚠️ equivalent on Updates but private, not shared; the Groups/ActivitiesList tab surface has no counterpart |
| `text-counter` | `NN/LIMIT characters` + a 30 px circular progress ring; turns danger and calls `handleIsValid(false)` the moment `value/limit > 1`. | feeds `NewPostScreen` (limit **2000**, shown from 1920), feeds `PostDetails` (same) | Inline text only: `StepAbout.tsx` (`BIO_MAX = 1000`), `StepBio.tsx`, `SupportForm.tsx` (`SUBJECT_MAX = 80`, `MESSAGE_MAX = 2000`) | ⚠️ no shared counter component, no ring, and **the web post composer enforces no character limit at all** |
| `toast` | Toast body + `BMToastConfig`. 5 types → background: `alert`→Bone, `success`→Success, `info`→Info, `warning`→Warning, `error`→Danger. Text white for info/error, black otherwise; tapping the icon calls `Toast.hide()`. | Mounted by `dialog-container` for `ModalPrivateGroup`; `Toast.show()` used app-wide | `components/ui/Toaster.tsx` (sonner), mounted in `app/layout.tsx` | ⚠️ web has success/info/warning/error but **no `alert` type**, and uses tinted-border/light-bg styling rather than mobile's solid brand fills |
| `typing-animation` | Three dots bouncing ±5 px on a staggered 200 ms loop. | `layouts/Chat/ChatMessagesTyping.tsx` | `components/chat/TypingIndicator.tsx` | ✅ |
| `typography` | The whole text system. **12 variants**: heading-1 40/48, heading-2 32/40, heading-3 24/32, heading-4 20/32, subtitle 18/24, body-1 16/24 (default), body-2 14/24, caption 12/16, cta-medium 14/16, cta-small 12/16, label 10/16, breadcrumb 10/16. **11 colours**, 2 weights, bullet `listStyle`, alignment, `numberOfLines`, and font scaling disabled everywhere. | Ubiquitous — imported by nearly every element and layout | — no component. Only `--font-heading` / `--font-body` in `app/globals.css`, plus ad-hoc `text-[15px]` / `text-[0.95rem]` classes per file | ❌ **no named type scale on web**; sizes drift file to file |

### `src/components/layouts/**` (68 dirs), by group

Most layout dirs are feature-specific and audited in the per-feature parity docs.
The cross-cutting ones:

| Layout | What it is | Web equivalent | Status |
|---|---|---|---|
| `AppStatus` | Full-screen modal shell (icon + single CTA) used by the maintenance/update states | — | ❌ |
| `Maintenance` | "Scheduled maintenance" full-screen block, driven by `StatusAppProvider` | — | ❌ |
| `OfflineNotice` | Polls `useNetworkStatus` every **7 s**, and after **3 consecutive failures** shows the network `ErrorLayout` and force-closes every open modal | — | ❌ |
| `UpdateAvailable` / `UpdateModal` | Optional-update banner and the "Update assistant" dialog (App Store / Play link) | — | 🚫 (no app store on web) |
| `SplashScreen` | Bootsplash hand-off | — | 🚫 |
| `Error` / `NotFound` | Generic error and 404 views | `app/(app)/**` per-route error states; Next.js `not-found` | ⚠️ no shared error layout |
| `EmptyState` / `EmptyGroups` / `EmptyUpdates` | Empty-state blocks | `GroupsEmptyState.tsx`, `ChatEmptyState.tsx`, `DiscoveryEmptyState.tsx`, `EmptyResults` in `form.tsx` | ✅ (per-feature, not shared) |
| `Templates` | `ReportTemplate`, `SubjectTemplate`, `CommentsTemplate`, `ThanksSharingTemplate` — the reusable "pick a reason then confirm" bodies | `ReportModal.tsx`, `ReportPostSheet` in `GroupSheets.tsx` | ⚠️ two implementations, no shared template |
| `BackNavigation` / `CloseButton` / `ItemHeader` | Header chrome | `Sheet` header, `LegalBackButton` | ⚠️ |
| `webview` | In-app browser for BMCF/partner content | External links open in a new tab | 🚫 |
| `PrivacyTermsContract` | Terms/privacy acceptance modal used mid-enrolment | `app/register` privacy step + `app/(legal)/**` | ✅ |
| `Ads` | Contentful ad card | `components/buddies/AdScreen.tsx` + `lib/contentful/ads.ts` | ✅ |
| `Snooze` | Snooze toggle + the layout that replaces the Feeds tab while snoozed | — | ❌ |

---

## Modals inventory

Mobile has exactly **one** modal host: `context/modal/DialogProvider.tsx` mounts
`elements/dialog-container`, and every dialog in the app is content pushed into
it via `useDialog().setContent({ children, modalSettings: { headerText } })`.
A second, older `context/modal/modal.provider.tsx` mounts `elements/modal` for
full-screen content and the offline notice.

Web has no host — `components/ui/Sheet.tsx` is rendered per callsite.

### `modal-*` element directories

| Modal | Triggered by | Content / actions | Web equivalent | Status |
|---|---|---|---|---|
| `modal/modal.tsx` (`CustomModal`) | `context/modal/modal.provider.tsx` when `toggle` is set — currently only the offline notice | Full-screen `react-native-modal`, safe-area padded, white | — | ❌ |
| `modal-container` | `context/guard/GuardProvider.tsx` (the "Unsaved changes" interstitial); also the styles behind `dialog-container` | Centred/slide-up card, header text + X, spring exit | `components/ui/Sheet.tsx` | ✅ |
| `modal-header` | `screens/profile/journal/JournalEditView.tsx`, `MyJournalLayout.tsx` | Back arrow + one CTA (`edit` icon) or a danger "remove" secondary CTA | `Sheet`'s `onBack` + footer slot | ⚠️ no CTA-in-header pattern |
| `modal-ambassador` | `HomeProfile` ambassador CTA; `UserInfo` / `UserInfoConnect` `onPressVerify` (via `useUserInfoShared.showModalAmbassador`) | headerText "Ambassador". Buttons: **DISMISS**, **BECOME AN AMBASSADOR** (opens an external link), **learn more** (finds/creates a support Stream channel and sends a message) | Ambassador badge only, in `components/chat/RoleBadges.tsx` / `BuddyCard.tsx` | ❌ |
| `modal-create-account` | `context/enrollment/EnrollmentControls.tsx` HELP menu → "I can't create an account" | 2-step: radio over `I_CANT_NOT_CREATE_ACCOUNT_REASONS`, then name + email → `sendHelpEmail` | `components/auth/HelpDialog.tsx`, view `"cant-create-account"` | ✅ |
| `modal-personal-information` | Same HELP menu → "Personal information" | 2-step: radio over `PERSONAL_INFORMATION_REASONS` (free-text required for the medical-centre reason), then name + email → `sendHelpEmail` | `HelpDialog.tsx`, view `"personal-info"` | ✅ |
| `modal-other-problems` | Same HELP menu → "Other problems" | Free-text problem + name + email → `sendHelpEmail`, reason `"Other"` | `HelpDialog.tsx`, view `"other"` | ✅ |
| `modal-medical-information` | `screens/profile/medicalInformation/MedicalInformation.tsx` help affordance | Radio over `HELP_BUTTON_MEDICAL_INFORMATION`, prefilled with the Cognito email, submitted via `raiseUserLambda` | — `HelpDialog`'s `View` union is `menu \| cant-create-account \| personal-info \| other` | ❌ |
| `modal-pending-connection` | `screens/buddies/userInfo/UserInfo.tsx:266` when a request is already pending | headerText "Connection request sent". **GOT IT** / **CANCEL REQUEST** → nested confirm dialog ("Connection request" → "YES, CANCEL REQUEST") | `BuddyProfileScreen.tsx:463` renders a "Withdraw invite" button that calls `deleteConnection` directly | ⚠️ no modal, no confirmation step |
| `modal-private-group` | `layouts/Groups/ConnectionGroup.tsx:60` when joining a private group | 6-character code field (`disabled until code.length >= 6`), inline `CODE_PRIVATE_GROUPS_NO_MATCH` error, **Ask the Host** link that opens/creates a chat with the host, and Join | `components/groups/JoinGroupDialog.tsx` `needsCode` branch | ⚠️ code gate ported; **"Ask the Host" is not** |

### Dialogs hosted in `dialog-container` (not `modal-*` dirs)

| Dialog | Triggered by | Header / actions | Web equivalent | Status |
|---|---|---|---|---|
| `ChatAttachmentMenu` | `ChatMessagesInput.tsx:287` ("Add to message"), `NewPostScreen.tsx:246` + groups `NewPost.tsx:102` ("Add to post"), both `PostDetails` ("Add to comment") | Photo / camera / document rows; selection deferred to `onModalHide` | Plain `<input type=file>` in `MessageComposer.tsx`; nothing in `PostComposer.tsx` | ⚠️ |
| `ModalHandleURL` | `NewPostScreen.tsx:155` — "Add link" | URL field inserted into the rich-text body | — | ❌ |
| `ModalGroupOptions` / `GroupActions` | groups `Feed.tsx:42`, `GroupHeader.tsx:113` | Mute / leave / report / group info rows | `PostActionsSheet` + `GroupInfoSheet` in `components/groups/GroupSheets.tsx` | ✅ |
| `LeaveGroupOptions` / `LeaveGroupConfirmationLayout` | groups `Feed.tsx:56`, `GroupHeader.tsx:131` — "Leave group" | Confirm leaving | `ConfirmSheet` in `GroupSheets.tsx` | ✅ |
| `ReportPostOptions` | `layouts/Post/Post.tsx:156`, `Post.fragment.tsx:133`, `EnrollmentControls.tsx:148`, MedicalInformation | Reason radio + submit | `ReportPostSheet` in `GroupSheets.tsx`; `components/chat/ReportModal.tsx` | ✅ |
| `ConfirmRemovePost` | `Post.tsx:174`, `Post.fragment.tsx:175` | Confirm delete | `ConfirmSheet` | ✅ |
| `ConfirmPinedPost` | `Post.fragment.tsx:197` | Confirm pin/unpin | `ConfirmSheet` (web adds a `conflict` outcome mobile lacks) | ✅ |
| `EditCommentModal` | `Post.fragment.tsx:217` | Edit an existing comment | Inline edit in `components/groups/PostThread.tsx` | ✅ |
| `ChatReactionPicker` + `ChatMessageActions` | `ChatMessageRenderer.tsx:101` (long-press a message) | Emoji row + copy/edit/delete/report | `components/chat/ReactionPicker.tsx` + the menu in `MessageBubble.tsx` | ✅ |
| `ChatOptionsModal` | `ChatMessagesMenuOptionsLayout.tsx:28` | Conversation menu | `ChatHeader.tsx` menu | ✅ |
| `ModalRemoveChanel` | `ChatMessagesMenuRemoveChannel.tsx:63` — "Remove from my buddies" | Confirm + delete connection | `ReportModal.tsx` block/report path | ⚠️ different framing |
| `ModalRemoveBuddie` | `RecommendedLayout.tsx:106` — `SURE_YOU_WANT_TO_DELETE_BUDDIES.title` | Confirm remove buddy | — (no swipe-delete on web) | ❌ |
| `ModalVerifyYourPhone` → `ModalSavePhoneNumber` → `ModalOTP` | `HomeBuddies.tsx:131`, `VerificationPhone/*` | 3-step in-dialog phone verification chain | `app/register` phone step (full page, not a dialog) | ⚠️ not available post-signup on web |
| `ChangeStatusConfirmationLayout` / `ModalConfirmChange` | `ChangeStatusLayout.tsx:57,95` — "Change my status" | Confirm the user-type change | — | ❌ |
| `ReplaceInfoConfirmationModal` | `change-status-accept.tsx:36` — "Info will be replaced" | Warn that medical info will be overwritten | — | ❌ |
| `Share` | `Recommended.tsx:169` | Share sheet with an empty header | `AccountSheet.handleShare()` | ⚠️ |
| Buddy-ID connect confirm | `UserInfo.tsx:236` — "Share your buddy id" | "Do you wish to add this new friend?" → Yes, send invite / Cancel | `BuddyIdSheet.tsx` | ✅ |
| `HintContent` | `elements/hint` (any `Input` with `hint` + `hintDescription`) | Title + up to two paragraphs + optional CTA | — | ❌ |
| `UpdateModal` | `hooks/useUpdate.tsx:71` — "Update assistant" | Open the app store | — | 🚫 |
| Unsaved changes | `context/guard/GuardProvider.tsx` | "YES, Leave" | Per-form `beforeunload` listeners | ⚠️ browser prompt only |
| `ModalStreaming` | `GroupsList.tsx:90` | Start a live session | `components/profile/ManageLivesScreen.tsx` | ✅ |
| `ModalDoesNotSupportStraming` | `HomeStreaming.tsx:31` | "Feature not supported" (device resolution) | — | 🚫 |
| `LiveOptionsModal` | `HeaderVideoControlViewer.tsx:41` | Live viewer options | `LiveOptionsSheet` + `ModerationSheet` in `components/live/LiveSheets.tsx` | ✅ |
| `DiagnosticFilter.modal` / `SearchBuddy` filters | `SearchBuddy.tsx:36`, `DiagnosticFilter.modal.tsx:60` | Filter pickers | `QuickFilterSheets.tsx` + `CustomFilterSheet.tsx` | ✅ |

---

## Context providers

Mobile mounts providers in two places — `App.tsx:38-79` and then again inside
the navigators:

```
App.tsx            I18nLanguage → SafeArea → Keyboard → Modal → ActionsSheets → Auth
                   → NavigationContainer → UIContext → PushNotification → StatusApp
                   → Dialog → Enrollment → <Main/>
MainDrawerNavigator ConnectionMap → ChatProviderLayout → Stream → Feed → Snooze
TabsNavigator      GroupsProvider
Feeds/Groups/Updates/Profile navigators   ConnectProvider  ← four separate instances
Profile/RequestBuddies navigators         GuardProvider
change-status-navigation                  ChangeStatusProvider
```

Web: `app/layout.tsx` (Toaster) → `app/(app)/layout.tsx` (AuthGuard →
StreamChatProvider → PushBridge → AppShell) → per-section layouts
(`buddies/layout.tsx`, `groups/layout.tsx`, `profile/layout.tsx`).

| Mobile provider | State it owns | Web equivalent | Status |
|---|---|---|---|
| `context/connection-map/ConnectionMapProvider.tsx` | `Record<userId, {status:'connected'\|'pending', connectionId}>`. Paginates sent + received `listConnections` to exhaustion; **`onUpdateConnection` / `onDeleteConnection` subscriptions** (:289-338); "accepted beats pending" dedup (:176, :221); resync on foreground (:346); a module-level `invalidateConnectionMap()` bridge (:116-120) so `PushNotificationProvider` — mounted *above* it — can force a resync | `lib/buddies/BuddiesProvider.tsx` + `lib/buddies/connections.ts:265` | ⚠️ web only subscribes to `onCreateConnectionByRecipientId`; **no update/delete subscription, no foreground resync, no push-driven invalidation** — a request the other party accepts stays "Pending" until reload |
| `context/status-app/status-app.provider.tsx` | `{type: 'LIVE' \| 'INMAINTENANCE' \| 'OPCIONAL_UPDATE' \| 'REQUIRED_UPDATE', reason}`. AppSync query + `onUpdateMaintenanceStatus` subscription, refetch on foreground, blocks render behind `<Loader/>` | — | ❌ |
| `context/change-status/change-status-provider.tsx` | Formik bag for the change-user-type flow + `nextUserType` | — | ❌ |
| `context/translation/translation.provider.tsx` | `I18nLanguageConstant`; renders `null` until loaded | `lib/i18n/index.ts` (module-level typed `t()`, no provider) | ✅ (different mechanism) |
| `context/auth/auth.provider.tsx` + `auth/useAuth.ts` | `user`, `unEnrolledUser`, `email`, `finishEnrollment`. Restores from AsyncStorage, **hourly token-refresh interval** (:29-38), pre-warms the Lambda client, and a `signOut` that runs each cleanup step under a **4000 ms `runSafely` race** (:249-261) before `Auth.signOut()` | `components/auth/AuthGuard.tsx` + `lib/auth-client.ts` | ⚠️ no auth context/user object, no periodic refresh, no `unEnrolledUser` resume path, no timeout-guarded sign-out; web re-derives the user id per feature via `lib/buddies/currentUser.ts:109` |
| `context/iu/UIContext.ts` | `safeAreaBgColor` | — | 🚫 |
| `context/enrollment/EnrollmentProvider.tsx` | Reducer over a 6-group screen `path`, `progress`, `currentIndex`, `isReadyToGoNext`, `userData`. **Two contexts swapped at runtime by `unEnrolledUser`** (:47-58) so half-signed-up users get a shorter path. `EnrollmentControls` wraps every step with the progress bar + HELP sheet | `lib/user-signup/store.ts` + `storage.ts` + `lib/navigation/userStepGate.ts` + `RegisterShell.tsx`; host variant in `lib/host-signup/*` | ⚠️ web is a URL-step machine with its own gates; no shared reducer, no dual "unenrolled resume" path |
| `context/stream/StreamProvider.tsx` | `count`, `hasUnreadMessages`, `hasNewChannel`, `client`, `isClientReady`. Registers the FCM device with Stream + `onTokenRefresh` (:118-138); listens for `notification.added_to_channel` / `channel_deleted`; emits the `connectWithFirstBuddy` analytics event | `lib/chat/StreamChatProvider.tsx` (15 000 ms connect timeout, :75-79) + `lib/chat/streamClient.ts` | ⚠️ no `hasNewChannel` / `added_to_channel` handling, no analytics; device registration lives in `lib/push/pushClient.ts` |
| `context/groups/GroupsProvider.tsx` | UI-only reducer: `currentGroupId`, `currentActivityId`, `postNotifications[]`, `newPostAdded`, `groupsToJoin`, `shouldRunAnimHome`; `badgeForGroups()` computes per-feed "has new post" badges | `lib/groups/GroupsProvider.tsx` | ⚠️ web owns real data (joinedGroups, liveGroupIds, `liveEventIdFor`, lazy `requireFeedSession`) and an `onCreateLiveStreamingGroupCustom` subscription, but carries **no per-group new-post badges** |
| `context/feeds/FeedProvider.tsx` | `{keys, client, feedUser}` from GetStream, initialised eagerly on mount | `lib/groups/feedClient.ts:50` `getFeedSession()` — module cache + inflight dedup, resolved lazily via `requireFeedSession` | ✅ (deliberately lazy on web) |
| `context/live-streaming/live-streaming.provider.tsx` | IVS-era broadcast state. **Not mounted anywhere** — dead code alongside the emptied `services/streaming/live-chat.ts` | `lib/live/useLiveRoom.ts` (Twilio) | 🚫 (mobile side dead) |
| `context/actionsheets/actionsheets.provider.tsx` | `toogle`, `title`, `options[]`, `actionSheetSelected`. Selection is **deferred to `onModalHide`** (:66-77) to avoid an iOS UIKit double-presentation freeze, and the index is "pulsed" so picking the same option twice re-fires | `components/ui/Sheet.tsx` (bottom sheet ≤ sm, dialog ≥ sm, nested-sheet stack so Escape peels one layer) | ⚠️ no imperative "configure options, read back index" API; every caller renders its own sheet |
| `context/snooze/SnoozeProvider.tsx` | `isSnooze` + `handleTogleSnooze`. On toggle calls the `snoozeOrUnsnooze` Lambda then **freezes/unfreezes every Stream channel** the user is in (:62-87), unfreezing only if the other member isn't snoozed. `FeedsNavigation.tsx:19` swaps the whole tab for `<SnoozeLayout/>` while snoozed | — web only *reads* `isSnooze` (`lib/buddies/discoveryFetch.ts:204`, `lib/groups/members.ts:144`, `BuddyIdSheet.tsx:60`) | ❌ no way to snooze or un-snooze from web |
| `context/push-notification/push-notification.provider.tsx` (488 lines) | `pushPost`, `hasPostMessage[]`, `idNotification[]`. Foreground / background / **cold-start** routing for `CHAT_MESSAGE`, `FRIEND_REQUEST`, `BUDDY`, `POST`, comment/reply, `LIVE_NOTIFY`. Cold start rebuilds nav state with `CommonActions.reset` (:43-67) and a 1500 ms delay; warm start uses 500 ms. Dedups by `eventId\|activityId\|channelId` (:371-375); selective notifee cancel; badge reset to 0. Gates children on `networkStatus` when logged in (:483) | `components/push/PushBridge.tsx` + `lib/push/pushClient.ts` + `public/firebase-messaging-sw.js` + `lib/notifications/routing.ts` | ⚠️ web's service worker routes **only** `channel_type === "messaging"` → `/chat/{id}`, everything else falls back to `/groups`. No cold-start reconstruction, no dedup, no badge handling |
| `context/guard/GuardProvider.tsx` | `guardControl`, `showModal`, `event.onPressLeave` — the "Unsaved changes / YES, Leave" interstitial | Per-form `beforeunload` listeners (`InterestsForm.tsx:108`, `PatientInfoForm.tsx:139`, `PersonalInfoForm.tsx:287`) | ⚠️ no in-app route-change interception |
| `context/modal/DialogProvider.tsx` | `showModal` + `content`, split into **separate actions and state contexts** (:24-32). The comment at :34-51 explains this fixed ~37 consumers re-rendering and Stream's MessageList re-measuring on every dialog open | `components/ui/Sheet.tsx` per callsite | ⚠️ no global dialog context |
| `context/modal/modal.provider.tsx` | Older full-screen modal + `showOffline` | — | ❌ |
| `context/connect/ConnectProvider.tsx` | `filterTags`, `filterQuery`, `usersList`, `currentUserData`, `bloquedUsers` (hardcoded `[]` — :216 "No block feature"), `activeConnections`. Hand-rolled external store with selector subscriptions + shallowEqual (:37-75). **Mounted 4 times**, so the same paginated connection scan runs once per tab | `lib/buddies/BuddiesProvider.tsx` + `lib/buddies/DiscoveryFiltersProvider.tsx` | ✅ web splits it correctly, mounts once, and actually populates `blockedUserIds` (`connections.ts:282`) |

---

## Hooks

`src/hooks/**` — 38 files.

| Mobile hook | What it does (with real numbers) | Web equivalent | Status |
|---|---|---|---|
| `useDebounce.ts` | `setTimeout(delay)` over a string; caller supplies ms | inlined: `useConversationSearch.ts:10` `DEBOUNCE_MS = 350` + `MIN_CHARS = 2`; `useUnreadChannels.ts:76` 400 ms | ⚠️ no shared hook |
| `useTimer.ts` | 1000 ms interval counter + `hh:mm:ss` formatter | — | ❌ |
| `useResendCooldown.ts` | OTP resend countdown that **recomputes remaining ms from the stored send timestamp on every tick and every foreground return**, so a backgrounded timer self-corrects | cooldown constants in `lib/user-signup/constants.ts:38` / `lib/host-signup/constants.ts:23`; countdown local to `StepPhone.tsx` | ⚠️ no wall-clock self-correction |
| `useAppState.ts` | `useAppStateEvents(cb)` on background→active; `useAppStateInactive()` on active→inactive. Used by ConnectionMap, StatusApp, PushNotification, useResendCooldown, useUpdate | only `lib/live/useWakeLock.ts:40` uses `visibilitychange` | ❌ no general foreground-resync primitive — the root cause of several stale-cache gaps |
| `useNetworkStatus.ts` | NetInfo wrapper with a **2000 ms stability delay** before flipping back online and a `firstRun` ref so launch is never marked offline | — (`navigator.onLine` unused anywhere) | ❌ |
| `useKeyboard.ts` | `isKeyboardVisible` | — | 🚫 |
| `useModal.ts` | Reads `modal.context`; `closeAllModals()` | — | 🚫 |
| `useDialog.ts` | `useDialog()` (actions, stable ref) and `useDialogState()` (observable) | — | 🚫 |
| `useActionSheets.ts` | `configActionSheets(options, title)`, `dismissActionSheets()` | `components/ui/Sheet.tsx` (declarative) | ⚠️ |
| `useSnooze.ts` | Context read | — | ❌ |
| `useGuard.tsx` | Context read | — | ❌ |
| `useStatusApp.ts` | Context read | — | ❌ |
| `useChangeStatus.ts` | Context read | — | ❌ |
| `useLiveStreaming.ts` | Context read (dead IVS provider) | — | 🚫 |
| `useFeedKeys.ts` | `useFeed()` context read | `useGroups().requireFeedSession()` | ✅ |
| `useLanguage.ts` | Returns `I18nLanguageConstant` | `t()` from `lib/i18n` | ✅ |
| `useMaintenance.ts` | Contentful `GET_MAINTENANCE_FLAG` → boolean, once on mount | — | ❌ |
| `usePushNotification.ts` | Context read + `clearPush()` | `PushBridge` (headless) | ⚠️ |
| `useMultiStepForm.ts` | Imports `@context/form/FormContextProvider`, **which does not exist** — the hook would throw. Dead/broken | `lib/user-signup/store.ts` | 🚫 (dead) |
| `useFormHook.ts` | Formik with `enableReinitialize`, `validateOnMount`, `validateOnBlur` | `components/ui/form.tsx` + `lib/validations.ts` (react-hook-form / zod) | ✅ (different library) |
| `useFunders.ts` | Contentful `GET_FUNDERS_CONTENTFUL` → `{name, description}[]` | `app/(app)/funders/page.tsx` renders `ScreenPlaceholder` | ❌ |
| `useQuery.ts` | SWR + `API.graphql`; `refetch` via `mutate(key)`; `fetchMore` merges `searchNotifications.items` deduped **by `createdAt`** | `lib/notifications/useNotifications.ts` + `lib/notifications/fetch.ts:158` `mergeNotifications` | ⚠️ no SWR anywhere on web; each hook hand-rolls loading state |
| `useQueryInmutable.ts` | `useSWRImmutable` variant | module-level caches (`lib/buddies/profiles.ts`, `lib/groups/feedClient.ts`, `lib/navigation/useSignedInUserType.ts`) | ⚠️ page-lifetime caches that never expire |
| `useMutation.ts` | `[fn, {loading, data, error}]` over `API.graphql` | direct `await` calls in `lib/**` | ⚠️ |
| `usePendingConnections.ts` | SWR on `GET_CONNECTIONS_PATH`; optimistic remove with `{revalidate:false}` | `lib/buddies/useRequests.ts` + `usePendingRequestCount.ts` | ✅ |
| `usePermissions.ts` | `check` → `request`; on `BLOCKED` alerts with a "Manage" → `Linking.openSettings()` CTA | browser permission prompts (`lib/push/pushClient.ts`, `lib/live/useMediaDevices.ts`) | 🚫 |
| `usePhoto.ts` | Gallery editor. `MAX_IMAGES = 6`, array padded to 6 slots, staged adds/deletes then `saveChanges()` = delete-then-upload | `lib/profile/photos.ts` (`MAX_GALLERY_PHOTOS = 6`, :15) + `PhotosForm.tsx` | ✅ |
| `usePhotoPicker.ts` | Maps action-sheet index 1/2/3 → camera / gallery / remove via `useFocusEffect` | `components/auth/PhotoPicker.tsx` + `PhotoCropper.tsx` | ✅ |
| `photo/useImagePicker.ts` | `400×400` crop, `compressImageQuality 0.5`, max `350×350`, `forceJpg`. **300 ms sleep after permission check**, **100 ms between picker and cropper** (iOS modal-conflict workaround). Circular crop overlay | `components/auth/PhotoCropper.tsx` | ⚠️ no documented 350 px / 0.5 compression contract |
| `photo/useChatMediaPicker.ts` | Photos `0.8` quality / max `1280×1280` / forceJpg; **video `compressVideoPreset:'1920x1080'`** (iOS's default `MediumQuality` blurred clips); PDFs only, **`MAX_DOCUMENT_SIZE_MB = 20`**, copied to a UUID filename because percent-encoded spaces broke the native uploader | `components/chat/MessageComposer.tsx` (`accept="image/*,application/pdf,.doc,.docx,.txt"`) | ⚠️ **no size cap on web**, and a wider mime allow-list than mobile |
| `photo/useS3Upload.ts` | `Storage.put` → `CREATE_PICTURE`; `uploadAndGetUrl` signs with **`expires: 900`** | `lib/user-signup/uploadPhoto.ts:53`, `lib/aws/s3Image.ts:24`, `lib/profile/photos.ts:99` | ✅ |
| `useFeedClient.ts` | Facade over FeedProvider keys with a local `connect(API_KEY, null, APP_ID_FEED)` fallback, plus `addFollowUser` / `unFollowGroup` (`keepHistory:false`) / `getFollowersGroup` | `lib/groups/useGroupFeed.ts` + `feedClient.ts` + `membership.ts:77` | ✅ |
| `feed/useFeedActivities.ts` | `MAX_POSTS_FOR_REQUEST = 30`; `getActivitiesGroup` uses `withReactionCounts`, `withRecentReactions`, **`recentReactionsLimit: 25`**. `addActivityUser` posts to Stream then fires a `createGroupPost` mutation purely to trigger push (failure swallowed) | `lib/groups/posts.ts` (`POSTS_PER_PAGE = 30`, :38 — read via the `newGetPostByGroup` Lambda, not Stream) | ⚠️ different read path |
| `feed/useFeedReactions.ts` | Likes / comments / threads / pins / edits over Stream REST. Child comments send **`parent` only, no `activity_id`** (:82-92) or the parent is dropped in webhooks. Pin = `pinned` reaction + `CREATE_PIN_MESSAGE` | `lib/groups/posts.ts` (`addComment`, `addReply`, `editComment`, `togglePin`, `replacePin`, `PinOutcome`) | ✅ (web adds a `conflict` pin outcome mobile lacks) |
| `useGroupPost.ts` | FCM `onMessage` → per-feed `hasNewPost` badge via `badgeForGroups` | `useGroupFeed` reloads page 1 on `onCreatePostByGroupId`, but sets no badge | ⚠️ |
| `useLocalNotifications.ts` | notifee channel `cancerbuddy_notifications`, `AndroidImportance.HIGH`, `incrementBadgeCount(1)` per display | `toast()` in `PushBridge.tsx:54` | 🚫 (no OS badge on web) |
| `useUpdate.tsx` | Forced-update assistant. Shows the modal only when the stored counter is **exactly 3 or 0** (:20), resets to 0 on show, increments on every app-inactive. `react-native-check-version` + `Linking` | — | 🚫 |
| `useSendMessageDirect.ts` | `existsChannelCreated` (`members:{$eq:[a,b]}`), `createChannelConnection`, `acceptConnectionChannel`, `createChannel(…, name:'<name> Ambassador')` | `lib/buddies/useConnectAction.ts` + `useRequests.ts` + `lib/chat/connections.ts` | ✅ |
| `useFiltersSelected.ts` | Turns `filterTags` into removable chip labels including hand-built age-range strings (`0-max`, `min-130`, `min-max`) for both user and patient ranges; `removeFilter` also nulls the paired id fields; emits `filtersToSearch` analytics on every recompute | `lib/buddies/filterChips.ts` + `filterConditions.ts` + `picklists.ts` | ✅ (no analytics on web) |
| `useValidateRules.ts` | Buddy-ID / QR rules: paginate `listUsers` until a match, reject self, reject snoozed, apply `connectAgeRulesBuddySearching`, then branch already-buddy / pending / new | `components/buddies/BuddyIdSheet.tsx` + `lib/buddies/age.ts:165` | ✅ |

Web-only hooks with no mobile counterpart: `lib/live/useMediaDevices.ts`,
`useAudioLevel.ts`, `useViewportDefaults.ts`, `useWakeLock.ts`,
`lib/chat/useUnreadChannels.ts`, `lib/chat/useConversationSearch.ts`,
`lib/navigation/useSignedInUserType.ts`.

---

## Services

| Mobile service | Exports / backend | Web equivalent | Status |
|---|---|---|---|
| `services/phone-verification/phone-verification.ts` | `sendCodePhoneService` (`USERS_LAMBDA` `sendCodePhone`, sets the resend cooldown on `sid`), `verifyCodePhoneService` (`verifyCodePhone`, expects `status === 'approved'`), `verificationEmail` (`verifyEmail`) | `lib/user-signup/cognitoUserSignupService.ts:363,509`, `lib/host-signup/cognitoHostSignupService.ts:352,504` via `lib/aws/raiseUserLambda.ts` | ✅ |
| `services/interceptors/amplify.ts` | `AmplifyRequest(query, vars)` → AppSync. **Retries once after `Auth.currentSession()`** on `UnauthorizedException` / "Token expired" / "not authorized" (:34-61) | `lib/aws/appsyncGraphql.ts:153` `executeAppSyncGraphql` — a 4-rung ladder (api-key+idToken → api-key+accessToken → Amplify userPool → IAM) | ✅ (web is more elaborate) |
| `services/interceptors/amplify2.ts` | `AmplifyRequest2(key, query, vars)` — SWR-cached AppSync read. Note it is a **hook** called from non-hook services (`groups.ts:27,70`) | — no SWR | ❌ |
| `services/status-app/status-service.ts` | `getStatusAppService()` → `getMaintenanceStatus` | — | ❌ |
| `services/groups/recommended.ts` | `getCurrenUserInformationToGroupsService`, `getGroupsWithCoincidenceService`, `allGroupsIdsService` (coincidence score ≥ 1 → recommended, rest via `pullAll`/`intersection`, drops `disabled` groups), `getJoinedGroupsUserServices` | `lib/groups/groupQueries.ts:256` `fetchAllGroups` + `components/groups/DiscoverGroups.tsx` | ❌ **the algorithm** — web lists every group with no scoring |
| `services/groups/recommended.queries.ts` | Builds one dynamic GraphQL doc from interests/diagnosis/city/hospitals/treatments plus `groupPublic` by age (`≤17` → TEENS+ALL_AGES, `≥18` → ADULTS+ALL_AGES) | — | ❌ |
| `services/groups/groups.ts` | `initializeKeysService` (GetStream connect), `getGroupsJoinedService` (SWR), `getGroupsJoinedServiceForStreaming`, `getGroupByIdService`, `getGroupsByUserService`, `getGroupFollowersService` (Stream `followStats`), `createFeedUser`. Note `__DEV__ \|\| !disabled` — disabled groups stay visible in dev | `lib/groups/groupQueries.ts` + `feedClient.ts:50` + `membership.ts:77` | ✅ |
| `services/groups/actions.ts` | `followGroupService`, `muteOrUnmuteGroupService` (asserts `statusCode === 204`), `unFollowGroupService` (`keepHistory:false` + `leftGroup`), `removeUserFromGroupService`, `reportPostService` | `lib/groups/membership.ts:22,33,56,100` | ✅ |
| `services/groups/post.ts` | `getCommentsByActivityService` → Stream `enrich/activities/` REST | `lib/groups/posts.ts:231`, `feedClient.ts:214` | ✅ |
| `services/groups/activities/activitiesFeed.ts` | `getDataGroup`, `getAllUsersIds`, `filterDeletedUsersPost`, `getuserInfoService`. **Bug at :34** — `intersection(idsActorsPost, idsActorsPost)` intersects the list with itself, so deleted-user posts are never filtered | `lib/groups/authors.ts` + `groupQueries.ts:275` | ✅ (web doesn't carry the bug) |
| `services/streaming/twilio-video.ts` | `getTwilioVideoToken` (`USERS_LAMBDA` `getTwilioToken`; the Lambda is sole authority on `isHost`/`hostIds`), `moderateParticipant` (`moderateLive`), `endLiveSession` (`endLive`), `notifyGroupLive` (**`NOTIFICATIONS_LAMBDA`**) | `lib/live/liveService.ts:95,143,163,176` — same four, same Lambdas | ✅ |
| `services/streaming/streaming.ts` | `startStreaming` / `finishedStreaming` → `LIVE_STREAM_LAMBDA` (legacy IVS RTMPS) | — | 🚫 (legacy on both sides) |
| `services/streaming/live-groups.ts` | `getLiveGroupsService`, `getLiveGroupCalendarService` (`USERS_LAMBDA` `getLiveCalendar`), `createLiveSession` (`createLive` → `{liveId, twilioRoomSid, chatChannelId}`) | `lib/groups/groupQueries.ts:297`, `lib/groups/liveGroups.ts:39` (+ `filterCalendarForPrivacy`, `buildCalendarMonths`), `lib/profile/manageLives.ts` | ✅ (web adds calendar privacy filtering + month grouping) |
| `services/streaming/live-chat.ts` | Emptied — `// IVS chat messaging removed.` | `lib/live/useLiveChat.ts` (Stream `livestream` channel, moderation signals, `MODERATION_NOTICE_THROTTLE_MS = 8000`) | 🚫 (web is ahead) |
| `services/connections/connections.ts` | `getPendingConnections`, `connectChannelSupport` (`USERS_LAMBDA` `createSupportConnection`, asserts `statusCode === 200`) | `lib/buddies/connections.ts` (superset) + `lib/host-signup/bootstrapSupportChannel.ts:130,203` | ✅ |
| `services/support/support.ts` | `sendHelpEmail` → **axios POST to `NEW_BACKEND_URL/messages/help-email`** (Hetzner, unauthenticated so it works pre-signup) | `HelpDialog.tsx:488` uses `USERS_LAMBDA` `sendEmailHelp`; `lib/support/service.ts:9` sets `defaultSupportService = mockSupportService` | ⚠️ **`/support` on web is wired to a mock — tickets go nowhere.** And the in-registration help dialog uses the *old* Lambda, not the new Hetzner endpoint |
| `services/guardian-verification/guardian-verification.ts` | `saveGuardianInfo` → `USERS_LAMBDA` `createGuardian` | `app/register/page.tsx:558,635` (inline `raiseUserLambda(CREATE_GUARDIAN)`) + `lib/aws/appsyncGuardianQueries.ts:66,81` | ✅ (web adds code read/consume; not extracted into a service) |
| `services/change-type/change-user-type.ts` | `ChangeUserTypeService` → `USERS_LAMBDA` `changeUserType` | — | ❌ |

---

## Analytics events

Mobile: `src/analytics/events.ts` (a single `emitEvent(payload)` switch) over
`@react-native-firebase/analytics`, with the event union in
`src/types/analytics/analitycsTypes.ts`.

**Web fires none of these.** `firebase` is a web dependency but is used only by
`lib/push/config.ts` / `lib/push/pushClient.ts` for FCM. There is no `gtag`,
`dataLayer`, `@vercel/analytics`, `next/script` analytics tag, or any `track()`
call anywhere in `app/`, `components/` or `lib/`.

| Event name | Fired where on mobile | Params | Web fires it? |
|---|---|---|---|
| `connectWithFirstBuddy` | `context/stream/StreamProvider.tsx:106`, once the user has ≥ 1 Stream channel | `{timestamp}` = min ms between `getUser.createdAt` and each channel's `created_at`. **Once per install** — latched in AsyncStorage | ❌ |
| `joinFirstGroup` | `layouts/Groups/ConnectionGroup.tsx:95` after a successful follow | `{timestamp}` = ms since account creation. Once per install | ❌ |
| `chatWithFirstBuddy` | `layouts/Chat/ChatMessagesInput.tsx:134` on first send | `{timestamp}` = ms since account creation. Once per install | ❌ |
| `comment` | `screens/feeds/PostDetails.tsx:258` | `{timestamp}`. Once per install | ❌ |
| `post` | `screens/feeds/NewPostScreen.tsx:188` | `{timestamp}`. Once per install — but note the guard reads the **`comment`** key (`events.ts:81`), so `post` is suppressed once a comment has been made | ❌ |
| `new_post` | `screens/feeds/NewPostScreen.tsx:193` | Splits the post body into words and logs **one event per word** as `{search: word}` — a keyword-frequency feed | ❌ |
| `openApp` | Declared in the union and handled as `analytics().logAppOpen()`, but **no call site emits it** | — | ❌ |
| `filtersToSearch` | `hooks/useFiltersSelected.ts:46`, on every filter recompute | `{Status: userType, Age: displayAge(user.birth), payload: mappedFilterLabels}` | ❌ |
| `timeToSendMessage` | `layouts/Chat/ChatMessagesInput.tsx:138`, on every send | `{timestamp: Date.now()}` | ❌ |
| `searchTerms` | Declared with a 16-value `type` union (diagnosis, condition, treatment, sideEffects, medicalCenter, mySupportOrganizations, cancerLoss, WhoLose, currentlyInUniversity, universityName, gender, location, status, interests, ageMin, ageMax) — **no call site emits it** | `{type, payload: {terms: string[]}}` | ❌ |
| `openEnrollment` | Declared and handled — **no call site emits it** | `{timestamp}` | ❌ |
| `bmcf_enrollment` | `screens/enrollment/enrollmentGroups/userInfo/LoadingPersonalInformation.tsx:141`, on enrolment completion | `{timestamp: Date.now()}` | ❌ |

Notes worth carrying into any web implementation:

- Six events are **once-per-install funnel markers** latched by
  `localStorageAnalytics` keys in AsyncStorage. A web port needs an equivalent
  latch that is per-account, not per-browser, or the numbers will not compare.
- Three declared events (`openApp`, `searchTerms`, `openEnrollment`) have no
  emitters on mobile either — do not treat them as an existing baseline.
- `post` has a real bug: `events.ts:81` reads
  `AsyncStorage.getItem(localStorageAnalytics.comment)` instead of `.post`.

---

## Business-rule utils

`src/utils/**` — only the files that encode a real rule are listed. Pure
wrappers (`graphqlRequest.ts`, `fetchData.ts`, `padding.ts`, `success.ts`) are
omitted or noted briefly.

| Mobile util | Business rule / actual constants | Web equivalent | Status |
|---|---|---|---|
| `utils/birth.ts` | The age system. `UNIVERSITY_AGE=17`, `MAXIMUM_AGE=130`, `MAXAGE=18`, `MINAGE=13`, `INFANTILE_AGE=7`, `CERO_AGE=0`, `RATE_BIRTH_MATCHES=5`. `birthRules()` returns an AppSync `[from,to]` window: 18+ → `[130y,18y]`; 14–17 → `[18y,14y]`; 8–13 → `[14y,7y]`; ≤7 → `[7y,0y]`. **Two connect guards**: `connectAgeRules` (strict — both ≥18, or both 13–17, or both 7–12) and `connectAgeRulesBuddySearching` (loose — both ≥18, or both ≥13, or both 7–12). `printAge` returns `""` for HOST/SUPPORT | `lib/buddies/age.ts:12-17` mirrors every constant except `RATE_BIRTH_MATCHES`; `birthRules`, `patientBirthRules`, `connectAgeRulesBuddySearching`, `displayAge`, `ageSuffix` are faithful ports | ⚠️ **the strict `connectAgeRules` and the ±5-year `userCoincidencesBirth` recommendation window have no web port** |
| `utils/dates.ts` | `MAX_MONTH_VALID=12`, `MAX_DIFF_YEARS=130`, regex `/^((0[1-9])\|(1[0-2]))\/(\d{4})$/`. `getPostDate`: <1 min → "Just now", <60 min → `Nm`, same day → `Nh`, yesterday → "Yesterday", else `Month D, YYYY - h:mm AM`; appends `Z` when GetStream omits it. `validateRemissionDate`: invalid if birth > remission or remission > now | `lib/profile/monthYear.ts` (`MAX_AGE_YEARS=130`, same regex, `monthYearToStoredDate` → **last day of month**, matching mobile's `birthDate`); `lib/chat/helpers.ts:96-118` for chat timestamps | ⚠️ no port of `getPostDate` — the groups feed uses different relative-time formatting |
| `utils/userProgress.ts` | Profile-completeness denominators from `userInformationLimits.ts`. Personal info: 12 keys, +2 (`CurrentlyInCollege`, `userCollegeId`) only when `userType===PATIENT && age>=18` → denominator 13 vs 11. Medical: 6 keys; SURVIVOR drops `treatments` + `treatmentStatus`, adds `inRemissionSince` → denominator 5. Caregiver: 2. `calcProgress` does **not** clamp | `lib/profile/progress.ts` — verbatim port including the `COLLEGE_SCORING_AGE=18` vs `COLLEGE_VISIBLE_AGE=17` asymmetry | ✅ |
| `utils/coincidences.ts` | Match labels: intersects the viewer's `Interests/Hospitals/Treatments/Diagnosis` id lists with the target's, prefixes `State.name`, joins with `, ` | `lib/buddies/display.ts:98-123` `matchSummary` — adds `desabilities`, `supportOrganizations` and `university` | ✅ (web is a superset) |
| `utils/userTools.ts` | Matching matrix `userTypeAllowed`: PATIENT→[PATIENT,SURVIVOR,CAREGIVER]; CAREGIVER→[CAREGIVER,SURVIVOR,PATIENT]; SURVIVOR→[SURVIVOR,CAREGIVER,PATIENT]; **HOST→[]**. `formatBuddyIdURL` = `https://cancerbuddy.bonemarrow.org/buddyId/<id>`. `formatLocation` strips `"(county)"` | `lib/buddies/types.ts:11` `USER_TYPES = ["PATIENT","SURVIVOR","CAREGIVER"]` (one flat list, not per-role); `lib/buddies/display.ts:24-32`; `BuddyIdScreen.tsx:27-30` | ⚠️ the per-role allow-matrix is flattened; the HOST→[] exclusion is implicit |
| `utils/permissions.ts` / `requestPermissions.ts` | RN permission matrix (camera/mic per platform); BLOCKED → Settings alert. FCM `requestPermission()` — enabled on `AUTHORIZED` or `PROVISIONAL` | `lib/live/useMediaDevices.ts` + browser `getUserMedia`; `lib/push/pushClient.ts` | 🚫 |
| `utils/images.ts` | `S3_URL_TTL_MS = 14 * 60 * 1000` (presigned URLs live 15 min). **Three-layer cache**: in-memory Map → Amplify `Cache` (persistent) → `Storage.get` | `lib/aws/s3Image.ts:20` — same TTL, in-memory Map + in-flight dedupe | ⚠️ **no persistent layer on web**, so every page load re-signs every avatar |
| `utils/urls.ts` | `findURLs` regex `\b(?:https?:\/\/)?(?:www\.)?([\w.-]+\.[\w.-]+)\b`; `linkifyText` wraps bare URLs in `<a>` (skips existing anchors, prepends `https://`); `splitMdString` truncates markdown while preserving `[label](url)`; `changeHTMLEntities` decodes ~70 entities | — | ❌ no linkify, no `findURLs`, no markdown-safe truncation |
| `utils/zipcodes.ts` | `ValidationZipCodes` → numeric range check against the `USAZipCodes` table (a US-only gate) | `lib/aws/appsyncPicklistQueries.ts:158-163` `searchCityZipCodes` (server lookup, `limit: 10000`) | ⚠️ different mechanism; web's `addressSchema.zipcode` is `min(1)` vs mobile's `min(5)` |
| `utils/snooze.ts` | `isSnoozeContactValidationUtil` — resolves the *other* channel member and reads `isSnooze` before allowing chat | `isSnooze` read in `lib/groups/members.ts:144`, `lib/buddies/profileDetail.ts:273`, `lib/buddies/discoveryFetch.ts:204` | ⚠️ read for filtering only; no pre-chat gate and no way to set it |
| `utils/resendCooldown.ts` | `RESEND_COOLDOWN_MS = 60000` (60 s), **keyed per address** and shared across email and phone OTP | `lib/signup/constants.ts:16` `OTP_RESEND_COOLDOWN_SEC = 30` — a per-component UI countdown, not a keyed store | ⚠️ **value halved, and backing out of a step resets it** |
| `utils/markdown.ts` | `replaceBreakLines`: `\r\n\|\r\|\n` → `<br>` | — | ❌ |
| `utils/chatReactions.ts` | `REACTIONS = like 👍, love ❤️, haha 😂, wow 😮, sad 😢, pray 🙏`; unknown type falls back to the raw string | `lib/chat/reactions.ts:6-13` — byte-identical | ✅ |
| `utils/chats.ts` | `getMembersChannelUtil` (contact = the member whose `user_id !== me`); `getNameChannelUtil` (>2 members → channel name, else contact name) | `lib/chat/helpers.ts:36-59` `channelDisplay` | ✅ |
| `utils/chatMedia.ts` | Image → `channel.sendImage` (Stream CDN resize/thumb); video/file → `channel.sendFile`. Attachment shape carries `original_width/height`, `file_size`, `duration` | Stream SDK in `lib/chat/useChannelMessages.ts` | ⚠️ attachment field parity (`original_width/height`, `duration`) unverified |
| `utils/feedMedia.ts` | Feed posts have **no Stream CDN**, so media goes to S3 via `Storage.put` and is persisted as `{type,bucket,region,key,mime,w,h,duration,name,size}`; presigned with `expires:900`, cached 14 min. `extFromMime`: `quicktime`→`mov`, defaults jpg/mp4/pdf | — `lib/groups/posts.ts` passes an `attachments` array through but has **no upload path** | ❌ web can view mobile-posted media but cannot attach any |
| `utils/files.ts` | `formatFileSize`: `<1024` → `N B`; `<1 MB` → `Math.round(kb) KB`; else `(mb).toFixed(1) MB` | `components/auth/PhotoPicker.tsx:82-83` — `toFixed(0) KB` / `toFixed(1) MB`, **no `B` branch** | ⚠️ |
| `utils/share.ts` | Shares `https://cancerbuddy.bonemarrow.org/buddyId/<id>`; iOS activityItemSources, Android title+message+url, success toast | `components/profile/BuddyIdScreen.tsx` (Web Share / copy) | ✅ |
| `utils/partners.ts` | Ads grouped by `organization`; favourites re-tagged `organization: 'Favorites'` and sorted first | `lib/buddies/favoriteAds.ts` (AppSync `FavoritesAds`), `lib/buddies/adRotation.ts` | ⚠️ favourites-first sort + org grouping not reproduced |
| `utils/errors.ts` | `AWS_ERRORS = {NotConfirmed:'UserNotConfirmedException', UsernameExists:'UsernameExistsException', LimitExceeded:'LimitExceededException'}` + a toast normaliser | `lib/errors/userFacingMessage.ts` — normalises string / Error / `{message}` / `underlyingError` / `cause` | ⚠️ the three named AWS codes are not centralised on web |
| `utils/localCache.ts` | RNFS file-per-key JSON cache under `CachesDirectoryPath/app-cache`; key sanitised `[^a-zA-Z0-9._-]→_`; every op fails soft | — | 🚫 (IndexedDB would be the analogue) |
| `utils/manyToManyMutations.ts` | `multipleMutations` fires N `API.graphql` promises then awaits sequentially, breaking on the first falsy; `useData` diffs current vs selected → delete-then-create | `lib/profile/manyToMany.ts` (`syncJoinTable` + `JoinTableConfig`) | ✅ |
| `utils/postActivityStore.ts` | Cross-screen like/comment store with `at` timestamps so an older snapshot can never overwrite a newer one; `pendingIsLiked` preserves an un-echoed local tap and folds `±1` into the server count | `lib/groups/useGroupFeed.ts:184-199` — optimistic like with rollback, but **per-hook, no cross-surface store and no monotonic `at` guard** | ⚠️ likes can visibly flip back, and counters don't sync between the feed and the post thread |
| `utils/tools.ts` | `validationAutocompleteUtil` regex `^[a-zA-Z0-9\d\-_\s_'-,.!#$&()]*$`; `setOrderArrayUtil` (unlisted → rank 999); `depureStringArrayUtil`; `capitalizeWordsUtils` | `lib/buddies/picklists.ts:154-166` `orderCatalog` (unlisted → `MAX_SAFE_INTEGER`, then alphabetical) | ⚠️ tiebreak differs (999-collision vs alpha); the autocomplete charset regex has no port |
| `utils/lambda.ts` | Cached `LambdaClient` that **rejects unauthenticated (guest) credentials**; expiry `now + 3500000` (~58 min), reuse buffer `300000` (5 min); retries once on `ExpiredTokenException`. `deleteAccount` deletes Stream channels first, then calls `delete` + `deleteAccount` | `lib/aws/raiseUserLambda.ts` | ⚠️ guest-credential rejection and the 58 min / 5 min buffers need confirming; account deletion is absent entirely |
| `utils/countiresCodeExclude.ts` | `excludeCountries = ['AQ','BV','TF','HM','UM']` — uninhabited territories removed from the phone picker | — web uses a curated `DIAL_COUNTRIES` allowlist instead | ⚠️ different approach, same effect |
| `utils/uuid.ts` | `nanoid(20)` (`LENGTH_UUID = 20`) | `Date.now()` + random hex in `lib/profile/photos.ts:61` | ⚠️ different id length/alphabet |
| `utils/enrollment/regex.ts` | `REGEX_VALIDATE_NAME` (rejects digits and a large punctuation set), `REGEX_VALIDATE_EMOJIS`, and `haveLastName` requiring ≥2 space-separated tokens | web splits into `firstName`/`lastName`, each `max(60)`, non-empty only (`lib/signup/validation.ts:30-38`) | ⚠️ **no emoji rejection and no name charset regex on web** |
| `utils/enrollment/conditions.ts` | Redirect maths keyed off age: `<MINAGE(13)` → guardian branch, else `+5`. Phone considered present when `phone.length > 6`. Verification branch: `≤12 && ≥8` → +1; `≤7` → +1; else jump to `AccountSetupUserRole` / `AccountSetupPhoneNumber` | `lib/navigation/userStepGate.ts`, `userRegisterBackTargets.ts`, `app/register/page.tsx:508,543` | ⚠️ web has **no `INFANTILE_AGE=7` branch** — it uses `CHILD_MIN_AGE = 8` |
| `utils/enrollment/redirection.ts` | Progress = `((currentIndex + counter + 1) / (path.length - 2)) * 100`, with fixed jumps (`UserRecoveryPassword`→3, `GuardianInformation`→2, `BackChildAlertCondition`→3) | `lib/navigation/hostStepGate.ts` / `userStepGate.ts` (step-array based) | ⚠️ different progress model |
| `utils/enrollment/insertions.ts` | Join-table creates keyed by `hospitalID`, `diagnosisID`, `treatmentID`, `disabilitiesID`, `interestID`, `languageID`, `supportOrganizationsID`; gallery via `UPDATE_PICTURE_AS_GALLERY` with `userGalleryId` | `lib/user-signup/userEnrollmentFinalize.ts`, `lib/profile/medicalInfo.ts:29-67` (same `targetKey`s) | ✅ |
| `utils/enrollment/register.ts` | `formatByTerms`: `name.trim()`, `birth: birthDate()` (**end of month**), `isSnooze:false`, guardian fields `\|\| null`, `terms:{acceptTerms, termsTimestamp: ISO}` | `lib/user-signup/cognitoUserSignupService.ts:200`, `lib/profile/monthYear.ts` | ✅ |
| `utils/enrollment/signup.ts` | `LoginInLambdaUtil` → GETSTREAM_LAMBDA `login` + USERS_LAMBDA `login`, passing the FCM token; stores GetStream tokens when `statusCode===200` | `lib/host-signup/hostEnrollmentFinalize.ts`, `lib/user-signup/userEnrollmentFinalize.ts` | ⚠️ no FCM token passed at login; web registers the device separately in `lib/push/pushClient.ts` |
| `utils/groups/calendar-privacy.ts` | Drops calendar rows for groups where `isPublic !== true` when the user isn't a member; **a fetch failure is treated as private** | `lib/groups/liveGroups.ts:73` | ✅ |
| `utils/groups/recommended.ts` | `cleanGroupsUtils` counts affinity per `groupID` across interests, hospitals, treatments, diagnosis, support orgs and disabilities, and excludes already-joined groups | — | ❌ no recommended-groups scoring on web |
| `utils/groups/html-rules.ts` + `markdownRules.tsx` | `cleanUrl` fixes `https://https://`, turns `https//` into `https://`, strips stray tags, HTML entities and zero-width chars `[​-‍﻿ ]`; `crearURL` → `mailto:` for `^\S+@\S+\.\S+$`, `tel:` for `^[+\d]+$`, else prepends `https://`. `readAnchortag` counts `<a>` | `lib/groups/sanitizeHtml.ts` — an allowlist of 21 tags, 14 dropped entirely, `A` keeps only `href/target/rel`, `isSafeHref` blocks `javascript:`/`data:` | ⚠️ web is **stricter and safer** (correct for a browser) but does **none of the URL repair**, so malformed authored links that mobile silently fixes render dead on web |
| `utils/groups/tools.ts` | `searchableGroupsUtil` — substring match over `name`, `description` and `Sponsor.name` | — | ❌ |
| `utils/groups/current-lives.ts` | Returns `['live', ...liveGroups, 'normal', ...normalGroups]` section markers | `lib/groups/liveGroups.ts` | ⚠️ |
| `utils/photopicker/gallery.ts` | `MAX_IMAGES_GALLERY = 6`; presign `expires:900`; pads the array to 6 with `''`; sorts by `createdAt` | `lib/profile/photos.ts:15` `MAX_GALLERY_PHOTOS = 6`, `:18` `MAX_UPLOAD_BYTES = 12 MB`, JPEG re-encode at quality `0.86` | ✅ |
| `utils/livestreaming/video.ts` | Per-device resolution: `iPhone8,4` → 720p/30/640×480; `iPhone7,1`–`8,2` → 720p/30/1280×720; else 1080p/30/1920×1080 | `lib/live/localTracks.ts:81-83` — `1280×720 ideal`, `frameRate 24`; screen share `frameRate 15` | ⚠️ lower target on web |
| `utils/storage.ts` | Legacy `@MyStorage:` prefix, imports `AsyncStorage` from `react-native` — **dead/broken, RN removed that export** | — | 🚫 (dead) |

---

## i18n / translation

The comparison here is the opposite of what the directory names suggest.

**Mobile's `src/translation/**` is a stub.** It contains exactly one catalogue —
`translation/en/settings.ts`, 23 lines, three entries (`snooze`, `changeStatus`,
`deleteAccount`), each `{title, description, action}` — reachable via
`I18nLanguageProvider` → `useLanguage()`. `translation/fr/` and `translation/es/`
contain only `.gitkeep`; **mobile ships no language other than English**, so web
is not behind on locales.

The real mobile string catalogue is **`src/res/strings/en/**`**, 870 lines of
plain exported constants imported directly (no key lookup, no interpolation):

| Mobile string group | Contents | Web counterpart | Status |
|---|---|---|---|
| `translation/en/settings.ts` | SNOOZE / CHANGE STATUS / DELETE ACCOUNT section copy | — (`grep -i "change status"` and `"delete my account"` in `lib/i18n/locales/en.ts` → 0 hits; `snooze` appears once, only as the buddy-ID error `app.buddies.buddyIdSnoozed`) | ❌ |
| `res/strings/en/common.tsx` | `NETWORK_ERROR_COPY`, `MAINTENANCE_SCHEDULED_TITLE_COPY`, `MAINTENANCE_SCHEDULED_COPY`, `COPY_UPDATE_AVAILABLE`, `COPY_MODAL_UPDATE_AVIABLE`, `FROZE_CHANNEL_COPY`, `UNFROZE_CHANNEL_COPY`, `COPY_TO_CLIPBOARD`, `COPY_EMAIL_TO_CLIPBOARD`, `SHARE_SCREEN`, `CHAT_INPUT_PLACEHOLDER_COPY`, `APP_TITLE_CANCER_BUDDY` | Only the app title has an analogue (`metadata.*`). Zero hits for maintenance, offline, update-available, freeze/unfreeze or clipboard copy | ❌ (matches the missing features) |
| `res/strings/en/enrollment.tsx` | Default step copy, under-age copy, `ALERT_USER_NOT_VERIFIED`, `ALERT_EMAIL_ALREADY_REGISTERED`, `ALERT_CODE_RECENTLY_SENT`, `ALERT_TOO_MANY_ATTEMPTS`, guardian consent options, `MINIMUM_AGE_ADVICE`, `I_CANT_NOT_CREATE_ACCOUNT_REASONS`, `VERIFICATION_CODE_SENT` | `register.*` (lines 314-618) and `hostsRegister.*` (153-313) in `lib/i18n/locales/en.ts` | ✅ web is far more complete |
| `res/strings/en/buddies.tsx` | `BADGES`, buddy-ID copy, scanner toasts, share copy, connection-request errors, and the `ORDER_*` display-order arrays | `app.buddies.*` (815-1042). Ordering arrays are mirrored in `lib/buddies/picklists.ts:108-147` — **except `ORDER_LANGUAGES_COPY`**, a curated 30-language order that web does not reproduce (web alphabetises instead) | ⚠️ |
| `res/strings/en/groups.tsx` | Join/leave/report error copy, `CODE_PRIVATE_GROUPS_NO_MATCH`, `COPY_POST_START_STREAMING`, `COPY_MODAL_NOT_SUPPORTED_STREAMING` | `app.groups.*` (1332-1493); the code-mismatch string is `app.groups.codeWrong` | ⚠️ streaming-unsupported copy has no counterpart (correctly — it's a device-capability message) |
| `res/strings/en/profile.tsx` | Save/failure toasts, `USER_DELETION_REASONS`, `LEAVE_WITHOUT_CHANGES`, journal error copy, `PHOTOPICKER_*` / `GALLERY_*` option labels, `PERSONAL_INFORMATION_REASONS`, `HELP_BUTTON_MEDICAL_INFORMATION`, `DESCRIPTION_SEARCH_LOCATION`, `DESCRIPTION_SEARCH_CITY`, `ZIPCODE_NOT_FOUND` | `app.profile.*` (1097-1331). `PERSONAL_INFORMATION_REASONS` is ported into `HelpDialog.tsx:280`; zip copy exists | ⚠️ **`USER_DELETION_REASONS`, `HELP_BUTTON_MEDICAL_INFORMATION` and the photo-picker option labels have no web equivalent** |
| `res/strings/en/change-status.tsx` | The whole change-user-type flow: `copiesWhenBecomePatient`, `copiesWhenBecomeSurvivor`, `ROLE_PLATFORM_OPTIONS`, `COPY_FINISH_CHANGE_STATUS`, `COPY_MODAL_ACCEPT_CHANGE_STATUS_INFO`, … | — | ❌ the entire flow is unported |

Architecturally, web's i18n is the better of the two: `lib/i18n/index.ts` gives
a typed `t(key, params)` with compile-time key autocomplete, `tList()` for
array leaves, `{name}` interpolation and a dev-time missing-key warning, over a
1843-line structured catalogue. Mobile has bare string constants and no
interpolation. Neither app supports a second locale today.

---

## Enums & models

Sources: `src/model/user/user.tsx`, `src/model/connect/ConnectTypes.ts`,
`src/models/index.d.ts` (Amplify DataStore), `src/models/enums/navigation/**`,
`src/types/**`.

| Enum | Members on mobile | Members on web | Missing |
|---|---|---|---|
| `UserType` (`model/user/user.tsx:1`) | `PATIENT`, `CAREGIVER`, `SURVIVOR`, `HOST`, `SUPPORT`, `AMBASSADOR` (deprecated) | `lib/profile/types.ts:11-19` all 6; `lib/buddies/types.ts:15-19` `UserTypeName` all 6 | — ✅ |
| `UserType` (`models/index.d.ts:7`, DataStore) | `PATIENT`, `SURVIVOR`, `CAREGIVER`, `SUPPORT` | n/a (no DataStore on web) | `HOST`, `AMBASSADOR` are missing from mobile's *own* DataStore enum — internal drift, not a web gap |
| `TreatmentStatus` (`user.tsx:11`) | `Pre-treatment`, `In treatment`, `Post-treatment` | only the literal `"Pre-treatment"`, compared inline (`StepDiagnosis.tsx:110,142`) | `In treatment`, `Post-treatment` — **no named enum on web, just a string compare** |
| `Treatment` (`user.tsx:17`) | `Chemotherapy`, `Hormone Therapy`, `Immunotherapy`, `Radiation Therapy`, `Surgery`, `Targeted Therapy`, `Transplant` | none — catalogue fetched via `fetchTreatments` | all 7 (acceptable — it is a dynamic catalogue) |
| `Pronoun` (`user.tsx:27`) | `he/him`, `she/her`, `they/them`, `I rather not disclose` | `lib/buddies/picklists.ts:109` uses the labels; `lib/signup/constants.ts:19` uses slugs `he_him`, `she_her`, `they_them`, `not_say` | — but **two incompatible representations coexist on web** (slugs at signup, labels in filters) |
| `Ethnicities` (`user.tsx:34`) | 9 values | `picklists.ts:119-129` — same 9, title-cased | — ✅ |
| `Transgender` (`user.tsx:46`) | **16**: Agender, Androgynous, Bigender, Cisgender Woman, Cisgender Man, Genderfluid, Genderqueer, Intersex, Non-binary, Transgender Woman, Transgender Man, Transfeminine, Transmasculine, Two-Spirit, Questioning, Prefer not to say | `picklists.ts:110` `["Yes","No","I rather not disclose"]` | 13 — **but mobile's own runtime array (`res/strings/en/buddies.tsx:179`) is also `Yes/No/I rather not disclose`.** One of the two is dead; resolve against the live `listTransgenders` catalogue before either client changes |
| `SexualOrientation` (`user.tsx:65`) | `Heterosexual`, `Gay/Lesbian`, `Bisexual`, `Queer`, `Other`, `I rather not disclose` | `picklists.ts:111-118` — same 6 (`Gay/lesbian`, matching mobile's runtime array) | — ✅ |
| `Relationship` (`user.tsx:74`) | `Parent (mom/dad)`, `Partner/spouse`, `Kid (daughter/son)`, `Sibling (brother/sister)`, `Friend`, `Relative` | `picklists.ts:130-137` — all 6 | — ✅ |
| Coping-with-loss options | `Spouse / Partner`, `Parent`, `Child`, `Sibling`, `Grandparent`, `Friend / Colleague`, `Other relative` | `picklists.ts:138-146` — all 7 | — ✅ |
| Language display order | 30 entries, spelled **`Ukranian`** (`buddies.tsx:154`) | 30 entries in `lib/aws/appsyncPicklistQueries.ts:237`, spelled **`Ukrainian`** | ⚠️ whichever spelling doesn't match the AppSync label silently drops to the alphabetical tail on that client |
| `UserDataKey` (`user.tsx:83`) | 46 form-field → AppSync-column mappings (`city→userCityId`, `photos→gallery`, `isUniversityStudent→CurrentlyInCollege`, `disabilities→desabilities`, `inRemisionSince→inRemissionSince`, `guardianEmail→parentEmail`, `copingWithCancerLoss→userCopingwithcancerlossId`, …) | no central map; AppSync names used inline (`lib/profile/types.ts`, `lib/buddies/types.ts:26-69`) | no single source of truth; **`guardianEmail → parentEmail` is not mapped anywhere on web** |
| `FilterValuesKeys` (`screens/buddies/filter/Filter.utils.ts:18`) | 19 keys + a ~31-field `FilterValues` including `otherInformation`, `ageRangesPatient`, `inRemision`, `patientDiagnosis`, `location`, `status` | `lib/buddies/types.ts:26-69` — 25 keys | `otherInformation`, `location`, `inRemision`, `patientDiagnosis`, `ageRangesPatient` (web replaced them with concrete `*Patient` fields) |
| `LambdaPayloadType` (`types/utils/lambda.ts:1`) | **39** verbs | `lib/aws/lambdaPayload.ts` — **19**: `login`, `sendCodePhone`, `verifyCodePhone`, `verifyEmail`, `createGuardian`, `createSupportConnection`, `supportMessage`, `sendEmailHelp`, `newGetPostByGroup`, `joinToGroup`, `leftGroup`, `muteGroup`, `unmuteGroup`, `getLiveCalendar`, `createLive`, `getTwilioToken`, `moderateLive`, `endLive`, `notifyGroupLive` | **20 missing**: `delete`, `deleteAccount`, `snooze`, `noSnooze`, `logout`, `supportemail`, `changeStatus`, `startStreaming`, `finishedStreaming`, `createRoomUser`, `readNotifications`, `ambassadorMessage`, `replyMessage`, `getPostByGroup`, `deleteMessage`, `getReactionsByPost`, `newGetReactionsByPost`, `finduserbyname`, `hasPinnedReactionsInGroup`, `unpinnedMessage` |
| `ReportTypes` (`types/feed/Post.ts:12`) | `COMMENT`, `POST`, `JOURNAL` | none | all 3 — web has only `POST_REPORT_REASONS` (`lib/groups/types.ts:154`), so journal and comment reporting have no type |
| Report reasons (`Templates/ReportTemplate.tsx:34-40`) | `Inappropriate comments`, `Spam`, `Made me feel uncomfortable`, `False profile`, `Other` | `lib/groups/types.ts:154-160` and `components/chat/ReportModal.tsx:13-17` — identical 5 | — ✅ |
| `GroupPublic` (`types/groups/GroupPublic.ts:1`) | `TEENS`, `ADULTS`, `ALL_PUBLIC` | `lib/groups/types.ts:51-52` — untyped `string`, and the doc comment says **`ALL_AGES`** | the enum is absent, the documented value is wrong, and **no web code branches on it — the teen/adult group audience gate is unenforced on web** |
| `AWS_ERRORS` (`utils/errors.ts:4`) | `UserNotConfirmedException`, `UsernameExistsException`, `LimitExceededException` | none | all 3 |
| Notification types | mobile's router switch (with a dead `case 'COMMENT_REPLY'`) | `lib/notifications/types.ts:31-39` — `POST`, `COMMENT`, `REPLY`, `LIKE`, `MESSAGE`, `FRIEND_REQUEST`, `BUDDY`, `NEWUSER` | — ✅ web is more explicit; `COMMENT_REPLY` confirmed dead |
| Push payload `data.type` | `CHAT_MESSAGE`, `FRIEND_REQUEST`, `BUDDY`, `POST` (incl. comment/reply), `LIVE_NOTIFY` | `public/firebase-messaging-sw.js:85-90` branches only on `channel_type === "messaging"` | **`FRIEND_REQUEST`, `BUDDY`, `POST`, `LIVE_NOTIFY` all fall back to `/groups`** |
| Connection status | `ConnectionMapEntry.status = 'pending' \| 'connected'` (`model/connect/ConnectTypes.ts:31`); rows keyed by `accepted`/`ignored` booleans | `lib/buddies/types.ts:192` `ConnectionStatus = "pending" \| "connected"`; same `{accepted:{eq:false}, ignored:{eq:false}}` filter | — ✅ |
| `ChangeStatusScreensEnum` (`models/enums/navigation/change-status.ts`) | 9: `ChangeStatusSelectScreen`, `ChangeStatusAcceptScreen`, `ChangeStatusFormScreen`, `ChangeStatusConfirmationScreen`, `ChangeStatusUpdateScreen`, `ChangeStatusFormDiagnosis`, `ChangeStatusFormMedicalCenter`, `ChangeStatusFormBirth`, `ChangeStatusFormRelationship` | none | **all 9 — the change-user-type flow does not exist on web** |
| `ChangeStatusFormScreens` | 4 (a subset of the above) | none | all 4 |
| `SessionReadyStatus` / `StateStatusUnion` (IVS era) | `NONE`, `READY`, `NOT_READY`; `DISCONNECTED\|CONNECTING\|CONNECTED\|INVALID` | `lib/live/types.ts:82-89` `LiveConnectionState` = `idle\|prejoin\|connecting\|connected\|reconnecting\|disconnected\|error` | different model (IVS → Twilio); mobile side is dead code |
| Live moderation actions | `moderateLive` payload | `lib/live/types.ts:28` `mute_audio \| mute_video \| remove \| block` | — ✅ same Lambda, same four strings |
| `HelpButtonReasonKey` / `DeleteReasonKey` | `option`, `reason` | ad-hoc field names in `HelpDialog.tsx` | no shared enum (cosmetic) |

Form-validation schemas (`model/forms/**`) are covered in the constants table
below; the notable divergences are name/emoji validation, zipcode length and
bio length.

---

## Config, constants & feature flags

Sources: `src/config/new-storage.ts`, `src/constants/**`,
`src/model/forms/**`.

| Constant / config / flag | Mobile value | Web value | Status |
|---|---|---|---|
| `MAXIMUM_AGE` / max age | `130` (`utils/birth.ts:72`) | `130` in `lib/buddies/age.ts:12` **but `120` in `lib/signup/constants.ts:5`** | ⚠️ **two different maxima inside the web app** |
| `MAXAGE` (adult threshold) | `18` | `18` (`age.ts:13`), `COLLEGE_SCORING_AGE = 18` | ✅ |
| `MINAGE` (teen threshold) | `13` | `MINAGE = 13` (`age.ts:14`), `MIN_AGE = 13` (`signup/constants.ts:4`) | ✅ |
| `INFANTILE_AGE` | `7` | `INFANTILE_AGE = 7` in `age.ts:15`, **but the signup gate uses `CHILD_MIN_AGE = 8`** | ⚠️ a 7-year-old routes differently on each client |
| `UNIVERSITY_AGE` | `17` | `UNIVERSITY_AGE = 17`, `COLLEGE_VISIBLE_AGE = 17` | ✅ |
| `RATE_BIRTH_MATCHES` | `5` — the ±5-year recommendation window | — | ❌ |
| `MAX_DIFF_YEARS` (date form) | `130` (`utils/dates.ts:4`) | `MAX_AGE_YEARS = 130` (`lib/profile/monthYear.ts:12`) | ✅ |
| `LIMIT_INTERESTS` | `10` | `10` in `lib/profile/progress.ts:17`; `lib/profile/interestsAndGoal.ts:7` explicitly notes **there is no cap enforced** | ⚠️ scored but not enforced |
| `LIMIT_LANGUAGES` | `1` | — | ❌ |
| `LIMIT_PHOTOS` / `MAX_IMAGES_GALLERY` | `6` | `MAX_GALLERY_PHOTOS = 6` (`lib/profile/photos.ts:15`) | ✅ |
| `LIMIT_PATIENT_PERSONAL_INFO` | `13` | `13` | ✅ |
| `LIMIT_CAREGIVER_AND_SURVIVOR_PERSONAL_INFO` | `11` | `11` | ✅ |
| `LIMIT_CAREGIVER_PERSONAL_INFO` | `2` | `2` | ✅ |
| `LIMIT_MEDICAL_INFORMATION_CAREGIVER` | `6` (survivor → 5) | `6` / `-1` | ✅ |
| Bio max length | `300` everywhere (`BioSchema`, `PersonalInformationSchema`) | `300` in `components/profile/PersonalInfoForm.tsx:63`, but **`1000` in `lib/user-signup/validation.ts:150`** and `BIO_MAX_LENGTH = 1000` for hosts | ⚠️ a bio written at web registration can exceed what the web profile editor will re-save |
| Post/comment body limit | `2000`, counter shown from 1920 | — `components/groups/PostComposer.tsx` has no `maxLength` | ❌ |
| Zipcode min length | `5` (`ProfileSetupAddressScheme`) | `1` (`lib/user-signup/validation.ts:146`) | ⚠️ |
| OTP length | `6` | `OTP_LENGTH = 6` | ✅ |
| OTP resend cooldown | `RESEND_COOLDOWN_MS = 60000` (60 s, address-keyed store) | `OTP_RESEND_COOLDOWN_SEC = 30` (per-component UI countdown) | ⚠️ **halved, and resets when you back out of a step** |
| Password rules | ≥8 chars, ≥1 digit, ≥1 special `[!?¿@#$%^&*_]`, ≥1 upper, ≥1 lower | `PASSWORD_MIN_LENGTH = 8` + the same four regexes (`lib/signup/validation.ts:78-96`) | ✅ |
| Phone regex | `/^(\+\d{1,4}( )?)?((\(\d{1,3}\))\|\d{1,3})[- .]?\d{3,4}[- .]?\d{2,4}$/` | `NATIONAL_MIN_DIGITS = 4`, `NATIONAL_MAX_DIGITS = 10` + a `DIAL_COUNTRIES` allowlist | ⚠️ different model |
| Phone mask | `constants/mask.tsx` `###-###-####` | — | ❌ |
| Phone-present heuristic | `phone.length > 6` during enrolment redirects | — | ❌ |
| `REGEX_VALIDATE_NAME` / `REGEX_VALIDATE_EMOJIS` | `constants/regex.ts` — rejects digits, most punctuation and emoji; last name required | `firstName`/`lastName` each non-empty + `max(60)` | ⚠️ **no charset or emoji validation on web** |
| S3 presigned URL TTL | `14 * 60 * 1000`; `expires: 900` | `TTL_MS = 14 * 60 * 1000` (`lib/aws/s3Image.ts:20`) | ✅ |
| Photo upload cap | none on mobile | `PHOTO_MAX_BYTES = 5 MB` (host), `MAX_UPLOAD_BYTES = 12 MB` (profile) | web-only, and a sensible addition |
| PDF / document cap | `MAX_DOCUMENT_SIZE_MB = 20` | — | ❌ |
| Lambda credential cache | expiry `now + 3500000` (~58 min), reuse buffer `300000` (5 min), guest creds rejected, one retry on `ExpiredTokenException` | `lib/aws/raiseUserLambda.ts` | ⚠️ buffers and guest rejection unconfirmed |
| Audience/discovery cache TTL | 5 min | `CACHE_TTL_MS = 5 * 60 * 1000` (`lib/buddies/audience.ts:24`) | ✅ |
| Paging limits | `resultLimit` in `graphql/queries/queryParams` | `RESULT_LIMIT = 1000000`, `MAX_PAGES = 200` (`lib/buddies/connections.ts:20-21`); picklists `limit: 10000` | ⚠️ equality unverified |
| `MAX_POSTS_FOR_REQUEST` | `30`, `recentReactionsLimit: 25` | `POSTS_PER_PAGE = 30` (`lib/groups/posts.ts:38`) | ✅ |
| `UNIVERSAL_DEEP_LINK` | `https://cancerbuddy.bonemarrow.org` (`constants/deepLinks.ts:5`) | same string in `BuddyIdScreen.tsx:27` | ✅ |
| `LOCAL_DEEP_LINK` | `cancerbuddy://cancerbuddy.bonemarrow.org` (`deepLinks.ts:3`) | — | ❌ no custom-scheme hand-off from web to the installed app |
| `BONE_MARROW_WEBSITE` | `https://bonemarrow.org/` | `BMCF_URL` (`lib/navigation/appNav.tsx:49`) | ✅ |
| `BONE_MARROW_EMAIL_CONTACT` | `cancerbuddy@bonemarrow.org` | `lib/i18n/locales/en.ts:52` `supportEmail` | ✅ |
| `I_RATHER_NOT_DISCLOSE` | `constants/userInfo.ts:1` | inline literal (`lib/buddies/profileDetail.ts:225`) | ⚠️ not centralised |
| `SCREENS_WITH_DRAWER_AND_TABBAR_VISIBLE` | 12 route names (`constants/routes.ts`) | `lib/navigation/appNav.tsx` | 🚫 |
| `VIDEO_CONFIG` (`constants/live-streaming/live-config.ts`) | `1080×1920`, bitrate `4_500_000`, `targetFrameRate 60`, `keyframeInterval 3`, `isBFrames true`, `isAutoBitrate true`, `maxBitrate 8_500_000`, `minBitrate 100_000`, profile `conservative` | `lib/live/localTracks.ts:81-83` — `1280×720 ideal`, `frameRate 24`; screen share `frameRate 15` | ⚠️ lower quality target on web. (Note the mobile constants are IVS-era; the live Twilio path uses `utils/livestreaming/video.ts` instead) |
| `AUDIO_CONFIG` | `bitrate: 128000` | — | ❌ |
| Live moderation notice throttle | — | `MODERATION_NOTICE_THROTTLE_MS = 8000` (`lib/live/useLiveChat.ts:26`) | web-only |
| Live event default duration | 60 min | `event.duration \|\| 60` (`lib/groups/liveGroups.ts:174`) | ✅ |
| `LENGTH_UUID` | `nanoid(20)` | `Date.now()` + random hex | ⚠️ |
| Storage keys | `@BMStorage:` prefix, `COGNITO_USER`, `USER_DATA` (`config/new-storage.ts`) | `cancerbuddy-register-draft` v1, `cancerbuddy-host-register-draft` v1; Cognito tokens in Amplify's default `localStorage` (deliberate — see `docs/SECURITY.md`) | 🚫 different namespaces by design |
| `excludeCountries` | `['AQ','BV','TF','HM','UM']` | curated `DIAL_COUNTRIES` allowlist | ⚠️ |
| Maintenance flag (Contentful) | `GET_MAINTENANCE_FLAG` → `maintenanceCollection.items[0].updateDatabase` | — | ❌ |
| Web push provisioning | FCM via `@react-native-firebase/messaging`, project `cancerbuddy-demo` | `lib/push/config.ts` reads 5 `NEXT_PUBLIC_FIREBASE_*` vars and returns `null` until all are set. **`NEXT_PUBLIC_FIREBASE_APP_ID` and `NEXT_PUBLIC_FIREBASE_VAPID_KEY` are both present in `.env`, so web push is live** — the "nobody has console access" note in the file's docblock is stale (see `docs/PUSH.md`) | ✅ (docblock needs updating) |
| Group audience gate (`groupPublic`) | `TEENS` / `ADULTS` / `ALL_PUBLIC`, applied in the recommended-groups query by age | typed as bare `string`; no branch anywhere | ❌ unenforced on web |

There are no runtime feature flags on either side — everything is compile-time
or env-driven. The closest thing to a kill switch is mobile's
`getMaintenanceStatus`, which web lacks entirely.

---

## Mobile-only platform capabilities

| Capability | Mobile implementation | Reasonable web substitute? | Status on web |
|---|---|---|---|
| Camera / QR scan | `react-native-vision-camera` + `@mgcrea/vision-camera-barcode-scanner` in `elements/BuddyIdScanner` | Yes in principle (`getUserMedia` + `BarcodeDetector` / a WASM decoder), but not built. Web substitutes manual Buddy-ID entry (`BuddyIdSheet.tsx`) and pasted deep links | 🚫 — substitute exists |
| Photo library / camera capture | `react-native-image-picker`, `react-native-image-crop-picker` (400×400 crop, quality 0.5) | Yes — `<input type="file" accept="image/*">` plus `components/auth/PhotoCropper.tsx`, already built | ✅ |
| Document picker + 20 MB PDF cap | `@react-native-documents/picker`, `MAX_DOCUMENT_SIZE_MB = 20` | Yes — `<input type="file">` plus a `File.size` check. **The cap is not implemented on web** | ⚠️ |
| In-app PDF viewing | `react-native-pdf` + `react-native-blob-util` + `react-native-fs`, with disk caching, progress, and platform-specific viewers | Yes — the browser's native PDF viewer via `<a target="_blank">`, or `<embed>`. Web links out; it does not render inline, and the groups feed doesn't handle PDFs at all | ⚠️ |
| Video playback | `react-native-video` (paused first frame + duration pill) | Yes — `<video>`. Not built for feed/chat attachments | ❌ |
| Native share sheet | `Share.share()` in `elements/buddy-id`, `qr-share` | Yes — `navigator.share` with a clipboard fallback, used in `AccountSheet.handleShare()` and `BuddyIdScreen.tsx` | ✅ |
| Clipboard | `@react-native-clipboard/clipboard` | Yes — `navigator.clipboard`, used | ✅ |
| Screen capture (`react-native-view-shot`) | Used by `usePostActions` to snapshot a post for sharing | Possible (`html2canvas`) but not built | ❌ |
| Push notifications | `@react-native-firebase/messaging` + `@notifee/react-native` (channels, OS badge count, categories, selective cancel) | Partly — FCM web push is built (`lib/push/*`, `public/firebase-messaging-sw.js`). **No OS badge, no notification channels, no selective cancel, and click-routing covers only chat** | ⚠️ |
| Local/scheduled notifications | notifee `displayNotification` with `incrementBadgeCount(1)` | The Notifications API can display, but there is no badge equivalent outside installed PWAs | 🚫 |
| Deep links | `cancerbuddy://cancerbuddy.bonemarrow.org` + universal `https://cancerbuddy.bonemarrow.org`, with cold-start nav-state reconstruction | Yes — plain URLs. Web is naturally better here; but web has no equivalent of the cold-start push→route reconstruction | ⚠️ |
| Offline detection | `@react-native-community/netinfo` + `useNetworkStatus` (2 s stability delay) + `OfflineNotice` (7 s poll, 3 strikes) | Yes — `navigator.onLine` + `online`/`offline` events. Not built | ❌ |
| App-store update check | `react-native-check-version` + `useUpdate` (counter must be 0 or 3) + `UpdateModal` | Not applicable — web deploys are always current. A service-worker "new version available" prompt would be the analogue | 🚫 |
| Maintenance kill switch | `getMaintenanceStatus` query + `onUpdateMaintenanceStatus` subscription + `MaintenanceLayout` | Yes — nothing platform-bound about it. **Not built** | ❌ |
| Keep-awake during live | `@sayem314/react-native-keep-awake` | Yes — `lib/live/useWakeLock.ts` (Screen Wake Lock API), built | ✅ |
| Device info | `react-native-device-info` (used for the live video-resolution capability gate) | Partly — `navigator.mediaDevices.getCapabilities()`. Web has `lib/live/useViewportDefaults.ts` instead | ⚠️ |
| Haptics | `react-native-haptic-feedback` is a dependency but **has no call sites** | `navigator.vibrate` exists on Android Chrome only | 🚫 (unused on mobile too) |
| Biometrics | Not implemented on mobile | — | 🚫 |
| Contacts | Not implemented on mobile | — | 🚫 |
| Offline cache / persistence | `aws-amplify` `Cache` (cleared on every launch, `App.tsx:32`), `AsyncStorage` via `config/new-storage.ts` (`@BMStorage:` prefix, in-memory mirror), `utils/localCache.ts` | `localStorage` for Cognito tokens (deliberately — see `docs/SECURITY.md` and the memory note about HTTP 431), module-level page-lifetime caches in `lib/**`. No persistent data cache | ⚠️ |
| Keyboard management | `react-native-keyboard-controller`, `keyboard-spacer`, `auto-scroll-container` | Not needed | 🚫 |
| Safe-area insets | `react-native-safe-area-context`, `UIContext.safeAreaBgColor` | `env(safe-area-inset-*)` where needed | 🚫 |
| Splash screen | `react-native-bootsplash` | `app/manifest.ts` + PWA icons exist | ⚠️ |
| In-app browser | `react-native-webview` (`layouts/webview`, BMCF/partner content, PDF viewer) | External links in a new tab | 🚫 |

---

## Cross-cutting gaps summary

Ordered by consequence, not by section.

### 1. No analytics layer at all — ❌ × 12

`src/analytics/events.ts` fires 12 Firebase events; web fires zero and has no
analytics SDK installed. Six of them are once-per-install funnel markers
(`connectWithFirstBuddy`, `joinFirstGroup`, `chatWithFirstBuddy`, `comment`,
`post`, `bmcf_enrollment`) — the exact events product uses to measure whether
onboarding works. Any web implementation must latch them **per account**, not
per browser, or the two data sets won't be comparable. Note three declared
events have no emitter on mobile either, and `post` reads the wrong latch key
(`events.ts:81`).

### 2. Missing safety and operational controls

- **The strict `connectAgeRules` guard is not ported.** Mobile has two age
  guards; web implements only the looser `connectAgeRulesBuddySearching` and
  uses it for Buddy-ID lookups (`BuddyIdSheet.tsx:64`). Under the loose rule an
  18-year-old and a 13-year-old may connect; under the strict rule they may
  not. This is a minor-safety rule.
- **`groupPublic` (TEENS / ADULTS / ALL_PUBLIC) is unenforced on web** — typed
  as bare `string`, branched on nowhere.
- **No maintenance kill switch.** `getMaintenanceStatus` +
  `onUpdateMaintenanceStatus` can put mobile into maintenance or force an
  update at runtime. Flipping it does nothing to web users.
- **Name validation is weaker on web** — no emoji rejection, no charset regex,
  no last-name requirement.
- **`MAX_AGE = 120` at web signup vs `130` in web discovery vs `130` on
  mobile**; `INFANTILE_AGE = 7` on mobile vs `CHILD_MIN_AGE = 8` on web.

### 3. Twenty of thirty-nine Lambda verbs are missing

`lib/aws/lambdaPayload.ts` declares 19 of mobile's 39. The user-visible
consequences: **no account deletion** (`delete` / `deleteAccount`), **no snooze
toggle** (`snooze` / `noSnooze` — web only *reads* `isSnooze`, so a snoozed
member cannot un-snooze from the browser), **no `changeStatus`** (the entire
9-screen change-user-type flow), **no `logout`** Lambda, and **no
`readNotifications`** (already documented as a broken Lambda in
`docs/UPDATES.md`). Everything downstream — the settings screen, the settings
string group, `ChangeStatusScreensEnum`, `SnoozeProvider` — is missing for the
same reason. `/settings` on web is 27 lines and one push card.

### 4. Composer capability

Mobile's post composer has a rich-text toolbar (`format-toolbar`), a media tray
with videos and PDFs (`post-media-tray`), a preview strip
(`media-preview-strip`), a 2000-character counter (`text-counter`) and an
in-app PDF viewer (`pdf-attachment`). `components/groups/PostComposer.tsx` is a
bare textarea: no attachments, no formatting, no length limit. There is also no
S3 upload path for feed media on web (`utils/feedMedia.ts` has no counterpart),
so web users can *view* mobile-posted attachments but cannot create them — and
`PostCard.tsx` renders every attachment as an `<img>`, so a PDF shows as a
broken image.

### 5. State freshness and live updates

- **No `useAppStateEvents` equivalent.** Mobile revalidates the connection map,
  app status and push state whenever the app returns to the foreground. Web has
  nothing, and several of its caches are page-lifetime with no expiry
  (`lib/groups/feedClient.ts`, `lib/navigation/useSignedInUserType.ts`,
  `lib/buddies/profiles.ts`).
- **Only `onCreateConnection…` is subscribed on web.** Mobile also subscribes
  to `onUpdateConnection` and `onDeleteConnection`, so a request the other
  party accepts or declines leaves the web button stuck on "Pending".
- **No offline detection** (`navigator.onLine` is unused; mobile has a 2 s
  stability delay plus a 3-strike offline modal).
- **`postActivityStore.ts` has no port** — web's optimistic like has no
  monotonic `at` guard and no cross-surface store, so likes can flip back and
  feed/thread counters can disagree.
- **Push click-routing covers chat only.** The service worker branches on
  `channel_type === "messaging"`; `FRIEND_REQUEST`, `BUDDY`, `POST` and
  `LIVE_NOTIFY` all fall back to `/groups`. No cold-start reconstruction, no
  dedup. (Web push itself *is* configured and working — the stale docblock in
  `lib/push/config.ts` says otherwise.)

### 6. No shared design-system layer, and two dead ends

- **Typography**: 12 named variants and 11 colours on mobile; two font-family
  CSS variables and per-file `text-[15px]` classes on web. This is the single
  largest source of visual drift.
- **Skeletons**: one shared `ListSkeleton` plus eleven bespoke `animate-pulse`
  blocks; mobile has a 5-variant library.
- Also unextracted on web: switch, badge, tabs, character counter, action row
  (`cta-button`), link, info card, full-screen loader.
- **`/support` on web submits to a mock.** `lib/support/service.ts:9` sets
  `defaultSupportService = mockSupportService`, so tickets from the public
  support page go nowhere — while `HelpDialog.tsx:488` uses the *old*
  `sendEmailHelp` Lambda rather than mobile's current Hetzner
  `/messages/help-email` endpoint. Two backends, one of them fake.
- **Group recommendations were never ported.** `services/groups/recommended*`
  scores groups by interests, diagnosis, city, hospitals, treatments and age
  band; `DiscoverGroups.tsx` lists everything. Buddy recommendation *was*
  ported (`lib/buddies/audience.ts`) — groups were not.

### Do not port

Dead on mobile, so nothing is owed: `elements/date-time-picker`,
`elements/filter-button-header`, `elements/keyboard-spacer`,
`elements/message`, `elements/radio-button-group`,
`elements/scrollview-container`, `context/live-streaming/**`,
`services/streaming/streaming.ts`, `hooks/useMultiStepForm.ts` (imports a
module that doesn't exist), `utils/storage.ts`. Two live mobile bugs worth
filing rather than reproducing: `activitiesFeed.ts:34`
(`intersection(x, x)` makes `filterDeletedUsersPost` a no-op) and
`TabItem.tsx:72` (a JSX element used as a truthiness guard, so the Updates dot
never renders).
