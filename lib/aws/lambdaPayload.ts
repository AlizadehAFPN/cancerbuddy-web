/**
 * Payload `type` strings for the AWS Lambdas — aligned with
 * `cancerbuddyapp/src/types/utils/lambda.ts` (`LambdaPayloadType`).
 *
 * Most go to `USERS_LAMBDA`, but not all: the target is the second argument to
 * {@link raiseUserLambda}, and a few verbs address `GETSTREAM_LAMBDA` or
 * `NOTIFICATIONS_LAMBDA` instead. Each of those says so on its own doc comment.
 *
 * Only verbs that are **live in mobile today** belong here. Mobile declares 41;
 * roughly ten are dead (IVS streaming, the broken `readNotifications`, and the
 * pre-optimisation `getPostByGroup` / `getReactionsByPost` pair). See
 * `docs/parity/WORKLIST.md` § Not being built before adding one.
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
  /**
   * Ambassador "learn more" → opens a support conversation.
   *
   * The wire string is `ambassadorMessage`, **not** `createAmbassadorMessage`.
   * The constant name in `cancerbuddyapp/src/types/utils/lambda.ts:23` is
   * `CREATE_AMBASSADOR_MESSAGE` but its value is not — the Lambda rejects the
   * longer form.
   */
  CREATE_AMBASSADOR_MESSAGE: "ambassadorMessage",
  /** Follow-up notification after a ReplyHost / AskToHost chat message. */
  REPLY_MESSAGE: "replyMessage",

  /* ── Account lifecycle ── */
  /** Tears down the signed-in session server-side; runs before `Auth.signOut()`. */
  LOGOUT: "logout",
  /**
   * Deletes the Stream user. Addresses **`GETSTREAM_LAMBDA`**, not the users one.
   *
   * Account deletion is three steps in this order, per
   * `cancerbuddyapp/src/utils/lambda.ts:100-130`: delete the member's Stream
   * channels client-side, then this verb, then {@link
   * LambdaPayloadType.DELETE_ACCOUNT} against `USERS_LAMBDA`.
   */
  DELETE_STREAM_USER: "delete",
  /** Deletes the account row. Runs last, after {@link LambdaPayloadType.DELETE_STREAM_USER}. */
  DELETE_ACCOUNT: "deleteAccount",
  /** Pauses new buddy requests and freezes the member's Stream channels. */
  SNOOZE: "snooze",
  /** Reverses {@link LambdaPayloadType.SNOOZE}. Mobile's constant is `UNSNOOZE`. */
  UNSNOOZE: "noSnooze",
  /** Patient↔Caregiver transitions. Patient↔Survivor goes through AppSync instead. */
  CHANGE_USER_TYPE: "changeStatus",
  /** Support / feedback form submission. Mobile's constant is `COMMENTS`. */
  COMMENTS: "supportemail",

  /* ── Groups ── */
  /** One page of a group's feed, authors already resolved server-side. */
  GET_POSTS_BY_GROUP: "newGetPostByGroup",
  JOIN_GROUP: "joinToGroup",
  LEAVE_GROUP: "leftGroup",
  MUTE_GROUP: "muteGroup",
  UNMUTE_GROUP: "unmuteGroup",
  /**
   * Deletes a post, comment or reply. Takes `{feedId, postId, commentId, isPost}`.
   *
   * This is the only correct way to delete: `feed.removeActivity` on the caller's
   * own feed silently succeeds without deleting anything another member authored.
   */
  DELETE_MESSAGE: "deleteMessage",
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
