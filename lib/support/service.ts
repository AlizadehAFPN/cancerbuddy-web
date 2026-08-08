import type { SupportTicketInput, SupportTicketResult } from "./types";

export interface SupportService {
  submitTicket(input: SupportTicketInput): Promise<SupportTicketResult>;
}

import { lambdaSupportService } from "./lambdaService";

/**
 * The real one.
 *
 * This used to be `mockSupportService`, unconditionally and with no dev-only
 * guard: it took no arguments, invented a ticket id after a timeout, and threw
 * the message away — while the form rendered a checkmark and a reference number.
 * Anyone reporting a bug, a billing problem or abusive content got an
 * affirmative receipt for something nobody received.
 */
export const defaultSupportService: SupportService = lambdaSupportService;
