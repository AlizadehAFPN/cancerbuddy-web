import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/aws/raiseUserLambda", () => ({ raiseUserLambda: vi.fn() }));
vi.mock("@/lib/buddies/currentUser", () => ({ getSignedInUserId: vi.fn() }));

import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import { getSignedInUserId } from "@/lib/buddies/currentUser";
import { lambdaSupportService } from "./lambdaService";
import { defaultSupportService } from "./service";
import { CATEGORY_WIRE_SUBJECT, SUPPORT_CATEGORIES } from "./types";

const invoke = vi.mocked(raiseUserLambda);
const signedIn = vi.mocked(getSignedInUserId);

const ticket = {
  subject: "Cannot open my group",
  category: "error" as const,
  message: "Tapping the group does nothing.",
  email: "member@example.com",
};

/** Acceptance check for `support-real-submission`, WORKLIST Phase 0. */
describe("support submits for real", () => {
  beforeEach(() => {
    invoke.mockReset();
    signedIn.mockReset();
    invoke.mockResolvedValue("{}");
    signedIn.mockResolvedValue("user-1");
    process.env.NEXT_PUBLIC_USERS_LAMBDA = "users-demo";
  });

  /** The whole point: the default service must not be a mock. */
  it("wires the real Lambda service as the default", () => {
    expect(defaultSupportService).toBe(lambdaSupportService);
  });

  it("no mock service survives in the repo", () => {
    const service = readFileSync("lib/support/service.ts", "utf8");
    expect(service).not.toMatch(/=\s*mockSupportService/);
  });

  it("posts subject, text and userId to the users Lambda", async () => {
    await lambdaSupportService.submitTicket(ticket);

    expect(invoke).toHaveBeenCalledTimes(1);
    const [verb, fn, payload] = invoke.mock.calls[0]!;
    expect(verb).toBe("supportemail");
    expect(fn).toBe("users-demo");
    expect(payload).toMatchObject({
      subject: "Report an error",
      userId: "user-1",
    });
  });

  /**
   * The Lambda takes only `{subject, text, userId}`, so the two fields web
   * collects beyond that must survive inside `text` rather than being dropped.
   */
  it("folds the typed subject line and reply-to address into the body", async () => {
    await lambdaSupportService.submitTicket(ticket);
    const text = String(
      (invoke.mock.calls[0]![2] as { text: unknown }).text,
    );

    expect(text).toContain("Cannot open my group");
    expect(text).toContain("Tapping the group does nothing.");
    expect(text).toContain("member@example.com");
  });

  it("still sends when signed out, and says so", async () => {
    signedIn.mockResolvedValue(null as never);
    await lambdaSupportService.submitTicket(ticket);

    const payload = invoke.mock.calls[0]![2] as { userId: string; text: string };
    expect(payload.userId).toBe("");
    expect(payload.text).toMatch(/signed out/i);
  });

  /** A failure must propagate; the old mock could not fail at all. */
  it("propagates a Lambda failure instead of reporting success", async () => {
    invoke.mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    await expect(lambdaSupportService.submitTicket(ticket)).rejects.toThrow();
  });

  it("returns no ticket id, because the backend issues none", async () => {
    const result = await lambdaSupportService.submitTicket(ticket);
    expect(result).not.toHaveProperty("ticketId");
    expect(result.receivedAt).toBeTruthy();
  });
});

describe("categories match mobile", () => {
  /** Mobile's five, from `SubjectTemplate.tsx:42-51`. */
  it("offers Community Safety and no invented billing option", () => {
    expect([...SUPPORT_CATEGORIES]).toEqual([
      "general",
      "error",
      "improvement",
      "safety",
      "other",
    ]);
    expect(SUPPORT_CATEGORIES).not.toContain("billing");
  });

  it("sends the exact subject strings mobile sends", () => {
    expect(Object.values(CATEGORY_WIRE_SUBJECT)).toEqual([
      "General Comments",
      "Report an error",
      "App Improvement Suggestions",
      "Community Safety",
      "Other",
    ]);
  });

  /** Dropped deliberately: the Lambda has no slot, so a file was discarded. */
  it("no longer offers an attachment the backend cannot receive", () => {
    const form = readFileSync("app/support/_components/SupportForm.tsx", "utf8");
    expect(form).not.toMatch(/type="file"/);
    expect(form).not.toMatch(/dataBase64/);
  });
});
