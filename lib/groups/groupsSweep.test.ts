import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/aws/appsyncGraphql", () => ({
  executeAppSyncGraphql: vi.fn(),
}));
vi.mock("@/lib/aws/s3Image", () => ({
  getS3ImageUrl: vi.fn(async () => undefined),
}));

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { BMCF_CONTACT_EMAIL } from "@/lib/constants/contact";
import en from "@/lib/i18n/locales/en";
import { widgetSrc } from "@/components/groups/GroupWidget";
import { fetchGroupMembers } from "./members";
import { canReplyPrivately } from "./moderation";
import { commentToHtml, htmlToPlainText } from "./richText";
import { sanitizePostHtml } from "./sanitizeHtml";

const exec = vi.mocked(executeAppSyncGraphql);

/** Source with comments stripped — otherwise an assertion matches the prose. */
function sourceOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

/* ── groups-comment-html-and-identity ───────────────────────────────────── */

describe("comment bodies are HTML", () => {
  /** Mobile sends `text.replaceAll('\n','<br>')`; web sent raw newlines. */
  it("stores line breaks as <br>", () => {
    expect(commentToHtml("line1\nline2")).toBe("line1<br>line2");
    expect(commentToHtml("a\r\nb\rc")).toBe("a<br>b<br>c");
  });

  it("renders a mobile-authored <br> as a break, not as text", () => {
    const html = sanitizePostHtml("line1<br>line2");
    expect(html).toContain("<br>");
    expect(html).not.toContain("&lt;br&gt;");
  });

  it("still strips anything dangerous a comment carries", () => {
    const html = sanitizePostHtml('hi<script>alert(1)</script><b onclick="x()">there</b>');
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(html).toContain("<b>there</b>");
  });

  /** The thread renders the body as markup and shows who wrote it. */
  it("the thread renders comment HTML and the author's identity", () => {
    const thread = sourceOf("components/groups/PostThread.tsx");
    expect(thread).toMatch(/dangerouslySetInnerHTML=\{\{\s*__html:\s*sanitizePostHtml\(comment\.text\)/);
    expect(thread).toMatch(/ageSuffix\(/);
    expect(thread).toMatch(/author\.groupHostId === post\.feedId/);
    expect(thread).toMatch(/author\?\.ambassador/);
  });

  /** And it sends what it renders. */
  it("the composer converts a typed newline before sending", () => {
    const thread = sourceOf("components/groups/PostThread.tsx");
    expect(thread).toMatch(/const body = commentToHtml\(text\)/);
  });
});

/* ── groups-comment-edit-and-report ─────────────────────────────────────── */

describe("comments can be edited and reported", () => {
  /** `editComment` existed and had no caller anywhere under components/. */
  it("editComment has a call site in the thread", () => {
    const thread = sourceOf("components/groups/PostThread.tsx");
    expect(thread).toMatch(/editComment\(session, target\.comment\.id/);
  });

  /** `fetchNextReactions` was written in Phase 0 and had no caller at all. */
  it("the thread pages past the first 25 comments", () => {
    const posts = sourceOf("lib/groups/posts.ts");
    expect(posts).toMatch(/fetchNextReactions\(session, nextUrl\)/);
    const thread = sourceOf("components/groups/PostThread.tsx");
    expect(thread).toMatch(/fetchMoreComments\(session, nextComments, loadAuthor\)/);
  });

  it("comments have a ⋯ menu at all", () => {
    const thread = sourceOf("components/groups/PostThread.tsx");
    expect(thread).toMatch(/CommentActionsSheet/);
    expect(thread).toMatch(/onOpenActions\(comment, depth > 0\)/);
  });

  /**
   * The edit round trip. The editor is a plain textarea — as mobile's is — so a
   * stored `<br>` has to come back as a newline and go out as a `<br>` again,
   * or every edit flattens the comment a little further.
   */
  it("edits round-trip a line break", () => {
    const stored = "one<br>two";
    const editable = htmlToPlainText(stored);
    expect(editable).toBe("one\ntwo");
    expect(commentToHtml(editable)).toBe(stored);
  });
});

/* ── groups-reply-privately ─────────────────────────────────────────────── */

describe("canReplyPrivately — mobile's eight combinations", () => {
  const base = { viewerId: "me", authorId: "them" };

  const cases: [string, string, string, string, boolean][] = [
    ["HOST", "PATIENT", "me", "them", true],
    ["SUPPORT", "PATIENT", "me", "them", true],
    ["PATIENT", "PATIENT", "me", "them", false],
    ["CAREGIVER", "PATIENT", "me", "them", false],
    ["HOST", "SUPPORT", "me", "them", false],
    ["SUPPORT", "SUPPORT", "me", "them", false],
    ["HOST", "PATIENT", "me", "me", false],
    ["SUPPORT", "PATIENT", "me", "me", false],
  ];

  for (const [viewerType, authorType, viewerId, authorId, expected] of cases) {
    it(`${viewerType} → ${authorType}${viewerId === authorId ? " (self)" : ""} = ${expected}`, () => {
      expect(
        canReplyPrivately({ viewerType, authorType, viewerId, authorId }),
      ).toBe(expected);
    });
  }

  it("needs both ids", () => {
    expect(canReplyPrivately({ ...base, viewerType: "HOST", authorId: "" })).toBe(false);
    expect(canReplyPrivately({ ...base, viewerType: "HOST", viewerId: null })).toBe(false);
  });
});

describe("both host-DM entry points share one implementation", () => {
  it("reply-privately and ask-the-host both go through resolveOrCreateDirectChannel", () => {
    const hook = sourceOf("lib/groups/useReplyPrivately.ts");
    expect(hook).toMatch(/resolveOrCreateDirectChannel/);
    expect(hook).toMatch(/useReplyPrivately/);
    expect(hook).toMatch(/useAskTheHost/);
    // One ladder, called from one place inside the module.
    expect(hook.match(/resolveOrCreateDirectChannel\(/g)).toHaveLength(1);
  });

  it("the ask-the-host link is absent when the viewer is the host", () => {
    const dialog = sourceOf("components/groups/JoinGroupDialog.tsx");
    expect(dialog).toMatch(/host\.id !== userId/);
  });
});

/* ── groups-member-row-diagnoses ────────────────────────────────────────── */

describe("group member rows carry diagnoses", () => {
  beforeEach(() => {
    exec.mockReset();
  });

  it("selects mobile's Diagnosis shape", async () => {
    exec.mockResolvedValue({ data: { userGroupsByGroupId: { items: [] } } } as never);
    await fetchGroupMembers({ groupId: "G1" });

    const query = (exec.mock.calls[0]![0] as { query: string }).query;
    expect(query).toMatch(/Diagnosis\s*\{\s*list:\s*items\s*\{\s*item:\s*diagnosis\s*\{\s*name/);
  });

  it("maps them to names", async () => {
    exec.mockResolvedValue({
      data: {
        userGroupsByGroupId: {
          items: [
            {
              id: "ug-1",
              User: {
                id: "u1",
                name: "Ada Lovelace",
                Diagnosis: {
                  list: [
                    { item: { name: "Hodgkin lymphoma" } },
                    { item: { name: "Anemia" } },
                    { item: null },
                    null,
                  ],
                },
              },
            },
          ],
        },
      },
    } as never);

    const page = await fetchGroupMembers({ groupId: "G1" });
    expect(page.members[0]!.diagnoses).toEqual(["Hodgkin lymphoma", "Anemia"]);
  });

  it("renders them on the row", () => {
    const rows = sourceOf("components/groups/GroupMembers.tsx");
    expect(rows).toMatch(/member\.diagnoses\.join\(", "\)/);
  });
});

/* ── groups-discover-pre-join-detail / -empty-contact ───────────────────── */

describe("Discover", () => {
  it("every row links to the group, not only a Join button", () => {
    const discover = sourceOf("components/groups/DiscoverGroups.tsx");
    expect(discover).toMatch(/<Link\s+href=\{`\/groups\/\$\{group\.id\}`\}/);
  });

  it("a non-member sees the hosts and sponsor when they follow it", () => {
    const feed = sourceOf("components/groups/GroupFeed.tsx");
    expect(feed).toMatch(/!member && \(/);
    expect(feed).toMatch(/GroupDetailBody/);

    // The same block the info sheet renders — no second copy of it.
    const sheets = sourceOf("components/groups/GroupSheets.tsx");
    expect(sheets).toMatch(/export function GroupDetailBody/);
    expect(sheets.match(/app\.groups\.sponsoredBy/g)).toHaveLength(1);
  });

  it("the empty state carries the contact address and a copy control", () => {
    const discover = sourceOf("components/groups/DiscoverGroups.tsx");
    expect(discover).toMatch(/BMCF_CONTACT_EMAIL/);
    expect(discover).toMatch(/app\.groups\.copyMail/);
    expect(discover).toMatch(/clipboard\.writeText\(BMCF_CONTACT_EMAIL\)/);
  });

  /** One constant, shared with every other surface that shows the address. */
  it("has exactly one definition of the address", () => {
    expect(BMCF_CONTACT_EMAIL).toBe("cancerbuddy@bonemarrow.org");
    expect(en.common.supportEmail).toBe(BMCF_CONTACT_EMAIL);
  });
});

/* ── groups-widget-tab ──────────────────────────────────────────────────── */

describe("the group widget tab", () => {
  it("reads the fields that were fetched and thrown away", () => {
    const feed = sourceOf("components/groups/GroupFeed.tsx");
    expect(feed).toMatch(/displayGroup\?\.widgetAvailable/);
    expect(feed).toMatch(/displayGroup\.widget\?\.url/);
    expect(feed).toMatch(/widget\?\.tab1/);
    expect(feed).toMatch(/widget\?\.tab2/);
  });

  it("only ever frames an http(s) URL", () => {
    expect(widgetSrc("https://example.org/x")).toBe("https://example.org/x");
    expect(widgetSrc("http://example.org")).toBe("http://example.org");
    expect(widgetSrc("javascript:alert(1)")).toBeNull();
    expect(widgetSrc("data:text/html,<h1>x</h1>")).toBeNull();
    expect(widgetSrc("")).toBeNull();
    expect(widgetSrc(null)).toBeNull();
  });

  it("sandboxes the frame without granting it our origin", () => {
    const widget = sourceOf("components/groups/GroupWidget.tsx");
    expect(widget).toMatch(/sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"/);
    expect(widget).not.toMatch(/allow-same-origin/);
    expect(widget).not.toMatch(/allow-top-navigation/);
  });

  /**
   * Build-time guard. There is no CSP on this app today; the day one appears it
   * must permit widget origins in `frame-src` or this tab renders an empty box.
   */
  it("any CSP that appears must declare frame-src", () => {
    const config = readFileSync("next.config.ts", "utf8");
    const declaresCsp = /key:\s*"Content-Security-Policy"/.test(config);
    if (declaresCsp) expect(config).toMatch(/frame-src/);
    else expect(declaresCsp).toBe(false);
  });
});
