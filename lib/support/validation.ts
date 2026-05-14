import { z } from "zod";
import {
  ATTACHMENT_MAX_BYTES,
  MESSAGE_MAX,
  MESSAGE_MIN,
  SUBJECT_MAX,
  SUBJECT_MIN,
  SUPPORT_CATEGORIES,
} from "./types";
import { t } from "@/lib/i18n";

export const supportFormSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(SUBJECT_MIN, t("validation.support.subjectRequired"))
    .max(SUBJECT_MAX, t("validation.support.subjectTooLong")),
  category: z.enum(SUPPORT_CATEGORIES, {
    error: t("validation.support.categoryRequired"),
  }),
  message: z
    .string()
    .trim()
    .min(MESSAGE_MIN, t("validation.support.messageTooShort"))
    .max(MESSAGE_MAX, t("validation.support.messageTooLong")),
  email: z
    .string()
    .min(1, t("validation.support.emailRequired"))
    .email(t("validation.support.emailInvalid")),
});

export type SupportFormValues = z.infer<typeof supportFormSchema>;

/** Pure validator for the optional image attachment, run outside Zod
 *  so we can short-circuit before reading the file as base-64. */
export function validateAttachment(
  file: File | null,
): { ok: true } | { ok: false; message: string } {
  if (!file) return { ok: true };
  if (!file.type.startsWith("image/")) {
    return { ok: false, message: t("validation.support.attachmentNotImage") };
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { ok: false, message: t("validation.support.attachmentTooBig") };
  }
  return { ok: true };
}
