# Drawer, Settings, Partners & Change-Status — mobile vs web parity

Audit date: 2026-08-07.
Mobile source of truth: `~/cancerbuddyapp` (React Native), read line by line.
Web target: `~/cancerbuddy-web` (Next.js App Router).

All paths are repo-relative. Mobile paths are relative to `cancerbuddyapp/`,
web paths relative to `cancerbuddy-web/`.

---

## Summary

The **drawer shell** ported well: web's `AccountSheet` reproduces all eight
mobile drawer rows, in order, with matching titles and subtitles. Everything
below the shell is where the gaps are.

- **Settings is nearly empty.** Mobile's `/settings` has three sections —
  Snooze, Change status, Delete account — plus a version footer. Web's
  `/settings` has one section that mobile does not have at all (web push
  permission). **All three real mobile settings sections are missing.**
- **The entire change-status flow (8 screens, 6 form fields, 2 distinct
  paths) does not exist on web.** No route, no component, no lambda constant.
  `grep -i "changestatus"` over the web repo returns nothing.
- **Delete account does not exist on web.** No route, no reason picker, no
  confirmation dialog, no `deleteAccount` lambda call. This is a legal /
  app-store-policy surface (mobile's own privacy policy and the child-safety
  doc both promise users can delete their data in-app), and the web app now
  ships that promise with no way to honour it.
- **Snooze does not exist on web** — neither the toggle nor the snoozed empty
  state that mobile shows across chat/groups.
- **`/partners` and `/funders` are still `ScreenPlaceholder`s.** The data
  layer for partners already exists (`lib/contentful/ads.ts`,
  `lib/buddies/favoriteAds.ts`, `components/contentful/RichText.tsx`) — only
  the grouped list screen is missing. Funders has no query at all.
- **`/support` is a mock.** The form is nicely built but
  `defaultSupportService` is `mockSupportService`, which returns a fabricated
  ticket id after a 600 ms `setTimeout`. Nothing is sent anywhere. Mobile's
  equivalent posts to `USERS_LAMBDA` with `type: "supportemail"`.
- **Legal is the one place web is ahead**: three real routes with proper SEO
  and cross-links, versus mobile's single screen with a modal.

Totals: **31 ❌ missing**, **12 ⚠️ partial**.

---

## Drawer menu row-by-row

Mobile: `src/navigation/drawer/DrawerMenu.tsx:96-157`.
Web: `lib/navigation/appNav.tsx:93-133` rendered by
`components/app-shell/AccountSheet.tsx`.

| Mobile drawer row | Subtitle | Destination | Web equivalent | Status |
|---|---|---|---|---|
| Learn about BMCF | Financial assistance & resources | `DrawerScreens.Website` → in-app `WebView` at `https://bonemarrow.org/` (`src/screens/drawer/website/website.tsx`) | `RESOURCE_LINKS[0]` → `<a href>` to `BMCF_URL`, `target="_blank"` | ⚠️ New browser tab instead of an in-app WebView. Reasonable web adaptation; flagged because the user leaves the app. |
| More resources from our partners | Information, products and support. | `DrawerScreens.Partners` → `PartnerNavigator` | `/partners` | ⚠️ Route exists, renders `ScreenPlaceholder` — the destination is a dead end. |
| Share with a friend | Know someone who might like this app? Tap to share. | `DrawerScreens.Share` → QR code + COPY LINK (`src/screens/drawer/share/Share.tsx`) | `action: "share"` → `navigator.share()` / clipboard, no screen | ⚠️ Different mechanic and different URL — see the Share screen inventory below. |
| Tech support & suggestions | Send your feedback or report an error. Your comments are important to us. | `DrawerScreens.Comments` → 2-step form → `USERS_LAMBDA` | `/support` | ⚠️ Route exists and is well built, but submits to a mock. Copy differs (subtitle shortened to "Send feedback or report an issue"). |
| Get to know our funders | CancerBuddy is made possible by independent grants. | `DrawerScreens.Funders`. **Row is hidden when `useFunders()` returns an empty list** (`DrawerMenu.tsx:128`) | `/funders`, always shown | ⚠️ Destination is a `ScreenPlaceholder`; the conditional-hide rule is not ported. |
| Read privacy policy, child safety and terms of use | — | `DrawerScreens.PrivacyPolicy` (one screen, three docs) | `/privacy` (label "Privacy, child safety & terms") | ✅ Content parity; web splits into three routes. |
| Settings | — | `DrawerScreens.Settings`. **Row is hidden for `UserType.HOST`** (`DrawerMenu.tsx:143`) | `/settings`, always shown | ⚠️ The HOST gate is not ported. Hosts on web see a Settings row mobile deliberately hides from them. |
| Log out | — | `signOut()` + `AsyncStorage.clear()` + clear `user`/`unEnrolledUser`/`email` | `handleLogout()` → `unregisterPushDevice()` → `disconnectStream()` → `signOut()` → `router.replace("/")` | ✅ Web additionally unregisters the push device, which mobile also does in `useAuth.ts`. |

### Drawer-level behaviour, not a row

| # | Mobile capability | Source | Web status | Notes |
|---|---|---|---|---|
| D1 | Opening the drawer is blocked by swipe for HOST accounts (`swipeEnabled: userType !== UserType.HOST`) | `MainDrawerNavigator.tsx:62` | ❌ | No equivalent gate; the account sheet opens for everyone. |
| D2 | Drawer mount triggers the optional-update modal (`useUpdate` + `useStatusApp`, `DrawerMenu.tsx:41-49`) | `src/hooks/useUpdate.tsx` | ❌ | No app-version/update prompt on web (arguably N/A for a web app — noted for completeness). |
| D3 | Drawer providers: `SnoozeProvider`, `StreamProvider`, `FeedProvider`, `ConnectionMapProvider`, `ChatProviderLayout` | `MainDrawerNavigator.tsx:41-71` | ⚠️ | Web `app/(app)/layout.tsx` mounts `StreamChatProvider` + `PushBridge` only. **No `SnoozeProvider` equivalent exists on web at all.** |
| D4 | Drawer is full-width (`drawerStyle: { width: '100%' }`) | `MainDrawerNavigator.tsx:34` | ✅ | Web sheet is `min(88vw, 22rem)` — appropriate for the medium. |

---

## Settings row-by-row

Mobile: `src/screens/settings/home/HomeSettings.tsx` (the whole screen is 78
lines — there are exactly three sections and a footer).
Copy lives in `src/translation/en/settings.ts`.
Web: `app/(app)/settings/page.tsx` (27 lines, one card).

| Mobile settings row | Control type | What it does | Web equivalent | Status |
|---|---|---|---|---|
| **SNOOZE** — "Feel like taking a break? Just set your profile to snooze. Your buddies will be notified, and your profile will be hidden." | Toggle switch, label "Snooze my profile" (`components/layouts/Snooze/snooze-switch.tsx`) | `snoozeOrUnsnooze()` → `USERS_LAMBDA` with `type: "snooze"` / `"noSnooze"`; then **freezes every Stream channel the user is in** with the copy in `FROZE_CHANNEL_COPY`; unsnooze only unfreezes channels whose other member isn't also snoozed (`context/snooze/SnoozeProvider.tsx:62-87`); success toast either way | — none — | ❌ |
| **CHANGE STATUS** — "If your condition has changed, you're able to update your status at any time. This info helps match you with buddies." | Caret link, "Change my status" | Navigates to `SettingsScreens.ChangeStatus` (the 8-screen sub-navigator) | — none — | ❌ |
| **DELETE ACCOUNT** — "This will permanently delete your CancerBuddy account, including all your chats, buddies, info and journal entries." | Caret link, "Delete my account" | Navigates to `SettingsScreens.DeleteAccount` | — none — | ❌ |
| Version footer — `Version {getVersion()} ({getBuildNumber()})` and `iOS` / `Android` | Static text | Build identification for support | — none — | ❌ |
| — | — | — | **Notifications card** (`components/push/PushSettingsCard.tsx`) — browser push permission, enable/disable, blocked/unsupported/unconfigured states | 🆕 web-only (see below) |

Mobile has **no** notification-preference rows, no blocked-users row, no
language row, and no privacy-toggle row in Settings. (Language lives in the
Profile stack — `ProfileScreens.Languages`, out of scope here and already
flagged missing in `docs/parity/00-navigation-map.md:146`. Blocking is done
per-user from the report flow, not from Settings.) So the four rows above are
the complete mobile settings surface, and web ships **zero of four**.

---

## Change-status flow

Mobile entry point: Settings → "Change my status".
Navigator: `src/navigation/app/change-status/change-status-navigation.tsx`
wraps everything in `ChangeStatusProvider`
(`src/context/change-status/change-status-provider.tsx`), whose Formik state is
the 8 keys `diagnosis, treatmentStatus, treatments, inRemisionSince,
disabilities, hospitals, patientBirth, relationship`.

**Web status for the entire section: ❌ MISSING.** There is no route, no
component, no store, and no `changeStatus` entry in
`lib/aws/lambdaPayload.ts`. Everything below is documented so it can be built.

### The two paths

`change-status-select.tsx:70-80` splits the flow:

| Selected new status | Current status | Path taken |
|---|---|---|
| SURVIVOR | any | **Path A** — `SettingsScreens.ChangeStatusLayout`, a one-screen confirm |
| PATIENT | SURVIVOR | **Path A** |
| PATIENT | CAREGIVER | **Path B** — the full 6-screen form flow |
| CAREGIVER | PATIENT or SURVIVOR | **Path B** |

Path A writes `userType` (+ `inRemissionSince`) with the AppSync `UPDATE_USER`
mutation. Path B posts a `changeStatus` payload to `USERS_LAMBDA`. They are
genuinely different backends — both need porting.

---

### Step 1 — `ChangeStatusSelectScreen` (`src/screens/chageStatus/change-status-select.tsx`)

Header: current-status card (`change-status-current-role.tsx`) showing the role
artwork + "Current Status" + the role's `primaryText`.
Title: "What's your new status?"
Subtitle: "This change doesn't affect your current buddies or groups."

| Field | Control | Options | Validation | Web |
|---|---|---|---|---|
| New status | Radio group (`RadioGroup`), selecting immediately navigates | Filtered from `CHANGE_ROLE_PLATFORM_OPTIONS` (`src/res/strings/en/change-status.tsx:110`): `I've been diagnosed` / `I'm in remission` / `I'm taking care of someone` | none — tap = commit | ❌ |

Option-filtering rules (`change-status-select.tsx:50-68`), all of which need
reproducing:

- current **PATIENT** → offer SURVIVOR + CAREGIVER
- current **CAREGIVER** → offer PATIENT only (SURVIVOR is filtered out)
- current **SURVIVOR** → offer PATIENT only (CAREGIVER is filtered out)
- **under 18** (`displayAge(birth) < MAXAGE`, `MAXAGE = 18` in
  `src/utils/birth.ts:73`) → CAREGIVER is removed regardless of current type.
  The user's `birth` is re-fetched with `GET_MAIN_USER_DATA` on mount.

---

### Step 2 — `ChangeStatusAcceptScreen` (`change-status-accept.tsx`) — Path B only

Full-bleed confirmation screen (`layouts/ChangeStatus/ChangeStatusFinished`):

- Title "My new status"
- Subtitle: the chosen role's `primaryText`
- Body: "You will be asked to update your medical information."
- Role artwork
- Button "YES, THIS IS MY NEW STATUS"

Tapping it opens a modal headed **"Info will be replaced"**
(`COPY_MODAL_ACCEPT_CHANGE_STATUS_INFO`):

- becoming CAREGIVER → "In order to update your status, your medical
  information as a Patient needs to be replaced. Do you agree?"
- becoming PATIENT → "In order to update your status, your medical information
  as a Caregiver needs to be replaced."

Buttons: **CANCEL** (dismiss, stay) / **CONFIRM** (advance).

Web: ❌ — no screen, no modal, no copy.

---

### Step 3 — `ChangeStatusUpdateInformation` (`ChangeStatusUpdateInformation.tsx`) — Path B only

Interstitial: X button top-right (resets navigation to `App`), "Almost there!",
`oneonone.gif`, "Please complete your new status information", button
"update my information".

Web: ❌.

---

### Step 4 — the form screens

All four are wrapped by the HOC `ChangeStatusControl`
(`src/components/layouts/change-status/change-status-controls.tsx`), which
supplies: a progress bar, the per-screen title/description, a right
**CONTINUE** button disabled until the screen's Yup schema passes, and an
optional left **MAYBE LATER** button.

Progress denominator (`getProgress()`, line 136): 4 screens when becoming a
CAREGIVER, 2 screens when becoming a PATIENT (Relationship + Birth are dropped).
The navigator itself also drops those two screens when the *current* user is a
CAREGIVER (`change-status-navigation.tsx:17-25`).

Copy is name-interpolated per target type
(`COPY_CHANGE_STATUS_CAREGIVER_FORMS` / `COPY_CHANGE_STATUS_PATIENT_FORMS`).

#### 4a. Relationship — `ChangeStatusFormRelationship` (becoming CAREGIVER only)

Title "I'm taking care of someone" / description "Sharing info makes your
recommendations better."

| # | Field | Control | Data source | Validation | Web |
|---|---|---|---|---|---|
| 1 | `relationship` | Single-select dropdown, placeholder "Relationship to the patient" | AppSync `FORMS_GET_RELATIONSHIPS` → `listRelationships`, re-ordered by `ORDER_RELATIONSHIPS_COPY` | `ChangeStatusRelationshipScheme`: required — "This field is required" | ❌ |

#### 4b. Patient birth — `ChangeStatusFormBirth` (becoming CAREGIVER only)

Title "Can you say more, {name}?"

| # | Field | Control | Data source | Validation | Web |
|---|---|---|---|---|---|
| 2 | `patientBirth` | Masked text input, placeholder "When were they born?", numeric keypad, `maxLength=7`, auto-formats `mm/yyyy` and clamps month to 01–12 (`layouts/Age/AgeLayout.tsx:40-52`) | — | `ChangeStatusBirthScheme`: `min(7)`; "Please include a valid month and year."; "Age can not be more than 130 years old"; "Please use correct format." | ❌ |

Hint when no error: "(mm/yyyy)" with a "Why do we ask this?" expander.

#### 4c. Diagnosis — `ChangeStatusFormDiagnosis` (always)

Title "I've been diagnosed" (→PATIENT) or "Any health info you can share,
{name}?" (→CAREGIVER). Rendered by
`layouts/PatientDiagnosis/PatientDiagnosisLayout.tsx` with
`showDisabilities={false}` — **side effects are deliberately not asked here**,
unlike enrollment.

| # | Field | Control | Data source | Validation | Web |
|---|---|---|---|---|---|
| 3 | `diagnosis` | Multi-select autocomplete ("ADD ANOTHER DIAGNOSIS"), placeholder "My diagnosis" / "Diagnosis" for caregivers, search "Type in your diagnosis here" | AppSync `GET_DIAGNOSIS_WITH_FILTER` / `GET_DIAGNOSIS_BY_ID` | required — "This field is required." | ❌ |
| 4 | `treatmentStatus` | Single-select dropdown, placeholder "Currently I'm..." / "Currently In..."; **hidden when target is SURVIVOR** | AppSync `FORMS_GET_TREATMENT_STATUS` | required — "This field is required." | ❌ |
| 5 | `treatments` | Multi-select dropdown ("ADD ANOTHER TREATMENT"), placeholder "My treatment"; **cleared and disabled when `treatmentStatus.label === "Pre-treatment"`** (`PatientDiagnosisLayout.tsx:141-148`) | AppSync `FORMS_GET_TREATMENTS`, sorted by label | schema-optional, but `ChangeStatusControl` adds a **cross-field rule**: CONTINUE stays disabled unless treatment status is "Pre-treatment" *or* at least one treatment is picked (`change-status-controls.tsx:104-119`) | ❌ |
| — | `inRemisionSince` | `mm/yyyy` input, only rendered when target is SURVIVOR — unreachable in this flow, since SURVIVOR takes Path A | — | validated against the user's birth date | n/a |

#### 4d. Medical center — `ChangeStatusFormMedicalCenter` (always, last form)

Title "Where were you treated, {name}?" / "{name}, where's your patient being
treated?"; description "This info matches you to buddies nearby, so you have
the option to meet in person."
This is the only form screen with `showLeftButton: true` → a **MAYBE LATER**
button that skips straight to Confirmation.

| # | Field | Control | Data source | Validation | Web |
|---|---|---|---|---|---|
| 6 | `hospitals` | Multi-select autocomplete ("ADD ANOTHER MEDICAL CENTER"), search "Type in your medical center here", empty state "Hmm, that's not on the list yet. Please skip this step for now." | AppSync `GET_HOSPITALS_WITH_FILTER` / `GET_HOSPITALS_BY_ID` | `ChangeStatusHospitalScheme`: required — "This field is required." | ❌ |

---

### Step 5 — `ChangeStatusConfirmationScreen` (`change-status-confirmation.tsx`) — Path B

Screen: "Your current status" / role subtitle / "Please log back in to your
account to start making new connections." / button "i understand, continue".

On press it builds `ChangeStatusPayload`:

```
{ userId, DiagnosisID[], userTreatmentStatusId, TreatmentsID[], HospitalsID[] }
+ if target is CAREGIVER: { userRelationshipId, patientBirth }
```

wrapped as `{ patientTocaregivers: … }` or `{ caregiverTopatients: … }` and
posted through `ChangeUserTypeService` → `raiseUserLambda(CHANGE_USER_TYPE =
"changeStatus", USERS_LAMBDA, payload)`. On HTTP 200 it **signs the user out**
and toasts "Thanks, your profile has been updated."

Web: ❌ — and note `"changeStatus"` is absent from
`lib/aws/lambdaPayload.ts`, so even the constant needs adding.

---

### Path A — `ChangeStatusLayout` (`src/screens/chageStatus/ChangeStatusLayout.tsx`)

Single screen, no forms.

- Copy switches on current type: PATIENT sees `copiesWhenBecomeSurvivor`
  (title `Change status to "In remission"`), SURVIVOR sees
  `copiesWhenBecomePatient` (title `Change status to "I've been diagnosed"`).
  Both share the subtitle "When you change your status, you can still keep your
  buddies - you'll find them in your Buddies section."
- Button **CHANGE STATUS** → modal "Change my status" → "Are you sure you want
  to change your status to {survivor|patient}?" → **YES, CHANGE STATUS**.
- Writes AppSync `UPDATE_USER` with
  `{ id, userType, inRemissionSince: getInRemisionDate() | null }`.
- Then swaps the modal for `ChangeStatusConfirmationLayout`: green check,
  "Your status has been updated." / "To continue, log back in to your account."
  / "Then if you want to let your buddies know, go to your Buddies section." /
  button **GOT IT** → signs out and clears `AsyncStorage`.

Known mobile quirk worth reproducing carefully rather than copying: the target
type is derived from `useAuth().userType`, **not** from the `nextUserType` the
select screen set (`ChangeStatusLayout.tsx:32-46`), so `inputOptions` has no
CAREGIVER key. It works only because the select screen never routes a caregiver
here.

Web: ❌ for all of it.

---

## Screen-by-screen inventory

### Drawer › Website ("Learn about BMCF")

**Mobile:** `src/screens/drawer/website/website.tsx` — a `react-native-webview`
opened with the `url` route param; header is a close (X) button that also
toggles the drawer.
**Web:** `lib/navigation/appNav.tsx:95-100` — an external anchor. No screen.

| # | Mobile capability | Data source | Web status | Notes |
|---|---|---|---|---|
| 1 | Open `https://bonemarrow.org/` from the drawer | `src/constants/contact.tsx:1` | ⚠️ | Same URL (`BMCF_URL` in `appNav.tsx:49`), but opens a new tab instead of an in-app view. |
| 2 | Loading spinner while the page loads | — | ❌ | N/A for a new tab. |
| 3 | Close button returns to the app with the drawer open | — | ❌ | N/A for a new tab. |

**Missing on web**
- Nothing material. The two ❌s above are artefacts of the medium.

---

### Drawer › Partners

**Mobile:** `src/screens/drawer/Partner/Partner.tsx` (+ nav
`src/navigation/partners/PartnerScreens.tsx`) — the partner-resources list.
**Web:** `app/(app)/partners/page.tsx` — a `ScreenPlaceholder`.

| # | Mobile capability | Data source | Web status | Notes |
|---|---|---|---|---|
| 4 | List of ~39 partner resources, `SectionList` grouped by `organization` | Contentful `GET_ADS` (`adCollection`) | ❌ | The fetch already exists on web (`lib/contentful/ads.ts` → `/api/contentful/ads`); only the screen is missing. |
| 5 | Section headers = organization name; a "Favorites" pseudo-section pinned first, tinted `ColorBone300`, with a filled yellow star | `utils/partners.ts` `AddFavoriteAds` + `orderFirstFavorites` | ❌ | `lib/buddies/favoriteAds.ts` already reads/writes the `FavoritesAds` rows. |
| 6 | Favourited rows themselves tinted `ColorBone300` | same | ❌ | |
| 7 | Row tap → the ad detail (`DrawerScreens.Ads`) carrying `handleNext` so the detail's "Next" walks the whole flattened list and wraps at the end (`Partner.tsx:83-100`) | in-memory `flatList` with an `index` per item | ❌ | Web's ad screen has no list-mode at all. |
| 8 | Re-fetch on screen focus, so a favourite toggled in the detail is reflected on return | `navigation.addListener('focus')` | ❌ | |
| 9 | Full-screen loader while fetching | — | ❌ | |
| 10 | Reachable from the Buddies stack too, via `PartnerFromBuddiesNavigator` (back button instead of drawer toggle) | `PartnerNavigator.tsx:24` | ❌ | |

**Missing on web**
- The partners list screen in its entirety.
- Organisation grouping.
- The pinned "Favorites" section and its tinting.
- List-mode traversal (`handleNext` / wrap-around) into the ad detail.
- Refresh-on-focus.

---

### Drawer › Partners › Ad detail

**Mobile:** `src/screens/buddies/ads/AddsScreen.tsx` +
`src/components/layouts/Ads/AdLayout.tsx`.
**Web:** `app/(app)/buddies/ad/[adId]/page.tsx` + `components/buddies/AdScreen.tsx`.

| # | Mobile capability | Data source | Web status | Notes |
|---|---|---|---|---|
| 11 | Whole screen tinted with the entry's `bgColor` | Contentful `ad.bgColor` | ✅ | `AdScreen.tsx:175,199`; web adds a `DEFAULT_AD_BG` fallback for the one entry with no colour. |
| 12 | Title, hero image, sponsor logo under "SPONSORED BY" | Contentful | ✅ | |
| 13 | Rich-text description | `documentToHtmlString` + `react-native-render-html` | ✅ | Web renders with its own `components/contentful/RichText.tsx` (no `dangerouslySetInnerHTML`). |
| 14 | Favourite star — add/remove writes `FavoritesAds { userID, adsUUID }` | AppSync `CREATE_FAVORITE_AD` / `DELETE_FAVORITE_AD` | ✅ | `lib/buddies/favoriteAds.ts`; web is optimistic with rollback + toast. |
| 15 | "Read More" link → in-app `WebView` at `ad.url` | Contentful `ad.url` | ⚠️ | Web opens a new tab (documented in `docs/CONTENTFUL.md:71`). |
| 16 | Primary button is **"MORE RESOURCES"** → the Partners list when arriving from the buddy interstitial | — | ❌ | Web substitutes "Read more" → the partner URL, because `/partners` is a placeholder. Documented as deliberate; reverts once Partners ships. |
| 17 | Primary button is **"Read More"** and secondary is **"Next"** when arriving *from the Partners list* (`fromList`), with a back arrow in the header | `params.handleNext` | ❌ | Web has no list-mode; the secondary is always "Skip". |
| 18 | "Skip" advances the buddy-discovery queue and increments `profilesViewed` | `ConnectProvider` | ✅ | `countAdSkip()` in `lib/buddies/adRotation.ts`. |

**Missing on web**
- List-mode: the back arrow, the "Next" secondary, and wrap-around traversal.
- The "MORE RESOURCES" → Partners primary action.

---

### Drawer › Share

**Mobile:** `src/screens/drawer/share/Share.tsx` + `elements/qr-share/qr-share.tsx`.
**Web:** no screen — `AccountSheet.tsx:47-60` `handleShare()`.

| # | Mobile capability | Data source | Web status | Notes |
|---|---|---|---|---|
| 19 | Screen with title "Share this app with a friend!" and body "Copy the link below and send it to them, or invite them to scan this QR code:" | `SHARE_SCREEN` in `src/res/strings/en/common.tsx:17` | ❌ | Web has no share screen; the row fires an action from the sheet. |
| 20 | A rendered QR code (280 px) of the app-store link | Contentful `appStoreLinkCollection.items[0].appLink` via SWR | ❌ | Web never reads `appStoreLink` — confirmed by `docs/CONTENTFUL.md:216`. |
| 21 | **COPY LINK** button → clipboard, falling back to `https://bonemarrow.org/` if the Contentful link is missing; success toast "The link was succesfully copied to your clipboard." | `COPY_TO_CLIPBOARD` | ⚠️ | Web copies `window.location.origin` — a *different URL* (the web app, not the app-store listing) — and shows **no toast or confirmation at all**, so a clipboard-only browser gives zero feedback. |
| 22 | Loader while the link is fetched | SWR `isLoading` | ❌ | |
| — | — | — | 🆕 | Web uses the native Web Share sheet (`navigator.share`) when available, which mobile does not do. |

**Missing on web**
- The share screen and its copy.
- The QR code.
- Reading `appStoreLink` from Contentful — web shares its own origin instead.
- Any success feedback after copying.

---

### Drawer › Comments ("Tech support & suggestions")

**Mobile:** `src/screens/drawer/comments/Comments.tsx`, a 2-step wizard built
from `layouts/Templates/SubjectTemplate.tsx` → `CommentsTemplate.tsx` →
`ThanksSharingTemplate.tsx`.
**Web:** `app/support/page.tsx` + `app/support/_components/SupportForm.tsx`
(single page, outside the app shell).

| # | Mobile capability | Data source | Web status | Notes |
|---|---|---|---|---|
| 23 | **Step 1 — subject.** Title "Tell us about it", body "Help us improve CancerBuddy by sharing more information. What is the subject of your suggestion?" | — | ⚠️ | Web merges both steps onto one page with different copy. |
| 24 | Subject is a **radio group** with exactly five options: `General Comments`, `Report an error`, `App Improvement Suggestions`, `Community Safety`, `Other` | `SubjectTemplate.tsx:43-52` | ⚠️ | Web uses six *different* categories — `account`, `billing`, `content`, `bug`, `feature`, `other` (`lib/support/types.ts:3`). **"Community Safety" has no web equivalent**, and `billing` is invented (the app has no billing). |
| 25 | Choosing "Other" reveals a free-text subject box, max 100 chars, min 4 to enable Next | `SubjectTemplate.tsx:97-108` | ⚠️ | Web has a free-text subject field always, max 80. |
| 26 | **Step 2 — comment.** Title "Can you say more?", body "Help us improve CancerBuddy by sharing more details."; textarea max 1000 chars, **Submit disabled under 20 chars**; back arrow returns to step 1 | `CommentsTemplate.tsx` | ⚠️ | Web's message is max 2000, min 10, with a live counter. No back step (single page). |
| 27 | Submit → `raiseUserLambda(COMMENTS = "supportemail", USERS_LAMBDA, { subject, text, userId })` | `Comments.tsx:37-56` | ❌ | **Web submits to `mockSupportService`** — a `setTimeout` that fabricates a ticket id and discards the input (`lib/support/mockService.ts`). Nothing is sent. `"supportemail"` is not in `lib/aws/lambdaPayload.ts`. |
| 28 | Sender identity is the signed-in `userId`; no email is asked for | `useAuth()` | ❌ | Web asks the user to type an email (it is a signed-out-capable page), so an in-app report loses the account link. |
| 29 | Error toast "An error occured while send your comment, try more later" | `showErrorInToast` | ⚠️ | Web sets `attachmentError` to a generic "couldn't send" string — surfaced in the attachment slot, which is the wrong place. |
| 30 | Success screen: `oneonone.gif`, "Thanks for sharing your opinion!", "Your comments are important to us and the community…", plus **"A follow up email has been sent to {masked email}"** read from the Cognito user | `ThanksSharingTemplate.tsx:38-48` | ⚠️ | Web's success screen shows a fabricated ticket id with a copy button instead. No follow-up-email promise (correctly, since none is sent). |
| 31 | Form resets every time the screen regains focus | `useFocusEffect` | ✅ | Web's "Send another" resets. |
| — | — | — | 🆕 | Web adds an optional image attachment (≤ 4 MB, images only) — mobile has none. Note it currently goes nowhere. |

**Missing on web**
- The real submission path (`USERS_LAMBDA` / `supportemail`). This is the single
  highest-impact gap in this document after change-status and delete-account:
  the form *looks* like it works.
- The "Community Safety" category — a safety-reporting channel that mobile
  exposes and web does not.
- Attribution to the signed-in user id.
- The masked follow-up-email confirmation.

---

### Drawer › Funders

**Mobile:** `src/screens/settings/funders.tsx` — heading "CancerBuddy is
supported by independent grants from:" then, for each funder sorted by name, a
bold `name` and a `description`.
**Web:** `app/(app)/funders/page.tsx` — a `ScreenPlaceholder`.

| # | Mobile capability | Data source | Web status | Notes |
|---|---|---|---|---|
| 32 | Fetch the funders list | Contentful `GET_FUNDERS_CONTENTFUL` → `fundersCollection { name description }`; 15 live entries (`docs/CONTENTFUL.md:25`) | ❌ | Web has **no funders query at all** — `lib/contentful/queries.ts` only defines `GET_ADS`. |
| 33 | Sort alphabetically by `name` (`sortListUtil`) | — | ❌ | |
| 34 | Render name (bold) + description per funder | — | ❌ | |
| 35 | Hide the drawer row entirely when the list is empty | `DrawerMenu.tsx:128` | ❌ | Web always shows the row. |
| 36 | Graceful empty on fetch failure (`useFunders` catches → `[]`) | — | ❌ | |

**Missing on web**
- The whole screen, the Contentful query, and the empty-list row-hiding rule.

---

### Drawer › Privacy policy, child safety and terms of use

**Mobile:** `src/screens/drawer/pp/PrivacyPolicy.tsx` — one screen: heading,
the BMCF blurb, the BMCF logo, then `PrivacyTermsContractLayout` which lists
three documents, each with 3–4 summary bullets and a **"Read All →"** button
that opens `PrivacyTermsContractModal` (full document, "GOT IT" to dismiss).
Content: `src/components/layouts/PrivacyTermsContract/PrivacyTerms.examples.ts`.
**Web:** `app/(legal)/{privacy,child-safety,terms}/page.tsx` +
`components/legal/{LegalShell,LegalDocument,LegalBackButton}.tsx`, content in
`lib/legal/content.ts`.

| # | Mobile capability | Data source | Web status | Notes |
|---|---|---|---|---|
| 37 | "Your privacy comes first" — 3 summary bullets + full policy (4 numbered sections, effective 1.17.22) | hardcoded | ✅ | `PRIVACY_POLICY` in `lib/legal/content.ts:32`; header comment says copied verbatim, and the blocks match. |
| 38 | "Child Safety Standards" — 3 summary bullets + full policy (6 key elements, effective April 22, 2025) | hardcoded | ✅ | `CHILD_SAFETY` at `lib/legal/content.ts:151`. |
| 39 | "Terms of use" — 4 summary bullets + full TOU (community guidelines, arbitration, etc., last updated Jan 26 2022) | hardcoded | ✅ | `TERMS_OF_USE` at `lib/legal/content.ts:233`. |
| 40 | Block hierarchy `title` → `subtitle` → `subtitleAlt` → `text[]` → `list[]` | — | ✅ | `LegalDocument.tsx` renders exactly this hierarchy. |
| 41 | BMCF blurb + logo above the documents | `@images/bm-logo-transparent.png` | ✅ | `LegalShell.tsx` `BMCFNote()` with `BMCF_LOGO_WIDE.svg`. |
| 42 | All three docs on one screen, summaries visible together | — | ⚠️ | Web splits into three routes; the drawer row lands on `/privacy` only. Cross-links at the bottom of each doc make the other two reachable, so nothing is lost, but a member who taps the drawer row does not *see* that three documents exist until they scroll to the bottom. |
| 43 | "Read All" modal per doc | — | ✅ | Superseded by full-page routes. |
| — | — | — | 🆕 | Web adds `metadata` for each doc (indexable legal pages) and a related-docs rail — mobile has neither. |
| — | — | — | ⚠️ | Legal routes live outside `app/(app)`, so following the drawer row **leaves the app shell**: the nav disappears and the only way back is the browser-history back button. Mobile keeps the drawer header. |

**Missing on web**
- Nothing content-wise. Two navigation-shape notes only (items 42 and the shell
  exit).

---

### Settings › Home

**Mobile:** `src/screens/settings/home/HomeSettings.tsx`.
**Web:** `app/(app)/settings/page.tsx`.

Covered in full in "Settings row-by-row" above. The four mobile capabilities
(44 Snooze toggle, 45 Change-status link, 46 Delete-account link, 47 version
footer) are all ❌.

**Missing on web**
- Snooze toggle and its channel-freezing side effects.
- The change-status entry point.
- The delete-account entry point.
- Build/version identification for support.

---

### Settings › Snooze

**Mobile:** `src/components/layouts/Snooze/snooze-switch.tsx` (the control),
`src/context/snooze/SnoozeProvider.tsx` (the behaviour),
`src/components/layouts/Snooze/SnoozeLayout.tsx` (the empty state).
**Web:** — none —

| # | Mobile capability | Data source | Web status | Notes |
|---|---|---|---|---|
| 48 | Read current snooze state on mount | AppSync `GET_USER_SNOOZE_STATUS` → `getUser.isSnooze` | ❌ | |
| 49 | Toggle → `USERS_LAMBDA` `type: "snooze"` / `"noSnooze"` | `utils/lambda.ts:188` | ❌ | Neither string exists in `lib/aws/lambdaPayload.ts`. |
| 50 | On snooze: freeze **every** Stream channel the user is a member of, with system text `FROZE_CHANNEL_COPY` | `stream-chat` `channel.update({frozen:true})` | ❌ | |
| 51 | On unsnooze: unfreeze only channels whose *other* member is not also snoozed (`isSnoozeContactValidationUtil`) | — | ❌ | Subtle rule — easy to get wrong on a re-implementation. |
| 52 | Success toasts `SET_TO_SNOOZE_SUCCESS` / `UNSNOOZE_SUCCESS` | — | ❌ | |
| 53 | Snoozed empty state across the app: bell-off icon, "Your profile is set to snooze", "You won't receive any messages or updates from your buddies and groups.", button **Turn off snooze** → Settings | `SnoozeLayout.tsx` | ❌ | |
| 54 | Snooze suppresses the contextual header buttons (Find new buddies / Explore groups / QR code) | `HamburgerHeader.tsx:105-127` | ❌ | |

**Missing on web**
- Everything. A member who snoozes on their phone has no way to see or undo it
  from the web app, and the web app will happily keep showing them as active.

---

### Settings › Delete account

**Mobile:** `src/screens/settings/delete-account/DeleteAccount.tsx` and
`DeleteAccountSuccess.tsx`.
**Web:** — none —

| # | Mobile capability | Data source | Web status | Notes |
|---|---|---|---|---|
| 55 | Screen "Can you say more?" / "Help us improve by sharing more info. Your feedback is anonymous." | — | ❌ | |
| 56 | **Reason radio group**, five options from `USER_DELETION_REASONS` (`src/res/strings/en/profile.tsx:133`): "I am (or my patient is) in remission", "I found support elsewhere", "This app isn't what I expected", "I didn't find the support I need here", "Other" | — | ❌ | |
| 57 | Choosing "Other" reveals a textarea, placeholder "Type your answer here", hint "(Maximum 1000 characters)", `maxLength=1000` | — | ❌ | |
| 58 | **DELETE MY ACCOUNT** button disabled until a reason is chosen, and until the "Other" text is non-empty when "Other" is selected | `DeleteAccount.tsx:210-214` | ❌ | |
| 59 | Confirmation modal headed **"Delete my account"**: "Are you sure you want to delete your account? None of your buddies, groups, conversations or info will be saved." with a single **YES, DELETE** button | — | ❌ | |
| 60 | Deletion itself: delete every Stream `messaging` channel the user belongs to, then `raiseUserLambda(DELETE, GETSTREAM_LAMBDA, { cognitoId, name })` (`utils/lambda.ts:95`) | — | ❌ | |
| 61 | Record the reason with AppSync `CREATE_DELETE_REASON` (`{ reason }`; "Other" stores the free text) | — | ❌ | |
| 62 | Clear session (`setUser/setUnEnrolledUser/setEmail` + `clearUserFromSession`) and route to the success screen | — | ❌ | |
| 63 | Success screen: check/success image, "Your CancerBuddy account has been deleted.", "All your info is safely removed. You're always welcome to rejoin the community with a new account.", buttons X and **GOT IT** both returning to the auth stack | `DeleteAccountSuccess.tsx` | ❌ | |

**Missing on web**
- The entire account-deletion path. Both `lib/legal/content.ts` (privacy:
  "You may manually delete any information in your account at anytime") and the
  child-safety doc ("Parents have the right to review, delete, or refuse
  further collection of their child's personal data") are published on the web
  app today with no in-app mechanism behind them.

---

### Change status (all 8 screens)

**Mobile:** `src/screens/chageStatus/**` + `src/navigation/app/change-status/**`.
**Web:** — none —

Enumerated field-by-field in the "Change-status flow" section above. Rolled up:

| # | Mobile capability | Data source | Web status | Notes |
|---|---|---|---|---|
| 64 | Status-select screen with age- and type-dependent option filtering | AppSync `GET_MAIN_USER_DATA` for `birth` | ❌ | |
| 65 | Under-18 rule: CAREGIVER removed from the options (`MAXAGE = 18`) | `utils/birth.ts:73` | ❌ | |
| 66 | Accept screen + "Info will be replaced" modal (2 copy variants, CANCEL / CONFIRM) | — | ❌ | |
| 67 | "Almost there!" interstitial with a close-out escape hatch | — | ❌ | |
| 68 | Progress bar whose denominator changes with the target type (4 vs 2) | — | ❌ | |
| 69 | Relationship field + `listRelationships` catalogue | AppSync | ❌ | |
| 70 | Patient-birth `mm/yyyy` field with month clamping and 3 validation messages | — | ❌ | |
| 71 | Diagnosis multi-select autocomplete | AppSync `findDiagnosis` | ❌ | |
| 72 | Treatment-status dropdown | AppSync `listTreatmentStatuses` | ❌ | |
| 73 | Treatments multi-select with the "Pre-treatment" clear-and-disable rule and the cross-field CONTINUE gate | AppSync `listTreatments` | ❌ | |
| 74 | Medical-center multi-select autocomplete + **MAYBE LATER** skip | AppSync `findHospitals` | ❌ | |
| 75 | Confirmation screen → `changeStatus` on `USERS_LAMBDA` → forced sign-out + success toast | — | ❌ | |
| 76 | Path A (Patient ↔ Survivor): copy screen, "Change my status" modal, `UPDATE_USER` with `inRemissionSince`, confirmation modal, forced sign-out | AppSync `UPDATE_USER` | ❌ | |

**Missing on web**
- All of it — 13 distinct capabilities across 8 screens and 6 form fields.

---

## Web-only additions (not on mobile)

| Web surface | What it is | Mobile counterpart |
|---|---|---|
| `/settings` **Notifications card** (`components/push/PushSettingsCard.tsx`) | Browser push permission: enable / turn off, plus distinct copy for `denied`, `unsupported` (iOS Safari pre-install) and `unconfigured` (Firebase env vars absent). The only place that ever prompts. | Mobile handles push at the OS level, with no in-app settings row. Genuine web-only need. |
| `/become-a-host` | A full 9-step host application wizard (intro, privacy, profile, credentials, phone + OTP, email OTP, photo, bio, done) with its own draft storage and Cognito signup service. | No mobile equivalent — hosts are provisioned out of band. |
| `/support` as a **public route** | Sits outside `app/(app)`, is linked from the legal footer and reachable signed-out, and collects an email address. | Mobile's Comments screen is inside the authenticated drawer only. |
| Support **image attachment** | Optional image ≤ 4 MB, validated client-side. | Mobile has no attachment. (Currently goes nowhere — see item 27.) |
| Support **ticket id** | `CB-XXXX-XXXX` shown on success with a copy button. | Mobile shows a masked follow-up email instead. Web's id is fabricated by the mock. |
| Three separate legal routes with `metadata` | `/privacy`, `/child-safety`, `/terms`, each SEO-titled and cross-linked, with a sticky brand bar and a footer nav. | Mobile has one screen + a modal, invisible to search engines. |
| `Share` via `navigator.share()` | Uses the OS share sheet when the browser supports it. | Mobile shows a QR code instead. |
| `/api/contentful/ads` | Server-side Contentful proxy keeping the delivery token out of the bundle. | Mobile calls Contentful directly from the client. |
| `/dashboard` | Redirect stub → `/groups`. | Legacy web artefact. |

---

## Cross-screen gaps

1. **No `SnoozeProvider` on web.** Mobile wraps the entire authenticated tree
   in it (`MainDrawerNavigator.tsx:45`), and snooze state changes what several
   screens render (chat empty state, header CTAs, discoverability). Web has no
   concept of it, so a member snoozed on mobile behaves as un-snoozed on web.
   This is a cross-screen behavioural divergence, not just a missing toggle.

2. **Two lambda payload types are absent from `lib/aws/lambdaPayload.ts`.**
   `"snooze"` / `"noSnooze"`, `"supportemail"`, `"changeStatus"` and `"delete"`
   (the account-deletion one, on `GETSTREAM_LAMBDA`) all exist in mobile's
   `LambdaPayloadType` and none are declared on web. Any of the four features
   above needs these added first.

3. **Contentful coverage is partial.** Web reads `ad` only. `funders` (15
   entries, drives the Funders screen) and `appStoreLink` (drives the share QR)
   are both unread — confirmed by `docs/CONTENTFUL.md:216-218`. The delivery
   proxy at `/api/contentful/ads` is ad-specific; adding funders means either a
   second route or generalising it.

4. **A working-looking mock in production code.** `defaultSupportService =
   mockSupportService` (`lib/support/service.ts:9`) has no dev-only guard and
   no visible "not wired up yet" affordance. A user who reports a safety issue
   gets a ticket id and no ticket. Worth either wiring or gating loudly.

5. **Role gates are dropped.** Mobile hides Settings from `HOST`
   (`DrawerMenu.tsx:143`) and disables drawer swipe for them
   (`MainDrawerNavigator.tsx:62`). Web's `primaryNavFor()` correctly reproduces
   the `SUPPORT` rule for the primary tabs, but `RESOURCE_LINKS` is a flat
   constant with no role filtering — so the account sheet is identical for
   every account type.

6. **Two forced-sign-out flows have no web home.** Both change-status paths end
   by signing the user out and asking them to log back in
   (`change-status-confirmation.tsx:50-58`, `ChangeStatusConfirmationLayout.tsx:44`),
   as does account deletion. Whoever builds these on web needs a
   sign-out-then-return pattern that does not strand the user — web's
   `AccountSheet.handleLogout` (`router.replace("/")`) is the closest existing
   precedent.

7. **Legal routes leave the app shell.** `/privacy` is in the `(legal)` route
   group with its own chrome, so tapping the drawer row from inside the app
   drops the sidebar/bottom bar. Consider a nested legal view under `(app)`, or
   at minimum a "back to app" affordance for signed-in members.

8. **The drawer's conditional rows are unconditional on web.** Both mobile
   conditions — funders-row-when-list-non-empty and settings-row-when-not-HOST
   — are absent. Low severity individually; together they mean the web account
   sheet can show two rows mobile would have hidden.
