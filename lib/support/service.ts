import type { SupportTicketInput, SupportTicketResult } from "./types";

export interface SupportService {
  submitTicket(input: SupportTicketInput): Promise<SupportTicketResult>;
}

import { mockSupportService } from "./mockService";

export const defaultSupportService: SupportService = mockSupportService;
