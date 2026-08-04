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
    yes: "Yes",
    no: "No",
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
    closeMenu: "Close menu",
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
    registerTitle: "Create your account",
    registerDescription:
      "Join CancerBuddy as a patient, caregiver, or survivor. Connect with people who truly understand your journey.",
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
    splashGreeting: "Welcome!",
    splashQuestion: "Are you new here?",
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

    /* ── Post-sign-in: onboarding state ── */

    /** Modal shown when sign-in reveals the account is fully registered. */
    registrationCompleteHeading: "Your registration is complete!",
    registrationCompleteSub:
      "Your CancerBuddy account is fully set up. Open the app to connect with patients, caregivers, and survivors who truly understand your journey.",
    registrationCompleteCta: "Go to dashboard",
    registrationCompleteClose: "Close",

    /** Inline banner shown when email was never confirmed. */
    notConfirmedHeading: "Email not confirmed",
    notConfirmedBody:
      "Your email address hasn't been verified yet. Complete your registration to activate your account.",
    notConfirmedCta: "Complete registration →",

    /** Screen-reader announcement when navigating back to registration. */
    resumingRegistration:
      "Your registration isn't finished yet — taking you back to where you left off.",
  },

  /* ── Signup (shared progress indicator) ──────────────────────────── */
  signup: {
    /** Live progress indicator used by both host and user register shells. */
    stepOfTotal: "Step {current} of {total}.",
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

  /* ── User register (/register) ────────────────────────────────────────
     Mirrors the mobile app's enrollment flow: privacy → profile → email →
     email-OTP → phone → phone-OTP → verified splash. Phase 2+ adds the
     role-aware screens that follow phone verification on mobile. */
  register: {
    alreadyMember: "Already a member?",
    leftPanel: {
      eyebrow: "Create Your Account",
      tagline: "You're not alone\non this journey.",
    },
    stepTitles: {
      privacy: "Before we begin",
      profile: "About you",
      tooYoung: "Age restriction",
      guardian: "Guardian consent",
      guardianOtp: "Guardian verification",
      credentials: "Set up sign-in",
      emailOtp: "Confirm your email",
      phone: "Verify your phone",
      verifiedSuccessfully: "Phone verified",
      userRole: "Your role",
      cgRelationship: "Relationship",
      cgPatientAge: "Patient's age",
      diagnosis: "Diagnosis",
      medicalCenter: "Medical center",
      address: "Location",
      createProfile: "Create profile",
      profilePic: "Profile photo",
      about: "About",
      interests: "Interests",
      languages: "Languages",
      photos: "Photos",
      loading: "Setting up",
      allSet: "All set",
    },
    intro: {
      eyebrow: "Create Your Account",
      heading: "Welcome to CancerBuddy",
      body: "Connect with patients, caregivers, and survivors who truly understand your journey. We'll guide you through a few quick steps to set up your account.",
      timeNote: "Takes about 5 minutes · you can save progress and continue later.",
      version: "v1.0",
      highlights: {
        connectTitle: "Real peer support",
        connectBody:
          "Meet people walking the same path — patients, caregivers, and survivors.",
        privateTitle: "Private & secure",
        privateBody:
          "Your information is encrypted and only shared with the people you choose.",
        flexibleTitle: "On your terms",
        flexibleBody:
          "Skip anything you'd rather not share — you can fill it in later from your profile.",
      },
      startCta: "Get started",
    },
    privacy: {
      eyebrow: "Policies",
      heading: "Before we begin",
      body: "Review each document, then confirm to continue setting up your account.",
      view: "View",
      readAll: "Read All",
      acceptAll: "I have read and accept all three policies above.",
    },
    profile: {
      heading: "About you",
      sub: "We use your name and date of birth to personalise your experience and connect you with relevant peer groups.",
      firstNameLabel: "First name",
      firstNamePlaceholder: "Your first name",
      lastNameLabel: "Last name",
      lastNamePlaceholder: "Your last name",
      dateOfBirthLabel: "Date of birth",
      bornHint: "Born {month} {year}",
      pronounsHint:
        "Pronouns are optional — you can always update this from your profile.",
      continueDisabledTitle:
        "Please fill in your name, last name, and date of birth.",
    },
    tooYoung: {
      heading: "We're sorry",
      body: "CancerBuddy requires users to be at least 8 years old. Please come back when you're a little older.",
      backCta: "Go back",
    },
    guardian: {
      heading: "Guardian consent required",
      sub: "Since you're under 13, a parent or guardian must give their consent before you can create an account.",
      fullNameLabel: "Guardian's full name",
      fullNamePlaceholder: "Enter guardian's full name",
      emailLabel: "Guardian's email address",
      emailPlaceholder: "guardian@example.com",
      consentLabel: "I consent to my child creating a CancerBuddy account",
      supervisionLabel: "I agree to supervise my child's use of the platform",
      sendCta: "Send verification code",
      sending: "Sending…",
    },
    guardianOtp: {
      heading: "Verify your guardian",
      sub: "We sent a {length}-digit code to {email}. Ask your parent or guardian to share it with you.",
      resendIn: "Resend in {seconds}s",
      resendCode: "Resend code",
      verify: "Verify & continue",
      verifying: "Verifying…",
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
    },
    emailOtp: {
      heading: "Confirm your email",
      sub: "We sent a {length}-digit code to {email}.",
      resumeHint:
        "You already started signing up with this email. Enter the verification code we sent you, or tap Resend code.",
      changeEmail: "← Change email",
      resendIn: "Resend in {seconds}s",
      resendCode: "Resend code",
      submit: "Verify email",
      submitting: "Verifying…",
    },
    phone: {
      heading: "Verify your phone",
      sub: "We'll text you a one-time code. Your number stays private — it isn't shown to other members.",
      phoneInputLabel: "Mobile phone number",
      codePromptLead: "Enter the {length}-digit code sent to",
      sendCode: "Send code",
      resend: "Resend",
      resendIn: "Resend in {seconds}s",
      verify: "Verify & continue",
      verifying: "Verifying…",
    },
    verifiedSuccessfully: {
      eyebrow: "Phone verified",
      heading: "You're verified, {name}!",
      body: "Phone number confirmed. Next we'll set up your profile so we can match you with the right buddies.",
      continueCta: "Continue",
    },
    userRole: {
      eyebrow: "Your status",
      heading: "What's your current status?",
      sub: "This helps us match you with the right peers and groups.",
      patient: { title: "I've been diagnosed", body: "I'm a patient, currently in treatment or about to start" },
      caregiver: { title: "I'm taking care of someone", body: "I'm a caregiver for a family member or friend" },
      survivor: { title: "I'm a survivor", body: "I've completed treatment, and I'm in remission" },
      caregiverHiddenHint: "Caregiver option is available for users 13 and older.",
    },
    cgRelationship: {
      heading: "Your relationship to the patient",
      sub: "How are you related to the person you're caring for?",
      sectionLabel: "Relationship",
      selectRelationship: "Select your relationship",
      searchRelationships: "Search relationships…",
    },
    cgPatientAge: {
      heading: "Patient's birth date",
      sub: "Enter the birth month and year of the person you're caring for.",
      sub2: "This is optional — you can skip it.",
      skipLink: "Skip this step",
    },
    diagnosis: {
      heading: "Can you say more?",
      headingPrefix: "Can you say more,",
      sub: "Sharing info makes your recommendations better.",
      myDiagnosis: "My diagnosis",
      currentlyIm: "Currently I'm",
      myTreatment: "My treatment",
      mySideEffects: "My side effects",
      sideEffectsHint: "If there are any side effects related to your diagnosis, please add them.",
      inRemissionSince: "In remission since",
      addDiagnosis: "Add a diagnosis",
      addAnotherDiagnosis: "Add another diagnosis",
      selectStatus: "Select your current status",
      addTreatment: "Add a treatment",
      addAnotherTreatment: "Add another treatment",
      addSideEffect: "Add a side effect",
      addAnotherSideEffect: "Add another side effect",
      treatmentLocked: "Select your status above to unlock this section",
      searchDiagnoses: "Search 173 diagnoses…",
      searchStatuses: "Search statuses…",
      searchTreatments: "Search treatments…",
      searchSideEffects: "Search side effects…",
    },
    medicalCenter: {
      heading: "Your medical team",
      sub: "Where are you or your patient being treated? You can add more later from your profile.",
      hospitalsLabel: "Hospital / Medical center",
      hospitalsPlaceholder: "Search hospitals…",
      addHospital: "Add a hospital or medical center",
      addAnotherHospital: "Add another hospital",
      selectHospital: "Select a hospital or medical center",
      searchHospitals: "Search hospitals…",
      supportOrgsLabel: "Support organization",
      supportOrgsPlaceholder: "Search organizations…",
      addSupportOrg: "Add a support organization",
      addAnotherSupportOrg: "Add another support organization",
      selectSupportOrg: "Select a support organization",
      searchSupportOrgs: "Search organizations…",
      skipLink: "Skip this step",
      skipNote: "You can add these from your profile later.",
    },
    address: {
      heading: "Your location",
      sub: "We use your location to suggest local peer groups and events.",
      zipcodeLabel: "Zip code",
      zipcodePlaceholder: "Zip Code",
      cityLabel: "City",
      cityPlaceholder: "City",
      stateLabel: "State",
      statePlaceholder: "State",
      zipNotFound: "Hmm, that zip code is not on the list yet. Please skip this step for now.",
      zipSearching: "Loading cities…",
    },
    createProfile: {
      heading: "Glad you're here, {name}!",
      body1: "Your CancerBuddy account is ready!",
      body2: "Now you can create your profile so you can get matched with buddies.",
      cta: "Create profile",
    },
    profilePic: {
      heading: "Add a profile photo",
      sub: "A photo helps others recognise you and builds trust in the community.",
      changePhoto: "Change photo",
      mayLater: "Maybe later",
    },
    about: {
      heading: "About you",
      sub: "Tell the community a bit about yourself.",
      bioLabel: "Bio",
      bioPlaceholder: "Write a short intro — interests, what you're going through, or anything you'd like others to know…",
      bioCounter: "{length} / {max}",
      cancerlossLabel: "Coping with cancer loss",
      copingLabel: "Who did you lose?",
      copingPlaceholder: "Select who you lost…",
      selectCoping: "Select who you lost",
      searchCoping: "Search options…",
      collegeLabel: "Currently in college or university",
      universityLabel: "University / College",
      universityPlaceholder: "Type to search for your university…",
      searchUniversities: "Search universities…",
      selectUniversity: "Search for your university or college",
      mayLater: "Maybe later",
    },
    interests: {
      heading: "Your interests",
      sub: "Select topics you enjoy — we'll use them to find better buddy matches.",
      mayLater: "Maybe later",
      tapToSelect: "Tap to select",
    },
    languages: {
      heading: "Languages you speak",
      sub: "We use this to connect you with peers who share your language.",
      mayLater: "Maybe later",
    },
    photos: {
      heading: "Add photos",
      sub: "Share up to 6 photos that represent you — your hobbies, travels, family, or anything that tells your story.",
      addPhoto: "Add photo",
      mayLater: "Maybe later",
      removePhoto: "Remove",
    },
    loading: {
      heading: "Your profile is getting ready…",
      sub: "Hang tight — we're finishing a few things in the background.",
    },
    allSet: {
      heading: "You're all set!",
      sub: "Your profile is live. We've found some buddies and groups you might like — let's go!",
      findBuddies: "Find buddies",
      exploreGroups: "Explore groups",
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
        "An account with this email already exists, but that password does not match. Enter the password you used when you started signing up, or use Forgot password when it is available.",
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
      roleRequired: "Please select a role to continue.",
      relationshipRequired: "Please select your relationship to the patient.",
      diagnosisRequired: "Please fill in the required diagnosis fields.",
      addressRequired: "Please fill in all address fields.",
      finalizeFailed: "Something went wrong saving your profile. Please try again.",
      photoUploadFailed: "Photo upload failed. Please try a different image.",
      guardianSaveFailed: "Couldn't save guardian information. Please try again.",
      guardianCodeMismatch: "That code didn't match. Please try again.",
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

  /* ── Authenticated app shell (sidebar / bottom-bar navigation) ─────── */
  app: {
    nav: {
      chat: "Chat",
      groups: "Groups",
      buddies: "Find Buddies",
      notifications: "Notifications",
      profile: "Profile",
      more: "More",
      openMenu: "Open menu",
      closeMenu: "Close menu",
      primaryLabel: "Primary",
    },
    account: {
      menuLabel: "Account menu",
      resourcesHeading: "Resources & support",
      bmcf: "Learn about BMCF",
      bmcfSub: "Financial assistance & resources",
      partners: "More from our partners",
      partnersSub: "Information, products and support",
      share: "Share with a friend",
      shareSub: "Know someone who'd like this? Tap to share",
      support: "Tech support & suggestions",
      supportSub: "Send feedback or report an issue",
      funders: "Get to know our funders",
      fundersSub: "Made possible by independent grants",
      legal: "Privacy, child safety & terms",
      settings: "Settings",
      logout: "Log out",
    },
    screens: {
      chatTitle: "Chat",
      chatBody: "Your conversations with buddies will appear here.",
      groupsTitle: "Groups",
      groupsBody: "Your joined groups and the live group calendar will appear here.",
      buddiesTitle: "Find Buddies",
      buddiesBody: "Discover and request new buddies here.",
      notificationsTitle: "Notifications",
      notificationsBody: "Your updates and notifications will appear here.",
      profileTitle: "Profile",
      profileBody: "Your profile will appear here.",
      settingsTitle: "Settings",
      settingsBody: "Account and app settings will appear here.",
      partnersTitle: "More from our partners",
      partnersBody: "Information, products and support from our partners.",
      fundersTitle: "Our funders",
      fundersBody: "CancerBuddy is made possible by independent grants.",
    },
    chat: {
      title: "Chat",
      noMessages: "No messages yet",
      empty: "No conversations yet",
      emptySub: "When you connect with a buddy, your chats will appear here.",
      selectPrompt: "Select a conversation",
      selectPromptSub: "Choose a chat from the list to start messaging.",
      connectError: "Couldn't connect to chat",
      loadError: "Couldn't load this conversation",
      retry: "Retry",
      messagePlaceholder: "Type a message…",
      send: "Send",
      sending: "Sending…",
      failedRetry: "Not sent — tap to retry",
      read: "Read",
      back: "Back to conversations",
      typing: "typing…",
      startConversation: "Say hello 👋",
      connected: "You're connected! Tap to chat.",
      host: "Host",
      verified: "Verified support",
      ambassador: "Ambassador",
      new: "New",
      search: "Search conversations",
      noResults: "No matches",
      filterUnread: "Unread",
      filterUnreadEmpty: "No unread conversations",
      attach: "Attach a file",
      file: "Attachment",
      frozen: "This conversation is closed.",
      editing: "Editing message",
      editPlaceholder: "Edit your message…",
      saveEdit: "Save",
      edited: "edited",
      copy: "Copy",
      edit: "Edit",
      delete: "Delete",
      deleteConfirmTitle: "Delete message?",
      deleteConfirmBody: "This message will be permanently removed.",
      deleteError: "Couldn't delete the message. Please try again.",
      messageActions: "Message actions",
      addReaction: "Add reaction",
      conversationMenu: "Conversation options",
      removeBuddy: "Remove from my buddies",
      removeBuddySub: "You won't be able to chat with them.",
      removeConfirm: "Remove this person from your buddies?",
      removeYes: "Remove",
      // Block & report
      blockReport: "Block & report",
      blockReportSub: "I'm uncomfortable with this user.",
      reportTitle: "Report this person",
      reportReasonPrompt: "Why are you reporting?",
      reasonInappropriate: "Inappropriate comments",
      reasonSpam: "Spam",
      reasonUncomfortable: "Made me feel uncomfortable",
      reasonFalseProfile: "False profile",
      reasonOther: "Other",
      reportMoreTitle: "Can you say more?",
      reportMoreSub:
        "Help keep our community safe by sharing more info. This is completely anonymous.",
      reportMoreHint: "(Maximum 1000 characters)",
      reportSubmit: "Submit",
      reportCancel: "Cancel",
      reportThankYou: "Thank you for keeping our community safe.",
      reportError: "Something went wrong while reporting. Please try again.",
      // Conversation start disclaimer
      disclaimer:
        "This is the beginning of your conversation. For everyone's well-being, remember to leave medical advice to the experts.",
      searching: "Searching…",
    },

    /* ── Buddies tab: incoming requests + discovery ─────────────────── */
    buddies: {
      journal: "Journal",
      journalEntryCount: "{count} shared entries",
      journalNoneShared: "Nothing shared yet.",
      journalError: "We couldn't load these entries.",
      readMore: "Read more",
      heading: "Let's find your next Buddy",
      sub: "People here have been where you are. Filter to find the ones closest to your experience.",
      loadError: "We couldn't load your buddies",
      loadErrorSub: "Check your connection and try again.",
      tryAgain: "Try again",
      refresh: "Refresh",
      results: "Results",
      finding: "Finding buddies…",
      countPeople: "{count} people",
      countPerson: "{count} person",
      countMatching: "{count} people match your filters",
      countMatchingOne: "{count} person matches your filters",
      discoveryError: "We couldn't load buddies right now.",

      // Sections
      requestsHeading: "Buddy requests",
      requestsError: "We couldn't load your buddy requests.",
      showAll: "Show all {count}",
      showFewer: "Show fewer",
      recommended: "Recommended for you",
      moreOptions: "More options",

      // Request actions
      connect: "Connect",
      maybeLater: "Maybe later",
      connectedToast: "You're connected with {name}.",
      dismissedToast: "We won't show {name}'s request again.",
      acceptError: "We couldn't connect you with {name}. Please try again.",
      dismissError: "We couldn't update that request. Please try again.",
      inviteSent:
        "Your invite was sent! Once {name} accepts, they'll be added to your buddies.",
      inviteError: "We couldn't send that invite. Please try again.",
      alreadyConnected: "You already have a connection with this person.",
      connectWith: "Connect with {name}",

      // Card states
      pending: "Pending",
      connected: "Connected",
      ambassador: "Ambassador",
      hideAction: "Stop suggesting {name}",
      hideConfirm:
        "Stop suggesting {name}? You won't see them in your results again.",
      hideConfirmYes: "Remove",
      cancel: "Cancel",
      hideError: "We couldn't remove that suggestion. Please try again.",

      // Quick search
      quickSearch: "Quick search",
      filterDiagnosis: "Diagnosis",
      filterLocation: "Location",
      filterCustom: "Custom",
      filterBuddyId: "Buddy ID",
      filterWithCount: "{label}, {count} selected",
      removeFilter: "Remove filter {label}",
      clearAll: "Clear all",
      clear: "Clear",
      apply: "Apply",
      showResults: "Show results",
      selected: "Selected",
      search: "Search…",
      searchStates: "Search states…",
      searchDiagnoses: "Search diagnoses…",
      searchMedicalCenters: "Search medical centers…",
      noResultsFor: "No results for “{query}”",
      nothingYet: "Nothing to show yet",
      tryDifferentKeyword: "Try a different keyword",
      loading: "Loading…",
      optionCount: "{count} options",
      optionCountOne: "{count} option",
      selectedCount: "{count} selected",
      clearSearch: "Clear search",
      close: "Close",
      back: "Back",
      typeTwoLetters: "Type at least 2 letters.",

      // Diagnosis sheet
      diagnosisTitle: "Search by diagnosis",
      diagnosisSub:
        "Pick one or more diagnoses to find buddies who share your experience.",

      // Location sheet
      locationTitle: "Search by location",
      locationSub: "Choose a state to see buddies near you.",
      locationClear: "Clear location",
      citySub: "Would you like to be more specific?",
      cityTitle: "Choose a city",
      searchCity: "Search city",
      showWholeState: "Show results for the whole state",

      // Custom filter
      customTitle: "Custom search",
      customSub: "Narrow your results down to exactly who you're looking for.",
      sectionStatus: "Status",
      sectionAgeRange: "Age range",
      sectionCaregiverInfo: "Caregiver info",
      sectionPersonal: "Personal information",
      sectionRelationship: "Relationship to patient",
      sectionMedical: "Medical information",
      sectionPatientInfo: "Patient info",
      sectionMedicalCenter: "Medical center",
      sectionSupportOrgs: "Support organizations",
      sectionOther: "Other information",
      lookingFor: "Who are you looking for?",
      anyone: "Anyone",
      statusPatient: "Currently a patient",
      statusSurvivor: "Survivor",
      statusCaregiver: "Caregiver",
      minAge: "Minimum age",
      maxAge: "Maximum age",
      patientMinAge: "Patient minimum age",
      patientMaxAge: "Patient maximum age",
      gender: "Gender",
      genderIdentity: "Gender identity",
      sexualOrientation: "Sexual orientation",
      ethnicity: "Ethnicity",
      languages: "Languages",
      addLanguage: "Add a language",
      state: "State",
      city: "City",
      workplace: "Workplace",
      searchWorkplace: "Search workplace",
      diagnosis: "Diagnosis",
      patientDiagnosis: "Patient's diagnosis",
      addDiagnosis: "Add a diagnosis",
      treatmentStatus: "Treatment status",
      treatments: "Treatments",
      addTreatment: "Add a treatment",
      treatmentStatusFirst: "Choose a treatment status first",
      inRemissionSince: "In remission since",
      inRemissionHint: "Shows people in remission since this date or later.",
      sideEffects: "Side effects",
      addSideEffect: "Add a side effect",
      medicalCenters: "Medical centers",
      addMedicalCenter: "Add a medical center",
      supportOrgs: "Support organizations (up to {limit})",
      addSupportOrg: "Add a support organization",
      cancerLoss: "Coping with cancer loss",
      whoDidTheyLose: "Who did they lose?",
      inCollege: "Currently in college or university",
      college: "College or university",
      searchColleges: "Search colleges",

      // Buddy ID
      buddyIdTitle: "Find a buddy by ID",
      buddyIdSub:
        "Every CancerBuddy profile has a Buddy ID. Enter one to go straight to that person.",
      buddyIdLabel: "Buddy ID",
      buddyIdFormat: "Format: BI-0000-0000",
      buddyIdFind: "Find buddy",
      buddyIdNotFound:
        "We couldn't find anyone with that Buddy ID. Double-check it and try again.",
      buddyIdSelf: "That's your own Buddy ID — share it with someone else to connect.",
      buddyIdSnoozed:
        "This account is paused right now, so you can't connect with them.",
      buddyIdAgeRule:
        "{name} is in a different age group, so you can't connect on CancerBuddy.",
      buddyIdError: "Something went wrong looking that up. Please try again.",

      // Empty state
      emptyFiltered: "No buddies match these filters.",
      emptyFilteredSub:
        "Try removing a filter or two — searches with lots of criteria narrow down fast.",
      emptyTitle: "Seems like there are no new buddies right now.",
      emptySub:
        "Help us grow the community — share CancerBuddy with a friend who could use it.",
      clearFilters: "Clear all filters",
      shareWithFriend: "Share with a friend",
      linkCopied: "Link copied!",
      shareText:
        "Join me on CancerBuddy — a community for people affected by cancer.",

      // Profile page
      profileUnavailable: "This profile isn't available.",
      profileLoadError: "We couldn't load this profile.",
      backToBuddies: "Back to buddies",
      closeProfile: "Close profile",
      positionOf: "{index} of {total}",
      about: "About",
      photos: "Photos",
      interests: "Interests",
      personalBackground: "Personal background",
      sponsoredBy: "Sponsored by",
      hereTo: "Here to {goal}",
      chatWithBuddy: "Chat with my buddy",
      withdrawInvite: "Pending — withdraw invite",
      withdrawn: "Invite withdrawn.",
      withdrawError: "We couldn't withdraw that invite. Please try again.",
      previousBuddy: "Previous buddy",
      nextBuddy: "Next buddy",
      next: "Next",
      cardCurrently: "Currently",
      cardSupportOrg: "Support organization",
      cardCollege: "College or university",

      // Role badges
      rolePatient: "Patient",
      roleSurvivor: "Survivor",
      roleCaregiver: "Caregiver",
      roleHost: "Host",
      roleSupport: "Verified support",
      caringFor: "Caring for {relationship}",

      // "Why we're suggesting them" labels, shown under each name
      matchInterests: "interests",
      matchHospitals: "medical center",
      matchTreatments: "treatment",
      matchDiagnosis: "similar diagnosis",
      matchSideEffects: "side effects",
      matchSupportOrgs: "support organizations",
      matchUniversity: "university",

      // Filter chips
      chipAgeRange: "Age {min}–{max}",
      chipAgeMin: "Age {min}+",
      chipAgeMax: "Age up to {max}",
      chipPatientAgeRange: "Patient age {min}–{max}",
      chipPatientAgeMin: "Patient age {min}+",
      chipPatientAgeMax: "Patient age up to {max}",
      chipRemission: "In remission since {date}",
    },

    /* ── Partner resources (Contentful "ad" entries) ─────────────────── */
    ads: {
      sponsored: "Sponsored",
      sponsoredBy: "Sponsored by",
      readMore: "Read more",
      opensNewTab: "Opens in a new tab",
      skip: "Skip",
      back: "Back",
      continue: "Continue",
      addToFavorites: "Add to favorites",
      removeFromFavorites: "Remove from favorites",
      favoriteError: "We couldn't update your favorites. Please try again.",
      unavailable: "This resource isn't available.",
    },

    /* ── Updates tab: the notification feed + buddy requests ─────────── */
    updates: {
      heading: "Updates",
      sub: "Everything that happened while you were away.",

      // The two tabs, matching mobile's "All" / "Buddies Request".
      tabAll: "All",
      tabRequests: "Buddy requests",
      tabRequestsCount: "{count} waiting",

      // Section headings. Mobile's wording, kept verbatim so the two apps
      // group a notification under the same label.
      sectionNew: "New",
      sectionToday: "Today",
      sectionYesterday: "Yesterday",
      sectionLast7: "Last 7 days",
      sectionLast30: "Last 30 days",

      // States
      loadError: "We couldn't load your updates",
      loadErrorSub: "Check your connection and try again.",
      tryAgain: "Try again",
      refresh: "Refresh",
      loadingMore: "Loading more…",
      endOfList: "That's everything.",

      empty: "Your updates will appear here.",
      emptySub:
        "Replies, likes and new posts from your groups show up here, along with buddy requests.",
      emptyRequests: "You don't have any buddy requests yet.",
      emptyRequestsSub:
        "When someone asks to connect, their request waits for you here.",
      findBuddies: "Find new buddies",

      // Accessibility
      openNotification: "Open this update",
      unopenable: "This update has nothing to open",
    },

    /* ── Profile tab: the hub and its edit sections ──────────────────── */
    profile: {
      heading: "Profile",
      tagline: "Update your profile for better matches.",
      loadError: "We couldn't load your profile",
      tryAgain: "Try again",

      // Identity
      changePhoto: "Change photo",
      hostBadge: "Host",
      buddyId: "Buddy ID",
      noBuddyId: "You don't have a Buddy ID yet",
      viewCode: "View code",
      buddyIdCopied: "Buddy ID copied.",
      buddyIdShare: "Share your Buddy ID so someone can find you.",

      // Sections
      hostTools: "Host tools",
      manageLives: "Manage lives",
      manageLivesHint: "Schedule and edit live sessions for your groups.",
      editMyInfo: "Edit my info",
      editPatientInfo: "Edit my patient's info",
      personal: "Personal",
      personalHint: "Pronouns, location, languages and about you.",
      medical: "Medical",
      medicalHint: "Diagnosis, treatment and care team.",
      patientPersonalHint: "Their date of birth and your relationship.",
      patientMedicalHint: "Their diagnosis, treatment and care team.",
      photos: "Photos",
      photosHint: "Up to 6 photos on your profile.",
      interests: "Interests",
      interestsHint: "Pick up to 10 so we can match you.",
      imHereTo: "I'm here to…",
      selectGoal: "Select goal",
      myJournal: "My journal",
      addEntry: "Add entry",
      journalHint:
        "Got anything on your mind? Keep it private or share it with the community.",

      // Shared form chrome
      back: "Back",
      save: "Save",
      saved: "Your changes are saved.",
      savedPartial: "Saved, but some changes didn't go through. Please check.",
      saveError: "We couldn't save your changes. Please try again.",
      unsavedChanges: "You have unsaved changes.",
      allSaved: "Everything is saved.",
      selectOne: "Select one",
      cancel: "Cancel",

      // Personal information
      personalTitle: "Personal information",
      aboutYouSection: "My personal info",
      email: "Email",
      emailHidden: "No email on file",
      emailHint: "Other members won't see this.",
      pronouns: "Pronouns",
      genderIdentity: "Gender identity",
      sexualOrientation: "Sexual orientation",
      ethnicity: "Ethnicity",
      locationSection: "Where you are",
      locationHint: "Your zip code decides the city and state options.",
      zipcode: "Zip code",
      zipcodePlaceholder: "5 digits",
      zipSearching: "Looking up cities…",
      zipNotFound: "We couldn't find that zip code.",
      city: "City",
      selectCity: "Select your city",
      enterZipFirst: "Enter a zip code first",
      workplace: "Workplace",
      workplacePlaceholder: "Add your workplace",
      searchWorkplaces: "Search workplaces",
      addressRequired: "Zip code and city are required.",
      languagesSection: "My languages",
      languagesHint:
        "This helps us match you with people who speak the same ones you do.",
      languages: "Languages",
      addLanguage: "Add language",
      searchLanguages: "Search languages",
      aboutMeSection: "About me",
      bio: "Your story",
      bioPlaceholder: "What's your story? Share a bit about yourself.",
      bioHint: "Up to {max} characters.",
      bioTooLong: "Your story is over the character limit.",
      cancerLoss: "Coping with cancer loss",
      whoDidYouLose: "Who did you lose?",
      inCollege: "Currently in college or university",
      college: "College or university",
      collegePlaceholder: "Add your school",
      searchColleges: "Search colleges",

      // Medical information
      medicalTitle: "Medical information",
      medicalPatientTitle: "My patient's medical information",
      diagnosisSection: "Diagnosis and treatment",
      diagnosisHint: "This is what we match on, so it matters most.",
      diagnosisHintPatient:
        "Tell us about the person you care for — this is what we match on.",
      diagnosis: "Diagnosis",
      addDiagnosis: "Add diagnosis",
      searchDiagnoses: "Search diagnoses",
      diagnosisRequired: "Add at least one diagnosis.",
      treatmentStatus: "Treatment status",
      treatmentStatusRequired: "Choose a treatment status.",
      treatments: "Treatments",
      addTreatment: "Add treatment",
      searchTreatments: "Search treatments",
      treatmentsLocked: "Choose a treatment status first.",
      remissionSince: "In remission since",
      remissionHint: "Month and year, e.g. 03/2024.",
      remissionRequired: "Tell us when you went into remission.",
      remissionInvalid: "Enter the date as MM/YYYY.",
      careTeamSection: "Care team",
      careTeamHint: "Where you're treated and who supports you.",
      careTeamHintPatient: "Where they're treated and who supports them.",
      hospitals: "Medical centers",
      addHospital: "Add medical center",
      searchHospitals: "Search medical centers",
      supportOrganizations: "Support organizations",
      addSupportOrganization: "Add organization",
      searchSupportOrganizations: "Search organizations",
      sideEffectsSection: "Side effects",
      sideEffectsHint: "Anything you'd like others to know about.",
      disabilities: "Side effects",
      addDisability: "Add side effect",
      searchDisabilities: "Search side effects",

      // Patient info (caregivers)
      patientTitle: "My patient's info",
      patientIntro:
        "A little about the person you care for. It helps us match you with caregivers in a similar situation.",
      patientBirth: "Their date of birth",
      patientBirthHint: "Month and year, e.g. 03/1975.",
      patientBirthRequired: "Add their date of birth.",
      relationship: "Your relationship to them",
      relationshipRequired: "Choose your relationship to them.",
      patientOnlyCaregivers: "This section is only for caregivers.",
      dateInvalid: "Enter the date as MM/YYYY.",
      dateFuture: "That date is in the future.",
      dateTooOld: "That date is too far in the past.",

      // Interests
      interestsTitle: "Interests",
      interestsIntro:
        "Pick what you're into — we use these to suggest buddies. Around {target} gives us the most to work with.",
      searchInterests: "Search interests",
      noInterestsMatch: "Nothing matches \u201c{query}\u201d",
      interestsSelected: "{count} selected \u00b7 {target} fills the ring",

      // Goal
      goalTitle: "I'm here to\u2026",
      goalIntro: "Tell people what brought you here. You can change it any time.",

      // Photos
      photosTitle: "Photos",
      photosIntro:
        "Up to {max} photos. They appear on your profile so buddies can put a face to the name.",
      addPhoto: "Add photo",
      removePhoto: "Remove photo",
      photoRemoved: "Photo removed.",
      photoUpdated: "Your photo is updated.",
      photoRemoveError: "We couldn't remove that photo. Please try again.",
      photoUploadError: "We couldn't upload that photo. Please try again.",
      photosFull: "You can have up to {max} photos.",
      photosCount: "{count} of {max} photos",

      // Journal
      journalTitle: "My journal",
      journalIntro:
        "Got anything on your mind? Keep it private, or share an entry on your profile.",
      journalPublicCount: "{count} of {total} shared publicly.",
      journalPlaceholder: "What's on your mind?",
      journalSave: "Save entry",
      journalAdded: "Entry saved.",
      journalUpdated: "Entry updated.",
      journalDeleted: "Entry deleted.",
      journalSaveError: "We couldn't save that. Please try again.",
      journalEdit: "Edit",
      journalDelete: "Delete",
      journalDeleteConfirm: "Delete this entry? It can't be recovered.",
      journalEmpty: "No entries yet",
      journalEmptySub: "Write the first one \u2014 nobody sees it unless you share it.",
      journalPublic: "Shown on your profile",
      journalPrivate: "Private to you",
      journalNowPublic: "That entry is now on your profile.",
      journalNowPrivate: "That entry is private again.",

      // Buddy ID
      copyId: "Copy ID",
      shareId: "Share",
      linkCopied: "Link copied.",
      copyFailed: "We couldn't copy that.",
      findByIdTitle: "Find someone by Buddy ID",
      findByIdHint: "Paste their ID or the link they shared with you.",
      buddyIdPlaceholder: "Their Buddy ID",
      findBuddy: "Find",
      buddyIdNotFound: "No one matches that Buddy ID.",
      lookupError: "We couldn't search right now. Please try again.",

      // Manage lives (hosts)
      scheduleLive: "Schedule a live",
      editLive: "Edit live session",
      liveTitle: "Title",
      liveTitlePlaceholder: "What's this session about?",
      liveDescription: "Description",
      liveDescriptionPlaceholder: "Anything members should know beforehand.",
      liveWhen: "Date and time",
      liveDuration: "Duration",
      liveMinutes: "{count} min",
      liveVisibleToMembers: "Visible to members",
      liveVisibleHint: "Turn off to hide it without deleting it.",
      liveNow: "Live now",
      liveScheduled: "Scheduled",
      liveHidden: "Hidden",
      liveCreated: "Live session scheduled.",
      liveUpdated: "Live session updated.",
      liveDeleted: "Live session deleted.",
      liveDelete: "Delete session",
      liveDeleteConfirm: "Delete \u201c{title}\u201d? This can't be undone.",
      liveSaveError: "We couldn't save that session. Please try again.",
      livesVisible: "Visible",
      livesHiddenTab: "Hidden",
      livesEmpty: "No sessions here yet",
      livesEmptySub: "Schedule one and it'll show up for your group.",
      livesNoGroup: "You're not hosting a group yet",
      livesNoGroupSub: "Live sessions belong to the group you host.",
      livesHostsOnly: "Only hosts can schedule live sessions.",

      // Access
      supportNoProfile: "Support accounts don't have a profile page.",
      supportNoProfileSub:
        "Your account is set up to help other members, so there's no profile to manage here.",
      backToGroups: "Go to groups",
    },

    /* ── Groups tab: my groups, live calendar, discovery, feeds ─────── */
    groups: {
      heading: "Groups",
      tabGroups: "Groups",
      tabCalendar: "Live group calendar",
      search: "Search groups",
      loadError: "We couldn't load your groups",
      loadErrorSub: "Check your connection and try again.",
      tryAgain: "Try again",
      retry: "Retry",
      close: "Close",
      cancel: "Cancel",
      back: "Back",

      // My groups
      yourLiveGroups: "Your live groups",
      yourGroups: "Your groups",
      live: "Live",
      muted: "Muted",
      hostedBy: "Hosted by {sponsor}",
      memberCount: "{count} members",
      memberCountOne: "{count} member",
      noGroupsTitle: "Every support group you join will appear here.",
      noGroupsSub:
        "Groups are where members share what's working, what isn't, and everything in between.",
      exploreGroups: "Explore groups",
      noSearchResults: "No groups match “{query}”",
      selectGroup: "Select a group",
      selectGroupSub: "Choose a group from the list to read its posts.",

      // Discovery
      discoverHeading: "What support groups would you like to join?",
      discoverSub: "Browse every group on CancerBuddy and join the ones that fit.",
      discoverSearch: "Type keywords here",
      discoverEmpty: "You've joined every group we have.",
      discoverEmptySub: "New groups appear here as they open.",
      privateGroup: "Private group",
      joined: "Joined",
      join: "Join",
      joining: "Joining…",
      joinedToast: "You've joined {name}! You'll find it in your Groups.",
      joinError: "We couldn't join that group. Please try again.",
      codeTitle: "This is a private group",
      codeSub: "Enter the group code to join. Ask the host if you don't have it.",
      codeLabel: "Group code",
      codePlaceholder: "Enter code",
      codeWrong: "That code doesn't match. Check it and try again.",
      codeSubmit: "Join group",

      // Group detail
      about: "About",
      hosts: "Hosts",
      host: "Host",
      sponsoredBy: "Sponsored by",
      members: "Members",
      leaveGroup: "Leave group",
      leaveGroupSub: "You won't be able to read or add group posts.",
      leaveConfirmTitle: "Leave {name}?",
      leaveConfirmBody:
        "You'll stop receiving its posts and won't be able to add new ones.",
      leaveConfirmYes: "Leave group",
      leftToast: "You've left {name}.",
      leaveError: "We couldn't leave that group. Please try again.",
      muteGroup: "Mute group updates",
      muteGroupSub: "You won't be notified about new posts.",
      unmuteGroup: "Unmute group updates",
      unmuteGroupSub: "You'll be notified about new posts.",
      muteError: "We couldn't change that setting. Please try again.",
      mutedToast: "You won't be notified about new posts in {name}.",
      unmutedToast: "You'll be notified about new posts in {name}.",
      groupOptions: "Group options",
      groupInfo: "Group info",

      // Feed
      noPostsTitle: "There are no posts yet",
      noPostsSub: "Something interesting will come up soon.",
      feedError: "We couldn't load this group's posts.",
      writePost: "Share something with the group…",
      newPost: "New post",
      post: "Post",
      posting: "Posting…",
      postPlaceholder: "What would you like to share?",
      postEmpty: "Write something first.",
      postCreated: "Your post is live.",
      postError: "We couldn't publish that post. Please try again.",
      editPost: "Edit post",
      saveChanges: "Save changes",
      postUpdated: "Your post was updated.",
      editError: "We couldn't save those changes. Please try again.",
      deletePost: "Delete post",
      deletePostConfirm: "Delete this post? It can't be recovered.",
      deletePostYes: "Delete",
      postDeleted: "Post deleted.",
      deleteError: "We couldn't delete that. Please try again.",
      pinnedPost: "Pinned post",
      pinPost: "Pin post",
      unpinPost: "Unpin post",
      pinned: "The post was pinned.",
      unpinned: "The post was unpinned.",
      pinError: "We couldn't pin that post. Please try again.",
      pinConflictTitle: "Replace the pinned post?",
      pinConflictBody:
        "This group already has a pinned post. Pinning this one will unpin it.",
      pinConflictYes: "Replace",
      edited: "Edited",
      like: "Like",
      unlike: "Unlike",
      likeError: "We couldn't register that. Please try again.",
      comments: "Comments",
      commentCount: "{count} comments",
      commentCountOne: "{count} comment",
      postActions: "Post options",
      loadMore: "Load more",

      // Comments
      commentPlaceholder: "Add a comment…",
      replyPlaceholder: "Reply to {name}…",
      send: "Send",
      reply: "Reply",
      replyCount: "{count} replies",
      replyCountOne: "{count} reply",
      viewReplies: "View replies",
      hideReplies: "Hide replies",
      noComments: "No comments yet — be the first.",
      commentAdded: "Comment added.",
      commentError: "We couldn't add that comment. Please try again.",
      editComment: "Edit comment",
      deleteComment: "Delete comment",
      deleteCommentConfirm: "Delete this comment?",
      commentDeleted: "Comment deleted.",

      // Reporting
      report: "Report post",
      reportSub: "Help keep the community safe.",
      reportTitle: "Report this post",
      reportPrompt: "Why are you reporting it?",
      reportSubmit: "Submit report",
      reportThanks: "Thanks — our team will review it.",
      reportError: "We couldn't send that report. Please try again.",

      // Members + host detail
      membersError: "We couldn't load the member list.",
      membersEmpty: "No members to show yet.",
      hostTitle: "Group host",
      hostNotFound: "We couldn't find that host.",
      hostsGroup: "Hosts",
      viewMembers: "View members",

      // Calendar
      calendarEmpty: "No live sessions scheduled.",
      calendarEmptySub: "Scheduled sessions for this month and next appear here.",
      calendarYourGroups: "Your groups",
      calendarMoreOptions: "More group options",
      calendarLive: "Live now",
      calendarUpcoming: "Upcoming",
      calendarError: "We couldn't load the live calendar.",
      liveVideoUnavailable:
        "Joining live video isn't available on the web yet — open the CancerBuddy app to join.",
    },
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
