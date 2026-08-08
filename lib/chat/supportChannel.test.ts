import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/aws/raiseUserLambda", () => ({ raiseUserLambda: vi.fn() }));
vi.mock("@/lib/aws/appsyncGraphql", () => ({ executeAppSyncGraphql: vi.fn() }));

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import {
  bootstrapSupportChannelAfterEnrollment,
  type SupportStreamClient,
} from "@/lib/host-signup/bootstrapSupportChannel";
import { shouldPromptForPhone } from "@/lib/profile/phoneStatus";

const invoke = vi.mocked(raiseUserLambda);
const graphql = vi.mocked(executeAppSyncGraphql);

const read = (p: string) =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** Records the order of every side effect, which is what this item is about. */
function stubClient(existing: { id?: string }[] = []) {
  const calls: string[] = [];
  const channel = {
    create: vi.fn(async () => {
      calls.push("channel.create");
    }),
    watch: vi.fn(async () => {
      calls.push("channel.watch");
    }),
  };
  const client: SupportStreamClient = {
    queryChannels: vi.fn(async () => {
      calls.push("queryChannels");
      return existing;
    }),
    channel: vi.fn(() => {
      calls.push("client.channel");
      return channel;
    }),
  };
  return { client, calls, channel };
}

/** Acceptance check for `chat-support-channel-creation`, WORKLIST Phase 2. */
describe("bootstrapSupportChannelAfterEnrollment", () => {
  beforeEach(() => {
    invoke.mockReset();
    graphql.mockReset();
    process.env.NEXT_PUBLIC_USERS_LAMBDA = "users-demo";

    invoke.mockImplementation(async (verb: string) => {
      if (verb === "createSupportConnection") {
        return JSON.stringify({
          statusCode: 200,
          body: { listConnections: [{ supportId: "support-1" }] },
        });
      }
      return JSON.stringify({ statusCode: 200 });
    });

    graphql.mockImplementation((async (args: { query: string }) =>
      args.query.includes("createConnection")
        ? { data: { createConnection: { id: "conn-1" } } }
        : { data: { updateConnection: { id: "conn-1" } } }) as never);
  });

  /**
   * The defect: there was no `client.channel` call at all. The `supportMessage`
   * Lambda posts into a channel it does not create, so a browser signup left a
   * connection row and a message with nowhere to live — and the member's chat
   * list showed no Support thread.
   */
  it("creates the Stream channel before asking the Lambda to post into it", async () => {
    const { client, calls } = stubClient();

    await expect(
      bootstrapSupportChannelAfterEnrollment({ cognitoUserId: "me", client }),
    ).resolves.toBe(true);

    expect(calls).toContain("client.channel");
    expect(calls).toContain("channel.create");
    expect(calls).toContain("channel.watch");

    const channelAt = calls.indexOf("client.channel");
    const messageAt = invoke.mock.calls.findIndex(
      ([verb]) => verb === "supportMessage",
    );
    expect(channelAt).toBeGreaterThan(-1);
    expect(messageAt).toBeGreaterThan(-1);
    // The channel must exist before the welcome message is requested.
    expect(calls.indexOf("channel.watch")).toBeGreaterThan(channelAt - 1);
  });

  /** A second run must not create a second conversation beside the first. */
  it("stops when the pair already has a channel", async () => {
    const { client, calls } = stubClient([{ id: "existing-1" }]);

    await expect(
      bootstrapSupportChannelAfterEnrollment({ cognitoUserId: "me", client }),
    ).resolves.toBe(true);

    expect(calls).not.toContain("client.channel");
    expect(graphql).not.toHaveBeenCalled();
    expect(invoke.mock.calls.some(([v]) => v === "supportMessage")).toBe(false);
  });

  /**
   * Without a client nothing can be created, so it defers rather than leaving a
   * connection row and a message with no channel — the state that produced the
   * missing Support thread in the first place.
   */
  it("does nothing at all when there is no Stream client", async () => {
    await expect(
      bootstrapSupportChannelAfterEnrollment({ cognitoUserId: "me" }),
    ).resolves.toBe(false);

    expect(invoke).not.toHaveBeenCalled();
    expect(graphql).not.toHaveBeenCalled();
  });
});

/** Acceptance check for `chat-support-bootstrap-retry`. */
describe("the chat list finishes what signup deferred", () => {
  const hook = read("lib/chat/useSupportChannelBootstrap.ts");
  const list = read("components/chat/ConversationList.tsx");
  const finalize = read("lib/user-signup/userEnrollmentFinalize.ts");

  it("runs only when the marker is set, and once per mount", () => {
    expect(hook).toMatch(/getItem\(PENDING_SUPPORT_KEY\) !== "true"/);
    expect(hook).toMatch(/ranRef\.current/);
  });

  it("clears the marker on success only, so a failure retries next visit", () => {
    expect(hook).toMatch(/if \(wired\) window\.localStorage\.removeItem\(PENDING_SUPPORT_KEY\)/);
  });

  it("is mounted on the chat list", () => {
    expect(list).toMatch(/useSupportChannelBootstrap\(/);
  });

  /**
   * The marker used to be set only when the bootstrap *threw*. The common case
   * is neither success nor an exception — enrolment has no client, so it defers
   * and returns false — and clearing it there meant the retry never ran.
   */
  it("signup sets the marker whenever provisioning did not complete", () => {
    expect(finalize).toMatch(
      /if \(supportWired\) \{[\s\S]*?removeItem\(PENDING_SUPPORT_CHANNEL_KEY\);[\s\S]*?\} else \{[\s\S]*?setItem\(PENDING_SUPPORT_CHANNEL_KEY, "true"\)/,
    );
    expect(finalize).not.toMatch(/else if \(bootstrapThrew\)/);
  });
});

/** Acceptance check for `phone-verify-post-signup`, WORKLIST Phase 2. */
describe("prompting for a missing phone number", () => {
  it("asks only when there is definitively no number", () => {
    expect(shouldPromptForPhone(null, false)).toBe(true);
    expect(shouldPromptForPhone("+14155551234", false)).toBe(false);
  });

  /** The read-failure sentinel counts as "has one" — a blip must not interrupt. */
  it("does not ask when the read failed", () => {
    expect(shouldPromptForPhone("unknown", false)).toBe(false);
  });

  it("does not ask again once dismissed this session", () => {
    expect(shouldPromptForPhone(null, true)).toBe(false);
  });

  it("reuses the signup phone service rather than reimplementing Twilio", () => {
    const dialog = read("components/profile/PhoneCaptureDialog.tsx");
    expect(dialog).toMatch(/cognitoUserSignupService\.startPhoneVerification/);
    expect(dialog).toMatch(/cognitoUserSignupService\.confirmPhone/);
    expect(dialog).toMatch(/phoneSchema/);
    expect(dialog).toMatch(/phoneOtpSchema/);
  });

  /** E.164 needs a country, so it reuses the wizard's control. */
  it("uses the shared country-aware phone input", () => {
    const dialog = read("components/profile/PhoneCaptureDialog.tsx");
    expect(dialog).toMatch(/<PhoneInput/);
    expect(dialog).toMatch(/buildE164\(countryIso2, national\)/);
  });

  it("is mounted where a member will meet it", () => {
    const list = read("components/chat/ConversationList.tsx");
    expect(list).toMatch(/<PhoneCaptureDialog/);
    expect(list).toMatch(/shouldPromptForPhone\(/);
  });
});
