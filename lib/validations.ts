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

/* ── Sign-up (stub — expands in future steps) ── */

export const signUpSchema = z.object({
  email: z
    .string()
    .min(1, t("validation.signUp.emailRequired"))
    .email(t("validation.signUp.emailInvalid")),
  password: z
    .string()
    .min(8, t("validation.signUp.passwordTooShort"))
    .regex(/[A-Z]/, t("validation.signUp.passwordNoUppercase"))
    .regex(/[0-9]/, t("validation.signUp.passwordNoNumber"))
    .regex(/[^A-Za-z0-9]/, t("validation.signUp.passwordNoSpecial")),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: t("validation.signUp.passwordsDontMatch"),
  path: ["confirmPassword"],
});

export type SignUpFormData = z.infer<typeof signUpSchema>;
