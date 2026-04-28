import type { SupportService } from "./service";
import type { SupportTicketResult } from "./types";

const FAKE_LATENCY_MS = 600;

function randomChunk(): string {
  return Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
}

export const mockSupportService: SupportService = {
  async submitTicket() {
    const result: SupportTicketResult = {
      ticketId: `CB-${randomChunk()}-${randomChunk()}`,
      status: "OPEN",
      receivedAt: new Date().toISOString(),
    };
    return new Promise((resolve) =>
      setTimeout(() => resolve(result), FAKE_LATENCY_MS),
    );
  },
};
