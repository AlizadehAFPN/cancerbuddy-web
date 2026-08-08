/**
 * The reset form's rules.
 *
 * Cognito enforces the pool's password policy on `forgotPasswordSubmit` and
 * rejects a weak password with `InvalidPasswordException` — a message written
 * for a developer. The same five rules the signup form applies are applied here
 * so the member is told before they submit, in the same words.
 *
 * `passwordRulesEqual` in `lib/signup/passwordRules.test.ts` guards the pair
 * against drifting apart.
 */

import { z } from "zod";
import { t } from "@/lib/i18n";
import { EMAIL_REGEX, OTP_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/signup";
import { PASSWORD_SPECIAL_CHARS } from "@/lib/signup/validation";

export const resetEmailSchema = z.object({
  email: z
    .string()
    .min(1, t("validation.credentials.emailRequired"))
    .regex(EMAIL_REGEX, t("validation.credentials.emailInvalid")),
});

/** The password half, character for character the signup rules. */
const newPassword = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    t("validation.credentials.passwordTooShort", { min: PASSWORD_MIN_LENGTH }),
  )
  .regex(/[A-Z]/, t("validation.credentials.passwordNoUppercase"))
  .regex(/[a-z]/, t("validation.credentials.passwordNoLowercase"))
  .regex(/\d/, t("validation.credentials.passwordNoDigit"))
  .regex(PASSWORD_SPECIAL_CHARS, t("validation.credentials.passwordNoSpecial"));

export const resetPasswordSchema = z
  .object({
    code: z
      .string()
      .trim()
      .length(
        OTP_LENGTH,
        t("validation.emailOtp.mustMatchLength", { length: OTP_LENGTH }),
      ),
    password: newPassword,
    confirmPassword: z
      .string()
      .min(1, t("validation.credentials.confirmRequired")),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: t("validation.credentials.passwordsDontMatch"),
  });

export type ResetEmailFormData = z.infer<typeof resetEmailSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
