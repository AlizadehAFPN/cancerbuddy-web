# Signup Flow + Support — Working Spec (cancerbuddy-web)

> Resume document for the multi-session build of the web signup flow + support
> feature. Read this top-to-bottom on a fresh session and you'll have full
> context without re-auditing the codebase.

## Scope

A 4-step signup flow on cancerbuddy-web mirroring the mobile app's pre-auth
journey but visually re-architected for web:

1. **Privacy Policy** (accept gate)
2. **Profile** — first name, last name (optional), age, pronouns
3. **Credentials** — email, password, confirm password
4. **OTP** — 6-digit email confirmation

Plus a **Support** feature (form + categories + screenshot attachment) at
`/support`.

**Backend is intentionally out of scope.** The service layer exposes
Promise-returning async functions whose shapes match what an Amplify-style
signup wrapper would return, so swapping the mock for a real backend is a
single-file change.

## Top-line decisions

- **Stack alignment**: matches the existing cancerbuddy-web stack — Next.js 16
  App Router, TypeScript strict, Tailwind v4 (inline `@theme` in
  `app/globals.css`), `react-hook-form` + `@hookform/resolvers/zod` + `zod`,
  no framer-motion (animations via the existing `hero-fade-up` /
  `hero-fade-in` keyframes), no i18n (English-only).
- **Path alias**: `@/*` → project root (e.g. `@/lib/signup`,
  `@/components/auth`, `@/components/ui`).
- **Routes**: `/signup` lives in the `(auth)` route group at
  `app/(auth)/signup/page.tsx`; `/support` is top-level at
  `app/support/page.tsx`. Both reuse the two-panel layout from
  `app/(auth)/login/page.tsx` (left = yellow brand panel; right = white form
  panel).
- **State**: a single `react-hook-form` form holds all step values;
  `useState` tracks the current step + submitting / resending / serverError.
  Per-step validation uses dedicated Zod schemas (see
  `lib/signup/validation.ts`).
- **Draft persistence**: `lib/signup/storage.ts` saves a stripped subset of
  the form to `localStorage` (key: `cancerbuddy-signup-draft`). Passwords +
  OTP are never persisted. To swap to a server-side draft endpoint later,
  replace just `storage.ts` with the same exports.
- **Pronouns**: `she/her`, `he/him`, `they/them`, `she/they`, `he/they`,
  `Prefer not to say`, `Custom` (free text up to 24 chars).
- **Min age**: 13 (constant `MIN_AGE` in `lib/signup/constants.ts`).
- **Password rules**: ≥ 8 chars, ≥ 1 uppercase, ≥ 1 lowercase, ≥ 1 number.
- **OTP**: 6 cells, paste-aware, auto-advance, 30 s resend cooldown. Auto-
  submits 300 ms after the 6th digit lands.
- **Mock service test inputs** (in `lib/signup/mockService.ts`):
  - email `exists@example.com` → `ALREADY_EXISTS / email`
  - email `google@example.com` → `ALREADY_EXISTS / google`
  - email `apple@example.com` → `ALREADY_EXISTS / apple`
  - OTP `000000` → `CODE_MISMATCH`
  - OTP `111111` → `CODE_EXPIRED`
  - any other 6-digit code → `CONFIRMED`

## File tree

```
app/
  (auth)/
    signup/
      page.tsx                      // controller (state machine + RHF + service)
      _components/
        SignupShell.tsx             // 2-panel layout + progress strip
        StepPrivacy.tsx
        StepProfile.tsx
        StepCredentials.tsx
        StepOtp.tsx
  support/
    layout.tsx                      // metadata + noindex
    page.tsx                        // support page chrome (mirrors signup shell)
    _components/
      SupportForm.tsx               // RHF + Zod + mock service

components/
  auth/
    OtpInput.tsx                    // 6-cell paste-aware input
    PasswordStrengthMeter.tsx       // 4-rule live meter
    PronounPicker.tsx               // pill picker + custom input
    index.ts                        // barrel
  ui/
    Button.tsx                      // EXISTING — reused
    Input.tsx                       // EXISTING — reused
    index.ts

lib/
  signup/
    constants.ts                    // PRONOUN_OPTIONS, MIN_AGE, OTP_LENGTH, ...
    types.ts                        // service contract types
    validation.ts                   // Zod per-step schemas + STEP_FIELDS
    storage.ts                      // localStorage draft adapter (BE swap)
    service.ts                      // SignupService interface + defaultSignupService
    mockService.ts                  // deterministic mock impl
    index.ts
  support/
    types.ts                        // SUPPORT_CATEGORIES, sizes, attachment shape
    validation.ts                   // Zod schema + validateAttachment()
    service.ts                      // SupportService interface
    mockService.ts                  // mock impl returning CB-XXXX-XXXX ticket id
    index.ts

docs/
  signup-flow-plan.md               // this file
```

## Service contract (BE swap target)

```ts
// lib/signup/service.ts
export interface SignupService {
  startSignup(input: StartSignupInput): Promise<StartSignupResult>;
  confirmSignup(input: ConfirmSignupInput): Promise<ConfirmSignupResult>;
  resendCode(input: { email: string }): Promise<{ ok: true }>;
}

interface StartSignupInput {
  email: string;
  password: string;
  profile: { firstName: string; lastName: string; age: number; pronouns: string };
  acceptedPrivacyAt: string;        // ISO timestamp
}

type StartSignupResult =
  | { status: "OTP_SENT"; nextStep: "CONFIRM_SIGN_UP" }
  | { status: "ALREADY_EXISTS"; provider: "email" | "google" | "apple" };

type ConfirmSignupResult =
  | { status: "CONFIRMED" }
  | { status: "CODE_MISMATCH" }
  | { status: "CODE_EXPIRED" };
```

When the real backend lands, write `realService.ts` next to `mockService.ts`,
implement the same `SignupService` interface, and change the single export in
`service.ts`:

```ts
- export const defaultSignupService: SignupService = mockSignupService;
+ export const defaultSignupService: SignupService = realSignupService;
```

No other file needs to change.

## Validation rules

| Field           | Rule                                              | Message                                                  |
| --------------- | ------------------------------------------------- | -------------------------------------------------------- |
| `firstName`     | trim ≥ 1, ≤ 60                                    | "Please enter your first name."                          |
| `lastName`      | optional, ≤ 60                                    | —                                                        |
| `age`           | integer, 13 – 120                                 | "You must be at least 13 to sign up."                    |
| `pronouns`      | one of options                                    | "Please choose pronouns or write your own."              |
| `customPronouns`| required when `pronouns === "custom"`, ≤ 24       | "Tell us how to refer to you."                           |
| `email`         | RFC-lite                                          | "Please enter a valid email."                            |
| `password`      | ≥ 8, upper, lower, digit                          | per-rule message                                         |
| `confirmPassword` | equals `password`                               | "Passwords don't match."                                 |
| `otp`           | exactly 6 digits                                  | "Enter the 6-digit code."                                |

Step-level Zod schemas in `lib/signup/validation.ts`:
`privacySchema`, `profileSchema`, `credentialsSchema`, `otpSchema`.

The controller (`app/(auth)/signup/page.tsx`) calls each schema's `safeParse`
on the active step before advancing — when a check fails, it pipes issues into
react-hook-form via `setError(field, ...)` so messages render under the right
`<Input>`.

## Step-by-step UI spec

### 1. Privacy
- Yellow shield icon, "Before we begin" headline, soft-toned bullet list of
  privacy guarantees.
- Big checkbox-styled accept tile.
- Continue button reads "Yes, let's start" — that's the splash-style YES that
  initiates the journey.

### 2. Profile
- Two-column name fields on `sm+`, single column on mobile.
- Age input enforces digits only via a tiny live filter.
- Pronouns pill picker; selecting "Custom" reveals a 24-char text field.

### 3. Credentials
- Email + password + confirm. Password and confirm use the existing `Input`
  component which has a built-in show/hide eye.
- Live `PasswordStrengthMeter` below the password field.
- "Already a member? Sign in" link in the shell header.

### 4. OTP
- Mask the email when displaying it (`j••n@example.com`).
- 6 boxed inputs, paste fills all of them, backspace navigates back.
- Auto-submits 300 ms after the 6th digit.
- Resend link with 30 s countdown.
- "Change email" link returns to Credentials with the email pre-filled.
- Success state: green check, "You're all set", CTA "Go to sign in".

## Support feature spec

`/support` — single-page form at the same chrome as signup.
- Fields: subject (1–80), category (segmented: Account & sign-in, Billing,
  Content concern, Bug report, Feature request, Other), message (10–2000 with
  live counter), reply email, optional image attachment (≤ 4 MB).
- Submit calls `defaultSupportService.submitTicket(...)`. Mock returns a
  `CB-XXXX-XXXX` ticket id.
- Success state shows the ticket id with a Copy button + "Send another" /
  "Back to home" CTAs.

## Implementation status

- [x] Resume document
- [x] Lib: `lib/signup` (constants, types, validation, storage, service, mockService)
- [x] Lib: `lib/support` (types, validation, service, mockService)
- [x] Auth primitives: `components/auth/{OtpInput,PasswordStrengthMeter,PronounPicker}`
- [x] Signup shell + 4 step components
- [x] Signup controller (`app/(auth)/signup/page.tsx`)
- [x] Support page + form
- [x] Type-check clean
- [ ] **Real backend wiring** — replace `mockSignupService` and `mockSupportService` with their real-API counterparts when the BE is ready
- [ ] **Privacy / Terms long-form** — `/privacy` and `/terms` aren't built yet; signup links to `/privacy` as a placeholder anchor

## Decisions deliberately deferred

- **OAuth on signup** — only email-password is in scope. The /login page has Google + Apple stubs; signup currently doesn't.
- **Phone signup** — out of scope; the mobile app uses it, but web signup is email-only per request.
- **Profile completion on social signup** — when OAuth lands, decide whether to route social users through Profile + Pronouns post-OAuth or skip it.
- **Server-side draft persistence** — localStorage adapter only; BE swap path documented in `lib/signup/storage.ts`.

## How to resume on a fresh session

1. Read this file end-to-end (~3 min).
2. Read `lib/signup/types.ts` and `lib/signup/service.ts` to refresh the contract.
3. Pick the next unchecked item in **Implementation status**.
4. If you need cross-cutting changes (new shared primitive, new schema), update the **Architecture / File tree** section above before writing code so the plan stays the source of truth.

## Note about provenance

This feature was originally built in a different project (landstories-web) by
mistake, then ported here. The code here is a re-implementation that matches
cancerbuddy-web's stack — light theme, `cb-*` palette, no i18n, react-hook-
form + zod, existing `Button`/`Input` primitives. The architectural decisions
(state machine, BE-friendly service layer, draft persistence pattern) survived
the port.
