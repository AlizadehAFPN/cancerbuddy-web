import { z } from "zod";
import { t } from "@/lib/i18n";

/* ── Login ── */

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, t("validation.login.emailRequired"))
    .email(t("validation.login.emailInvalid")),
  password: z
    .string()
    .min(1, t("validation.login.passwordRequired"))
    .min(8, t("validation.login.passwordTooShort")),
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

