import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/aws/raiseUserLambda", () => ({ raiseUserLambda: vi.fn() }));

import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import {
  buildAskToHostAttachment,
  buildReplyHostAttachment,
  chatPrefill,
  emptyThreadCopy,
  notifyReplyHost,
} from "./contextEntry";

const invoke = vi.mocked(raiseUserLambda);
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** Acceptance check for `chat-context-entry-points`, WORKLIST Phase 2. */
describe("chatPrefill", () => {
  /**
   * Mobile's literals, verbatim (`ChatMessagesInput.tsx:70-78`). The recipient
   * expects these exact sentences; rewording would make the same request read
   * differently depending on which app the sender used.
   */
  it("matches mobile's ReplyHost sentence", () => {
    expect(
      chatPrefill({ type: "ReplyHost", hostName: "Grace", groupName: "Teens" }),
    ).toBe('Hi Grace, related to your post on "Teens", take a look at the responses.');
  });

  it("matches mobile's AskToHost sentence", () => {
    expect(chatPrefill({ type: "AskToHost", groupName: "Teens" })).toBe(
      "Could you provide me with the access code to join the Teens private group?",
    );
  });
});

describe("emptyThreadCopy", () => {
  /** A host replying about their own post should not be warned about medical advice. */
  it("drops the medical-advice caution for ReplyHost", () => {
    expect(emptyThreadCopy("ReplyHost")).toBe(
      "This is the beginning of your conversation.",
    );
  });

  it("keeps it for everything else", () => {
    for (const type of ["AskToHost", null, undefined] as const) {
      expect(emptyThreadCopy(type)).toMatch(/medical advice/);
    }
  });
});

describe("the attachments carry what the card needs", () => {
  it("builds the ReplyHost shape mobile sends", () => {
    expect(buildReplyHostAttachment({ id: "p1", feedId: "f1", actor: "u1" })).toEqual({
      type: "ReplyHost",
      image_url: "",
      post: { id: "p1", feedId: "f1", actor: "u1" },
    });
  });

  it("builds the AskToHost shape mobile sends", () => {
    expect(buildAskToHostAttachment({ id: "g1", name: "Teens" })).toEqual({
      type: "AskToHost",
      group: { id: "g1", name: "Teens" },
    });
  });
});

describe("notifyReplyHost", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue("{}");
    process.env.NEXT_PUBLIC_USERS_LAMBDA = "users-demo";
  });

  it("posts the five fields mobile posts", async () => {
    await notifyReplyHost({
      post: { id: "p1", feedId: "f1", actor: "author-1" },
      channelId: "c1",
      senderId: "me",
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    const [verb, fn, payload] = invoke.mock.calls[0]!;
    expect(verb).toBe("replyMessage");
    expect(fn).toBe("users-demo");
    expect(payload).toMatchObject({
      type: "replyMessage",
      groupId: "f1",
      feedId: "f1",
      activityId: "c1",
      remitentId: "me",
      userId: "author-1",
    });
  });

  /** The message is already sent by then, so this must not read as a send failure. */
  it("swallows a failure", async () => {
    invoke.mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    await expect(
      notifyReplyHost({ post: { id: "p1" }, channelId: "c1", senderId: "me" }),
    ).resolves.toBeUndefined();
  });
});

describe("the conversation screen wires it up", () => {
  const screen = stripComments(
    readFileSync("components/chat/ActiveConversation.tsx", "utf8"),
  );

  it("reads the context out of the query string", () => {
    expect(screen).toMatch(/searchParams\.get\("ctx"\)/);
    expect(screen).toMatch(/chatPrefill\(/);
  });

  it("attaches the context to the first message only", () => {
    expect(screen).toMatch(/contextSentRef/);
    expect(screen).toMatch(/await send\(text, contextAttachment\)/);
  });

  it("fires the notification for ReplyHost and not for AskToHost", () => {
    // `[\s\S]*` rather than the `s` flag: tsconfig targets ES2017.
    expect(screen).toMatch(/contextType === "ReplyHost"[\s\S]*notifyReplyHost/);
  });

  it("uses the context-aware empty-thread copy", () => {
    expect(screen).toMatch(/emptyThreadCopy\(contextType\)/);
  });
});
