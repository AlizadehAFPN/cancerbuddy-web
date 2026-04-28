export const SUPPORT_CATEGORIES = [
  "account",
  "billing",
  "content",
  "bug",
  "feature",
  "other",
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<SupportCategory, string> = {
  account: "Account & sign-in",
  billing: "Billing",
  content: "Content concern",
  bug: "Bug report",
  feature: "Feature request",
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

export interface SupportTicketResult {
  ticketId: string;
  status: "OPEN";
  receivedAt: string;
}
