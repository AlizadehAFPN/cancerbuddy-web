# Navigation map — mobile vs web

The complete route inventory of the mobile app (`~/cancerbuddyapp`) laid against the
web app's App Router tree. This is the skeleton the rest of the parity docs hang on:
every `### Screen` heading in the feature docs corresponds to a row here.

Source of truth: `src/navigation/**` in the mobile repo, read 2026-08-07.

---

## A naming trap, first

The mobile `TabsNavigator` enum values do **not** match their keys
(`src/types/navigation/tabs.ts`):

```ts
export enum TabsNavigator {
  Buddies = 'Chat',            // ← the "Chat" tab is the BuddiesNavigation stack
  Feeds = 'Groups',            // ← the "Groups" tab is the FeedsNavigation stack
  HomeNotifications = 'HomeNotifications',
  Updates = 'Updates',
  Profile = 'Profile',
  Live = 'Live',
  RequestBuddies = 'Buddies',  // ← the "Buddies" tab is the RequestBuddies stack
}
```

Read the icon, not the key. Anything reasoning from the enum key alone will map
three of the five tabs to the wrong screen. `lib/navigation/appNav.ts` on web
already decodes this correctly.

---

## Navigator hierarchy (mobile)

```
Main (src/navigation/main/Main.tsx)
├── Auth              → AuthNavigator          (when signed out)
│   └── SignIn stack  → Login, ForgotPassword, Verification, SuccessNotification
├── App               → MainDrawerNavigator    (when signed in)
│   ├── Tabs          → TabsNavigator          (the 6 bottom tabs, below)
│   ├── Website       → WebViewLayout          ("Learn about BMCF")
│   ├── Comments      → SettingsCommentsScreen ("Tech support & suggestions")
│   ├── Share         → Share
│   ├── PrivacyPolicy → PrivacyPolicy          (privacy + child safety + terms)
│   ├── Settings      → SettingsNavigator
│   ├── Funders       → FundersSettingsScreen
│   ├── DeepLink      → DeepLinkNavigation
│   └── Partners      → PartnerNavigator
├── StatusApp         → maintenance / forced-update interstitial
└── BuddyProfile      → DeepLinkBuddyProfile   (cold-start deep link target)
```

Enrollment (`src/navigation/enrollment/Enrollment.tsx`) is mounted separately as the
sign-up wizard.

---

## The bottom tabs

| # | Tab (icon) | Enum key | Enum value | Stack | Web equivalent |
|---|---|---|---|---|---|
| 1 | Chat bubbles | `Buddies` | `'Chat'` | `BuddiesNavigation` | `/chat` + `/buddies` |
| 2 | Four circles | `Feeds` | `'Groups'` | `FeedsNavigation` | `/groups` |
| 3 | Handshake | `RequestBuddies` | `'Buddies'` | `RequestBuddiesNavigation` | `/buddies` |
| 4 | Bell | `Updates` | `'Updates'` | `UpdatesNavigation` | `/notifications` |
| 5 | Avatar | `Profile` | `'Profile'` | `ProfileNavigation` | `/profile` |
| 6 | Play circle | `Live` | `'Live'` | `StreamingNavigation` | `/live` (not in nav) |

Conditional rendering in `src/navigation/tabs/TabsNavigator.tsx`:

- **`SUPPORT` accounts** get no `Profile` tab and no `HomeNotifications`.
- **The `Live` tab is never mounted** — `route.name === TabsNav.Live ? null : …`
  filters it out unconditionally. Live is reachable only from inside Groups.
  See `docs/parity/live-streaming.md` for what this means for parity.

Web's `primaryNavFor()` reproduces the `SUPPORT` rule and omits `/live` from the
sidebar, matching mobile.

---

## Full screen inventory by stack

### Buddies stack (`BuddiesScreens.tsx`) — the "Chat" tab

| Mobile screen | Component path |
|---|---|
| `Home` | `src/screens/buddies/homeBuddies` |
| `FeedDetail` | feeds |
| `Recommended` | `src/screens/buddies/recommended` |
| `Filter` | `src/screens/buddies/filter` |
| `UserInfo` | `src/screens/buddies/userInfo` |
| `UserInfoConnect` | `src/screens/buddies/userInfo` |
| `Chat` | `src/screens/buddies/chat` |
| `Report` | `src/screens/buddies/report` |
| `GalleryScreen` | `src/screens/buddies/gallery` |
| `Adds` | `src/screens/buddies/ads` |
| `WebView` | `src/screens/buddies/webview` |
| `JournalList` | `src/screens/buddies/journal` |
| `JournalEntryDetail` | `src/screens/buddies/journal` |
| `QrIdentificationBuddies` | `src/screens/profile/qrIdentification` |
| `UserInfoProfileInvite` | shared user-info screen |
| `HomeProfile` | `src/screens/profile/homeProfile` |
| `SuccessPhoneVerification` | — |
| `PartnerNavigator` | nested partner stack |
| `PostDetail` | `src/screens/groups/post-details` |
| `ActiveUsersListGroups` | `src/screens/groups/user-active-list-groups` |
| `ActivitiesFeed` | feeds |

### Request Buddies stack (`RequestBuddiesScreens.tsx`) — the "Buddies" tab

`HomeRequestBuddies` (`src/screens/requestBuddies`), then it re-mounts the Buddies
leaves: `UserInfo`, `UserInfoConnect`, `Recommended`, `Filter`, `GalleryScreen`,
`QrIdentificationBuddies`, `UserInfoProfileInvite`, `Chat`, `Adds`, `WebView`.

### Feeds stack (`FeedsScreens.tsx`) — the "Groups" tab

`Home`, `NewPostScreen`, `PostDetail`, `ActivitiesFeed`, `RecommendedFeeds`,
`FeedDetail`, `HostDetail`, `ReportFeed`, `UserInfoScreenGroups`, `FeedUserGallery`,
`FeedJournalList`, `FeedJournalDetail`, `VideoControls`, `Chat`,
`ActiveUsersListGroups`, `EditPost`, `TwilioVideoRoom`.

### Groups stack (`GroupsScreens.tsx`)

`HomeNotificationsGroupFeed`, `Groupfeed`, `NewPost`, `RecommendedGroups`,
`GroupDetail`, `JoinGroupDetail`, `GroupUserGallery`, `PostDetail`,
`UserInfoGroups`, `ReportGroup`, `HostDetail`, `GroupJournalList`,
`GroupJournalDetail`, `ActiveUsersListGroups`, `Chat`, `EditPost`,
`TwilioVideoRoom`. (`Home` is commented out.)

### Updates stack (`UpdatesScreens.tsx`)

`Home` (HomeNotifications), `HomeUpdates`, `UserInfo`, `GalleryUpdates`,
`UpdatesJournalList`, `UpdatesJournalDetail`, `Chat`, `PostDetail`,
`ActiveUsersListGroups`, `UserInfoScreenGroups`, `HostDetail`, `EditPost`.

### Profile stack (`ProfileScreens.tsx`)

| Mobile screen | Web route |
|---|---|
| `Home` | `/profile` |
| `Personal` | `/profile/personal` |
| `CaregiverPatientPersonalInfo` | `/profile/patient` |
| `Medical` | `/profile/medical` |
| `Interests` | `/profile/interests` |
| `Languages` | — none — |
| `Photos` | `/profile/photos` |
| `Goal` | `/profile/goal` |
| `Journal` | `/profile/journal` |
| `QrIdentification` | `/profile/buddy-id` |
| `UserInfoProfileInvite` | `/buddies/[userId]` |
| `UserProfileInviteGallery` | — |
| `JournalPreview` | `/buddies/[userId]/journal` |
| `JournalEntryDetail` | `/buddies/[userId]/journal` |
| `Chat` | `/chat/[channelId]` |
| `HomeNotifications` | `/notifications` |
| `ManageLives` | `/profile/lives` |
| `ManageLivesDetail` | `/profile/lives` |
| `ManageLivesCreate` | `/profile/lives` |

`Languages` has no web route — see `docs/parity/profile.md`.

### Streaming stack (`StreamingScreens.tsx`)

`HomeStreaming`, `VideoControls`. Plus `TwilioVideoRoom` reached from Feeds/Groups.

### Settings stack (`SettingsScreens.tsx`)

`Home`, `ChangeStatus` (nested navigator), `ChangeStatusConfirmation`,
`DeleteAccount`, `AccountDeletedSuccess`, `Funders`, `ChangeStatusLayout`.

Change-status sub-stack (`change-status-screens.tsx`): `Home` (select), `Accept`,
`Update`, `ChangeStatusFormRelationship`, `ChangeStatusFormBirth`,
`ChangeStatusFormDiagnosis`, `ChangeStatusFormMedicalCenter`, `Confirmation`.

### Partners stack (`PartnerScreens.tsx`)

`Partners`, `Ads`, `WebView`.

### Deep-link stack (`DeepLinkScreens.tsx`)

`Home` (Tabs), `UserInfoProfileInvite`, `UserProfileInviteGallery`, `JournalList`,
`JournalEntryDetail`, `Home` (HomeProfile).

### Sign-in stack (`SignInScreens.tsx`)

`Login`, `ForgotPassword`, `Verification` (SetUpNewPassword), `SuccessNotification`.

---

## Drawer menu, row by row

From `src/navigation/drawer/DrawerMenu.tsx`:

| Row | Subtitle | Destination |
|---|---|---|
| Learn about BMCF | Financial assistance & resources | `Website` (in-app WebView) |
| More resources from our partners | Information, products and support. | `Partners` |
| Share with a friend | Know someone who might like this app? Tap to share. | `Share` |
| Tech support & suggestions | Send your feedback or report an error. Your comments are important to us. | `Comments` |
| Get to know our funders | CancerBuddy is made possible by independent grants. | `Funders` (conditional) |
| Read privacy policy, child safety and terms of use | — | `PrivacyPolicy` |
| Settings | — | `Settings` (conditional) |
| Log out | — | sign-out action |

Web mirrors this in `lib/navigation/appNav.ts` → `RESOURCE_LINKS` + `LOGOUT_LINK`.
Row-level differences are audited in `docs/parity/drawer-settings.md`.

---

## Web routes with no mobile counterpart

| Web route | Note |
|---|---|
| `/become-a-host` | Web-only marketing/application flow |
| `/support` | Web page for what mobile does via the `Comments` drawer screen |
| `/dashboard` | Web-only |
| `/groups/hosts`, `/groups/hosts/[hostId]` | Web surfaces hosts as a browsable list; mobile only reaches HostDetail contextually |
| `/groups/discover` | Web's own name for RecommendedGroups |
| `/(legal)/child-safety`, `/privacy`, `/terms` | Mobile bundles all three into one `PrivacyPolicy` screen |
| `/api/contentful/ads` | Web-side ad proxy |
