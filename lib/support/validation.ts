import { z } from "zod";
import {
  ATTACHMENT_MAX_BYTES,
  MESSAGE_MAX,
  MESSAGE_MIN,
  SUBJECT_MAX,
  SUBJECT_MIN,
  SUPPORT_CATEGORIES,
} from "./types";

export const supportFormSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(SUBJECT_MIN, "Please add a short subject.")
    .max(SUBJECT_MAX, "Please keep the subject under 80 characters."),
  category: z.enum(SUPPORT_CATEGORIES, {
    error: "Please pick a category.",
  }),
  message: z
    .string()
    .trim()
    .min(MESSAGE_MIN, "Please share at least a few sentences so we can help.")
    .max(MESSAGE_MAX, "That's longer than 2,000 characters — please shorten it."),
  email: z
    .string()
    .min(1, "Please enter your email.")
    .email("Please enter a valid email."),
});

export type SupportFormValues = z.infer<typeof supportFormSchema>;

/** Pure validator for the optional image attachment, run outside Zod
 *  so we can short-circuit before reading the file as base-64. */
export function validateAttachment(
  file: File | null,
): { ok: true } | { ok: false; message: string } {
  if (!file) return { ok: true };
  if (!file.type.startsWith("image/")) {
    return { ok: false, message: "Only image files are supported." };
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { ok: false, message: "That image is over 4 MB. Try a smaller one." };
  }
  return { ok: true };
}
