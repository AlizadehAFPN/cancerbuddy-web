# Profile — mobile vs web parity

Source of truth: `~/cancerbuddyapp/src/navigation/profile/ProfileScreens.tsx` and every
screen it reaches, read line by line 2026-08-07.
Target: `~/cancerbuddy-web` — `app/(app)/profile/**`, `components/profile/**`,
`lib/profile/**`.

Mobile paths in this document are relative to `~/cancerbuddyapp`; web paths are relative
to `~/cancerbuddy-web`.

---

## Summary

The profile stack is the **most complete** feature port in the web app. All nine editable
sections exist, the per-`UserType` visibility rules are ported faithfully (including the
two that read as bugs), the completion-ring maths is a verbatim port down to the
denominators, and the many-to-many save diffing matches mobile's create/delete semantics.
Three web screens are outright better than mobile: the profile hub has a real error state,
the journal pages to exhaustion, and the "you're not hosting a group" case is explained
rather than shown as an empty list.

What is missing clusters into five themes:

1. **The avatar header is stripped.** Mobile shows `First, age`, `City, ST`, and pronouns
   under the name. Web shows the name, role badge and goal only. Three visible facts gone.
2. **Every "Help — I can't find my information" path is absent.** Mobile's Medical screen
   carries a life-buoy HELP button that opens a two-step support form
   (`modal-medical-information`) wired to `SENDEMAILHELP` on `USERS_LAMBDA`. The web
   Medical screen has no help affordance at all. The ambassador badge is likewise inert on
   web — mobile taps through to `modal-ambassador`.
3. **The Buddy ID screen is a weaker duplicate.** `/profile/buddy-id` looks a person up by
   ID with only a not-found check. Mobile runs five validations (self, snoozed, minor-
   protection age rule, already-buddies, invite-pending) each with its own copy. The web
   app *has* all five — in `components/buddies/BuddyIdSheet.tsx` — but the profile screen
   doesn't use them. Also no ID input mask and no QR scanning.
4. **Small per-field rules dropped.** Support organizations lose their `limit: 3`;
   treatments lose their "required once a status is chosen" rule; the remission date is no
   longer cross-checked against the user's own birth date; the State field disappears from
   the address block entirely; several catalogue orderings and help texts are gone.
5. **Photos lost the replace action and the camera.** Mobile's per-slot action sheet offers
   *Remove* and *Change*; web offers only remove. Neither client reorders or nominates a
   primary photo, so that part is even.

**Counts.** Across the visibility matrix and the fifteen screen tables: **57 ❌ missing**,
**81 ⚠️ partial**, 188 ✅ present, and 31 ➕ where the web does something mobile doesn't.
The *Cross-screen gaps* section at the end re-states nine of those as themes rather than
adding new ones.

---

## UserType visibility matrix

`UserType` values (mobile `src/model/user/user.tsx`, web `lib/profile/types.ts`):
`PATIENT`, `CAREGIVER`, `SURVIVOR`, `HOST`, `SUPPORT`, and the deprecated `AMBASSADOR`
(ambassadorship is really the boolean `ambassador` field).

### Hub sections

| Section | PATIENT | CAREGIVER | SURVIVOR | HOST | SUPPORT | Web behaviour |
|---|---|---|---|---|---|---|
| Whole Profile tab | ✅ | ✅ | ✅ | ✅ | **never mounted** (mobile `TabsNavigator`) | ✅ `canAccessProfile()` returns false for SUPPORT; `ProfileGate` renders `ProfileForbidden` |
| Manage Lives | — | — | — | ✅ | — | ✅ `sections.manageLives = userType === HOST` |
| Personal (own) | ✅ | ✅ | ✅ | ✅ | — | ✅ always |
| Medical (own) | ✅ | **hidden** | ✅ | ✅ | — | ✅ `sections.ownMedical = userType !== CAREGIVER` |
| Photos | ✅ | ✅ | ✅ | ✅ | — | ✅ always |
| Interests | ✅ | ✅ | ✅ | ✅ | — | ✅ always |
| Languages *(card commented out on mobile, `HomeProfile.tsx:190-202`)* | — | — | — | — | — | ✅ absent on web too; picker lives inside Personal |
| "Edit my patient's info" → Personal | — | ✅ | — | — | — | ✅ `sections.patientInfo = userType === CAREGIVER` |
| "Edit my patient's info" → Medical | — | ✅ (same screen as everyone's Medical) | — | — | — | ✅ same `/profile/medical` route |
| Goal | ✅ | ✅ | ✅ | ✅ | — | ✅ always |
| Journal | ✅ | ✅ | ✅ | ✅ | — | ✅ always |

**The caregiver quirk, stated plainly:** a caregiver has no medical record of their own.
Their "Medical" card sits under *my patient's info* and opens the identical screen everyone
else reaches from "Medical" — for a caregiver that record *is* the patient's. Both clients
do this; the web only changes the wording (`medicalRulesFor().aboutPatient`).

### Field-level visibility inside screens

| Field | Rule (mobile) | Mobile source | Web |
|---|---|---|---|
| Treatment status | hidden for `SURVIVOR` | `PatientDiagnosisLayout.tsx:239` | ✅ `medicalRulesFor().showTreatmentStatus` |
| In remission since | shown **only** for `SURVIVOR` | `PatientDiagnosisLayout.tsx:290` | ✅ `showRemissionDate` |
| Treatments picker | disabled until a treatment status is chosen; survivors excepted | `PatientDiagnosisLayout.tsx:285-288` + `validateTreatment` | ✅ `treatmentsEnabled` |
| Diagnosis | required for every user type | all three `Profile*DiagnosisScheme` | ✅ `requireDiagnosis: true` |
| Treatment status required | `PATIENT` only | `ProfilePatientDiagnosisScheme` | ✅ `requireTreatmentStatus: isPatient` |
| Remission date required | `SURVIVOR` only | `ProfileSurvivorDiagnosisScheme` | ✅ `requireRemissionDate: isSurvivor` |
| Screen title "MY PATIENT'S MEDICAL INFO" | `CAREGIVER` | `MedicalInformation.tsx:95` | ✅ `medicalPatientTitle` |
| Diagnosis field *title* differs | `CAREGIVER` gets the short "Diagnosis" label, others "My Diagnosis" | `PatientDiagnosisLayout.tsx:167-182` | ⚠️ web uses one label for everyone; only the card *description* changes |
| College questions | shown from age **17** (`UNIVERSITY_AGE`); `CAREGIVER` never sees them via `CollegesLayout` | `usePersonalInformation.ts:197`, `Colleges.tsx:31` | ⚠️ web shows from 17 (`COLLEGE_VISIBLE_AGE`) for **all** user types — the caregiver exclusion inside `CollegesLayout` is not reproduced |
| College fields *scored* | only for `PATIENT` aged ≥ 18 (`MAXAGE`) | `userProgress.ts:52-61` | ✅ deliberately reproduced, including the 17-vs-18 inconsistency (`progress.ts:34`) |
| Personal-info denominator | 13 for adult `PATIENT`, else 11 | `userInformationLimits.ts:18-19` | ✅ verbatim |
| Medical denominator | 5 for `SURVIVOR`, else 6 | `userProgress.ts:97-100` | ✅ verbatim |
| Patient-info denominator | 2 | `userInformationLimits.ts:21` | ✅ verbatim |
| Role badge on avatar | shown for all except `HOST` (excluded because it isn't a real underlying role) | `AvatarInfoLayout.tsx:102-112` | ✅; web additionally adds a green **Host** badge mobile never renders (web superset) |
| SUPPORT verified tick + "From CancerBuddy Support Team" | `SUPPORT` | `AvatarInfoLayout.tsx:256, 332` | n/a — SUPPORT can't reach the web profile |
| Journal empty-state illustration | one image per `CAREGIVER` / `PATIENT` / `SURVIVOR` | `JournalEmptyView.tsx:13-17` | ❌ web empty state is text only |

---

## Screen-by-screen inventory

### 1. HomeProfile — the hub

**Mobile:** `src/screens/profile/homeProfile/HomeProfile.tsx` (+ `AvatarProfile/AvatarProfile.tsx`,
`components/layouts/AvataInfo/AvatarInfoLayout.tsx`) — landing screen of the Profile tab;
avatar + identity, Buddy ID, completion rings per section, goal, journal entry point.
**Web:** `app/(app)/profile/page.tsx` → `components/profile/ProfileHub.tsx`

| # | Mobile field / capability | Type & validation | Data source | Web status | Notes |
|---|---|---|---|---|---|
| 1 | Tagline "Update your profile for better matches." | static text | — | ✅ | `app.profile.tagline` |
| 2 | Avatar image | image, S3 signed URL | `getUser.ProfilePic.file` | ✅ | `BuddyAvatar`, 72px |
| 3 | Avatar edit icon → action sheet | 3 options when no photo: *Cancel / Take Photo / Choose From Library* | `PHOTOPICKER_EMPTY_OPTIONS_COPY` | ⚠️ | Web has a "Change photo" button opening a file input (`accept="image/*"`). No camera-capture option. |
| 4 | Action sheet when a photo exists | 4 options: *Cancel / Remove Current Photo / Take Photo / Choose From Library* | `PHOTOPICKER_OPTIONS_COPY` | ⚠️ | Web shows a separate "Remove photo" text link, only when `userProfilePicId` is set |
| 5 | Avatar circular crop before upload | `pickPhotoAndCrop` / `takePhotoAndCrop`, `cropperCircleOverlay: true` | `useImagePicker.ts:48-79` | ❌ | Web re-encodes to JPEG bounded to 1024px, no crop UI |
| 6 | Avatar upload compression | 400×400 target, `compressImageQuality: 0.5`, `compressImageMaxWidth/Height: 350`, `forceJpg` | `useImagePicker.ts:10-18` | ⚠️ | Web: `toJpegFile(file, 1024)` at quality 0.86 — much larger files |
| 7 | Title `"{FirstName}, {age}"` | derived, `displayAge(birth)` | `getUser.name`, `getUser.birth` | ⚠️ | Web renders `formatName(name, userType)` only — **age is not shown** |
| 8 | Location line `"City, ST"` | derived, `formatLocation` | `getUser.City.name`, `getUser.State.stateAbbreviation` | ❌ | Not rendered on the web hub at all (the query does fetch `city`/`state`) |
| 9 | Pronoun line | text, hidden when value is `I rather not disclose` | `getUser.Pronoun.name` | ❌ | Not rendered on the web hub |
| 10 | Role badge (Patient / Caregiver / Survivor) | badge, hidden for `HOST` | `userType` | ✅ | `ROLE_LABELS` + `ROLE_BADGE_CLASS` |
| 11 | Ambassador check badge | tappable overlay on the avatar | `getUser.ambassador === true` | ⚠️ | Web renders a static "Ambassador" pill — **not tappable** |
| 12 | Ambassador modal (`ModalAmbassador`, `type="HomeProfile"`) | dialog, header "Ambassador" + check icon; body "Thank you for the effort you make for CancerBuddy"; **DISMISS** button | `modal-ambassador/ModalAmbassador.tsx` | ❌ | No web equivalent anywhere |
| 13 | Host badge | — | — | ➕ | Web-only addition; mobile never passes `isHost` here so a host shows no badge |
| 14 | Goal name under the identity block | — | — | ➕ | Web shows `goal.name` in the header; mobile only shows it on the goal row |
| 15 | Buddy ID label "BUDDY ID" + value | text; falls back to `"you dont have buddy id yet"` | `getUser.buddyId` | ✅ | Web fallback copy: "You don't have a Buddy ID yet" |
| 16 | Buddy ID **SHARE** button | opens the OS share sheet with `SHARE_BUDDY_ID_DESCRIPTION` | `utils/share.onShare` | ⚠️ | Moved to `/profile/buddy-id`; the hub has a "View code" link instead |
| 17 | Toast on share: "Share your Profile only with people who you trust" | info toast | `COPY_TOAST_INFO_BUDDY_ID` | ❌ | Never shown on web |
| 18 | HOST-only "Manage Lives" row | link, broadcast icon | `userType === HOST` | ✅ | Web card under an explicit "Host tools" heading |
| 19 | Section heading "EDIT MY INFO" | caption, bold | — | ✅ | |
| 20 | Personal card + completion ring | ring 0–100 | `personalInformationProgress(user)` | ✅ | Verbatim port |
| 21 | Medical card + ring (hidden for caregivers) | ring | `medicalInformationProgress(user, userType)` | ✅ | |
| 22 | Photos card + ring | ring, denominator 6 | `galleryProgress(gallery)` | ✅ | |
| 23 | Interests card + ring | ring, denominator 10 | `interestProgress(interests.items)` | ✅ | |
| 24 | Languages card | commented out on mobile | — | ✅ | Correctly absent |
| 25 | Caregiver heading "EDIT MY PATIENT'S INFO" | caption | `userType === CAREGIVER` | ✅ | |
| 26 | Caregiver → Personal card + ring | ring, denominator 2 | `caregiverPersonalInformationProgress` | ✅ | |
| 27 | Caregiver → Medical card + ring | ring | same `medicalInformationProgress` | ✅ | |
| 28 | "I'M HERE TO..." row showing goal name or `"Select goal"` | link | `getUser.Goal.name` | ✅ | |
| 29 | "MY JOURNAL" heading + body copy + "ADD ENTRY" | link | — | ✅ | |
| 30 | Section hints under each card title | — | — | ➕ | Web-only ("Pronouns, location, languages and about you." etc.) |
| 31 | Loading state | full-screen `Loader` | — | ✅ | Web renders skeleton cards |
| 32 | Error state | **none** — gallery errors are swallowed (`HomeProfile.tsx:81-83`) | — | ➕ | Web shows "We couldn't load your profile" + Try again |
| 33 | Refetch on screen focus | `useFocusEffect` re-runs profile + gallery every time the tab is focused | — | ⚠️ | Web refreshes after a save (`refresh()` / `refreshGallery()`) but not on window/tab focus |
| 34 | Gallery paged to exhaustion for the ring | recursive `nextToken` walk | `GET_USER_GALLERY` | ✅ | Web caps at 20 pages (`MAX_GALLERY_PAGES`) |
| 35 | Link to preview your own public profile | — | — | ✅ | Neither client offers one — see *Cross-screen gaps* |

**Missing on web**
- Your age next to your name.
- Your city and state under your name.
- Your pronouns under your name.
- Tapping the ambassador badge to read what being an ambassador means.
- Sharing your Buddy ID straight from the hub (you have to open the code screen first).
- The "share your profile only with people you trust" warning.
- Taking a new profile photo with the camera.
- Cropping a profile photo before it uploads.
- The profile re-reading itself when you come back to the tab.

---

### 2. PersonalInformation

**Mobile:** `src/screens/profile/personalInformation/PersonalInformation.tsx` +
`usePersonalInformation.ts`, and the layouts it composes:
`components/layouts/Address/AddressLayout.tsx`, `components/layouts/Languages/LanguagesLayout.tsx`,
`components/layouts/About/AboutLayout.tsx`, `components/layouts/CancerLoss/CancerLoss.tsx`,
`components/layouts/Colleges/Colleges.tsx`.
Validation: `PersonalInformationSchema` (`model/forms/EnrollmentFormValidations.ts:262`).
**Web:** `app/(app)/profile/personal/page.tsx` → `components/profile/PersonalInfoForm.tsx`,
`lib/profile/personalInfo.ts`

| # | Mobile field / capability | Type & validation | Data source | Web status | Notes |
|---|---|---|---|---|---|
| 1 | Section heading "MY PERSONAL INFO" | caption | — | ✅ | Web: "My personal info" card title |
| 2 | Email | text input, **disabled**, hint "Other app users won't see this." | Cognito `user.attributes.email` | ✅ | Web reads `fetchSignedInEmail()`; hint "Other members won't see this." |
| 3 | Pronouns | single-select, optional, clearable | `listPronouns` | ⚠️ | Web `SelectField` (native `<select>` with an empty first option — clearable ✅). **Catalogue ordering not applied** |
| 3a | Pronouns display order | `ORDER_PRONOUNS_COPY` = She/her, He/him, They/them, I rather not disclose | `res/strings/en/buddies.tsx:108` | ❌ | Web uses whatever order AppSync returns |
| 4 | Gender Identity | single-select, optional, clearable | `listTransgenders` | ⚠️ | Same — no ordering |
| 4a | Gender Identity order | `ORDER_TRANSGENDER_COPY` = Yes, No, I rather not disclose | `buddies.tsx:180` | ❌ | |
| 5 | Sexual Orientation | single-select, optional, clearable | `listSexualOrientations` | ⚠️ | Same — no ordering |
| 5a | Sexual Orientation order | Heterosexual, Gay/lesbian, Bisexual, Queer, Other, I rather not disclose | `buddies.tsx:182` | ❌ | |
| 6 | Ethnicity | single-select, optional, clearable | `listEthnicities` | ⚠️ | Same — no ordering |
| 6a | Ethnicity order | African/African American/Black, Asian/Asian American, Hispanic/Latino/Latina/Latinx, Middle Eastern/North African, Native American/First Nations/Indigenous, Pacific Islander, White/Caucasian/European, Multi-racial/Multi-ethnic, Prefer not to say | `buddies.tsx:115-125` | ❌ | |
| 7 | Zip code | text, mask `zipcode`, number-pad, **required**; lookup fires at exactly 5 chars | `searchCityZipCodes` | ✅ | Web strips non-digits, `maxLength={5}`, same 5-digit trigger |
| 8 | Zip "not found" error | "Hmm, that zipcode is not on the list yet. Please skip this step for now." | `ZIPCODE_NOT_FOUND` | ⚠️ | Web copy: "We couldn't find that zip code." |
| 9 | Zip network-error message | `NETWORK_ERROR_COPY` shown when the lookup itself errors | `AddressLayout.tsx:59-63` | ❌ | Web treats a failed lookup as "not found" — same message either way |
| 10 | City | single-select from the zip results, **required**; auto-opens the picker when ≥ 2 results | `searchCityZipCodes.items` | ⚠️ | Web `SelectField`, options `"{city}, {ST}"`, disabled until a zip resolves. **No auto-open** |
| 11 | State | text input, **disabled**, shows `stateName`, **required** in the schema | derived from the chosen city | ❌ | Web never renders a State field — `userStateId` is set silently from the city. The user cannot see which state they are in |
| 12 | Workplace | async autocomplete, optional; search placeholder "Type in your workplace here" | `searchWorkplaces` / `getWorkplace` | ✅ | Web: button → `Sheet` + `AsyncPicker`, with Clear |
| 12a | Workplace title + explanatory description | "Workplace" / "Start typing the name, and a list will appear - then click on your workplace. This info helps match you with buddies." | `FORMS_COPY_RES.workplace` | ❌ | Web shows the label only, no description |
| 12b | Workplace empty-state message | "Hmm, that's not on the list yet. Please select the closest option available." | `FORMS_COPY_RES.workplace.emptyStateMessage` | ⚠️ | `AsyncPicker` has a generic empty state |
| 13 | Section heading "MY LANGUAGES" + subtitle | "This will help us match you with other people who speak the same ones you do." | — | ✅ | Web card title + description, same intent |
| 14 | Languages | multi-select, optional, `firstItemClearable`, add button "ADD LANGUAGE", placeholder "Select language" | `listLanguages` | ✅ | Web `MultiSelectField` — chips + "Add language" → picker sheet |
| 14a | Language ordering | `ORDER_LANGUAGES_COPY`, 30 entries: English, Spanish, Chinese, Tagalog, Vietnamese, Arabic, French, Korean, Russian, German, Haitian Creole, Hindi, Portuguese, Italian, Polish, Urdu, Japanese, Farsi, Gujarati, Greek, Bengali, Thai, Hebrew, Turkish, Swahili, Somali, **Ukranian**, Navajo, Punjabi, Amharic | `buddies.tsx:127-158` | ⚠️ | Web ports the list (`LANGUAGE_SORT_ORDER`) but **spells it "Ukrainian"** — mobile's catalogue value is "Ukranian", so on web that language falls out of the priority order into the alphabetical tail (`lib/aws/appsyncPicklistQueries.ts:232-238`) |
| 15 | Section heading "ABOUT ME" | caption | — | ✅ | |
| 16 | Bio | textarea; input `maxLength={1000}`, hint "(Maximum 1000 characters)"; **schema caps it at 300** and disables Save above that | `PersonalInformationSchema` bio `.max(300)` | ⚠️ | Mobile is self-contradictory. Web resolves it to a single consistent 300: `BIO_MAX = 300`, hint "Up to 300 characters.", live `n/300` counter, Save blocked above it |
| 17 | Sub-heading "OTHER INFO" | caption | — | ❌ | Web uses a plain divider inside the "About me" card |
| 18 | Coping-with-cancer-loss checkbox | single checkbox, label "Coping with cancer loss" | `CANCER_LOSS_OPTIONS` | ✅ | |
| 19 | "Who did you lose?" | single-select, appears only when the checkbox is on; clearing the checkbox clears this value | `listCopingWithCancerLosses` | ✅ | Web mirrors both the reveal and the clear-on-uncheck |
| 19a | Coping-with order | Spouse/Partner, Parent, Child, Sibling, Grandparent, Friend/Colleague, Other relative | `ORDER_COPING_WITH_LOSS_COPY` | ❌ | No ordering applied on web |
| 20 | "Currently in college or university" checkbox | shown when age ≥ 17 (`UNIVERSITY_AGE`); hidden for `CAREGIVER` inside `CollegesLayout` | `COLLEGE_OPTIONS` | ⚠️ | Web shows it from 17 for **every** user type — the caregiver exclusion is not ported |
| 21 | College / University | async autocomplete, appears only when the checkbox is on; clearing the checkbox clears it | `findColleges` / `getCollege` | ✅ | Web: `Sheet` + `AsyncPicker`, same reveal and clear rules |
| 21a | College title + description + "Add Another University / College" | `FORMS_COPY_RES.colleges` | | ❌ | Label only on web; the add-another affordance is meaningless anyway (single value) |
| 22 | Save button | bottom-right, disabled while the form is invalid | — | ✅ | Web has a sticky footer bar; disabled unless dirty + address complete + bio ≤ 300 |
| 23 | Save-blocked explanation | none — the button is simply greyed out | — | ➕ | Web states the reason in the footer ("Zip code and city are required.", "Your story is over the character limit.") |
| 24 | Unsaved-changes guard | intercepts `beforeRemove`, shows a modal: "Are you sure you want to leave without saving your changes?" | `useGuard` + `LEAVE_WITHOUT_CHANGES` | ⚠️ | Web only registers `beforeunload` — in-app route changes (clicking Back, the sidebar, a card) discard edits silently |
| 25 | Save order | languages first, then `updateUser` | `usePersonalInformation.ts:166-175` | ✅ | Deliberately preserved (`personalInfo.ts:164`) |
| 26 | Success toast "Your info has been updated!" | | | ✅ | "Your changes are saved." |
| 27 | Partial-failure signal | none — mobile can't tell you a language row failed | | ➕ | Web returns `partial` and warns: "Saved, but some changes didn't go through." |
| 28 | Failure toast "An error ocurred while updating your information." | | | ✅ | "We couldn't save your changes. Please try again." |
| 29 | Form re-read after save | `refetch()` + `resetForm` | | ✅ | Web re-reads so join-row ids are fresh before the next diff |
| 30 | Loading state | `Loader` while pronouns/college/personal queries resolve | | ✅ | Skeleton cards |
| 31 | Load-error state | none | | ➕ | Web shows an error panel with a Back button |

**Missing on web**
- The State field. You choose a zip and a city and are never shown, or able to check, which state you have been put in.
- The catalogue orderings for pronouns, gender identity, sexual orientation, ethnicity and "who did you lose" — mobile deliberately puts the common answers first.
- "Ukranian" is mis-spelled in the web language ordering, so it sorts to the bottom instead of position 27.
- A distinct message when the zip lookup fails because of the network rather than because the zip doesn't exist.
- The city picker opening by itself when a zip matches more than one city.
- The explanatory paragraphs under Workplace and College ("start typing the name, and a list will appear…").
- The "OTHER INFO" sub-heading.
- Hiding the college questions from caregivers.
- A confirmation before navigating away from unsaved edits inside the app.

---

### 3. CaregiverPatientPersonalInformation

**Mobile:** `src/screens/profile/personalInformation/CaregiverPatientPersonalInformation.tsx`
+ `components/layouts/Age/AgeLayout.tsx`, `components/layouts/Relationship/RelationshipLayout.tsx`.
Validation: `ProfileCaregiverPersonalInfoPatientScheme` (`model/forms/profile.ts:62`).
**Web:** `app/(app)/profile/patient/page.tsx` → `components/profile/PatientInfoForm.tsx`

| # | Mobile field / capability | Type & validation | Data source | Web status | Notes |
|---|---|---|---|---|---|
| 1 | Heading "MY PATIENT'S INFO" | caption | — | ✅ | Web: "My patient's info" |
| 2 | Intro paragraph | none | — | ➕ | Web adds "A little about the person you care for…" |
| 3 | Patient birth | text, placeholder "When were they born?", digits-only, auto-formats to `mm/yyyy`, `maxLength 7`, month clamped to 01–12 as you type | `getUser.patientBirth` | ✅ | Web `formatMonthYearInput`, `maxLength={7}`, `inputMode="numeric"` |
| 3a | Birth hint | `(mm/yyyy)` + an expandable "Why do we ask this?" note: "Your age qualifies you to use this app and helps find buddies close to your age." | `AgeLayout.tsx:101-108` | ⚠️ | Web hint is "Month and year, e.g. 03/1975." — the *why* explanation is gone |
| 3b | Birth validation | `isValidDate` — required, well-formed, not in the future, within `MAX_DIFF_YEARS` | `utils/dates` | ✅ | Web `validateMonthYear`: incomplete / invalid / future / too-old (130 years) |
| 3c | Month clamping while typing | typing `13` becomes `12`; typing `00` becomes `01` | `AgeLayout.tsx:40-52` | ❌ | Web accepts `13/2000` as you type and only rejects it on validation |
| 4 | Relationship to the patient | single-select, **required**, clearable, placeholder "Relationship to the patient" | `listRelationships` | ✅ | Web `SelectField`, label "Your relationship to them" |
| 4a | Relationship order | `ORDER_RELATIONSHIPS_COPY` = Friend, Relative, Sibling (brother/sister), Kid (daughter/son), Partner/spouse, Parent (mom/dad) | `buddies.tsx:160` | ❌ | No ordering on web |
| 5 | Save | disabled unless valid **and** `patientBirth` non-empty | — | ✅ | Web: `dirty && !validationError` |
| 6 | Storage format | month/year stored as the **last day of the month** (`birthDate`) | `utils/birth` | ✅ | `monthYearToStoredDate` reproduces this exactly, and documents why |
| 7 | Non-caregiver access | screen is unreachable — no card is rendered | — | ✅ | Web shows "This section is only for caregivers." + Back |
| 8 | Unsaved-changes guard | `beforeRemove` + modal | `useGuard` | ⚠️ | `beforeunload` only |
| 9 | Success / failure toasts | "Your info has been updated!" / "An error ocurred…" | — | ✅ | |
| 10 | Loading state | `Loader` | — | ✅ | Skeleton |

**Missing on web**
- The "Why do we ask this?" explanation under the birth field.
- Month clamping while typing (mobile turns `13` into `12` on the spot).
- The preferred ordering of the relationship options.
- An in-app guard against leaving with unsaved edits.

---

### 4. MedicalInformation

**Mobile:** `src/screens/profile/medicalInformation/MedicalInformation.tsx` +
`useMedicalInformation.ts`, composing `components/layouts/PatientDiagnosis/PatientDiagnosisLayout.tsx`,
`components/layouts/MedicalCenter/MedicalCenterLayout.tsx`,
`components/layouts/SupportOrganizations/SupportOrganizationsLayout.tsx`.
Validation: `ProfilePatientDiagnosisScheme` / `ProfileSurvivorDiagnosisScheme` /
`ProfileCaregiverDiagnosisScheme` (`model/forms/profile.ts`).
**Web:** `app/(app)/profile/medical/page.tsx` → `components/profile/MedicalInfoForm.tsx`,
`lib/profile/medicalInfo.ts`

| # | Mobile field / capability | Type & validation | Data source | Web status | Notes |
|---|---|---|---|---|---|
| 1 | Heading "MY MEDICAL INFO" / "MY PATIENT'S MEDICAL INFO" | caption, caregiver-aware | `userType` | ✅ | |
| 2 | **HELP button** (life-buoy icon, top-right) | opens a dialog listing one CTA: "Medical Information / I can't find my Medical information" | `MedicalInformation.tsx:74-90, 138-156` | ❌ | No help affordance on the web Medical screen |
| 3 | `ModalMedicalInformation` | full-screen form: heading "Medical Information", body "Tell us more about what information you can't find on the provided lists.", radio group, conditional details input (hint "(Maximum 1000 characters)"), **SUBMIT** | `modal-medical-information/ModalMedicalInformation.tsx` | ❌ | — |
| 3a | Radio option 1 | "I can't find my Diagnosis, Treatmentor Side Effects" *(typo is in the source)* | `HELP_BUTTON_MEDICAL_INFORMATION` | ❌ | |
| 3b | Radio option 2 | "I can't find my Medical Center or Support Organization" — selecting it reveals a required free-text "Enter details" input | same | ❌ | |
| 3c | Submit action | `raiseUserLambda(SENDEMAILHELP, USERS_LAMBDA, {email, name, textIfAdded, reason, subject: 'Medical Information'})`; success toast "We are here to help you, we will be in touch soon."; failure toast "Could not send information, please try again later." | `utils/lambda` | ❌ | The web app *has* `raiseUserLambda` and a `HelpDialog` in the auth flow, but nothing wired here |
| 4 | Diagnosis | multi async autocomplete, **required for every user type**, add button "ADD ANOTHER DIAGNOSIS" | `findDiagnosis` / `getDiagnosis` | ⚠️ | Web `MultiSelectField` over the full `listDiagnoses` catalogue with a search box — functionally equivalent, but it is a client-side filter over a preloaded list, not a server-side prefix search |
| 4a | Diagnosis description text | "Start typing the name, and a list will appear - then tap on your diagnosis. This info helps match you with buddies." | `FORMS_COPY_RES.diagnosis.description` | ❌ | Web card description is different copy |
| 4b | Diagnosis empty-state | "Hmm, that's not on the list yet. Please select the closest option available." — **suppressed on this screen** (`disabledAutocompleteMessageEmptyState`) | `MedicalInformation.tsx:109` | ✅ | Neither client shows it here |
| 5 | Treatment status | single-select, hidden for `SURVIVOR`; required for `PATIENT`; placeholder "Currently I'm…" (caregiver: "Currently In…") | `listTreatmentStatuses` | ⚠️ | Web label "Treatment status", placeholder "Select one" — the mobile placeholders are gone |
| 5a | Clearing the status clears treatments | `updateTreatment` empties `treatments` and deletes each existing join row | `PatientDiagnosisLayout.tsx:133-149` | ❌ | Web leaves the chosen treatments in place when the status is cleared; they only become uneditable |
| 5b | Choosing "Pre-treatment" clears treatments | same handler, special-cased on the label | `PatientDiagnosisLayout.tsx:145-148` | ❌ | Not reproduced |
| 6 | Treatments | multi-select, disabled until a status is chosen (survivors excepted), add button "ADD ANOTHER TREATMENT", sorted alphabetically | `listTreatments` | ✅ | Web `treatmentsEnabled` + "Choose a treatment status first." hint |
| 6a | Treatments effectively **required** once a status exists | `useMedicalInformation.ts:191-221` sets `valid=false` and a field error "treatment is required" whenever `treatments` is empty, blocking Save | | ❌ | Web never requires treatments. A patient can save with a status and no treatment |
| 7 | In remission since (`SURVIVOR` only) | text, mask `mm/yyyy`, number-pad, **required**, hint "(mm/yyyy)" | `getUser.inRemissionSince` | ✅ | Web input `maxLength={7}`, placeholder `MM/YYYY`, hint "Month and year, e.g. 03/2024." |
| 7a | Remission cross-checked against the user's birth date | `validateRemissionDate(userBirth, remissionDate)` → error "Date is not valid" | `PatientDiagnosisLayout.tsx:70-92` | ❌ | Web validates format / future / >130 years only. A remission date before the user was born is accepted |
| 8 | My medical center | multi async autocomplete, add button "ADD ANOTHER MEDICAL CENTER" | `findHospitals` / `getHospital` | ⚠️ | Same catalogue-vs-search divergence as diagnosis |
| 8a | Medical-center description text | "Start typing the name, and a list will appear - then tap on your medical center…" | `FORMS_COPY_RES.medicalCenter.description` | ❌ | |
| 9 | Support organizations | multi-select, `firstItemClearable`, add button "ADD ANOTHER SUPPORT ORG.", sorted alphabetically, **`limit: 3`** — the Add button disappears once three rows exist (`dropdown-multiple.tsx:30, 85`) | `listSupportOrganizations` | ⚠️ | Web offers the same picker but **enforces no maximum** — a user can select more than 3 |
| 9a | Support-organization hint | "If you are part of an organization that supports cancer patients, survivors or caregivers you can add it." | `FORMS_COPY_RES.supportOrganization.hint` | ❌ | |
| 10 | Side effects (disabilities) | multi-select, `firstItemClearable`, add button "Add another side effect", sorted alphabetically | `listDisabilities` | ✅ | |
| 10a | Side-effects help text | "If exists any side effects related to the cancer diagnosis, please input them." | `FORMS_COPY_RES.disabilities.helpText` | ⚠️ | Web card description: "Anything you'd like others to know about." |
| 11 | Save | disabled unless every CSV field passes `validationStringArrayUtil`, `isValid`, and the treatments rule | `validationSubmit()` | ⚠️ | Web: `dirty && !validationError`, and the treatments rule is missing (see 6a) |
| 12 | Save-blocked explanation | none | — | ➕ | Web names the failing rule in the footer ("Add at least one diagnosis.", "Choose a treatment status.", "Tell us when you went into remission.") |
| 13 | Save order | `updateUser` (status + remission) first, then the five join tables | `useMedicalInformation.ts:255-285` | ✅ | Preserved (`medicalInfo.ts:218-263`) |
| 14 | Success / failure toasts | | | ✅ | Plus the web's `partial` warning |
| 15 | Loading state | `Loader` | | ✅ | Skeleton |
| 16 | Custom header with a back button and no nav bar | `headerShown: false` + `GlobalBackButton help` | | ⚠️ | Web uses the standard back arrow + title, no help slot |

**Missing on web**
- The whole HELP flow: the life-buoy button, the "I can't find my medical information" form, its two radio options, its details field, and the support email it sends.
- The rule that once you pick a treatment status you must also record at least one treatment.
- Clearing your treatments when you clear or change your treatment status to "Pre-treatment".
- Checking that a remission date is after your own date of birth.
- The three-organization maximum on support organizations.
- The explanatory paragraphs and hints for diagnosis, medical centre, support organizations and side effects.
- The "Currently I'm…" / "Currently In…" treatment-status placeholders.

---

### 5. Interests

**Mobile:** `src/screens/profile/interests/Interests.tsx` + `components/layouts/Interest/InterestsLayout.tsx`
**Web:** `app/(app)/profile/interests/page.tsx` → `components/profile/InterestsForm.tsx`

| # | Mobile field / capability | Type & validation | Data source | Web status | Notes |
|---|---|---|---|---|---|
| 1 | Heading "MY INTERESTS" | caption | — | ✅ | |
| 2 | Subtitle "For better recommendations, choose your favorites from the list." | — | — | ⚠️ | Web copy differs: "Pick what you're into — we use these to suggest buddies. Around 10 gives us the most to work with." |
| 3 | Interests picker | multi-select dropdown, `firstItemClearable`, add button "ADD INTEREST", placeholder "Select interest", sorted alphabetically | `listInterests` | ⚠️ | Web renders the full catalogue as a grid of toggle chips with a search box — a deliberate, documented divergence (`InterestsForm.tsx:3-11`) |
| 4 | No maximum | `LIMIT_INTERESTS = 10` is only the ring denominator | `userInformationLimits.ts:5` | ✅ | Web states this explicitly and enforces no cap |
| 5 | Selected count | not shown | — | ➕ | Web footer: "{n} selected · 10 fills the ring" |
| 6 | Search within the catalogue | inside the dropdown sheet | — | ✅ | Web `SearchField` + "Nothing matches "{query}"" |
| 7 | Save | disabled when the selection is unchanged | `interestsChanged()` | ✅ | Web `dirty` |
| 8 | Join-table diff on save | create for new, delete for removed | `useData` / `manyToManyMutations` | ✅ | `syncJoinTable` with `INTERESTS_JOIN` |
| 9 | Success toast | "Your info has been updated!" | | ✅ | Plus the `partial` warning |
| 10 | Unsaved-changes guard | `beforeRemove` + modal | `useGuard` | ⚠️ | `beforeunload` only |
| 11 | Loading / load-error | `Loader`; no error state | | ➕ | Web has a skeleton and an error panel |

**Missing on web**
- An in-app confirmation before abandoning unsaved interest changes.

---

### 6. Languages (standalone screen)

**Mobile:** `src/screens/profile/languages/Languages.tsx` — registered in `ProfileScreens.tsx:63-67`
but **unreachable**: the hub card that navigated here is commented out (`HomeProfile.tsx:190-202`).
**Web:** `— none —`

| # | Mobile field / capability | Type & validation | Data source | Web status | Notes |
|---|---|---|---|---|---|
| 1 | Heading "MY LANGUAGES" + subtitle | caption | — | ✅ | Reproduced as a card inside `/profile/personal` |
| 2 | Language multi-select | see PersonalInformation #14 | `listLanguages` | ✅ | Same picker, same join table |
| 3 | Standalone route | dead route on mobile | — | ✅ | Correctly not built on web |
| 4 | Save-disabled quirk | `interestsChanged()` returns `false` whenever any language is selected, so Save is always enabled once you pick one | `Languages.tsx:122-137` | ✅ | Not reproduced — and shouldn't be |

**Missing on web** — nothing. The absence is correct.

---

### 7. Photos

**Mobile:** `src/screens/profile/photos/Photos.tsx` +
`components/layouts/Photos/PhotosLayoutProfile.tsx`, `hooks/usePhoto.ts`,
`utils/photopicker/gallery.ts`
**Web:** `app/(app)/profile/photos/page.tsx` → `components/profile/PhotosForm.tsx`,
`lib/profile/photos.ts`

| # | Mobile field / capability | Type & validation | Data source | Web status | Notes |
|---|---|---|---|---|---|
| 1 | Heading "MY PHOTOS" | caption | — | ✅ | |
| 2 | Subtitle "Add and edit your photos to show to the community." | — | — | ⚠️ | Web: "Up to 6 photos. They appear on your profile so buddies can put a face to the name." |
| 3 | Six-slot grid, empty slots always rendered | `MAX_IMAGES_GALLERY = 6` | `listPictures` filtered on `userGalleryId` | ✅ | Web renders 6 slots, `MAX_GALLERY_PHOTOS = 6` |
| 4 | Photo ordering | sorted by `createdAt` via `orderDates`, filled slots first | `fillArrayPhotoPickerUtil` | ✅ | Web sorts newest first |
| 5 | Manual reordering | **not offered** | — | ✅ | Not on web either |
| 6 | "Primary photo" nomination | **not offered** (the avatar is a separate `Picture` with no `userGalleryId`) | — | ✅ | Web keeps the same separation and documents it |
| 7 | Per-photo edit icon → action sheet | *Cancel / Remove Current Photo / Choose From Library* | `GALLERY_OPTIONS_COPY` | ⚠️ | Web offers a hover/focus **X** that deletes. No menu |
| 7a | **Change this photo** (replace in place) | `changePhotoTemporarily` — picks a new photo and swaps it into the same slot | `usePhoto.ts:70-73` | ❌ | Web has no replace action; you delete then add |
| 8 | Empty-slot tap → action sheet | *Cancel / Choose From Library* | `GALLERY_EMPTY_OPTIONS_COPY` | ✅ | Web: clicking an empty slot opens the file picker |
| 9 | Camera capture for gallery photos | **not offered on mobile either** — gallery options are library-only | `GALLERY_*_OPTIONS_COPY` | ✅ | Parity |
| 10 | "ADD PHOTO" button, shown only while a slot is free | button, tertiary, `+` icon | — | ✅ | Web disables it at 6 |
| 11 | Multi-file selection | one at a time | — | ➕ | Web accepts multiple files and uploads up to the remaining room |
| 12 | Over-limit feedback | none — the button just disappears | — | ➕ | Web: toast "You can have up to 6 photos." |
| 13 | Photo count readout | none | — | ➕ | Web: "{n} of 6 photos" |
| 14 | Staged edits + **Save** button | all adds/removes are held in memory; Save deletes from S3 then uploads | `usePhoto.saveChanges` | ⚠️ | Web commits each change immediately — a deliberate, documented divergence (`PhotosForm.tsx:3-13`). There is no Save button and no way to cancel a deletion |
| 15 | Upload compression | 400×400, quality 0.5, max 350×350, `forceJpg` | `useImagePicker.PICKER_CONFIG` | ⚠️ | Web: bounded to 1600px, JPEG quality 0.86 — noticeably larger objects |
| 16 | Upload size guard | none | — | ➕ | Web rejects empty files and anything over 12 MB |
| 17 | Loading indicator | full-screen `Loader` | — | ✅ | Web: per-slot spinner |
| 18 | Upload error | toast "An error occured while uploading the image." | — | ✅ | "We couldn't upload that photo. Please try again." |
| 19 | Delete error | swallowed | — | ➕ | Web: "We couldn't remove that photo. Please try again." |
| 20 | Gallery paged to exhaustion | recursive `nextToken` | — | ✅ | Web caps at 20 pages |

**Missing on web**
- Replacing a photo in place — you must delete it and add a new one.
- Batching photo edits behind a Save button (each change is now immediate and irreversible).
- The tighter image compression mobile applies before upload.

---

### 8. Goal — "I'm here to…"

**Mobile:** `src/screens/profile/goal/Goal.tsx` + `components/elements/emojis/EmojisGroup.tsx`
**Web:** `app/(app)/profile/goal/page.tsx` → `components/profile/GoalForm.tsx`

| # | Mobile field / capability | Type & validation | Data source | Web status | Notes |
|---|---|---|---|---|---|
| 1 | Heading "I'M HERE TO..." | caption | — | ✅ | |
| 2 | Intro copy | none | — | ➕ | Web: "Tell people what brought you here. You can change it any time." |
| 3 | Goal options | single-select, each an illustration + name, sourced from the catalogue | `listGoals` (`id`, `name`, `image.file`) | ✅ | Web grid of tiles, same fields, S3-signed image |
| 3a | Goal display order | fixed: **Listen, Support, Say hi, Give strength, Send love, Escape, Remember, Exchange ideas** — anything not on the list sorts last | `EmojisGroup.tsx:10-19` via `setOrderArrayUtil` | ❌ | Web renders `listGoals` in whatever order AppSync returns |
| 3b | Grid shape | `FlatList numColumns={4}` | `EmojisGroup.tsx:31` | ⚠️ | Web: 2 columns on mobile widths, 3 on `sm:` and up |
| 4 | Image fallback | none | — | ➕ | Web falls back to a 🎯 glyph when a goal has no image |
| 5 | Current selection pre-highlighted | `value={getUser.userGoalId}` | | ✅ | |
| 5a | Deselect by tapping the selected tile | clears the highlight locally but **never calls `onSelected`**, so the parent keeps the old goal and Save stays disabled | `EmojisGroup.tsx:21-28` | ➕ | Web has no deselect — a goal can only be swapped, which avoids the dead state entirely |
| 6 | Save | disabled when nothing is picked **or** the pick equals the stored goal | `Goal.tsx:79` | ✅ | Web: `!dirty || !selected` |
| 7 | Save mutation | `updateUser({ userGoalId })` | | ✅ | |
| 8 | Success toast | "Your info has been updated!" | | ✅ | |
| 9 | Failure toast | "An error ocurred while updating your information." | | ✅ | |
| 10 | Stays on the screen after saving | yes | | ✅ | Same |
| 11 | Load-error state | none | | ➕ | Web has one |

**Missing on web** — nothing material.

---

### 9. Journal — MyJournalLayout / JournalEditView / JournalEmptyView

**Mobile:** `src/screens/profile/journal/MyJournalLayout.tsx`, `JournalEditView.tsx`,
`JournalEmptyView.tsx`, `MyJournalLayout.utils.ts`, plus
`components/elements/journal/JournalControl.tsx`
**Web:** `app/(app)/profile/journal/page.tsx` → `components/profile/JournalScreen.tsx`,
`lib/profile/journal.ts`

| # | Mobile field / capability | Type & validation | Data source | Web status | Notes |
|---|---|---|---|---|---|
| 1 | Heading "MY JOURNAL" | caption | — | ✅ | |
| 2 | "ADD ENTRY" CTA in the modal header, shown only when entries exist | button, edit icon | — | ⚠️ | Web always shows an "Add entry" button, including on the empty state (arguably better) |
| 3 | Column label "SHOW ON PROFILE" above the switches | label, bold | — | ⚠️ | Web labels each switch individually: "Shown on your profile" / "Private to you" |
| 4 | Entry list, newest first | `orderDates(b.createdAt, a.createdAt)` | `listJournals` filtered on `userJournalId` | ✅ | Web sorts newest first |
| 5 | Entry date | `MM/DD/YYYY`, rendered as a bold heading | `formatUSADate` | ⚠️ | Web: `12 March` (or `12 March 2024` for other years), small grey text |
| 6 | Entry preview text | truncated to **42 characters** with an ellipsis, single line | `formatSubtitle(text, 42)` | ⚠️ | Web shows the entry in full, with newlines preserved |
| 7 | Visibility switch per entry | toggle | `visibleToPublic` | ✅ | Web `VisibilitySwitch`, optimistic with rollback |
| 8 | Toast when turning an entry public | "Your journal entry can now be seen by visitors to your profile" | `MyJournalLayout.tsx:89-94` | ✅ | "That entry is now on your profile." |
| 9 | Toast when turning an entry private | **none** | — | ➕ | Web confirms both directions |
| 10 | Tap an entry → editor | full-screen `Modal`, slide animation | — | ⚠️ | Web expands the entry inline; the list stays visible (documented divergence) |
| 11 | Editor text area | multiline, `autoFocus`, 32pt, no character limit | — | ✅ | Web `Textarea`, `rows={5}`, `autoFocus`, no limit |
| 12 | Attachments / images / rich text | **not offered** | — | ✅ | Not on web either |
| 13 | Create entry | `createJournal({ text, userJournalId })`; CTA "DONE"; disabled while the text is blank | — | ✅ | Web: "Save entry", disabled on empty |
| 14 | Update entry | `updateJournal({ id, text, userJournalId })`; CTA becomes "DELETE" once the text is saved | — | ⚠️ | Web keeps Edit and Delete as two separate, always-visible actions — mobile's single CTA that morphs from DONE to DELETE is a well-known foot-gun |
| 15 | Delete confirmation | `DialogContainer`, header "Delete entry", body "Are you sure you want to delete your journal entry?", button "YES, DELETE" | — | ✅ | Web `ConfirmSheet`: "Delete this entry? It can't be recovered." |
| 16 | Cancel an edit | back button on the modal header | — | ✅ | Web: explicit Cancel button |
| 17 | Empty state — role illustration | `BMCF_Caregiver-BW.png` / `BMCF_Patient-BW.png` / `BMCF_Survivor-BW.png`, 258×258 | `useAuth().userType` | ❌ | Web empty state is text only |
| 18 | Empty state — "No entries yet." + "Add entry" button | heading + large button | — | ✅ | Web: "No entries yet" + "Write the first one — nobody sees it unless you share it." |
| 19 | Public/total count | none | — | ➕ | Web: "{n} of {total} shared publicly." |
| 20 | Pagination | mobile pages `listJournals` to exhaustion for the owner's list | `MyJournalLayout.tsx:49-73` | ✅ | Web pages too (capped at 20) |
| 21 | Create error toast | `journalCreateError` — **references an undefined variable** (`JournalEditView.tsx:54`), so the catch block throws instead of showing a toast | | ➕ | Web shows "We couldn't save that. Please try again." |
| 22 | Update / delete error toasts | `journalEditError` / `journalDeleteError` | | ✅ | Both map to the same web message |
| 23 | Load-error state | none | | ➕ | Web shows an error panel with Try again |
| 24 | Foreign-key inconsistency | create/update send `userJournalId`; the visibility toggle sends `journalUserId` | | ➕ | Web sends neither on the toggle — just `id` and `visibleToPublic` (documented, `journal.ts:15-18`) |

**Missing on web**
- The role illustration on the empty journal.
- The 42-character preview truncation (web shows entries in full, which changes the list from an index into a feed).
- The US-style `MM/DD/YYYY` date format on entries.

---

### 10. QrIdentification / BuddyId

**Mobile:** `src/screens/profile/qrIdentification/QrIdentification.tsx`, composing
`components/layouts/BuddyIdQr/BuddyIdQr.tsx`, `components/layouts/BuddyIdInput/BuddyIdInput.tsx`,
`components/elements/BuddyIdScanner/BuddyIdScanner.tsx`, `components/elements/buddy-id/buddy-id.tsx`,
and `hooks/useValidateRules.ts`.
**Web:** `app/(app)/profile/buddy-id/page.tsx` → `components/profile/BuddyIdScreen.tsx`

The mobile screen has three modes driven by route params: no params (QR + share + optional
scanner), `screen: 'SCANQR'` (scanner only), `screen: 'SEARCHID'` (typed lookup). The web
folds the first and third into one page.

| # | Mobile field / capability | Type & validation | Data source | Web status | Notes |
|---|---|---|---|---|---|
| 1 | Info toast on mount | "Share your Profile only with people who you trust" | `COPY_TOAST_INFO_BUDDY_ID` | ❌ | Never shown |
| 2 | Title "Connect with a friend through QR!" | heading | `BUDDY_ID_SCREENS_COPY.qr.title` | ⚠️ | Web title is just "Buddy ID" |
| 3 | Body copy | "Buddies can connect with you by scanning this QR code in person. You can also share your Buddy ID with them via text message or your favorite app." | `BUDDY_ID_SCREENS_COPY.qr.text` | ⚠️ | Web: "Share your Buddy ID so someone can find you." |
| 4 | Buddy ID row + SHARE button | share sheet with `SHARE_BUDDY_ID_DESCRIPTION` ("Hi! Let's connect! This is my CancerBuddy ID") | `utils/share.onShare` | ⚠️ | Web "Share" uses `navigator.share` where available, otherwise copies the link. **No share message text** |
| 5 | Share success toast | "Your Buddy ID was shared successfully!" | `SHARE_BUDDY_ID_SUCCESS` | ❌ | Web toasts "Link copied." on the fallback path only |
| 6 | Copy the raw ID | not offered on mobile | — | ➕ | Web: "Copy ID" button + toast |
| 7 | QR code | 250px, encodes `formatBuddyIdURL(buddyId)` | `react-native-qrcode-svg` | ✅ | Web: 232px canvas, `https://cancerbuddy.bonemarrow.org/buddyId/<id>` — verified identical |
| 8 | "Scan buddy's qr code" toggle → camera | `BuddyIdScanner` (VisionCamera, `codeTypes: ['qr']`), 300×300, overlay marker image, 8-second rescan lockout, "Tap to activate camera" fallback after 5s, camera-permission error toast | `BuddyIdScanner.tsx` | ❌ | Web does not scan QR codes at all — deliberate and documented (`BuddyIdScreen.tsx:9-13`) |
| 9 | Typed lookup — title | "Find friend with their Buddy ID" | `BUDDY_ID_SCREENS_COPY.input.title` | ⚠️ | Web section heading: "Find someone by Buddy ID" |
| 10 | Typed lookup — input mask | auto-formats to `XX-XXXX-XXXX`, strips non-alphanumerics, uppercases, 10 characters max (`maxLength 12` with separators) | `BuddyIdInput.tsx:22-33` | ❌ | Web is a plain free-text field with no mask or uppercasing |
| 11 | Format hint "(BI-0000-0000)" | caption | — | ❌ | Web placeholder is "Their Buddy ID" |
| 12 | "Find Buddy" button disabled until exactly 10 characters | — | — | ⚠️ | Web only requires a non-empty value |
| 13 | Accepts a pasted deep link | scanner splits on `/` and takes the last segment | `QrIdentification.tsx:37-59` | ✅ | Web does the same for typed input |
| 14 | Validation: no match | warning toast "The Buddy ID you entered didn't match with a profile. Please try again" (typed) / "The QR code you entered didn't match with a profile. Please try again" (scanned) | `TOAST_COPY_MESSAGES_SCANNER` | ⚠️ | Web: inline error "No one matches that Buddy ID." — one message for both cases |
| 15 | Validation: it's your own ID | info toast "That was a link to your profile! Remember to keep the connection with yourself" and navigates back to the profile | `useValidateRules.ts:183-207` | ❌ | Web navigates you to `/buddies/<your own id>` |
| 16 | Validation: the account is snoozed | alert toast "The profile you are trying to reach is not available" | `useValidateRules.ts:175-180` | ❌ | Web ignores `isSnooze` here |
| 17 | Validation: minor-protection age rule | opens the profile with a banner "You cannot connect with this Buddy due to our minor protection policy", connect buttons hidden. The rule (`utils/birth.ts:226-242`): allowed only if **both** are ≥ 18, **or both** ≥ 13, **or both** are < 13 and ≥ 7 — any cross-bracket pairing fails, and a missing birth date scores 0 and therefore always fails | `connectAgeRulesBuddySearching` | ❌ | Web performs no age check on this screen (`BuddyIdSheet.tsx` does) |
| 18 | Validation: already buddies | info toast "{Name} and you are already Buddies!" then opens the profile with `isBuddy: true` | `useValidateRules.ts:108-119` | ❌ | |
| 19 | Validation: invite already pending | opens the profile with the banner "You are waiting to connect with {Name}. Meanwhile, you can search for new buddies!" and connect buttons hidden | `useValidateRules.ts:120-131` | ❌ | |
| 20 | Loading indicator during lookup | `Loader` | — | ✅ | Web: button spinner |
| 21 | Lookup network error | swallowed (`console.error`) | — | ➕ | Web toasts "We couldn't search right now. Please try again." |

> **These validations exist elsewhere on web.** `components/buddies/BuddyIdSheet.tsx:50-70`
> implements not-found, self, snoozed and the age rule with proper copy, and masks the input
> to `BI-0000-0000`. The profile screen is a separate, thinner implementation of the same
> lookup — a straightforward fix is to reuse the sheet or lift its checks.

**Missing on web**
- Scanning a buddy's QR code with the camera.
- The `BI-0000-0000` input mask and format hint on the profile lookup.
- The five safety and status checks when you look someone up from the profile (your own ID, snoozed accounts, the minor-protection age rule, already-a-buddy, invite-pending).
- The "share only with people you trust" warning.
- A share message alongside your Buddy ID.
- The "Your Buddy ID was shared successfully!" confirmation.

---

### 11. ManageLives (list)

**Mobile:** `src/screens/profile/manage-lives/ManageLives.tsx`
**Web:** `app/(app)/profile/lives/page.tsx` → `components/profile/ManageLivesScreen.tsx` (list pane),
`lib/profile/manageLives.ts`

| # | Mobile field / capability | Type & validation | Data source | Web status | Notes |
|---|---|---|---|---|---|
| 1 | Host gate | reachable only from the host-only hub card | `userType === HOST` | ✅ | Web also blocks direct navigation: "Only hosts can schedule live sessions." |
| 2 | Host's group resolved from `User.groupHostId` | | `getUser` | ✅ | `fetchHostGroupId` |
| 3 | No group → empty list, no create button | silent | | ➕ | Web: "You're not hosting a group yet" + "Live sessions belong to the group you host." |
| 4 | Intro "Manage your live sessions and group activities." | subtitle | — | ❌ | Web has no intro line |
| 5 | Segmented control Active / Hidden | always visible, each with a count badge | `active !== false` vs `active === false` | ⚠️ | Web shows the tabs **only when at least one hidden session exists**, and shows no counts |
| 6 | Session list filter | drops `status === 'ended'` and `archived` | | ✅ | Same filter in `fetchLiveSessions` |
| 7 | Section header "UPCOMING SESSIONS" / "HIDDEN SESSIONS" + count | caption + badge | — | ❌ | Web has no section header above the list |
| 8 | Card: status pill | LIVE NOW (red dot) / ENDED / SCHEDULED | `inLive`, `status` | ⚠️ | Web pills: "Live now" / "Hidden" / "Scheduled". **No ENDED pill** — but ended sessions are filtered out on both clients, so it is unreachable |
| 9 | Card: title | falls back to `groupName`, then "Live Session" | | ⚠️ | Web renders `session.title` with no fallback |
| 10 | Card: description, 2 lines | | | ✅ | `line-clamp-2` |
| 11 | Card: date | `Mar 3, 2026` (`scheduledAt` else `createdAt`) | | ⚠️ | Web `formatSessionWhen`: `Tue, 3 Mar · 2:00 PM · 30 min` — one combined line, and **no `createdAt` fallback** |
| 12 | Card: time | `2:00 PM` | | ✅ | Folded into the same line |
| 13 | Card: duration | `30 min` / `1h` / `1h 30m` | `formatDuration` | ⚠️ | Web always says "{n} min" — 90 minutes reads as "90 min", not "1h 30m" |
| 14 | Card: chevron affordance | icon | — | ⚠️ | Web highlights the selected card instead |
| 15 | Sort order | none — API order | | ➕ | Web sorts by `scheduledAt` ascending |
| 16 | Pull-to-refresh | `RefreshControl` | | ⚠️ | No web equivalent (reloads after every save) |
| 17 | Refetch on focus | `useFocusEffect` | | ⚠️ | Web loads once, then after each mutation |
| 18 | Floating "+" action button | FAB, shown only when a group exists | | ✅ | Web: "Schedule a live" button in the header |
| 19 | Empty state (active) | "No live sessions yet" / "Create your first live session to start broadcasting to your group." | | ✅ | "No sessions here yet" / "Schedule one and it'll show up for your group." |
| 20 | Empty state (hidden) | "No hidden sessions" / "Sessions you toggle off will appear here." | | ⚠️ | Web uses the same copy for both tabs |
| 21 | Loading | `ActivityIndicator` | | ✅ | Skeleton rows |
| 22 | Load error | `console.error` only | | ➕ | Web toasts "We couldn't load your profile" |
| 23 | Navigation model | three screens: list → detail, list → create | | ⚠️ | Web keeps the list and puts the editor in a sticky side panel (documented divergence) |

---

### 12. ManageLivesCreate

**Mobile:** `src/screens/profile/manage-lives/ManageLivesCreate.tsx` +
`components/elements/live-schedule-field/LiveScheduleField.tsx`
**Web:** the `mode: "create"` branch of `components/profile/ManageLivesScreen.tsx`

| # | Mobile field / capability | Type & validation | Data source | Web status | Notes |
|---|---|---|---|---|---|
| 1 | Header card: group name (or "New Live Session") + "Schedule a new broadcast for your group." | — | route params | ⚠️ | Web shows the group name in the page header; the subtitle is gone |
| 2 | Section label "DETAILS" | caption with a dot | — | ⚠️ | Web: "Schedule a live" panel title only |
| 3 | **Title** | text, **required**, `Alert('Error', 'Title is required')` on submit | — | ✅ | Web disables Submit while blank |
| 3a | Title hint "A short, clear name for the session." | — | — | ❌ | Web placeholder: "What's this session about?" |
| 3b | Title max length | none | — | ✅ | None on web either |
| 4 | **Description** | textarea, optional | — | ✅ | Web `Textarea`, 3 rows |
| 4a | Description hint "Optional. Tell members what this session is about." | — | — | ⚠️ | Web placeholder: "Anything members should know beforehand." |
| 5 | Section label "SCHEDULE *" | caption | — | ⚠️ | Web: "Date and time" field label |
| 6 | **Date** row | own labelled row ("Date", calendar icon), placeholder **"Select date"**, value `March 17, 2026` | `LiveScheduleField.tsx:192-225` | ⚠️ | Web uses a single `<input type="datetime-local">` for date + time |
| 7 | **Time** row | own labelled row ("Time", clock icon), placeholder **"Select time"**, value `7:30 PM` | `LiveScheduleField.tsx:228-261` | ⚠️ | Same combined input |
| 7a | Time granularity | **`minuteInterval={15}`** — only :00, :15, :30 and :45 can be chosen | `LiveScheduleField.tsx:346, 384` | ❌ | Web's `datetime-local` accepts any minute, so web can create sessions mobile cannot represent |
| 7b | iOS picker is confirm-or-cancel | transparent modal, title "Select Date"/"Select Time", spinner, **Cancel** + **Confirm**; the value is buffered until Confirm | `LiveScheduleField.tsx:321-375` | ⚠️ | Web writes on every change with no confirm step |
| 8 | Schedule minimum date | **now** (date mode only — the time picker is unbounded) | `LiveScheduleField.tsx:111, 340-345` | ❌ | Web sets no `min` — a host can schedule a session in the past |
| 9 | Schedule maximum date | **one year from today**, 23:59:59 | `buildDefaultMaximumScheduleDate` | ❌ | Web sets no `max` |
| 10 | Schedule required | `Alert('Error', 'Please select a date and time')` | — | ✅ | Web disables Submit while blank (create only) |
| 11 | **Duration** options | 6 chips in a horizontal scroller: `15 min` (15), `30 min` (30), `45 min` (45), `1h` (60), `1.5h` (90), `2h` (120) | `DEFAULT_DURATION_OPTIONS` | ⚠️ | Web offers the same six values but labels them all "{n} min" — "60 min", "90 min", "120 min" instead of "1h", "1.5h", "2h" |
| 11a | **"Ends at" preview** | live caption under the duration chips once both a time and a duration are set: `Ends at 8:30 PM`, or `Ends Mar 18 at 12:15 AM` when it rolls past midnight | `LiveScheduleField.tsx:174-185, 308-318` | ❌ | Web never shows the end time |
| 12 | Default duration on create | **60** | `ManageLivesCreate.tsx:39` | ⚠️ | Web defaults to **30** (`DEFAULT_DURATION`) |
| 13 | Cancel button | navigates back | — | ✅ | Web: Cancel closes the editor |
| 14 | Create button | calls `createLiveSession` on `USERS_LAMBDA` (which also provisions the Twilio room and chat channel) | `services/streaming/live-groups` | ✅ | Same lambda payload type |
| 15 | Success | toast "Live session created" and navigate back | — | ✅ | "Live session scheduled." |
| 16 | Failure | `Alert('Error', message)` | — | ✅ | Web toasts the lambda's message, unwrapping double-encoded bodies |
| 17 | Active toggle at creation | not offered — new sessions are active | — | ✅ | Web hides the toggle in create mode too |
| 18 | Loading | full-screen `Loader` replacing the form | — | ⚠️ | Web shows a button spinner and keeps the form visible |

---

### 13. ManageLivesDetail

**Mobile:** `src/screens/profile/manage-lives/ManageLivesDetail.tsx`
**Web:** the `mode: "edit"` branch of `components/profile/ManageLivesScreen.tsx`

| # | Mobile field / capability | Type & validation | Data source | Web status | Notes |
|---|---|---|---|---|---|
| 1 | Re-fetches the session on open | `getLiveStreamingGroup` | | ⚠️ | Web edits from the row already in the list; `fetchLiveSession` exists in `manageLives.ts:145` but is unused |
| 2 | Header card: status pill | LIVE NOW / ENDED / SCHEDULED | | ⚠️ | Only in the list row on web |
| 3 | Header card: group name as the title | | | ⚠️ | Web header shows the group name once for the whole page |
| 4 | Header card: scheduled date + time | | | ⚠️ | On the list row |
| 5 | Header card: "• Created {date}" | | `createdAt` | ❌ | Not shown anywhere on web |
| 6 | Title | text, **required** | | ✅ | |
| 7 | Description | textarea, optional; empty saves as `null` | | ✅ | Same |
| 8 | Date / time / duration | as ManageLivesCreate | | ⚠️ | Same divergences (#6-#12 above) |
| 9 | Default duration when unset | **30** | `ManageLivesDetail.tsx:103` | ✅ | Web also 30 |
| 10 | Schedule optional on edit | saves `scheduledAt: null` if blank | | ✅ | Web doesn't require it in edit mode |
| 11 | "Active session" switch | toggle; subtitle changes: "Members can see and join this session." / "Hidden from members until reactivated." | | ⚠️ | Web: a checkbox labelled "Visible to members" with the static hint "Turn off to hide it without deleting it." — the state-dependent subtitle is gone |
| 12 | "Delete session" row | destructive row with a trash icon | | ✅ | Web: a text link in the editor footer |
| 13 | "Last updated {date}" under Delete | caption | `updatedAt` | ❌ | Not shown on web |
| 14 | Delete confirmation | native `Alert`: "Delete Live Session" / "Are you sure you want to delete this live session?" / Cancel + Delete | | ✅ | Web `ConfirmSheet`: "Delete "{title}"? This can't be undone." — names the session |
| 15 | Delete mutation | `deleteLiveStreamingGroup` | | ✅ | Same |
| 16 | Save changes button | full-width bottom bar | | ✅ | Web: Save in the editor footer |
| 17 | Update mutation fields | `title`, `description`, `duration`, `scheduledAt`, `active` | | ✅ | Identical |
| 18 | Success toast | "Live session updated" / "Live session deleted" | | ✅ | Same wording |
| 19 | Failure | `Alert('Error', 'Failed to update live session')` | | ✅ | Toast |
| 20 | Saving overlay | full-screen spinner | | ⚠️ | Button spinner |
| 21 | Join / start the broadcast from here | not offered on this screen | | ✅ | Web live video lives at `/live/[eventId]` (see `docs/LIVE.md`) |

**Missing on web (lives, all three screens)**
- The intro line and the "UPCOMING SESSIONS" / "HIDDEN SESSIONS" section headers.
- Counts on the Active / Hidden tabs, and the Hidden tab being visible when it is empty.
- Being stopped from scheduling a session in the past, or more than a year out.
- The 15-minute time granularity — web lets a host schedule 7:07 PM, which mobile can never produce.
- The "Ends at 8:30 PM" preview under the duration chips.
- Human durations — "1h", "1.5h", "2h" read as "60 min", "90 min", "120 min".
- The 60-minute default on a new session (web starts at 30).
- "Created {date}" and "Last updated {date}" on a session.
- The active-toggle subtitle that changes with the state.
- A card title falling back to the group name when a session has no title.
- Pull-to-refresh / refetch when returning to the list.

---

### 14. UserInfoProfileInvite, UserProfileInviteGallery, JournalPreview, JournalEntryDetail

These four are registered inside `ProfileScreens.tsx` but are the **Buddies** screens reused
as deep-link/scan targets. They are audited in full in the buddies parity document; recorded
here for completeness of the profile stack.

| # | Mobile screen | Purpose | Web status | Notes |
|---|---|---|---|---|
| 1 | `ProfileScreen.UserInfoProfileInvite` → `screens/buddies/userInfo/UserInfo.tsx` | someone else's profile, opened after a QR scan / ID lookup, with connect buttons | ✅ | `app/(app)/buddies/[userId]/page.tsx` → `components/buddies/BuddyProfileScreen.tsx` |
| 2 | `ProfileScreen.UserProfileInviteGallery` → `screens/buddies/gallery/GalleryScreen.tsx` | dedicated photo screen: heading "PHOTOS", **one image per row** at 40% of screen height, sorted **oldest first**, no lightbox/zoom/pager, no empty state | ⚠️ | Web renders a 3–4 column grid inline in `BuddyProfileScreen.tsx:363-383`. No dedicated route, and no lightbox on either client |
| 3 | `ProfileScreen.JournalPreview` → `screens/buddies/journal/JournalPreviewList.tsx` | that person's public journal: heading "JOURNAL", rows of `MM/DD/YYYY` (heading-4/bold) + one truncated line of text, **newest first**, no empty state | ✅ | `app/(app)/buddies/[userId]/journal/page.tsx` → `components/buddies/JournalList.tsx` |
| 4 | `ProfileScreen.JournalEntryDetail` → `screens/buddies/journal/JournalPreviewEntryDetail.tsx` | read-only single entry: pre-formatted date (caption/bold) + full text (subtitle). No actions | ⚠️ | Web shows entries in full in the list; no per-entry route |
| 5 | Journal preview block on the profile itself (`JournalPreviewProfile.tsx`) | "JOURNAL" heading, newest entry's date as `March 17, 2025`, 4 lines of text, **"Read More"** button → the journal list. Renders **nothing** when there are no public entries | ✅ | Web `JournalPreview` block inside `BuddyProfileScreen.tsx:361` |
| 6 | `ProfileScreen.Chat`, `ProfileScreen.HomeNotifications` | the chat and updates screens reachable from a scanned profile | ✅ | `/chat` and `/notifications` exist; see their own parity docs |
| 7 | Viewing your **own** public profile from the profile tab | reachable by scanning your own QR (mobile intercepts it — see Buddy ID #15) | ❌ | No link from the web hub; see *Cross-screen gaps* #8 |

The connect-flow rules that live on this screen — the `Connect` / `Pending` / `Connected` /
`Next` / `Maybe later` / `Chat` button bar, the blocked-user check, the "share your buddy id"
confirm modal and the six connection toasts — belong to the buddies audit and are not
re-listed here.

---

### 15. Shared profile elements

| # | Mobile element | What it does | Web equivalent | Status |
|---|---|---|---|---|
| 1 | `elements/percent-circle/PercentCircle.tsx` | ring + "{n}%" label; the animation is commented out and it renders statically; does **not** clamp above 100 | `components/profile/ProgressRing.tsx` | ✅ clamps at render, keeps the un-clamped maths, animates the arc |
| 2 | `elements/buddy-id/buddy-id.tsx` | "BUDDY ID" label, value, SHARE button, trust toast | inlined into `ProfileHub.tsx:273-288` | ⚠️ Share and the toast are not on the hub |
| 3 | `elements/qr-share/qr-share.tsx` | QR of the App Store link (from Contentful `appStoreLinkCollection`) + "COPY LINK"; used by the drawer **Share** screen | — | ❌ no web "share the app" screen at all |
| 4 | `elements/BuddyIdScanner/BuddyIdScanner.tsx` | VisionCamera QR scanner, permissions, rescan lockout, reactivate tap target | — | ❌ deliberate |
| 5 | `elements/journal/JournalControl.tsx` | date + truncated text + visibility `Switch` | `VisibilitySwitch` inside `JournalScreen.tsx` | ✅ (see journal table for the truncation/date diffs) |
| 6 | `elements/avatar/avatar.tsx` | sizes x-small→large, rounded/square shapes, icon overlay, initials fallback | `components/buddies/BuddyAvatar.tsx` | ✅ |
| 7 | `elements/avatar-vertical/AvatarVertical.tsx` | centred group avatar, LIVE ring/badge, "View {n} members" — a **groups** element, not used in the profile stack | groups components | n/a |
| 8 | `layouts/AvataInfo/AvatarInfoLayout.tsx` | the identity block: avatar, name, role badge, ambassador overlay, host badge, pronoun, location, "here to", muted bell | `ProfileHub.tsx:197-271` | ⚠️ see hub rows #7-#12 |
| 9 | `elements/media-preview-strip/MediaPreviewStrip.tsx` | removable media thumbnails for chat compose — **not used** anywhere in the profile stack | chat components | n/a |
| 10 | `elements/modal-medical-information/ModalMedicalInformation.tsx` | the Medical screen's HELP form | — | ❌ |
| 11 | `elements/modal-personal-information/ModalPersonalInformation.tsx` | two-step help form (reasons → name + email → SUBMIT) with a progress bar; used **only in enrollment** (`context/enrollment/EnrollmentControls.tsx`), never in the profile stack | `components/auth/HelpDialog.tsx` covers the enrollment case | ✅ out of scope here |
| 12 | `elements/modal-ambassador/ModalAmbassador.tsx` | ambassador explainer; from the profile hub it shows the thank-you variant with a DISMISS button, elsewhere "BECOME AN AMBASSADOR" (Google Form link) + "learn more" (opens a support chat) | — | ❌ |
| 13 | `elements/content-button/content-button.tsx`, `layouts/ItemHeader/ItemHeader.tsx` | the row + section-heading primitives the hub is built from | `SectionCard` / `ActionCard` in `ProfileHub.tsx` | ✅ |
| 14 | `elements/dropdown/dropdown.tsx` | multi-select with `addButton`, `firstItemClearable`, `limit`, `onDeletedItem`, `onClear` | `MultiSelectField` in `components/ui/form.tsx:520` | ⚠️ no `limit` support — see Medical #9 |

---

## Cross-screen gaps

These apply across the whole profile stack rather than to one screen.

1. **❌ No support/"I can't find my information" path anywhere in the profile.** Mobile
   surfaces `ModalMedicalInformation` behind the Medical screen's HELP button and posts it
   to `SENDEMAILHELP` on `USERS_LAMBDA`. The web app already has `raiseUserLambda` and a
   `HelpDialog` component in the auth flow; nothing wires them into the profile.

2. **❌ Nothing explains ambassadorship.** The badge appears on the web hub but does nothing.
   Mobile's tap-through is the only place a user learns what the badge means or how to apply.

3. **⚠️ The unsaved-changes guard only covers a browser refresh.** Every editable mobile
   screen registers `beforeRemove` and shows "Are you sure you want to leave without saving
   your changes?" (`useGuard`, `LEAVE_WITHOUT_CHANGES`). The web forms register
   `beforeunload`, which fires on refresh and tab-close but **not** on a client-side route
   change — clicking the back arrow, a sidebar link, or a hub card discards edits silently.
   This affects Personal, Patient, Medical and Interests.

4. **❌ Catalogue orderings are not applied.** Mobile runs `setOrderArrayUtil(items, ORDER_*_COPY, 'label')`
   over pronouns, gender identity, sexual orientation, ethnicity, relationships and
   coping-with-loss so the common answers sit at the top. The web renders whatever order
   AppSync returns for all six. Only languages are ordered on web — and that list has a
   spelling bug ("Ukrainian" vs the catalogue's "Ukranian").

5. **❌ Field help text is systematically dropped.** `FORMS_COPY_RES` carries a `title`,
   `description`, `searchPlaceholder`, `addButtonText`, `emptyStateMessage` and sometimes a
   `hint`/`helpText` for each catalogue field. The web keeps the label and roughly one
   sentence per *card*; the per-field descriptions ("Start typing the name, and a list will
   appear — then tap on your diagnosis. This info helps match you with buddies.") and the
   "hmm, that's not on the list yet" empty states are gone.

6. **⚠️ Autocomplete became local filtering.** Diagnosis, medical centre, and side effects
   are server-side prefix searches on mobile (`findDiagnosis`, `findHospitals`,
   `SEARCH_WORKPLACE_WITH_ID_STATE`). On web only workplace and college stayed async; the
   rest preload the whole catalogue and filter in the browser. Fine today; it degrades as
   the catalogues grow.

7. **⚠️ Nothing refetches on focus.** Mobile's `useFocusEffect` re-reads the profile and the
   gallery every time the tab is focused, so a change made on another device shows up. The
   web reads once per mount and after its own saves.

8. **❌ No "preview my public profile".** Mobile registers `UserInfoProfileInvite` inside the
   profile stack, so a user who scans their own QR lands on their public profile — the only
   way to see what others see. The web sends you to `/buddies/<your id>` from the lookup, but
   there is no link from the hub, and the self-lookup is unvalidated (Buddy ID #15).

9. **⚠️ Two Buddy ID implementations on web.** `components/profile/BuddyIdScreen.tsx` and
   `components/buddies/BuddyIdSheet.tsx` both look a user up by Buddy ID. The buddies one
   masks the input and runs all four safety checks; the profile one does neither. They should
   be one component.

10. **➕ Where web is ahead of mobile.** Recorded so a future "fix parity" pass doesn't undo
    them: real error states with retry on every screen; partial-save warnings when a join row
    fails; the journal paging to exhaustion and confirming both visibility directions; photo
    size/emptiness guards; a stated reason for every disabled Save button; the host badge; and
    the explicit "you're not hosting a group yet" state.
