# Auth, Onboarding, App Status & Deep Links — mobile vs web parity

Source of truth: `~/cancerbuddyapp` (React Native).
Target: `~/cancerbuddy-web` (Next.js App Router).

All mobile paths below are relative to `~/cancerbuddyapp`, all web paths relative to
`~/cancerbuddy-web`.

---

## Summary

The web `/register` wizard is a genuine, working port of the mobile enrollment
flow — Cognito sign-up, email OTP, Twilio phone OTP, role branch, medical
profile, address, profile completion, and the same AppSync finalisation
pipeline. Twenty of mobile's twenty-one reachable enrollment screens exist in
some form. Two things, however, break parity hard:

1. **Caregivers skip two whole steps on web.** `app/register/page.tsx:916`
   sends `cgPatientAge → address`, so a CAREGIVER never sees Diagnosis or
   Medical Center. On mobile a caregiver walks
   `CGPatientAge → PatientDiagnosis → PatientMedicalCenter → Address`
   (`src/context/enrollment/EnrollmentProvider.utils.tsx:25-32`, counter `1`
   from index 16 → 17). Caregiver diagnosis/hospital data is silently never
   collected on web.
2. **Password reset does not exist on web.** Mobile has a three-screen flow
   (ForgotPassword → Verification → SuccessNotification). Web's login page
   links to `/forgot-password` (`app/(auth)/login/page.tsx:368`) — a route that
   does not exist, so the link 404s. `forgotPasswordAction` in
   `app/actions/auth.ts:66` is a stub with a `TODO` and never calls Cognito.

Beyond that: the whole **app-status subsystem** (maintenance mode, forced
update, optional update) has no web counterpart at all, and the **only mobile
deep-link pattern** (`/buddyId/:buddyId`) has no web route even though
`components/profile/BuddyIdScreen.tsx:30` generates and shows that exact URL to
users.

On the plus side, web is *ahead* of mobile in a few places: a real resume
mechanism for interrupted sign-ups (`RESUME_UNCONFIRMED` / `RESUME_SIGNED_IN`),
an explicit "not confirmed" banner on login, a forward-only step watermark that
stops URL tampering, and in-memory-only draft storage (no localStorage — matches
the standing project rule).

**Counts: 26 ❌ MISSING, 24 ⚠️ PARTIAL.**

### Mobile dead code found while tracing (not web gaps)

These exist on mobile but have no reachable forward transition. They are
documented so nobody "ports" them by mistake:

- **`userRecoveryGroup`** — `UserRecoveryCodeVerification`,
  `UserRecoveryLoginWithoutEmail`, `UserRecoveryPassword` (path indices 6–8).
  No mapping in `src/utils/enrollment/redirection.ts` or `conditions.ts`
  produces a counter landing on 6, 7 or 8. They only serve as offset padding
  (`userRecoveryGroup.length + N`). Their real-world purpose (resume an
  unconfirmed signup) is covered on web by `RESUME_UNCONFIRMED`.
- **`PrivacyTermsAlertChild`** (index 4, "You need to be 8 years old…") —
  `RedirectVerificationConditionUtil` returns `1` for *both* the 8–12 branch and
  the ≤7 branch (`src/utils/enrollment/conditions.ts:76-79`), so index 4 is
  never entered. Under-8 users fall into the guardian flow on mobile too.
- **`PersonalInfoNotification`** (`enrollmentGroups/notifications/`) — never
  imported into any screen group; hardcoded `"Glad you're here, anna!"`.
- **`EnrollmentBackButton`'s `withoutButton`** state is computed then discarded
  by a literal `{true ? … : …}` (`src/navigation/enrollment/EnrollmentBackButton.tsx:56`),
  so the back arrow shows on every screen including OTP screens.
- **`RedirectBackVerificationConditionUtil`** compares `path.length < 32`
  (`src/utils/enrollment/conditions.ts:34`) but `enrollmentPath.length` is 28 —
  the check is always true, so Back from `AccountSetupUserRole` /
  `AccountSetupPhoneNumber` jumps a new user all the way to
  `PrivacyTermsContract`.

---

## Sign-in / password reset

### Welcome / splash

| Item | Mobile | Web | Status |
| --- | --- | --- | --- |
| Screen | `SplashScreenInitial` (`src/components/layouts/SplashScreen/SplashScreenInitial.tsx`), registered as `AuthNavigator` initial route | `app/(auth)/page.tsx` + `app/(auth)/WelcomeSplash.tsx` | ✅ EXISTS |
| Copy "Welcome!" / "Are you new here?" | Yes (lines 152, 160) | Landing hero uses different marketing copy (`landing.heroHeading`) | ⚠️ PARTIAL — mobile's literal "Are you new here?" question is gone |
| "No" button → Sign in | Yes (`navigate('Signin')`) | Sign-in link in nav / `MobileMenu` | ✅ EXISTS |
| "Yes" button → Sign up | Yes (`navigate('SignUp')`) | Register link | ✅ EXISTS |
| Staged entrance animation (illustration slide, logo cross-fade, 2 s delay) | Yes (`Animated.parallel` / `Animated.sequence`) | `hero-fade-up` / `hero-fade-in` CSS keyframes only | ⚠️ PARTIAL — simplified, no logo hand-off sequence |
| "Powered by" + BMCF logo | Yes | Yes | ✅ EXISTS |

### Login

Mobile: `src/screens/signIn/Login/Login.tsx`, schema `LoginSchema`
(`src/model/forms/EnrollmentFormValidations.ts:140`).
Web: `app/(auth)/login/page.tsx`, schema `loginSchema` (`lib/validations.ts:6`),
service `lib/login/cognitoLoginService.ts`.

| Field / behaviour | Mobile | Web | Status |
| --- | --- | --- | --- |
| Heading | "Welcome back!" | `login.heading` | ✅ EXISTS |
| Email input | placeholder "Your email", `keyboardType="email-address"`, `autoCorrect={false}`, `textContentType="emailAddress"`, trimmed on change | labelled Email input, `type="email"`, `autoComplete="email"`, `autoCapitalize="none"`, `spellCheck={false}` | ✅ EXISTS |
| Email — required msg | `"This field is required."` | `validation.login.emailRequired` = "Email address is required." | ⚠️ PARTIAL — different wording |
| Email — format msg | `"Please provide a valid email."` (regex `^[a-zA-Z0-9._%+-]+@…`) | "That doesn't look like a valid email…" (Zod `.email()`) | ⚠️ PARTIAL — different wording + different validator |
| Password input | placeholder "Your password", `variant="password"` with show/hide | `type="password"`, built-in eye toggle | ✅ EXISTS |
| Password — required msg | `"This field is required."` | "Password is required." | ⚠️ PARTIAL — wording |
| Password — min length on login | none (only `.required()`) | `.min(8, …)` — web rejects short passwords **before** hitting Cognito | ⚠️ PARTIAL — divergence; a legacy user with a <8-char password can't even submit on web |
| Errors shown only after blur | Yes (`blurred` state map) | `mode: "onBlur"` | ✅ EXISTS |
| Errors forced on for all fields when submit fails validation | Yes (`setBlurred({email:true,password:true})`) | RHF shows all on submit | ✅ EXISTS |
| Native-autofill ref sync workaround | Yes (`emailRef.current._lastNativeText`, 50 ms delay) | N/A on web | ✅ EXISTS (not applicable) |
| "I forgot my password" link | Yes → `SignInScreens.ForgotPassword` | Yes → `/forgot-password` — **route does not exist (404)** | ❌ MISSING (dead link) |
| Loader while submitting | `<Loader />` | `loading` prop on Button | ✅ EXISTS |
| Google / Apple / social sign-in | **none** on mobile | **none** on web | ✅ EXISTS (parity: neither has it). Note `docs/signup-flow-plan.md:225` claims "the /login page has Google + Apple stubs" — that is stale and wrong |
| Biometric (Face ID / fingerprint) login | **none** on mobile | **none** on web | ✅ EXISTS (parity) |
| `UserNotConfirmedException` handling | Navigates to `SignUp`, resets enrollment, `setEmail`, toast `ALERT_USER_NOT_VERIFIED` = "This email is already registered. Please confirm your account to complete the enrollment process." | `NotConfirmedBanner` inline, links to `/register` | ⚠️ PARTIAL — web shows a banner instead of auto-navigating; message text differs |
| Other Cognito errors | Raw Cognito message via `showErrorInToast(error)` | Mapped to `login.invalidCredentials` for `NotAuthorized` / `UserNotFound` / `InvalidParameter`; raw message otherwise | ⚠️ PARTIAL — web is friendlier but not identical |
| `NEW_PASSWORD_REQUIRED` challenge | not handled (mobile just throws) | Explicit guard, signs out, tells user to use "Forgot password" (`cognitoLoginService.ts:113-122`) — but forgot-password doesn't exist | ⚠️ PARTIAL — advice points at a 404 |
| Post-login analytics flags | 5 `AsyncStorage` keys set to `'true'` (`Login.tsx:41-57`) | not set on login (only seeded to `'false'` at enrollment finalize) | ❌ MISSING |
| Post-login destination | `logIn()` → `setUser()` → drawer/home; unenrolled → `navigate('SignUp')` + toast "Please complete your profile to finish your enrollment/registration." | `DONE` → `/groups`; `RESUME_PHONE` → `/register?step=phone`; `RESUME_USER_ROLE` → `/register?step=userRole` | ✅ EXISTS (web is finer-grained) |
| Unenrolled-user toast | Yes | none (silent redirect) | ❌ MISSING |
| Keyboard-sticky submit button | `KeyboardStickyView` | N/A | ✅ EXISTS (n/a) |

### Forgot password (mobile `ForgotPassword.tsx`)

| Field / behaviour | Mobile | Web | Status |
| --- | --- | --- | --- |
| Route/screen | `SignInScreens.ForgotPassword` | none — `/forgot-password` not in `app/` | ❌ MISSING |
| Heading "Forgot your password?" | Yes | — | ❌ MISSING |
| Body "No worries! Enter your email to get a recovery code." | Yes | — | ❌ MISSING |
| Email field, schema `EmailScheme` (`.trim().required('This field is required').email()`) | Yes | `forgotPasswordSchema` exists in `lib/validations.ts:21` but is only wired to a stub action | ❌ MISSING |
| Progress bar at 25 % | Yes | — | ❌ MISSING |
| "Send code" button, disabled until valid | Yes | — | ❌ MISSING |
| `Auth.forgotPassword(email)` call | `sendForgotPasswordCode` (`src/context/auth/authUtils.ts:126`) | commented-out TODO (`app/actions/auth.ts:83`) | ❌ MISSING |
| `LimitExceededException` → "Too many attempts. Please wait a while before requesting another code." | Yes (`showAuthErrorInToast`) | — | ❌ MISSING |

### Set up new password (mobile `SetupNewPassword.tsx`, route `SignInScreens.Verification`)

| Field / behaviour | Mobile | Web | Status |
| --- | --- | --- | --- |
| Screen | Yes | none | ❌ MISSING |
| Heading "Code sent!" / sub "Check your email." | Yes | — | ❌ MISSING |
| 6-cell OTP (`CodeValidationLayout`, `CELL_COUNT = 6`) | Yes | `components/auth/OtpInput.tsx` exists and is reusable, but no reset screen uses it | ❌ MISSING |
| "I need another code" resend link | Yes → `sendForgotPasswordCode` + toast `VERIFICATION_CODE_SENT(email)` = "A new confirmation code was sent to {email}" | — | ❌ MISSING |
| New password + confirm (`ConfirmPasswordLayout`) | Yes | — | ❌ MISSING |
| `NewPasswordSchema` rules: ≥8 chars, ≥1 digit, ≥1 special `[!?¿@#$%^&*_]`, ≥1 uppercase, ≥1 lowercase, confirm must match | Yes | Same rules exist in `lib/signup/validation.ts:78-104` for registration only | ❌ MISSING (for reset) |
| Password hint text `"Please use 8 characters, including: • 1 number • 1 capital letter… • 1 special character…"` | Yes | Equivalent live meter on register only | ❌ MISSING (for reset) |
| Progress bar at 100 % | Yes | — | ❌ MISSING |
| `Auth.forgotPasswordSubmit` | `submitNewPassword` | — | ❌ MISSING |

### New-password success (mobile `NewPasswordSuccessNotification.tsx`)

| Item | Mobile | Web | Status |
| --- | --- | --- | --- |
| Screen with `thanks.png` illustration | Yes | none | ❌ MISSING |
| "Nice – you've got a new password!" | Yes | — | ❌ MISSING |
| "You can log into CancerBuddy with it." | Yes | — | ❌ MISSING |
| "Log in" CTA → Login | Yes | — | ❌ MISSING |

---

## Enrollment wizard step-by-step

**Mobile path construction** — `src/context/enrollment/EnrollmentProvider.utils.tsx:25`:

```
enrollmentPath = privacyTermsGroup(6) + userRecoveryGroup(3) + accountSetupGroup(6)
               + profileSetupCareGiverGroup(2) + profileSetupGroup(3) + userInfoGroup(8)
               = 28 screens
```

The traversal order below is what a user actually walks, derived from
`goToNextScreen` + `RedirectCalculateUtil` + `conditions.ts`. Bracketed numbers
are the index inside `enrollmentPath`.

**Web flow order** — `lib/navigation/userStepGate.ts:USER_FLOW_ORDER` (24 entries
including `intro` and `done`).

| Step # | Mobile step | Fields & options | Conditional on | Web step | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| — | *(no mobile equivalent)* | — | — | `intro` (`StepIntro.tsx`) — 3 marketing highlight cards + "Start" CTA + time note | ⚠️ PARTIAL | Web-only extra screen. Harmless, but it means web has 1 more screen than mobile before privacy. |
| 1 | `PrivacyTermsContract` [0] | Three long-form sections rendered from `PrivacyTerms.examples.ts`: **Your privacy comes first**, **Child Safety Standards**, **Terms of use**; each with a "Read All" button opening `PrivacyTermsContractModal`. Single CTA **"I've read & accept"** (`forceNotDisable: true` — always enabled). Dispatches `AcceptTerms`, which stamps `acceptTerms: true` + `termsTimestamp: new Date()`. | always | `privacy` (`StepPrivacy.tsx`) | ⚠️ PARTIAL | Web shows a *summary* of each policy with a "Read all" link to `/privacy`, `/child-safety`, `/terms` (full text lives in `lib/legal/content.ts`) instead of an in-page modal. Web requires an explicit **checkbox** ("accept all three") before Continue; mobile's button is always enabled. Web CTA label is generic "Continue", not "I've read & accept". |
| 2 | `PrivacyTermsIntroduction` [1] | Title "Welcome to CancerBuddy!" / "Please introduce yourself." Fields: **name** (single free-text input, placeholder "What's your name?", hint "(First & last name)", `autoCapitalize`, 300 ms debounce); **birth** (custom masked `mm/yyyy` input, `maxLength=7`, month auto-clamped to 01–12, hint "(mm/yyyy)" + tooltip "Why do we ask this? Your age qualifies you to use this app and helps find buddies close to your age."); **pronoun** (`Dropdown`, options from AppSync `listPronouns`, ordered by `ORDER_PRONOUNS_COPY` = She/her, He/him, They/them, I rather not disclose, clearable). | always | `profile` (`StepProfile.tsx`) | ⚠️ PARTIAL | See "Field-level deltas — Step 2" below. |
| 2a | `PrivacyTermsUnderAgeDetected` [2] | Interstitial: `BMCF_Survivor.png` image + copy "Hold on Buddy, it looks like you are a minor" / "We're glad to have you here buddy! You will need adult supervision to join the community." Continue always enabled. | age < 13 (`displayAgeOld(birth) <= MINAGE-1`) | — | ❌ MISSING | Web jumps straight from `profile` to `guardian` (`page.tsx:543`). The "you're a minor, here's why" explainer screen is gone. |
| 2b | `PrivacyTermsUnderAge` [3] | Title "Before you start". Copy `UNDER_AGE_LAYOUT_COPY` = "Please ask your parent or guardian to fill out the following info:". Fields: **guardianFullName** (placeholder "Full name", hint "(First & last name of parent or guardian)"); **guardianEmail** (placeholder "Adult's email", hint "(For verification purposes)"); **checkbox 1** `OPTION_GUARDIANT_CONSENT` = "I am the parent or guardian responsible for this underage user."; **checkbox 2** `OPTION_GUARDIANT_CONSENT_SUPERVISION` = "I will supervise this minor in the use of the CancerBuddy app." Submit calls `saveGuardianInfo` (Lambda `CREATE_GUARDIAN`) → stores `userGuardianId`. | age < 13 | `guardian` (`StepGuardian.tsx`) | ✅ EXISTS | Same 4 fields, same `CREATE_GUARDIAN` Lambda call (`page.tsx:557`). Web adds a `.email()` check on guardian email with message "Please enter a valid email address"; mobile uses "Please provide a valid email." |
| — | `PrivacyTermsAlertChild` [4] | `CalendarX` icon + `MINIMUM_AGE_ADVICE` = "You need to be 8 years old to use this version of CancerBuddy." + "We're working on a new version for you. Please check back soon!" + "got it" → back. | *unreachable* (see dead-code note) | — | ⚠️ PARTIAL | Web has no minimum-age floor either: `profileSchemaForUser` (`lib/user-signup/validation.ts:43`) only bounds birth year by `MIN_BIRTH_YEAR` (age ≤ 120) and "not in the future", so a 3-year-old passes and enters the guardian flow. `CHILD_MIN_AGE = 8` / `GUARDIAN_MAX_BIRTH_YEAR` are declared in `lib/signup/constants.ts:3,8` but **never referenced anywhere**. |
| 2c | `PrivacyTermsGuardianOTP` [5] | Heading "Thanks, {guardianFullName}" / "Please verify your identity." 6-cell OTP. Verification compares the entered code against AppSync `getGuardian.code`, then `UPDATE_GUARDIAN_USED_CODE`. Resend link `"I need another code"` / `"Resend code in m:ss"` with a **60 s** cooldown (`RESEND_COOLDOWN_MS = 60000`). Wrong code → toast `"Invalid code"`. | age < 13 | `guardianOtp` (`StepGuardianOtp.tsx`) | ⚠️ PARTIAL | Same `getGuardianCode` + `markGuardianCodeUsed` calls. Cooldown is **30 s** on web (`OTP_RESEND_COOLDOWN_SEC = 30`) vs 60 s on mobile. Web's resend re-runs `CREATE_GUARDIAN` (mints a *new* guardian row + id) rather than resending against the existing one (`page.tsx:628-657`). Mobile's resend calls `Auth.resendSignUp(guardianEmail)`, which is itself odd. |
| 3 | `AccountSetupMailPass` [9] | Title "Hi {name}!" / "Let's create your account." Fields: **email** (placeholder "What's your email?", hint "Other app users won't see this.", `autoCorrect={false}`); **password** (placeholder "Create password", hint "Please use 8 characters, including: • 1 number • 1 capital letter, such as A or B • 1 special character, such as $ or !"); **passwordConfirmation** (placeholder "Confirm password"). Submit → `Auth.signUp`. | always | `credentials` (`StepCredentials.tsx`) | ✅ EXISTS | See "Field-level deltas — Step 3". |
| 3a | `EmailVerification` modal (inside `AccountSetupMailPass`) | Bottom-sheet modal: "Welcome back {name}!" / `how_to_reg.png` / "Pick up where you left off" / "It seems you've started the account creation process using this email:" / `({email})` / "You can continue with your existing information or start over by creating a new account". Buttons: **"resume set up"** (continue) and link **"Create new account"** (→ `ResetEnrollment`). | Lambda `VERIFY_EMAIL` reports `email_verified === 'false'` | Inline hint only: `register.emailOtp.resumeHint` shown on the OTP step when `RESUME_UNCONFIRMED` | ⚠️ PARTIAL | Web has the resume *behaviour* (arguably better — see `StartUserSignupResult` in `lib/user-signup/types.ts:36`) but not the modal, and **no "start over / create new account" escape hatch**. |
| 4 | `AccountSetupValidation` [10] | Title "Thanks, {name} –" / "Please confirm your email." 6-cell OTP, no Continue button (auto-submits on 6th digit). On success: `confirmSignUp` → `signIn` → `RegisterUserUtil` (AppSync `CREATE_USER`). Resend "I need another code" (60 s cooldown) + toast "A new confirmation code was sent to {email}". Wrong code → red cells. | always | `emailOtp` (`StepEmailOtp.tsx`) | ⚠️ PARTIAL | Web has an explicit **Verify** button rather than auto-submit on the 6th digit. Web adds a **"Change email"** link (mobile has none here). Resend cooldown 30 s vs 60 s. Web masks the email (`j••n@example.com`); mobile shows it in full. |
| 5 | `AccountSetupPhoneNumber` [11] | Title "Phone verification" / "Please provide your phone number and we'll send you a verification code." Field: **phone** via `PhoneNumberInput` (country picker + national number). Validation `ProfileSetupPhoneScheme`: regex `^(\+\d{1,4}( )?)?((\(\d{1,3}\))\|\d{1,3})[- .]?\d{3,4}[- .]?\d{2,4}$`, messages "Phone number shoud have the format \"+country code\" \"number\"" *(sic — typo in mobile)* and "Phone number is required". Submit → Lambda `SEND_CODE_PHONE`, stores `sid` in AsyncStorage. Skips the send if the same number is within the 60 s cooldown. | always | `phone` (`StepPhone.tsx`, phone + OTP on one screen) | ⚠️ PARTIAL | Web merges phone entry and phone OTP into one screen with an in-place reveal; mobile uses two stack screens. Web validation is `lib/host-signup/validation.ts` (`phoneSchema`), messages: "Please choose your country." / "Phone number is required." / "That phone number looks too short." / "…too long." — none match mobile's single format message. Web adds `ALREADY_IN_USE` handling ("This phone number is already linked to another account.") which mobile lacks. |
| 6 | `AccountSetupOtp` [12] | Title "Verify your number" / "Please verify your phone number." 6-cell OTP, `"Enter the code sent to\n {phone}"`. Auto-submits on 6th digit. Links: **"I need another code"** (60 s cooldown) and **"Change number"** (goes back a screen). Verify → Lambda `VERIFY_CODE_PHONE`, then AppSync `UPDATE_USER_PHONE` **and** `Auth.updateUserAttributes({phone_number, phone_number_verified:'true'})`. Failure toast: "An error occured, please try again in a few seconds". | always | folded into `phone` | ⚠️ PARTIAL | Same Twilio pipeline (`confirmPhone`). Web has an explicit **Verify** button (no auto-submit). "Change number" is implicit — editing the number resets the OTP block (`StepPhone.tsx:118`) — there is no labelled "Change number" control. Cooldown 30 s vs 60 s. |
| 7 | `AccountSetupVerifiedSuccessfully` [13] | Title "Thanks, {name}" / "Your phone number has been verified:" + the phone number rendered as a heading. Continue. | always | `verifiedSuccessfully` (`StepVerifiedSuccessfully.tsx`) | ⚠️ PARTIAL | Web shows a check-circle + "{name}" heading but **does not echo the verified phone number back**, which is the entire point of the mobile screen. |
| 8 | `AccountSetupUserRole` [14] | Title "Next step, {name}" / "This info helps match you with buddies." / subtitle "What's your current status?" Radio cards from `ROLE_PLATFORM_OPTIONS`: **PATIENT** "I've been diagnosed" / "I'm a patient, currently in treatment or about to start" (`BMCF_Patient.png`); **CAREGIVER** "I'm taking care of someone" / "I'm a caregiver for a family member or friend" (`BMCF_Caregiver.png`); **SURVIVOR** "I'm a survivor" / "I've completed treatment, and I'm in remission" (`BMCF_Survivor.png`). CAREGIVER is filtered out when `displayAge(birth) < 13`. | always | `userRole` (`StepUserRole.tsx`) | ✅ EXISTS | Same three roles, same images (plus BW variants for unselected), same under-13 CAREGIVER filter (`StepUserRole.tsx:69`). Web adds an explanatory hint when the option is hidden. Copy comes from i18n keys — verify they match `ROLE_PLATFORM_OPTIONS` verbatim. |
| 9 | `ProfileSetupCGRelationship` [15] | Title "Can you say more, {name}?" / "Sharing info makes your recommendations better." Field: **relationship** — `Dropdown`, placeholder "Relationship to the patient", options from AppSync `listRelationships`, ordered by `ORDER_RELATIONSHIPS_COPY` = Friend, Relative, Sibling (brother/sister), Kid (daughter/son), Partner/spouse, Parent (mom/dad). Required. | `userType === CAREGIVER` | `cgRelationship` (`StepCGRelationship.tsx`) | ⚠️ PARTIAL | Same AppSync source and required rule. Web sorts **alphabetically** (`sortAlpha`), losing mobile's deliberate `ORDER_RELATIONSHIPS_COPY` ordering. |
| 10 | `ProfileSetupCGPatientAge` [16] | Title "Can you say more, {name}?" Field: **patientBirth** — masked `mm/yyyy` input, placeholder "When were they born?", hint "(mm/yyyy)" + same "Why do we ask this?" tooltip. Continue **disabled** until `patientBirth.length === 7`. No "Maybe later". | `userType === CAREGIVER` | `cgPatientAge` (`StepCGPatientAge.tsx`) | ⚠️ PARTIAL | Web's Continue is **always enabled** and there is an extra **"Skip"** link — mobile requires a complete date. Web uses the shared `MonthYearPicker` (two selects) instead of a masked text field. |
| 11 | `ProfileSetupPatientDiagnosis` [17] | Copy branches by role: CAREGIVER → "Any health info you can share, {name}?"; otherwise → "Can you say more, {name}?"; both "Sharing info makes your recommendations better." Fields: **diagnosis** (multi-select autocomplete against AppSync `findDiagnosis`, required); **treatmentStatus** (`Dropdown` from `listTreatmentStatuses`, required, hidden for SURVIVOR); **inRemissionSince** (masked `mm/yyyy`, SURVIVOR only, required, cross-validated against birth via `validateRemissionDate` → "Date is not valid"); **treatments** (multi-select from `listTreatments`, alpha-sorted, **locked** until a treatment status is chosen and cleared/locked when status label is `Pre-treatment`); **disabilities** (multi-select from `listDisabilities`, alpha-sorted, optional, has `helpText`). Continue requires diagnosis + treatments non-empty (`validationStringArrayUtil`) and `onValidRules`. `maybeLater: false`. | all roles, **including CAREGIVER** | `diagnosis` (`StepDiagnosis.tsx`) | ❌ MISSING for CAREGIVER | **Caregivers never reach this step on web** (`page.tsx:916` → `address`). For PATIENT/SURVIVOR the port is faithful: same required rules, same Pre-treatment lock (`StepDiagnosis.tsx:110`), same optional side-effects section. Web also drops the caregiver-specific heading copy and the caregiver-only "Patient minimum/maximum age" inputs that mobile renders when `onFilter` is set. |
| 12 | `ProfileSetupPatientMedicalCenter` [18] | Title (all roles) "{name}, which organizations assist you?" / "This info matches you to buddies nearby or those that share the same medical center or support organization." Fields: **hospitals** (multi autocomplete `findHospitals`, `MedicalCenterScheme` marks it `.required('Required')`); **supportOrganizations** (`Dropdown` multi from `listSupportOrganizations`, **limit 3**, required). Continue needs both non-empty. `maybeLater: true` → a **"Maybe later"** button appears. | all roles, **including CAREGIVER** | `medicalCenter` (`StepMedicalCenter.tsx`) | ❌ MISSING for CAREGIVER | Same two pickers, same `limit={3}` on support orgs, same "both required for Continue", same skip link. But caregivers never see it on web. |
| 13 | `ProfileSetupAddress` [19] | Title "Where's home, {name}?" / "This info matches you to buddies nearby, so you have the option to meet in person." Fields: **zipcode** (masked 5-digit, searches AppSync `searchCityZipCodes`; error `ZIPCODE_NOT_FOUND` or `NETWORK_ERROR_COPY` = "Make sure wifi or mobile data is turned on, then try again."); **city** (`Dropdown` populated from the zip result, auto-opens when ≥2 cities); **state** (read-only, auto-filled). `showWorkplace={false}` during enrollment. `ProfileSetupAddressScheme`: city required, state required, zipcode `.min(5, 'Please provide a valid zip code.')`. `maybeLater: false`. | always | `address` (`StepAddress.tsx`) | ✅ EXISTS | Same zip→city→state cascade, same auto-select when exactly one city, no skip link. Web auto-selects on 1 result and lists cities as radio cards rather than a dropdown. Error text is `register.address.zipNotFound`; mobile's `NETWORK_ERROR_COPY` variant for a failed query is not reproduced. |
| 14 | `UserInfoCreateProfile` [20] | Full-screen: `thanks.png`, "Glad you're here, {firstName}!", "Your CancerBuddy account is ready!", "Now you can create your profile, so you can get matched with buddies.", CTA **"Create profile"**. | always | `createProfile` (`StepCreateProfileWelcome.tsx`) | ✅ EXISTS | Same three copy blocks + CTA. Illustration is an inline SVG instead of `thanks.png`. |
| 15 | `UserInfoProfilePic` [21] | Title "Hello, {name}!" / "Show your personality with a profile picture of you, your pet, your favorite place or your lucky charm." After a photo is chosen the copy swaps to `otherDescription` = "Nice choice! To confirm your profile picture, tap continue." Action sheet: take photo / choose from library (and remove, once set). Continue disabled until a photo exists; **"Maybe later"** present. Uploads to S3 → `createPicture` → stores `userProfilePicId`. | always | `profilePic` (`StepProfilePic.tsx`) | ⚠️ PARTIAL | Web has picker + cropper (`PhotoPicker` / `PhotoCropper`) and the same `createPicture` upload (`lib/user-signup/uploadPhoto.ts`), plus a skip link. Missing: the **copy swap after selection** (`updateCopy` / `otherDescription`). Web's Continue is enabled with no photo (it just proceeds), mobile disables it. |
| 16 | `UserInfoAbout` [22] | Title "About me" / "Introduce yourself to the community!" Fields: **bio** (textarea, placeholder "What's your story? Share a bit about yourself.", `maxLength={1000}`, hint "(Maximum 1000 characters)" — note `BioSchema` contradicts this with `.max(300)`, required min 1); **cancerloss** checkbox → reveals **copingWithCancerLoss** `Dropdown` "Who did you lose?" ordered by `ORDER_COPING_WITH_LOSS_COPY`; **isUniversityStudent** checkbox (hidden for CAREGIVER) → reveals **university** autocomplete `findColleges`. College block shown only when `displayAge(birth) >= UNIVERSITY_AGE (17)`. `maybeLater: true`. | always; college sub-block gated on age ≥ 17 and role ≠ CAREGIVER | `about` (`StepAbout.tsx`) | ⚠️ PARTIAL | Faithful: 1000-char bio, cancer-loss checkbox → coping dropdown, college checkbox → college typeahead, age-17 gate, CAREGIVER exclusion, skip link. Deltas: coping options are alpha-sorted instead of `ORDER_COPING_WITH_LOSS_COPY`; web shows the college block when birth is unknown (`age === null`), mobile renders nothing without a birth date; web's bio limit is a hard 1000 (mobile's schema says 300 while its input says 1000 — an internal mobile inconsistency web resolved in favour of 1000). |
| 17 | `UserInfoInterests` [23] | Title "My interests" / "For better recommendations, choose your favorites from the list." Field: **interests** — `Dropdown` multi, `firstItemClearable`, addButton "ADD INTEREST", placeholder "Select interest", options `listInterests` alpha-sorted, required. `maybeLater: true`. | always | `interests` (`StepInterests.tsx`) | ✅ EXISTS | Web renders selectable pills instead of a dropdown; ≥1 required for Continue; skip link present. |
| 18 | `UserInfoLanguage` [24] | Title "What languages do you speak?" / "This will help us match you with other people who speak the same ones you do." Field: **languages** — `Dropdown` multi, addButton "ADD LANGUAGE", placeholder "Select language", options `listLanguages` ordered by `ORDER_LANGUAGES_COPY` (English, Spanish, Chinese, Tagalog, Vietnamese, Arabic, French, Korean, Russian, German, Haitian Creole, Hindi, Portuguese, Italian, Polish, Urdu, Japanese, Farsi, Gujarati, Greek, Bengali, Thai, Hebrew, Turkish, Swahili, Somali, Ukranian, Navajo, Punjabi, Amharic). Required. `maybeLater: true`. | always | `languages` (`StepLanguages.tsx`) | ⚠️ PARTIAL | Present, ≥1 required, skip link. Mobile's curated `ORDER_LANGUAGES_COPY` ordering (English/Spanish first) is not reproduced. |
| 19 | `UserInfoPhotos` [25] | Title "My photos" / "Want to add more photos? Go ahead!" Up to **6** gallery slots (`new Array(6)`). Continue enabled only once ≥1 slot is filled. `maybeLater: true`. | always | `photos` (`StepPhotos.tsx`) | ⚠️ PARTIAL | Same 6-slot grid, same upload → `createPicture`, skip link. Web's Continue is enabled with zero photos (mobile requires ≥1). |
| 20 | `UserInfoLoading` [26] | `LOADING_INFORMATION_COPY` = "Your profile is getting ready..." / `LOADING_INFORMATION_COPY_SUBTITLE` = "Missed something important? \n\n No worries! You can always update your information in the profile section". Runs `UpdateRegisterUserUtil` (`UPDATE_USER`) then `InsertManyToManyUtils` (diagnosis, treatments, hospitals, disabilities, interests, languages, support orgs, gallery), seeds 5 analytics flags to `'false'`, emits `bmcf_enrollment`. Error toasts: "Missing user session. Please log in again." / "Could not save your information. Please try again." / "An error occured while registering your information, please try again in a few seconds". Guards double-run with `startedRef`. | always | `loading` (`StepLoading.tsx` → `lib/user-signup/userEnrollmentFinalize.ts`) | ⚠️ PARTIAL | The pipeline is a faithful port (same `UPDATE_USER`, same 7 many-to-many mutations with the same foreign keys, same gallery wiring, same GetStream + Users LOGIN lambdas, same 5 analytics keys, same `startedRef` double-run guard) **plus** a retry button mobile lacks. Missing: the `bmcf_enrollment` analytics event. Two schema deltas — web sends `supportOrganizationsID` via a `createSupportOrgUser` mutation while mobile uses `CREATE_SUPPORT_ORGANIZATIONS_USER`; and web strips **all** empty values from `UPDATE_USER` (`userEnrollmentFinalize.ts:246`), so an intentionally-false `cancerloss` / `CurrentlyInCollege` is dropped rather than written as `false`. |
| 21 | `UserInfoAllSet` [27] | `all-set-patient.png`, "You're all set!", "Now that your profile is done, we've found some buddies and support groups you might like ... let's go!" Two CTAs: **"Find buddies"** and **"Explore groups"** — both call the same `redirection()` which sets `pendingSupportChannel = 'true'`, promotes the stored Cognito user to `setUser`, and clears the unenrollment record. | always | `allSet` (`StepAllSet.tsx`) | ⚠️ PARTIAL | Same two CTAs and copy, but **both push to `/dashboard`** — neither goes to buddies or groups, and mobile's own buttons are also identical-behaviour, so the divergence is only the destination. `pendingSupportChannel` is handled earlier, inside `finalizeUserEnrollment` (step 6/7), not here. |

### Cross-cutting chrome (`EnrollmentControlsContext`)

| Item | Mobile | Web | Status |
| --- | --- | --- | --- |
| Progress bar across all enrollment screens | `ProgressBar current={enrollmentState.progress}` on every wrapped screen | `RegisterShell` progress strip, but only for the **6** steps in `USER_REGISTER_STEPS` (`privacy, profile, credentials, emailOtp, phone, verifiedSuccessfully`) | ⚠️ PARTIAL — the 15 post-phone steps render `stepIndex = 0` and no meaningful progress (`RegisterShell.tsx:90`) |
| HELP button on every enrollment screen | Yes — `life-buoy.png` + "HELP", opens a 3-option sheet: "I can't create an account / I need help creating my account", "Personal information / I can't find my Zip Code, Diagnosis or Medical Center", "Other / Describe the problem" | `HelpDialog` in `RegisterShell` header, same 3 categories (`CANT_CREATE_REASONS`, `PERSONAL_INFO_REASONS`, other), submits via `USERS_LAMBDA` | ✅ EXISTS |
| Swipe-back gesture disabled | `gestureEnabled: false` set on every screen | N/A (browser back is governed by the URL watermark) | ✅ EXISTS |
| Back button on OTP screens | Shown (the `withoutButton` guard is dead code) | Shown | ✅ EXISTS |
| Title/description driven by a copy map | `ENROLLMENT_DEFAULT_COPIES(name)` keyed by screen, with `{name}` interpolation | Per-step i18n keys in `lib/i18n/locales/en.ts` | ⚠️ PARTIAL — most headings were rewritten; only a few (`diagnosis`, `createProfile`, `verifiedSuccessfully`) still interpolate the first name |
| `updateCopy` alternate title/description | Used by `UserInfoProfilePic` after a photo is chosen | not implemented | ❌ MISSING |
| Draft persistence | none — enrollment state is in-memory reducer only, lost on app kill (recovery is via `unEnrolledUser` in AsyncStorage) | in-memory Zustand only, no localStorage (`lib/user-signup/storage.ts`), passwords/OTPs/guardianId never persisted | ✅ EXISTS |
| Resume for a half-finished account | `unrolledPath` — an 18-screen alternate stack (`PrivacyTermsContract → phone/OTP/verified → role → …`) chosen when `unEnrolledUser` is set | `RESUME_UNCONFIRMED` / `RESUME_SIGNED_IN` with 3 resume points (`PHONE`, `USER_ROLE`, `DONE`) | ⚠️ PARTIAL — web cannot resume mid-profile (e.g. at `address` or `about`); a user who quits there is classified `DONE` on next login and dropped into `/groups` with an incomplete profile |
| Forward-step gate / URL tampering | N/A (native stack) | `clampToReachableUserStep` watermark (`lib/navigation/userStepGate.ts`) | ✅ EXISTS (web-only hardening) |

### Field-level deltas — Step 2 (Profile)

| Field | Mobile | Web | Status |
| --- | --- | --- | --- |
| Name | **one** input for "First & last name". `PrivacyTermsPersonalInfoScheme` runs `validateName` (rejects emojis + non-name chars via `REGEX_VALIDATE_NAME`/`REGEX_VALIDATE_EMOJIS`) and `haveLastName` (splits on space, requires ≥2 tokens). Messages: "This field is required." / "Please provide a valid name." / "Please include your first and last name." | **two** inputs, `firstName` + `lastName`, each `.trim().min(1).max(60)` | ⚠️ PARTIAL — two fields instead of one is fine, but the **emoji/character-class rejection is entirely absent on web**, and the "Please provide a valid name." message has no counterpart |
| Birth | masked free-text `mm/yyyy`, `maxLength=7`, month clamped 01–12 while typing. `isValidDate` errors: "Please include a valid month and year." and "Age cannot be more than 130 years old." | `MonthYearPicker` (two selects), min year = `currentYear - 120`, max = current year. Messages: "Please select your birth month." / "Please select your birth year." / "Please enter a birth year after {min}." / "Birth year cannot be in the future." | ⚠️ PARTIAL — a picker can't produce an invalid month, so most of mobile's messages are moot, but the **130-year ceiling is now 120** and mobile's exact strings are gone |
| Pronouns | AppSync `listPronouns`, ordered `She/her, He/him, They/them, I rather not disclose`, clearable, placeholder "What are your pronouns?" | `PronounPicker` fetching the same AppSync list | ⚠️ PARTIAL — `ORDER_PRONOUNS_COPY` ordering not applied; `lib/signup/constants.ts:19` also declares a hardcoded `PRONOUN_OPTIONS` array that the picker no longer uses (dead) |
| "Why do we ask this?" birth tooltip | Yes (`InputHint` with title + description) | not present | ❌ MISSING |

### Field-level deltas — Step 3 (Credentials)

| Rule | Mobile message | Web message | Status |
| --- | --- | --- | --- |
| email required | "This field is required." | "Email address is required." | ⚠️ PARTIAL |
| email format | "Please provide a valid email." (Yup `.email()`) | "That doesn't look like a valid email. Try something like name@example.com." (strict RFC-ish regex, `lib/signup/validation.ts:66`) | ⚠️ PARTIAL |
| password ≥ 8 | "Your password must have at least 8 characters, including: • 1 numbers • 1 capital letter… • 1 special character…" | "Password must be at least 8 characters long." | ⚠️ PARTIAL |
| ≥ 1 digit | "Your password must include at least 1 number." | "Add at least one number (0–9) to strengthen your password." | ⚠️ PARTIAL |
| ≥ 1 uppercase | "Your password must include at least 1 capital letter, such as A or B." | "Add at least one uppercase letter (A–Z)…" | ⚠️ PARTIAL |
| ≥ 1 lowercase | folded into the ≥8 rule | "Add at least one lowercase letter (a–z)…" | ✅ EXISTS |
| ≥ 1 special `[!?¿@#$%^&*_]` | "Your password must include at least 1 special character, such as ! or $." | "Add at least one special character (for example !, $, or &), matching the mobile app." | ✅ EXISTS — same character class |
| confirm required | "This field is required." | "Please re-enter your password to confirm it." | ⚠️ PARTIAL |
| confirm must match | "Passwords don't match – check for typos." | "Those passwords don't match. Please retype your password exactly." | ⚠️ PARTIAL |
| password hint under the field | static bullet list | live `PasswordStrengthMeter` — **but it only checks 4 rules** (`checkPassword` in `lib/signup/validation.ts:123` omits the special-character rule that the schema enforces) | ⚠️ PARTIAL — the meter can read "all green" while submit still fails |
| already-registered but **unconfirmed** | `handleExistingUsername` calls `Auth.resendSignUp`, toasts "A new confirmation code was sent to {email}", returns `{Session:null}` so the flow continues to OTP | `RESUME_UNCONFIRMED` → OTP step with `resumeHint` | ✅ EXISTS |
| already-registered and **confirmed** | `ALERT_EMAIL_ALREADY_REGISTERED` = "This email is already registered. Please sign in instead." | "An account with this email already exists. Try signing in instead." | ⚠️ PARTIAL — wording |
| code recently sent (client cooldown) | `ALERT_CODE_RECENTLY_SENT` = "A code was already sent recently. Please check your inbox before requesting a new one." | no equivalent — web's cooldown just disables the button | ❌ MISSING |
| Cognito `LimitExceededException` | `ALERT_TOO_MANY_ATTEMPTS` = "Too many attempts. Please wait a while before requesting another code." | falls through to the generic "Something went wrong. Please try again." | ❌ MISSING |
| existing email + wrong password | not handled (mobile just fails) | `EXISTING_EMAIL_WRONG_PASSWORD` with a dedicated message | ✅ EXISTS (web-only) |

---

## App status (maintenance / forced update)

Mobile wiring: `StatusAppProvider` (`src/context/status-app/status-app.provider.tsx`)
fetches `getStatusAppService()` on network-up and on every app foreground, then
opens an AppSync subscription (`onUpdateMaintenanceStatus`). `Main.tsx:39-69`
reacts to `{type}` plus `useUpdate().version.needsUpdate` and navigates to the
`StatusApp` screen after a 2 s delay.

| Item | Mobile | Web | Status |
| --- | --- | --- | --- |
| Status source | AppSync query + live subscription `GET_STATUS_APP_SUSCRIPCION`; default `{type:'LIVE', reason:''}` | none | ❌ MISSING |
| Re-check on app foreground | `useAppStateEvents(getStatusApp)` | none | ❌ MISSING |
| Re-check on network recovery | `useNetworkStatus()` effect | none | ❌ MISSING |
| `INMAINTENANCE` screen | `MaintenanceLayout` → `ErrorView` with title "We're undergoing maintenance and be right back!", status "Scheduled maintenance", body "We're working to improve this app for you. Sorry the inconvience that may be caused. Please come back in a while!" *(sic)* | none | ❌ MISSING |
| `REQUIRED_UPDATE` screen | `UpdateAvailable` (forced): `ClockClockwise` icon, "Hey buddy, it's time to update!", "To continue using CancerBuddy, you need to update to the most recent version of the app.", single full-width CTA "i understand, update" → `Linking.openURL(storeUrl)` | none | ❌ MISSING (arguably N/A on web — but there is no "reload for a new version" affordance either) |
| `OPCIONAL_UPDATE` screen | Same screen with `optional`: body "There's a newer version of CancerBuddy available. Ready for some new features?", CTA "update" + secondary "Maybe later" → back to `App`/`Auth` | none | ❌ MISSING |
| Optional-update nag throttling | `useUpdate` + `UpdateStorage` counter — the modal only reappears on the 0th and 3rd backgrounding (`useUpdate.tsx:20`) | none | ❌ MISSING |
| Version check against the store | `react-native-check-version` `checkVersion()` → `version.needsUpdate` | none | ❌ MISSING |
| `UpdateModal` "Update assistant" dialog | `COPY_MODAL_UPDATE_AVIABLE` — "New features, better app!" + Update now / MAYBE LATER | none | ❌ MISSING |
| `StatusApp` gesture lock | `options={{gestureEnabled:false}}` so the screen can't be swiped away | none | ❌ MISSING |

Nothing in `app/`, `lib/`, or `components/` references maintenance status,
required update, or optional update — verified by grep across the whole web repo.

---

## Deep links

Mobile registration is `linking.js` at the repo root, wired into
`NavigationContainer`. `prefixes` are `https://cancerbuddy.bonemarrow.org` and
`cancerbuddy://cancerbuddy.bonemarrow.org`; `config.screens` declares exactly
**one** pattern.

| URL pattern | Mobile destination | Params | Web route | Status |
| --- | --- | --- | --- | --- |
| `https://cancerbuddy.bonemarrow.org/buddyId/:buddyId` | `BuddyProfile` → `DeepLinkBuddyProfile` (`src/screens/deeplink/DeepLinkBuddyProfile.tsx`), registered on the root stack in `Main.tsx:84` | `{ buddyId: string }` (parsed to string) | **none** — `app/` has no `buddyId` route segment | ❌ MISSING |
| `cancerbuddy://cancerbuddy.bonemarrow.org/buddyId/:buddyId` | same | same | N/A (custom scheme) | ❌ MISSING (no web fallback page for app-scheme links) |
| *(cold-start variant)* same URL | Queued by `getInitialURL()` into `pendingDeepLinkUrl`, `return null` so RN doesn't make it the initial route; `Main.tsx:23-37` consumes it after `user` exists and navigates 800 ms later so home is mounted behind the modal. De-duped against `lastConsumedUrl` for Android intent persistence. | `{ buddyId }` | none | ❌ MISSING |
| *(background variant)* same URL | `linking.subscribe` forwards straight to the listener; RN navigates immediately | `{ buddyId }` | none | ❌ MISSING |
| *(in-app, not a URL)* QR scan / manual Buddy-ID entry | `QrIdentification` strips `LOCAL_DEEP_LINK`/`UNIVERSAL_DEEP_LINK` prefixes then runs `useValidateRules(buddyId)` | — | `app/(app)/profile/buddy-id/page.tsx` displays the code/QR; `components/buddies/QuickSearchBar.tsx` accepts a Buddy ID | ⚠️ PARTIAL — web can *look up* a buddy ID, but not by URL |

### `DeepLinkBuddyProfile` behaviour (mobile) vs web

| Rule | Mobile | Web | Status |
| --- | --- | --- | --- |
| Not signed in → dismiss | `navigation.goBack()` when `!user` | N/A (no route) | ❌ MISSING |
| `buddyId` → `userId` resolution | `GET_USER_ID_FROM_BUDDY_ID_TOKEN`, paginated with `nextToken` until a hit | `lib/buddies/*` resolve by userId, not buddyId, from a URL | ❌ MISSING |
| Own profile → bounce to Profile tab | `goBack()` then `rootNavigate('Profile')` after 100 ms | — | ❌ MISSING |
| Unknown buddyId → dismiss | `goBack()` | — | ❌ MISSING |
| Renders `UserInfoScreen` with `showButtons`, `closeButtonGoesBack` | Yes, wrapped in `ConnectionMapProvider` + Stream `Chat`/`OverlayProvider` | `app/(app)/buddies/[userId]/page.tsx` is the closest equivalent | ⚠️ PARTIAL — the destination screen exists on web, just not reachable from the shared link |

### The separate `DeepLink` drawer route (mobile)

`src/navigation/deepLink/DeepLinkNavigation.tsx` is registered as
`DrawerScreens.DeepLink`. It is **not** a URL target — it is entered in-app with
a `buddyId` route param and runs `useValidateRules`, which layers on rules the
`BuddyProfile` route does not:

| Rule | Mobile behaviour | Web | Status |
| --- | --- | --- | --- |
| Invalid QR | toast `TOAST_COPY_MESSAGES_SCANNER('invalidQR')` | — | ❌ MISSING |
| Non-existent user | toast `('nonExistUser')` | — | ❌ MISSING |
| Recipient is snoozed | toast `('snoozeAccount')`, abort | — | ❌ MISSING |
| Scanning yourself | toast `('myself')` + navigate to own Profile | — | ❌ MISSING |
| Age-band mismatch (`connectAgeRulesBuddySearching`) | opens profile with `showButtons:false` + an explanatory message | — | ❌ MISSING |
| Already buddies | toast `('alredyBuddies', name)` + `isBuddy: true` | — | ❌ MISSING |
| Invite already sent | opens profile with `showButtons:false` + `('sentInvite', name)` | — | ❌ MISSING |
| Sub-screens: `DeepUserGallery`, `DeepJournalList`, `DeepJournalEntryDetail`, `Profile` | Registered in `DeepLinkScreens.tsx` | `app/(app)/buddies/[userId]/journal/page.tsx` etc. exist under the normal buddies routes | ⚠️ PARTIAL — the screens exist, the deep-link entry point does not |

**Net effect:** `components/profile/BuddyIdScreen.tsx:30` hands users a
`https://cancerbuddy.bonemarrow.org/buddyId/<id>` link to share. On the web app
that URL resolves to `app/not-found.tsx`. On mobile it opens the buddy's
profile. There is no web landing page, no app-store interstitial, and no
`app/[...]` catch-all that recognises the pattern.

---

## Session & auth plumbing

| Concern | Mobile | Web | Status |
| --- | --- | --- | --- |
| Token store | Amplify default (AsyncStorage) + a mirrored `AuthenticatedUser` blob under key `user` (`src/context/auth/storage.ts`) | Amplify default browser storage (localStorage) — deliberately **not** `cookieStorage` (documented cause of HTTP 431) | ✅ EXISTS |
| Bootstrap on launch | `AuthProvider.restoreUser()` — reads stored user, sets it, renders immediately, then refreshes the session in the background | `AuthGuard` (`components/auth/AuthGuard.tsx`) calls `Auth.currentSession()` per protected subtree | ⚠️ PARTIAL — web re-checks per navigation instead of hydrating a user object once; there is no cached "current user" context equivalent to mobile's `AuthContext` |
| Proactive token refresh | `setInterval` every 60 min → `getAccessJwtToken()` → re-store + `setUser` (`auth.provider.tsx:29-38`) | none — relies on Amplify's implicit refresh inside `currentSession()` | ⚠️ PARTIAL |
| Refresh failure → forced sign-out | Yes: `checkSessionStatus` else-branch calls `signOut()` and clears user/unenrolled/email | `hasValidSession()` returns false → `AuthGuard` redirects to `/` | ⚠️ PARTIAL — web redirects but never clears the stale Amplify cache or runs cleanup |
| Unenrolled-user record | `unEnrollmentUser` key in AsyncStorage; drives the 18-screen `unrolledPath` and is removed once `user` is set | Zustand `useUserSignupStore` (in-memory) + login-time resume classification | ⚠️ PARTIAL — web loses all resume state on refresh; only the coarse `RESUME_PHONE`/`RESUME_USER_ROLE` server-side classification survives |
| Sign-out sequence | `signOut()` in `useAuth.ts:263` runs, in order and each wrapped in a 4 s `runSafely` timeout: `logOutAccountLambda(userId)` → `clientInstance.removeDevice(fcmToken)` → delete the `UserDeviceToken` row + GetStream device → clear `user` key → clear `unEnrollmentUser` → `Auth.signOut()` | `lib/auth-client.ts:signOut()` → `Auth.signOut()` only | ❌ MISSING — no logout Lambda, no GetStream `removeDevice`, no FCM/`UserDeviceToken` cleanup, no timeout guard |
| Sign-out ordering rationale (session-dependent calls **before** `Auth.signOut`) | Documented in-code | N/A | ❌ MISSING |
| FCM token registration | `createOrUpdateFCMToken` — de-dupes the token across accounts (deletes it from any other user) then inserts | `lib/push/*` (out of this audit's scope, but no equivalent de-dupe was found in the sign-out path) | ⚠️ PARTIAL |
| GetStream token bootstrap | `LoginInLambdaUtil` → `GETSTREAM_LAMBDA` LOGIN → stores `getStream` in AsyncStorage; also calls `USERS_LAMBDA` LOGIN with the FCM token | Same two lambdas, but only at enrollment finalize (`userEnrollmentFinalize.ts:311,335`); the login path (`cognitoLoginService`) does **not** call either | ❌ MISSING — a returning web user never re-runs the GetStream/Users LOGIN lambdas |
| `pendingSupportChannel` flag | Set to `'true'` in `AllSetNotification` so home creates the support channel after Stream connects | Handled inside `finalizeUserEnrollment` (sets/removes based on bootstrap outcome) | ✅ EXISTS |
| Server-side route protection | N/A | `proxy.ts` — `PROTECTED_PREFIXES` is deliberately **empty** and `getSessionFromCookie` always returns `false`; all gating is client-side | ⚠️ PARTIAL — documented tradeoff, but it means protected pages are only guarded by JS |
| `lib/auth.ts` / `app/actions/auth.ts` | N/A | Both are **stubs**: `getSession()` returns `null`, `createSession()` is empty, `loginAction` calls `createSession("stub-user-id")` then `redirect("/dashboard")` | ⚠️ PARTIAL — dead scaffolding that shadows the real Cognito path; `loginAction` is not referenced by the login page but would "succeed" for anyone who wired it up |
| Session expiry UX | Silent sign-out + return to Auth stack | Silent redirect to `/` | ✅ EXISTS |

---

## Cross-screen gaps

Ranked by how much they'd hurt a real user.

1. ❌ **Caregivers skip Diagnosis + Medical Center on web.** `app/register/page.tsx:916`
   (`handleCGPatientAgeContinue → goToStep("address")`). Fix: route
   `cgPatientAge → diagnosis`, teach `StepDiagnosis` a `CAREGIVER` variant
   (heading "Any health info you can share, {name}?", no `inRemissionSince`),
   and update `USER_REGISTER_BACK_FALLBACK` so `address` back-resolves through
   `medicalCenter` for caregivers too (it currently special-cases to
   `cgPatientAge`, `page.tsx:516-524`).
2. ❌ **No password reset at all**, and the login page's "Forgot password?" link
   points at a non-existent `/forgot-password`. Three mobile screens plus
   `Auth.forgotPassword` / `Auth.forgotPasswordSubmit` are unimplemented.
3. ❌ **No `/buddyId/:buddyId` route**, while the web app itself hands users
   that link to share (`components/profile/BuddyIdScreen.tsx:30`). Every shared
   Buddy-ID link opens a 404 in a desktop browser.
4. ❌ **No app-status subsystem.** No maintenance page, no way to tell users the
   backend is down, no "a new version is available, reload" affordance.
5. ❌ **Sign-out does almost nothing.** Mobile deregisters the FCM token from
   both AppSync and GetStream and calls a logout Lambda; web only calls
   `Auth.signOut()`. Signed-out web users will keep receiving push.
6. ❌ **Returning web users never re-run the GetStream/Users LOGIN lambdas.**
   Mobile does this on every `logIn()`; web only does it once, at enrollment
   finalize.
7. ⚠️ **Progress bar lies for 15 of 21 steps.** `USER_REGISTER_STEPS` still lists
   only the Phase-1 six, so everything from `userRole` onward shows step 1 of 6.
8. ⚠️ **Resend cooldowns are 30 s on web vs 60 s on mobile** for all three OTPs
   (email, phone, guardian) — `OTP_RESEND_COOLDOWN_SEC` vs `RESEND_COOLDOWN_MS`.
   Cognito's own rate limit will start rejecting.
9. ⚠️ **Name validation lost.** Mobile rejects emojis and non-name characters
   and requires two tokens; web only checks length 1–60 per field.
10. ⚠️ **Password strength meter disagrees with the schema** — `checkPassword`
    omits the special-character rule the schema enforces, so the meter can show
    all-green on a password that will be rejected.
11. ⚠️ **Curated picklist orderings dropped.** `ORDER_PRONOUNS_COPY`,
    `ORDER_RELATIONSHIPS_COPY`, `ORDER_LANGUAGES_COPY`,
    `ORDER_COPING_WITH_LOSS_COPY` are all replaced by plain alphabetical sorts.
    English/Spanish no longer lead the language list.
12. ⚠️ **Required-ness relaxed on three steps.** `cgPatientAge` (mobile requires
    a full mm/yyyy), `photos` (mobile requires ≥1), `profilePic` (mobile requires
    a photo before Continue) are all freely skippable on web.
13. ⚠️ **Two mobile screens have no web counterpart at all:**
    `PrivacyTermsUnderAgeDetected` (the "you're a minor" explainer) and the
    `EmailVerification` "Pick up where you left off / Create new account"
    bottom-sheet.
14. ⚠️ **`AccountSetupVerifiedSuccessfully` doesn't echo the phone number**,
    which is the screen's whole purpose on mobile.
15. ⚠️ **Resume granularity.** Web can only resume at `phone`, `userRole`, or
    `done`. Quit at `about` and the next login classifies you `DONE` and drops
    you into `/groups` with no bio, interests, languages, or photos.
16. ⚠️ **`docs/signup-flow-plan.md` is stale and misleading.** It describes a
    4-step `/signup` flow at `app/(auth)/signup/` with a mock service and
    localStorage draft persistence. None of that is true any more — the flow is
    21 steps at `/register`, backed by `lib/user-signup/cognitoUserSignupService.ts`,
    with in-memory-only drafts. It also wrongly claims the login page has
    Google + Apple stubs. Recommend rewriting or deleting it.
17. ⚠️ **`lib/auth.ts` and `app/actions/auth.ts` are unused stubs** that would
    create a fake session (`createSession("stub-user-id")`) if anyone wired
    `loginAction` to a form. Worth deleting.
18. ⚠️ **`lib/signup/constants.ts` exports `CHILD_MIN_AGE` /
    `GUARDIAN_MAX_BIRTH_YEAR` / `PRONOUN_OPTIONS` / `PRONOUN_LABELS` that nothing
    reads.** In particular there is no minimum-age floor: a birth year implying
    age 3 passes `profileSchemaForUser` and enters the guardian flow.
19. ⚠️ **`finalizeUserEnrollment` strips falsy values** before `UPDATE_USER`
    (`userEnrollmentFinalize.ts:246`), so `cancerloss: false` and
    `CurrentlyInCollege: false` are never written. Mobile writes them explicitly.
20. ⚠️ **`bmcf_enrollment` analytics event not emitted** on web finalize.
21. ⚠️ **Post-login analytics flags not set.** Mobile writes 5 keys to `'true'`
    on every successful login (`Login.tsx:41-57`); web never does.
22. ⚠️ **No unenrolled-user toast on web login.** Mobile explains "Please
    complete your profile to finish your enrollment/registration."; web silently
    redirects into `/register?step=…`.
23. ⚠️ **Cognito rate-limit and recent-code messages missing.**
    `ALERT_TOO_MANY_ATTEMPTS` and `ALERT_CODE_RECENTLY_SENT` have no web
    equivalent — both collapse into "Something went wrong."
24. ⚠️ **`updateCopy` (alternate title/description) not ported**, so the profile-
    picture screen never swaps to "Nice choice! To confirm your profile picture,
    tap continue."
25. ⚠️ **Server-side route protection is off** (`proxy.ts` `PROTECTED_PREFIXES`
    is empty by design). Documented, but worth re-reading against
    `docs/SECURITY.md` Phase B/C before launch.
26. ⚠️ **Support-org mutation name differs** — web uses `createSupportOrgUser`
    (`userEnrollmentFinalize.ts:63`), mobile uses `CREATE_SUPPORT_ORGANIZATIONS_USER`.
    Worth confirming both resolve to the same AppSync resolver.
