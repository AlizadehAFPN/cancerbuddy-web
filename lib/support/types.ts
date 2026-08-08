import { t } from "@/lib/i18n";

/**
 * Mobile's five subject options, verbatim — the string the Lambda receives as
 * `subject` is one of these (`SubjectTemplate.tsx:42-51`).
 *
 * Web previously invented its own six, which both dropped **Community Safety**
 * (the one that matters most on a patient-support product) and added a `billing`
 * option for a product that does not bill anyone.
 */
export const SUPPORT_CATEGORIES = [
  "general",
  "error",
  "improvement",
  "safety",
  "other",
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<SupportCategory, string> = {
  general: t("support.categories.general"),
  error: t("support.categories.error"),
  improvement: t("support.categories.improvement"),
  safety: t("support.categories.safety"),
  other: t("support.categories.other"),
};

/**
 * The exact string sent as the Lambda's `subject`, so a web ticket lands in the
 * same bucket as a mobile one. Not translated — it is a routing key, not copy.
 */
export const CATEGORY_WIRE_SUBJECT: Record<SupportCategory, string> = {
  general: "General Comments",
  error: "Report an error",
  improvement: "App Improvement Suggestions",
  safety: "Community Safety",
  other: "Other",
};

export const SUBJECT_MIN = 1;
export const SUBJECT_MAX = 80;
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;
export const ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;

export interface SupportAttachment {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Base-64 payload; mock-only. Real backend would receive a multipart upload. */
  dataBase64: string;
}

export interface SupportTicketInput {
  subject: string;
  category: SupportCategory;
  message: string;
  email: string;
  attachment?: SupportAttachment | null;
}

/**
 * There is no ticket id: the Lambda sends an email and returns no identifier.
 * Web used to fabricate a `CB-XXXX-XXXX` and offer a Copy button for it, which
 * gave people a reference number that meant nothing to anyone.
 */
export interface SupportTicketResult {
  receivedAt: string;
}
