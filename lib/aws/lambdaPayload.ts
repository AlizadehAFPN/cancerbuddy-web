/**
 * Payload `type` strings sent to `USERS_LAMBDA` — aligned with
 * `cancerbuddyapp/src/types/utils/lambda.ts` (`LambdaPayloadType`).
 */
export const LambdaPayloadType = {
  /** Same string as `cancerbuddyapp` `LambdaPayloadType.LOGIN` — GetStream + users table bootstrap. */
  LOGIN: "login",
  SEND_CODE_PHONE: "sendCodePhone",
  VERIFY_CODE_PHONE: "verifyCodePhone",
  VERIFY_EMAIL: "verifyEmail",
  /** Creates a guardian record + sends verification email; returns guardianId. */
  CREATE_GUARDIAN: "createGuardian",
  /** `HomeBuddies` / `connectChannelSupport` — provisions support (e.g. Ava) connection list. */
  CREATE_SUPPORT_CONNECTION: "createSupportConnection",
  /** After connection is accepted; same payload shape as mobile `HomeBuddies`. */
  CREATE_SUPPORT_MESSAGE: "supportMessage",
  /** In-registration help email — mirrors mobile `LambdaPayloadType.SENDEMAILHELP`. */
  SEND_HELP_EMAIL: "sendEmailHelp",

  /* ── Groups ── */
  /** One page of a group's feed, authors already resolved server-side. */
  GET_POSTS_BY_GROUP: "newGetPostByGroup",
  JOIN_GROUP: "joinToGroup",
  LEAVE_GROUP: "leftGroup",
  MUTE_GROUP: "muteGroup",
  UNMUTE_GROUP: "unmuteGroup",
  /** Scheduled live sessions across all groups. */
  GET_LIVE_CALENDAR: "getLiveCalendar",
  /** Schedules a live session; also provisions its Twilio room and chat channel. */
  CREATE_LIVE: "createLive",

  /* ── Live video room ── */
  /**
   * Mints a Twilio Video access token and reports the caller's role. The
   * Lambda is the only place that decides who is a host, and it refuses
   * blocked users — never infer either client-side.
   */
  GET_TWILIO_TOKEN: "getTwilioToken",
  /** Host-only: mute / hide / remove / block another participant. */
  MODERATE_LIVE: "moderateLive",
  /** Host-only: close the session for everyone. */
  END_LIVE: "endLive",
  /**
   * Host-only: push "we're live" to the group's members. Runs on
   * `NOTIFICATIONS_LAMBDA`, not the users one.
   */
  NOTIFY_GROUP_LIVE: "notifyGroupLive",
} as const;
