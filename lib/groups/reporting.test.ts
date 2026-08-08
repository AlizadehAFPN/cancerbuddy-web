import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/aws/appsyncGraphql", () => ({
  executeAppSyncGraphql: vi.fn(),
}));

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { reportPost } from "./membership";
import {
  OTHER_MAX_CHARS,
  OTHER_MIN_CHARS,
  REPORT_REASONS,
  ReportTargetType,
  reportReasonValue,
  reportSubmitDisabled,
} from "./reporting";

const exec = vi.mocked(executeAppSyncGraphql);

/** Acceptance check for `groups-report-payload-and-other-detail`, WORKLIST Phase 3. */

describe("reportSubmitDisabled", () => {
  it("blocks submit with no reason chosen", () => {
    expect(reportSubmitDisabled({ reason: "" })).toBe(true);
  });

  it("allows submit for a plain reason", () => {
    expect(reportSubmitDisabled({ reason: "Spam" })).toBe(false);
  });

  /** Mobile's `state === 'Other' && stateInput.length < 10`. */
  it("blocks Other with nine characters", () => {
    expect(reportSubmitDisabled({ reason: "Other", detail: "123456789" })).toBe(true);
  });

  it("allows Other with ten", () => {
    expect(reportSubmitDisabled({ reason: "Other", detail: "1234567890" })).toBe(false);
  });

  it("does not count whitespace as detail", () => {
    expect(
      reportSubmitDisabled({ reason: "Other", detail: "          " }),
    ).toBe(true);
  });

  it("pins the two bounds mobile enforces", () => {
    expect(OTHER_MIN_CHARS).toBe(10);
    expect(OTHER_MAX_CHARS).toBe(1000);
  });
});

describe("reportReasonValue", () => {
  /** Other submits the free text, not the word "Other" — mobile's ternary. */
  it("sends the free text for Other", () => {
    expect(reportReasonValue({ reason: "Other", detail: "  they threatened me  " })).toBe(
      "they threatened me",
    );
  });

  it("sends the reason itself otherwise", () => {
    expect(reportReasonValue({ reason: "Spam", detail: "ignored" })).toBe("Spam");
  });
});

describe("the reasons list matches mobile's, in order", () => {
  it("is mobile's `ReportTemplate` data array", () => {
    expect([...REPORT_REASONS]).toEqual([
      "Inappropriate comments",
      "Spam",
      "Made me feel uncomfortable",
      "False profile",
      "Other",
    ]);
  });
});

describe("reportPost payload", () => {
  beforeEach(() => {
    exec.mockReset();
  });

  /**
   * The load-bearing assertion. `CreateReportPostInput` (introspected against the
   * live schema) has **no `userId` field**, so the previous three-field payload
   * was rejected by AppSync and no report ever reached moderation.
   */
  it("sends the schema's fields, and never a `userId`", async () => {
    exec.mockResolvedValue({ data: {} } as never);

    await reportPost({
      postId: "act-1",
      reportedUser: "author-1",
      reporterUser: "me",
      post: "<p>the body</p>",
      type: ReportTargetType.COMMENT,
      reason: "Spam",
    });

    const input = exec.mock.calls[0]![0].variables?.input as Record<string, unknown>;
    expect(input).toEqual({
      postId: "act-1",
      reportedUser: "author-1",
      reporterUser: "me",
      post: "<p>the body</p>",
      type: "COMMENT",
      reason: "Spam",
    });
    expect(input).not.toHaveProperty("userId");
  });

  /** The enum values are the schema's, verified by introspection. */
  it("uses the ReportTypes enum literals", () => {
    expect(ReportTargetType.POST).toBe("POST");
    expect(ReportTargetType.COMMENT).toBe("COMMENT");
    expect(ReportTargetType.JOURNAL).toBe("JOURNAL");
  });

  /** Comments were unreportable on web; the sheet must be reachable for them. */
  it("has a call site that reports a comment", () => {
    const thread = readFileSync("components/groups/PostThread.tsx", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(thread).toMatch(/ReportTargetType\.COMMENT/);
  });
});
