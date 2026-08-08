import { z } from "zod";
import { t } from "@/lib/i18n";

/* ── Login ── */

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, t("validation.login.emailRequired"))
    .email(t("validation.login.emailInvalid")),
  /**
   * Only non-empty — deliberately *not* the signup rules.
   *
   * Signup enforces a minimum length, but accounts created before that rule
   * exist, and Cognito is the authority on whether a password is correct.
   * Applying the signup minimum here meant a member with a legacy short password
   * could not submit the form at all: no request was ever sent, so they were
   * locked out of an account whose password was valid.
   */
  password: z.string().min(1, t("validation.login.passwordRequired")),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/* ── Forgot password ── */

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, t("validation.login.emailRequired"))
    .email(t("validation.login.emailInvalid")),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

