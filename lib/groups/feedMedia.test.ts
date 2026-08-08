import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  extFromMime,
  formatDuration,
  formatFileSize,
  kindOfFile,
  normaliseAttachment,
  normaliseAttachments,
  validateDocument,
} from "./feedMedia";

/** Source assertions must not match the prose that explains the old behaviour. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/**
 * Acceptance check for `feed-media-normaliser-and-render`, WORKLIST Phase 0.
 *
 * The defect: mobile persists an S3 *object reference* with no `url` field, and
 * web's normaliser required `url` — so 100% of mobile-authored attachments were
 * filtered out before render.
 */
describe("normaliseAttachment", () => {
  /** A literal row as `cancerbuddyapp/src/utils/feedMedia.ts:42-53` writes it. */
  const mobileVideo = {
    type: "video",
    bucket: "cancerbuddy-files",
    region: "us-east-1",
    key: "public/abc-123.mov",
    mime: "video/quicktime",
    width: 1920,
    height: 1080,
    duration: 64,
    name: "scan.mov",
    size: 4_194_304,
  };

  it("keeps a mobile video attachment that the old normaliser dropped", () => {
    const result = normaliseAttachments([mobileVideo]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "video",
      bucket: "cancerbuddy-files",
      key: "public/abc-123.mov",
      duration: 64,
    });
  });

  it("keeps images and documents in one pass", () => {
    const result = normaliseAttachments([
      { type: "image", bucket: "b", key: "k1", mime: "image/jpeg" },
      mobileVideo,
      { type: "file", bucket: "b", key: "k3", mime: "application/pdf", name: "r.pdf" },
    ]);
    expect(result.map((a) => a.type)).toEqual(["image", "video", "file"]);
  });

  /** `bucket` + `key` are what can be signed; without them a card has no source. */
  it("drops rows that cannot be signed", () => {
    expect(normaliseAttachments([{ type: "image", key: "k" }])).toEqual([]);
    expect(normaliseAttachments([{ type: "image", bucket: "b" }])).toEqual([]);
    expect(normaliseAttachment(null)).toBeNull();
    expect(normaliseAttachment("nope")).toBeNull();
    expect(normaliseAttachments("not an array")).toEqual([]);
  });

  /** Rows written without an explicit `type` still render as the right thing. */
  it("falls back to the mime type when type is absent", () => {
    expect(normaliseAttachment({ bucket: "b", key: "k", mime: "image/png" })?.type).toBe(
      "image",
    );
    expect(normaliseAttachment({ bucket: "b", key: "k", mime: "video/mp4" })?.type).toBe(
      "video",
    );
    expect(
      normaliseAttachment({ bucket: "b", key: "k", mime: "application/pdf" })?.type,
    ).toBe("file");
    // Nothing to go on at all — a download link is the safe default.
    expect(normaliseAttachment({ bucket: "b", key: "k" })?.type).toBe("file");
  });

  it("accepts the legacy mimeType spelling", () => {
    expect(
      normaliseAttachment({ bucket: "b", key: "k", mimeType: "image/webp" })?.type,
    ).toBe("image");
  });

  it("ignores non-finite numeric fields", () => {
    const a = normaliseAttachment({
      bucket: "b",
      key: "k",
      width: Number.NaN,
      size: "big",
    });
    expect(a?.width).toBeUndefined();
    expect(a?.size).toBeUndefined();
  });
});

describe("display helpers", () => {
  it("formats sizes the way a document card shows them", () => {
    expect(formatFileSize(4_194_304)).toBe("4.0 MB");
    expect(formatFileSize(51_200)).toBe("50 KB");
    expect(formatFileSize(0)).toBeUndefined();
    expect(formatFileSize(undefined)).toBeUndefined();
  });

  it("formats a video duration", () => {
    expect(formatDuration(64)).toBe("1:04");
    expect(formatDuration(9)).toBe("0:09");
    expect(formatDuration(0)).toBeUndefined();
  });
});

describe("the feed renders them", () => {
  it("no longer requires a url, and no longer renders everything as an img", () => {
    const posts = readFileSync("lib/groups/posts.ts", "utf8");
    expect(posts).toMatch(/normaliseAttachments/);
    expect(posts).not.toMatch(/filter\(\(a\) => !!a\.url\)/);

    const card = readFileSync("components/groups/PostCard.tsx", "utf8");
    expect(card).toMatch(/<PostAttachments\s/);
    expect(card).not.toMatch(/src=\{attachment\.url/);
  });

  it("renders per type, and on comments as well as posts", () => {
    const view = readFileSync("components/groups/PostAttachments.tsx", "utf8");
    expect(view).toMatch(/<video/);
    expect(view).toMatch(/DocumentCard/);
    expect(view).toMatch(/<img/);

    const thread = readFileSync("components/groups/PostThread.tsx", "utf8");
    expect(thread).toMatch(/<PostAttachments attachments=\{comment\.attachments\}/);
  });
});

/** Acceptance check for `feed-media-post-composer`, WORKLIST Phase 1. */
describe("attachment validation and key naming", () => {
  it("rejects over 20 MB and accepts exactly 20 MB", () => {
    expect(validateDocument({ size: 21 * 1024 ** 2 }).ok).toBe(false);
    expect(validateDocument({ size: 20 * 1024 ** 2 }).ok).toBe(true);
    expect(validateDocument({ size: 20 * 1024 ** 2 + 1 }).ok).toBe(false);
  });

  it("names the rejection so the composer can pick the right copy", () => {
    expect(validateDocument({ size: 21 * 1024 ** 2 }).reason).toBe("too-large");
  });

  /** iOS reports `video/quicktime`; a `.quicktime` key will not play in a browser. */
  it("maps quicktime to mov, and falls back per kind", () => {
    expect(extFromMime("video/quicktime", "video")).toBe("mov");
    expect(extFromMime("image/jpeg", "image")).toBe("jpeg");
    expect(extFromMime("application/pdf", "file")).toBe("pdf");
    expect(extFromMime(undefined, "image")).toBe("jpg");
    expect(extFromMime(undefined, "video")).toBe("mp4");
    expect(extFromMime(undefined, "file")).toBe("pdf");
  });

  it("classifies a picked file by mime", () => {
    expect(kindOfFile("image/png")).toBe("image");
    expect(kindOfFile("video/mp4")).toBe("video");
    expect(kindOfFile("application/pdf")).toBe("file");
    expect(kindOfFile(undefined)).toBe("file");
  });
});

describe("the composer can attach", () => {
  const composer = readFileSync("components/groups/PostComposer.tsx", "utf8");

  it("offers a picker, a removable tray and an upload step", () => {
    expect(composer).toMatch(/type="file"/);
    expect(composer).toMatch(/accept="image\/\*,video\/\*,application\/pdf"/);
    expect(composer).toMatch(/uploadFeedMedia/);
    expect(composer).toMatch(/removeAttachment/);
  });

  /**
   * `createPost`'s `attachments` is required, so a call site that forgets it
   * fails to compile rather than silently dropping the media — which is exactly
   * what happened while the parameter was optional and nothing passed it.
   */
  it("requires attachments on createPost", () => {
    // Comments stripped — the docblock explains the old optional signature.
    const posts = stripComments(readFileSync("lib/groups/posts.ts", "utf8"));
    expect(posts).toMatch(/attachments:\s*FeedMediaAttachment\[\];/);
    expect(posts).not.toMatch(/attachments\?:\s*unknown\[\]/);
  });

  /**
   * What gets persisted is the object reference. A presigned URL expires in
   * minutes, so storing one would leave the post broken shortly after posting.
   *
   * Asserted on the type and the returned literal rather than the whole file:
   * `measure()` legitimately creates and revokes a local blob URL to read image
   * dimensions, which is not a stored value.
   */
  it("stores a reference, never a url", () => {
    const media = stripComments(readFileSync("lib/groups/feedMedia.ts", "utf8"));

    const iface = media.slice(
      media.indexOf("export interface FeedMediaAttachment"),
      media.indexOf("function str("),
    );
    expect(iface).toMatch(/bucket:\s*string;/);
    expect(iface).toMatch(/region:\s*string;/);
    expect(iface).toMatch(/key:\s*string;/);
    expect(iface).not.toMatch(/\burl\b/);

    const body = media.slice(
      media.indexOf("export async function uploadFeedMedia"),
      media.indexOf("async function measure("),
    );
    expect(body).toMatch(/bucket,/);
    expect(body).toMatch(/region,/);
    expect(body).toMatch(/key,/);
    expect(body).not.toMatch(/\burl\b/);
  });
});
