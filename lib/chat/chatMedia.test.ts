import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  IMAGE_MAX_SIDE,
  MAX_CHAT_FILE_MB,
  buildChatAttachment,
  scaledDimensions,
  validateChatFile,
} from "./chatMedia";
import { mapContextAttachments } from "./useChannelMessages";

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** Acceptance check for `chat-media-send-pipeline`, WORKLIST Phase 1. */
describe("validateChatFile", () => {
  it("rejects 21 MB with mobile's exact copy and passes 19 MB", () => {
    const rejected = validateChatFile({ size: 21 * 1024 ** 2 });
    expect(rejected.ok).toBe(false);
    // Byte-identical to `useChatMediaPicker.ts:128`, so both apps say the same.
    expect(rejected.message).toBe(
      `The file is too large. Maximum size is ${MAX_CHAT_FILE_MB} MB.`,
    );

    expect(validateChatFile({ size: 19 * 1024 ** 2 }).ok).toBe(true);
    expect(validateChatFile({ size: 20 * 1024 ** 2 }).ok).toBe(true);
  });
});

describe("image scaling", () => {
  /** Mobile compresses to 1280 on the longest side at quality 0.8. */
  it("shrinks a 3000×2000 photo to a 1280 longest side, keeping the ratio", () => {
    expect(scaledDimensions(3000, 2000)).toEqual({ width: 1280, height: 853 });
    expect(scaledDimensions(2000, 3000)).toEqual({ width: 853, height: 1280 });
  });

  it("never scales an already-small image up", () => {
    expect(scaledDimensions(640, 480)).toEqual({ width: 640, height: 480 });
    expect(scaledDimensions(IMAGE_MAX_SIDE, 100)).toEqual({
      width: IMAGE_MAX_SIDE,
      height: 100,
    });
  });
});

describe("buildChatAttachment", () => {
  /** Without these the thread jumps as each image loads. */
  it("carries original dimensions on an image", () => {
    expect(
      buildChatAttachment({
        url: "https://cdn/x.jpg",
        file: { name: "x.jpg", type: "image/jpeg", size: 1000 },
        width: 1280,
        height: 853,
      }),
    ).toMatchObject({
      type: "image",
      image_url: "https://cdn/x.jpg",
      original_width: 1280,
      original_height: 853,
    });
  });

  /** `file_size` is what the document card shows. */
  it("carries mime type and size on a document", () => {
    expect(
      buildChatAttachment({
        url: "https://cdn/r.pdf",
        file: { name: "r.pdf", type: "application/pdf", size: 1_258_291 },
      }),
    ).toMatchObject({
      type: "file",
      asset_url: "https://cdn/r.pdf",
      title: "r.pdf",
      mime_type: "application/pdf",
      file_size: 1_258_291,
    });
  });

  it("marks a video as a video, not a generic file", () => {
    expect(
      buildChatAttachment({
        url: "https://cdn/v.mp4",
        file: { name: "v.mp4", type: "video/mp4", size: 5000 },
      }),
    ).toMatchObject({ type: "video", asset_url: "https://cdn/v.mp4" });
  });
});

/** Acceptance check for `chat-media-render`. */
describe("the chat renders what it receives", () => {
  const hook = stripComments(readFileSync("lib/chat/useChannelMessages.ts", "utf8"));
  const bubble = stripComments(readFileSync("components/chat/MessageBubble.tsx", "utf8"));
  /**
   * Read raw, not through `stripComments`: the `accept` value contains
   * `image/*`, and a naive block-comment strip treats that `/*` as a comment
   * opener and swallows the rest of the file.
   */
  const composer = readFileSync("components/chat/MessageComposer.tsx", "utf8");

  /**
   * The defect: video fell through to the `asset_url` branch and became a
   * download link, so an incoming video could not be watched in the app.
   */
  it("maps video to its own type rather than file", () => {
    expect(hook).toMatch(/const isVideo =/);
    expect(hook).toMatch(/type: isVideo \? "video" : "file"/);
  });

  it("surfaces file size and original dimensions", () => {
    expect(hook).toMatch(/size: a\.file_size/);
    expect(hook).toMatch(/width: a\.original_width/);
    expect(hook).toMatch(/height: a\.original_height/);
  });

  it("plays video inline and shows a size on document cards", () => {
    expect(bubble).toMatch(/<video/);
    expect(bubble).toMatch(/formatFileSize\(a\.size\)/);
  });

  /** A tall photo was cropped square, losing the point of the message. */
  it("does not crop images to a square", () => {
    expect(bubble).toMatch(/object-contain/);
    expect(bubble).not.toMatch(/max-h-64 max-w-full rounded-2xl object-cover/);
  });

  it("lets a member pick a video at all", () => {
    expect(composer).toMatch(/accept="[^"]*video\/\*/);
  });

  it("validates, compresses and guards against a double send", () => {
    expect(hook).toMatch(/validateChatFile\(/);
    expect(hook).toMatch(/compressChatImage\(/);
    expect(hook).toMatch(/sendingFilesRef/);
  });
});

/** Acceptance check for `chat-context-attachment-cards`, WORKLIST Phase 2. */
describe("mapContextAttachments", () => {
  it("keeps an AskToHost group that the mapper used to drop", () => {
    expect(mapContextAttachments([{ type: "AskToHost", group: { id: "g1", name: "Teens" } }]))
      .toEqual([{ type: "askToHost", group: { id: "g1", name: "Teens" } }]);
  });

  it("keeps a ReplyHost post", () => {
    expect(
      mapContextAttachments([{ type: "ReplyHost", post: { id: "p1", feedId: "f1" } }]),
    ).toEqual([{ type: "replyHost", post: { id: "p1", feedId: "f1" } }]);
  });

  /** Mobile's own test: some ReplyHost payloads carry the post without the type. */
  it("recognises a post payload that omits the type", () => {
    expect(mapContextAttachments([{ post: { id: "p1", feedId: "f1" } }])).toEqual([
      { type: "replyHost", post: { id: "p1", feedId: "f1" } },
    ]);
  });

  it("ignores media attachments", () => {
    expect(
      mapContextAttachments([{ type: "image", image_url: "https://cdn/x.jpg" }]),
    ).toEqual([]);
    expect(mapContextAttachments(undefined)).toEqual([]);
  });

  /** And the media mapper must not claim them either, or they render twice. */
  it("is disjoint from the media mapper", () => {
    const hook = stripComments(readFileSync("lib/chat/useChannelMessages.ts", "utf8"));
    expect(hook).toMatch(
      /if \(a\.type === "AskToHost" \|\| a\.type === "ReplyHost" \|\| a\.post\) continue;/,
    );
  });
});

describe("context messages survive and render", () => {
  const hook = stripComments(readFileSync("lib/chat/useChannelMessages.ts", "utf8"));
  const bubble = stripComments(readFileSync("components/chat/MessageBubble.tsx", "utf8"));
  const card = stripComments(readFileSync("components/chat/ContextAttachment.tsx", "utf8"));

  /** A message with no text but a quoted group was filtered out entirely. */
  it("a text-less message with context is not treated as empty", () => {
    expect(hook).toMatch(/m\.context\.length > 0/);
  });

  it("renders the jump links and the not-found state", () => {
    expect(card).toMatch(/goToGroup/);
    expect(card).toMatch(/goToComment/);
    expect(card).toMatch(/commentNotFound/);
    expect(card).toMatch(/href=\{`\/groups\/\$\{group\.id\}`\}/);
    expect(card).toMatch(/href=\{`\/groups\/\$\{post\.feedId\}\?post=\$\{post\.id\}`\}/);
  });

  /** The attachment cannot be re-authored, so editing would strip it. */
  it("offers no Edit on a message carrying context", () => {
    expect(bubble).toMatch(/message\.context\.length === 0/);
  });

  it("sanitises the quoted post body", () => {
    expect(card).toMatch(/sanitizePostHtml\(post\.object\)/);
  });
});
