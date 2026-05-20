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
} as const;
