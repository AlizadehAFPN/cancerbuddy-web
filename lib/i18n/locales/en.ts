/**
 * English string catalog — single source of truth for every user-facing
 * string in the webapp. Imported only through `lib/i18n` (`t(...)`); do not
 * import this file directly from components.
 *
 * Conventions:
 *  • Group keys by feature, then by sub-surface (page → section → key).
 *  • Use `{name}` placeholders for runtime values; pass them as the second
 *    arg to `t(...)`. Numbers are stringified automatically.
 *  • Keep one string per concept — if two surfaces happen to share copy
 *    today but might diverge tomorrow, prefer two keys.
 *  • Whitespace, punctuation, and curly quotes are preserved verbatim from
 *    the original UI so this migration is a pure refactor.
 *
 * Long-form legal content lives in `lib/legal/content.ts` (structured data
 * already designed as an i18n source) and is re-exported by `lib/i18n`.
 */

const en = {
  /* ── Cross-cutting, app-wide strings ───────────────────────────────── */
  common: {
    appName: "CancerBuddy",
    bmcfName: "Bone Marrow & Cancer Foundation",
    bmcfNameAmp: "Bone Marrow & Cancer Foundation",
    poweredBy: "Powered by",
    copyright: "© {year} CancerBuddy",
    back: "Back",
    backHome: "Back home",
    backToHome: "Back to home",
    backToCancerBuddyHome: "Back to CancerBuddy home",
    cancerBuddyHome: "CancerBuddy home",
    cancerBuddyAlt: "CancerBuddy",
    cancerBuddyCommunityAlt: "CancerBuddy community",
    cancerBuddyCommunityIllustratedAlt: "CancerBuddy community — illustrated",
    becomeAHostAlt: "Become a CancerBuddy host",
    bmcfLogoAlt: "Bone Marrow Cancer Foundation",
    continue: "Continue",
    cancel: "Cancel",
    apply: "Apply",
    signIn: "Sign in",
    getStarted: "Get started",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    support: "Support",
    /** Three-tab footer shorthand (legal pages) */
    privacy: "Privacy",
    terms: "Terms",
    childSafety: "Child Safety",
    needHelp: "Need help?",
    supportEmail: "cancerbuddy@bonemarrow.org",
    openMenu: "Open menu",
    mainNavigation: "Main navigation",
  },

  /* ── Page metadata (titles + descriptions consumed by Next) ─────────── */
  metadata: {
    rootDefaultTitle: "CancerBuddy",
    rootTitleTemplate: "%s | CancerBuddy",
    rootDescription:
      "Connect with others on your cancer journey. Peer support for patients, caregivers, and survivors.",
    landingTitle: "CancerBuddy — Peer Support for Your Cancer Journey",
    landingDescription:
      "CancerBuddy connects cancer patients, caregivers, and survivors with real people who truly understand — for conversations, shared experiences, and genuine peer support.",
    dashboardTitle: "Dashboard",
    privacyTitle: "Privacy Policy",
    privacyDescription:
      "How CancerBuddy™ collects, uses, and protects your information. Source-of-truth content from the Bone Marrow & Cancer Foundation.",
    termsTitle: "Terms of Use",
    termsDescription:
      "The agreement between you and the Bone Marrow & Cancer Foundation that governs your use of the CancerBuddy™ app.",
    childSafetyTitle: "Child Safety Standards",
    childSafetyDescription:
      "Our commitment to children's safety and wellbeing — COPPA compliance, content age-appropriateness, and CSAM/CSAE policies.",
    hostsRegisterTitle: "Register as a Host",
    hostsRegisterDescription:
      "Apply to become a CancerBuddy host. Guide newcomers, share what you've learned, and offer real peer support to people navigating a cancer journey.",
    supportTitle: "Support",
    supportDescription: "Tell us what's going on and we'll get back to you.",
    notFoundTitle: "Page not found",
  },

  /* ── 404 ──────────────────────────────────────────────────────────── */
  notFound: {
    headline: "We couldn't find that page.",
    goHome: "Go home",
  },

  /* ── Landing page (/) ─────────────────────────────────────────────── */
  landing: {
    heroHeading: "You are not alone on this journey.",
    heroBody:
      "CancerBuddy connects patients, caregivers, and survivors for real conversations and genuine peer support — from people who truly understand.",
    ctaPrimary: "Get started — it's free",
    ctaSecondary: "Sign in",
    supportedBy: "Proudly supported by",
    hostInviteLead: "Want to support others?",
    hostInviteCta: "Register as a host →",
  },

  /* ── Login (/login) ───────────────────────────────────────────────── */
  login: {
    tagline: "Your support community\nawaits.",
    noAccount: "No account?",
    noAccountCta: "Get started",
    heading: "Welcome back",
    sub: "Sign in to your CancerBuddy account",
    emailLabel: "Email address",
    emailPlaceholder: "you@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Your password",
    forgotPassword: "Forgot password?",
    or: "or",
    submit: "Sign in",
    bottomCta: "Don't have an account?",
    bottomCtaLink: "Create a free account →",
    invalidCredentials: "Invalid email or password. Please try again.",
  },

  /* ── Signup (/signup) ─────────────────────────────────────────────── */
  signup: {
    tagline: "Your support community\nawaits.",
    alreadyMember: "Already a member?",
    /** Live progress indicator. */
    stepOfTotal: "Step {current} of {total}.",
    stepTitles: {
      privacy: "Before we begin",
      profile: "Tell us a little about you",
      credentials: "Set up sign-in",
      otp: "Confirm your email",
    },
    privacy: {
      eyebrow: "Policies",
      heading: "Before we begin",
      body: "Review each document, then confirm below to continue your account setup.",
      view: "View",
      accept: "I have read and accept.",
      continue: "Continue",
    },
    profile: {
      heading: "Tell us a little about you",
      sub: "Just enough to personalise your experience.",
      firstNameLabel: "First name",
      firstNamePlaceholder: "Your first name",
      lastNameLabel: "Last name",
      lastNamePlaceholder: "Your last name",
      dateOfBirthLabel: "Date of birth",
      bornHint: "Born {month} {year}",
      pronounsHint: "Pronouns are optional — you can always update this later.",
      continueDisabledTitle:
        "Please fill in your name, last name, and date of birth.",
    },
    credentials: {
      heading: "Set up sign-in",
      sub: "Your email and password keep your account secure.",
      emailLabel: "Email address",
      emailPlaceholder: "name@example.com",
      emailHint: "We'll send a confirmation code here.",
      passwordLabel: "Password",
      passwordPlaceholder: "Create a strong password",
      confirmPasswordLabel: "Confirm password",
      confirmPasswordPlaceholder: "Re-enter your password",
      continueDisabledTitle:
        "Please fill in your email and both password fields.",
    },
    otp: {
      heading: "Confirm your email",
      sub: "We sent a {length}-digit code to {email}.",
      changeEmail: "← Change email",
      resendIn: "Resend in {seconds}s",
      resendCode: "Resend code",
      submit: "Verify",
      submitting: "Verifying…",
      doneHeading: "You're all set",
      doneSub: "Your account is ready. Sign in to start connecting.",
      doneCta: "Go to sign in",
    },
    serverError: {
      somethingWrong: "Something went wrong. Please try again.",
      couldntResend: "Couldn't resend right now. Please try again in a moment.",
      codeMismatch: "That code didn't match. Please try again.",
      codeExpired: "That code expired. Please request a new one.",
      alreadyExistsGoogle:
        "An account with this email already exists. Please sign in with Google.",
      alreadyExistsApple:
        "An account with this email already exists. Please sign in with Apple.",
      alreadyExistsDefault:
        "An account with this email already exists. Try signing in instead.",
    },
  },

  /* ── Hosts register (/hosts-register) ─────────────────────────────── */
  hostsRegister: {
    alreadyMember: "Already a member?",
    leftPanel: {
      eyebrow: "Host Application",
      tagline: "Lead with empathy.\nHelp someone feel less alone.",
    },
    stepTitles: {
      privacy: "Before we begin",
      profile: "Tell us about you",
      credentials: "Set up sign-in",
      emailOtp: "Confirm your email",
      phone: "Verify your phone",
      photo: "Add a photo",
      bio: "Share your story",
    },
    intro: {
      eyebrow: "Host Application",
      heading: "Register as host",
      body: "Hosts are the heart of CancerBuddy. Guide newcomers, share what you've learned, and offer real, human support.",
      timeNote:
        "Takes about 4 minutes · you can save progress and finish later.",
      version: "v2.1",
      highlights: {
        empathyTitle: "Show up for someone",
        empathyBody:
          "Be the trusted voice patients reach for when nobody else gets it.",
        scheduleTitle: "On your schedule",
        scheduleBody:
          "Set your availability and the topics you're comfortable supporting.",
        verifiedTitle: "Verified & supported",
        verifiedBody:
          "Phone verification keeps the community safe; we provide training.",
      },
      startCta: "Start Application",
    },
    privacy: {
      eyebrow: "Policies",
      heading: "Before we begin",
      body: "Hosts hold a position of trust. Review each document, then confirm to continue.",
      view: "View",
      acceptAll: "I have read and accept all three policies above.",
    },
    profile: {
      heading: "Tell us about you",
      sub: "Buddies see your first name and pronouns on your host profile.",
      firstNameLabel: "First name",
      firstNamePlaceholder: "Your first name",
      lastNameLabel: "Last name",
      lastNamePlaceholder: "Your last name",
      dateOfBirthLabel: "Date of birth",
      bornHint: "Born {month} {year}",
      pronounsHint:
        "Pronouns are optional — update any time from your profile.",
      continueDisabledTitle:
        "Please fill in your name, last name, and date of birth.",
    },
    credentials: {
      heading: "Set up sign-in",
      sub: "Your email and password keep your host account secure.",
      emailLabel: "Email address",
      emailPlaceholder: "name@example.com",
      emailHint: "We'll send a confirmation code here.",
      passwordLabel: "Password",
      passwordPlaceholder: "Create a strong password",
      confirmPasswordLabel: "Confirm password",
      confirmPasswordPlaceholder: "Re-enter your password",
    },
    emailOtp: {
      heading: "Confirm your email",
      sub: "We sent a {length}-digit code to {email}.",
      resumeHint:
        "You already started registration with this email. Enter the verification code we sent you, or tap Resend code.",
      changeEmail: "← Change email",
      resendIn: "Resend in {seconds}s",
      resendCode: "Resend code",
      submit: "Verify email",
      submitting: "Verifying…",
    },
    phone: {
      heading: "Verify your phone",
      sub: "We'll text you a one-time code. Your number stays private to your host profile.",
      phoneInputLabel: "Mobile phone number",
      codePromptLead: "Enter the {length}-digit code sent to",
      sendCode: "Send code",
      resend: "Resend",
      resendIn: "Resend in {seconds}s",
      verify: "Verify & continue",
      verifying: "Verifying…",
    },
    photo: {
      heading: "Add a photo",
      sub: "A clear, friendly photo of yourself helps buddies feel comfortable reaching out.",
      continueDisabledTitle: "Choose a photo to continue.",
    },
    bio: {
      heading: "Share your story",
      sub: "Optional — a short personal statement helps us match you with the right buddies.",
      label: "Your story",
      placeholder:
        "Tell us a little about you — your background, why you'd like to host, and what kind of support you can offer.",
      counter: "{length} / {max}",
      apply: "Apply",
      submitting: "Submitting…",
      tooLongTitle: "Please shorten your story below the limit.",
    },
    done: {
      heading: "Welcome — you're registered as a Host",
      bodyAssignment:
        "Your host profile is created. Our support team will assign you as a host to a group and after that, you can work as host in the group.",
      bodySignInLead: "You can now sign in to the",
      bodySignInBold: "CancerBuddy mobile app as a Host",
      bodySignInTrail: "with the same email and password you used here.",
      buddyIdLabel: "Buddy ID",
      buddyIdMissingLead:
        "We couldn't load your Buddy ID in the browser. Open the",
      buddyIdMissingBold: "Profile",
      buddyIdMissingTrail:
        ", and you'll see your Buddy ID there (same account as here).",
      buddyIdMissingMid: "CancerBuddy app, go to",
      copy: "Copy",
      copied: "Copied",
      copyAriaLabel: "Copy Buddy ID",
      needHelpLead: "Need help? Reach us at",
      hostsEmail: "hosts@cancerbuddy.com",
      goToSignIn: "Go to sign in",
      backToHome: "Back to home",
    },
    serverError: {
      somethingWrong: "Something went wrong. Please try again.",
      couldntResend: "Couldn't resend right now. Please try again in a moment.",
      codeMismatch: "That code didn't match. Please try again.",
      codeExpired: "That code expired. Please request a new one.",
      alreadyExistsGoogle:
        "An account with this email already exists. Please sign in with Google.",
      alreadyExistsApple:
        "An account with this email already exists. Please sign in with Apple.",
      alreadyExistsDefault:
        "An account with this email already exists. Try signing in instead.",
      existingEmailWrongPassword:
        "An account with this email already exists, but that password does not match. Enter the password you used when you started registration, or use Forgot password when it is available.",
      missingPasswordAfterRefresh:
        "Your password is missing (for example after a refresh). Go back to the previous step, re-enter your password, then continue.",
      profileFieldErrors:
        "Please fill out all required profile fields correctly.",
      credentialFieldErrors: "Please fix the errors in your credentials.",
      phoneInvalid: "Please choose a country and enter a valid number.",
      phoneAlreadyInUse:
        "This phone number is already linked to another account. Please use a different number.",
      phoneCheckAndRetry:
        "That number doesn't look right. Please check and try again.",
      phoneBecameInvalid: "Phone number became invalid. Please re-enter it.",
      photoMissingForApply:
        "Please go back and choose a photo before applying.",
      applyFailed: "Couldn't submit your application. Please try again.",
    },
  },

  /* ── Support (/support) ───────────────────────────────────────────── */
  support: {
    leftHeading: "We're here to help.",
    leftBody:
      "Real questions, real answers. Tell us what's happening and a person on our team will get back to you by email — usually within a day.",
    heading: "How can we help?",
    sub: "Tell us what's going on and we'll get back to you.",
    form: {
      subjectLabel: "Subject",
      subjectPlaceholder: "Briefly describe your issue",
      categoryLabel: "Category",
      messageLabel: "Message",
      messagePlaceholder:
        "Share what happened, what you expected, and anything else we should know.",
      messageCounter: "{length} / {max}",
      emailLabel: "Reply email",
      emailPlaceholder: "you@example.com",
      attachLabel: "Attach a screenshot",
      attachHint: "Optional · single image · up to 4 MB",
      chooseImage: "Choose an image",
      attachFormats: "PNG, JPG, GIF",
      removeAttachment: "Remove attachment",
      attachmentSizeKb: "{kb} KB",
      submit: "Send message",
      submitting: "Sending…",
      couldntRead: "Couldn't read that file. Please try a different one.",
      couldntSend: "Couldn't send. Please try again.",
    },
    success: {
      heading: "Message sent",
      sub: "Thanks — we'll get back to you by email shortly.",
      ticketIdLabel: "Ticket ID",
      copyId: "Copy ID",
      copied: "Copied!",
      sendAnother: "Send another",
      backHome: "Back to home",
    },
    categories: {
      account: "Account & sign-in",
      billing: "Billing",
      content: "Content concern",
      bug: "Bug report",
      feature: "Feature request",
      other: "Other",
    },
  },

  /* ── Legal pages (/privacy, /terms, /child-safety) ────────────────── */
  legal: {
    eyebrow: "Legal · BMCF CancerBuddy™",
    bmcfNote:
      "This app is created by the Bone Marrow & Cancer Foundation (BMCF). The Bone Marrow & Cancer Foundation supports patients, their families and caregivers every step of the way during a cancer diagnosis. No one should ever feel alone.",
    continueReading: "Continue reading",
    read: "Read",
    backButtonAria: "Go back to previous page",
  },

  /* ── Dashboard placeholder ────────────────────────────────────────── */
  dashboard: {
    heading: "Dashboard",
    body: "You're logged in. This screen is coming in the next step.",
  },

  /* ── Pronouns (single-select labels) ──────────────────────────────── */
  pronouns: {
    label: "Pronouns",
    optional: "Optional",
    choose: "Choose…",
    he_him: "He/him",
    she_her: "She/her",
    they_them: "They/them",
    not_say: "I'd rather not disclose",
  },

  /* ── Reusable form labels/messages shared across components ────────── */
  forms: {
    /** Password strength meter. */
    strongPassword: "Strong password — nice.",
    passwordRules: {
      minLength: "At least 8 characters",
      uppercase: "One uppercase letter",
      lowercase: "One lowercase letter",
      number: "One number",
    },
    /** Password visibility toggle in Input.tsx. */
    showPassword: "Show password",
    hidePassword: "Hide password",
    /** Generic spinner aria-label on Button. */
    loading: "Loading",
    /** OTP input. */
    otpGroupLabel: "One-time code",
    otpDigitLabel: "Digit {index}",
    /** MonthYearPicker. */
    monthYearPlaceholder: "MM / YYYY",
    monthYearAria: "Select birth month and year",
    monthYearDialogAria: "Select birth month and year",
    goToYearLabel: "Go to year",
    goToYearPlaceholder: "{min}–{max}",
    go: "Go",
    yearInvalidRange: "Enter a year between {min} and {max}.",
    yearOutOfRange: "Year must be between {min} and {max}.",
    yearHint: "Type a full year (e.g. 1950) and press Enter or Go.",
    monthYearFooter:
      "Scroll the list or use Go to year, then tap your birth month.",
    monthsHeader: "Month",
    yearHeader: "Year",
    monthsGridAria: "Months",
    monthLabelWithYear: "{month} {year}",
    monthNamesShort: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    monthNamesLong: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    /** PhoneInput. */
    countryAria: "Country: {name} ({dial})",
    chooseCountry: "Choose a country",
    chooseCountryDialog: "Choose country",
    countrySearchPlaceholder: "Search country or code",
    countryNoMatches: "No matches. Try a country name or dial code.",
    mobileNumberPlaceholder: "Mobile number",
    /** PhotoPicker. */
    dropToUpload: "Drop to upload",
    choosePhoto: "Choose a photo",
    photoPickerHint: "Drag & drop or click — JPG/PNG/WebP, max {max} MB",
    selectedPhotoAlt: "Selected photo preview",
    replace: "Replace",
    remove: "Remove",
    /** PhotoCropper. */
    cropperHeading: "Position your photo",
    cropperSub: "The circle is how your avatar will appear.",
    cropperDialogAria: "Crop your photo",
    cropperClose: "Close",
    cropperZoomOut: "Zoom out",
    cropperZoomIn: "Zoom in",
    cropperZoom: "Zoom",
    cropperCancel: "Cancel",
    cropperApply: "Apply",
  },

  /* ── Validation messages (Zod) ────────────────────────────────────── */
  validation: {
    privacy: {
      mustAccept: "Please accept all three policies to continue.",
    },
    profile: {
      firstNameRequired: "First name is required — please enter it.",
      firstNameTooLong:
        "That name is a bit long. Please keep it under 60 characters.",
      lastNameRequired: "Last name is required — please enter it.",
      lastNameTooLong:
        "That name is a bit long. Please keep it under 60 characters.",
      birthMonthRequired: "Please select your birth month.",
      birthMonthInvalid: "Please select a valid month.",
      birthYearRequired: "Please select your birth year.",
      birthYearTooEarly: "Please enter a birth year after {min}.",
      birthYearTooLate: "You must be at least {minAge} years old to sign up.",
    },
    credentials: {
      emailRequired: "Email address is required.",
      emailInvalid:
        "That doesn't look like a valid email. Try something like name@example.com.",
      passwordTooShort: "Password must be at least {min} characters long.",
      passwordNoUppercase:
        "Add at least one uppercase letter (A–Z) to strengthen your password.",
      passwordNoLowercase:
        "Add at least one lowercase letter (a–z) to strengthen your password.",
      passwordNoDigit:
        "Add at least one number (0–9) to strengthen your password.",
      passwordNoSpecial:
        "Add at least one special character (for example !, $, or &), matching the mobile app.",
      confirmRequired: "Please re-enter your password to confirm it.",
      passwordsDontMatch:
        "Those passwords don't match. Please retype your password exactly.",
    },
    emailOtp: {
      mustMatchLength: "Enter the {length}-digit code we sent to your email.",
    },
    phone: {
      countryRequired: "Please choose your country.",
      numberRequired: "Phone number is required.",
      numberTooShort:
        "That phone number looks too short. Please check and try again.",
      numberTooLong:
        "That phone number is too long. Please remove any extra digits.",
      otpMustMatchLength:
        "Enter the {length}-digit code we sent to your phone.",
    },
    photo: {
      wrongType: "Please choose a JPG, PNG, or WebP image.",
      tooBig: "That image is over {max} MB. Please pick a smaller file.",
      empty: "That file appears to be empty. Please try a different photo.",
    },
    bio: {
      tooLong:
        "Your story is over the {max}-character limit. Please trim it a bit.",
    },
    support: {
      subjectRequired: "Please add a short subject.",
      subjectTooLong: "Please keep the subject under 80 characters.",
      categoryRequired: "Please pick a category.",
      messageTooShort: "Please share at least a few sentences so we can help.",
      messageTooLong:
        "That's longer than 2,000 characters — please shorten it.",
      emailRequired: "Please enter your email.",
      emailInvalid: "Please enter a valid email.",
      attachmentNotImage: "Only image files are supported.",
      attachmentTooBig: "That image is over 4 MB. Try a smaller one.",
    },
    login: {
      emailRequired: "Email is required",
      emailInvalid: "Please enter a valid email address",
      passwordRequired: "Password is required",
      passwordTooShort: "Password must be at least 8 characters",
    },
    signUp: {
      emailRequired: "Email is required",
      emailInvalid: "Please enter a valid email address",
      passwordTooShort: "Password must be at least 8 characters",
      passwordNoUppercase: "Must contain at least one uppercase letter",
      passwordNoNumber: "Must contain at least one number",
      passwordNoSpecial: "Must contain at least one special character",
      passwordsDontMatch: "Passwords do not match",
    },
  },

  /* ── Fallback / generic error copy used by `userFacingErrorMessage` ── */
  errors: {
    fallback: "Something went wrong. Please try again.",
  },
} as const;

export default en;
export type Messages = typeof en;
