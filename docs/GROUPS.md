# Groups & feeds (`/groups`)

The web port of mobile's **Groups** tab (`TabsNavigator.Feeds`). Architecture —
which of the three transports owns which concern — is in
`lib/groups/posts.ts` and the module docblocks; this file records the parts of
the **Phase 3 parity sweep** that are not obvious from the code, and the traps
that cost real time.

Mobile sources: `cancerbuddyapp/src/screens/feeds/**`,
`src/components/layouts/Groups/**`. Read them before changing anything here.

---

## 1. A report from the web app never reached moderation

`CreateReportPostInput`, introspected against the live schema on 2026-08-08:

```
id, postId, reportedUser, reporterUser, post, reason, type, createdAt
```

There is **no `userId` field**. Web sent `{postId, userId, reason}`, and AppSync
rejects an input object carrying a field the type does not declare — so every
report failed validation while the member was shown "Thanks — our team will
review it."

`lib/groups/reporting.ts` now owns the payload, the reasons list and the submit
gate. Three things travel with a report that did not before: the reported member
(`reportedUser`), the content itself (`post`), and whether it was a post or a
comment (`type`, the `ReportTypes` enum — `POST` / `COMMENT` / `JOURNAL`).
Choosing *Other* opens a 1000-character box and submits **that text** as the
reason, not the word "Other" — mobile's `state === 'Other' ? stateInput : state`.

`reportPost` takes all six fields as required parameters. That is deliberate: the
old three-field call site had to stop compiling.

---

## 2. Comment bodies are HTML on both clients

Mobile sends `comment.replaceAll('\n', '<br>')` (`PostDetails.tsx:273`) and
renders through `RenderHtml`. Web stored raw newlines and rendered plain text
with `whitespace-pre-line`, so a line break written on a phone arrived on the web
as the literal characters `<br>`.

`commentToHtml()` in `lib/groups/richText.ts` is the storage direction;
`sanitizePostHtml()` is the render direction. Both are needed — dropping either
one puts the two clients back out of step.

**Deliberately not escaped.** Mobile does not escape a comment before storing it,
so a member who types `<b>` gets bold on both clients. Escaping on web alone
would make the same keystrokes mean different things depending on which app
happened to be open. Safety on the web side is the sanitiser at render, which is
the same allowlist post bodies go through.

The editor is a plain textarea (mobile's `EditComment.modal` is too), so the
round trip is `htmlToPlainText` in, `commentToHtml` out. A test pins it: without
both halves every edit flattens the comment a little further.

---

## 3. Two host-DM entry points, one ladder

"Reply privately" (a host messaging a post's author) and "Ask the host" (a member
asking for a private group's code) are the only two routes between Groups and
Chat, and web had neither — the Groups tab never opened a conversation at all.

Both go through `lib/chat/directChannel.ts`:

```
queryChannels({type:'messaging', members:{$eq:[me,them]}})
  → found?  use its id
  → none?   createConnection → AcceptConnection → channel(id).create()/watch()
```

The connection row's id **is** the channel id. Two things follow from that, and
both are load-bearing:

- If the Stream lookup fails, the ladder gives up rather than falling through to
  `createConnection`. A duplicate connection row for a pair who already have one
  is the single failure here that nothing can undo.
- The channel `name` is written as mobile writes it: `"<their first name> Host"`
  for a private reply and `"<my name> Ambassador"` for ask-the-host. The second
  is plainly a copy-paste from the ambassador flow — and it is what every
  mobile-created ask-the-host channel is called, so web writes the same thing
  rather than a tidier name the two clients would disagree about.

Navigation lands on `/chat/<id>?ctx=ReplyHost&…`, which is the contract Phase 2
built: `ActiveConversation` reads the query string, pre-fills the sentence and
attaches the group or post to the first message.

**Divergence, stated.** Mobile attaches a *screenshot* of the post taken with
`react-native-view-shot`. Web attaches the post itself, which Phase 2's
`ContextAttachment` renders as a card with a jump link — the thing the screenshot
stood in for, and it stays correct when the post is edited. For a **comment**,
web attaches the parent post rather than the reaction: mobile attaches the
reaction, whose id resolves to nothing on the other side, so the recipient lands
on "content not found".

---

## 4. Retries: two different failures, two different answers

| Where | Mobile | Web |
|---|---|---|
| Group feed returns an empty page | up to 3 retries, 1500 ms apart, spinner stays up (`activities-feed.tsx:34,171-194`) | `fetchGroupPostsWithEmptyRetry`, same budget, **first page only** |
| Thread fetch returns nothing | one retry after 1200 ms, then `CONTENT NOT FOUND` (`PostDetails.tsx:112-125`) | `fetchPostCommentsWithRetry`, same delay |

Two details worth keeping:

- The feed retry applies to **page 0 only**. An empty *later* page is how paging
  ends; retrying it would turn the end of every feed into three dead round trips.
- The thread retry also covers a **rejection**, where mobile's does not — mobile's
  `try` wraps both attempts, so a thrown first attempt skips its own retry. On the
  web a single failed request is the commonest case there is.

`CONTENT NOT FOUND` is shown only when the thread has *never* loaded. A later
empty answer leaves what is on screen alone, exactly as mobile's `hasLoadedRef`
does — otherwise a blip erases a thread the member is reading.

---

## 5. Comment paging

`latest_reactions_extra.comment.next` was in every enriched-activity response and
was never read, so a thread stopped at the first 25 comments with no way to reach
the rest. `fetchMoreComments` follows it.

Stream hands that cursor back in three shapes — absolute, `/api/v1.0/…`-relative,
and already trimmed. `relativeStreamPath()` reduces all three; mobile strips them
by hand at each call site and gets it subtly different in two places.

---

## 6. The `NEW` badge is persisted, and that is a deliberate divergence

Mobile keeps pushed-post markers in React state (`hasPostMessage`), so they live
as long as the app process — days. A browser tab is closed and reopened
constantly, and an in-memory marker would be one nobody ever saw.
`lib/groups/unreadPosts.ts` writes group ids to `localStorage` (ids only —
nothing about a person or a message).

The plumbing: the service worker posts **every** push payload to **every** open
tab (`cancerbuddy:push-data`), separately from the focused-tab toast. A badge is
per-tab state and must not depend on which window has focus. `PushBridge` marks
the group; opening the group — or one of its posts from a notification — clears
it.

---

## 7. The widget tab

`widgetAvailable` and `widget {tab1 tab2 url}` were queried, typed, and thrown
away. They are now a second tab over the feed, as on mobile.

The frame is sandboxed with `allow-scripts allow-forms allow-popups
allow-popups-to-escape-sandbox` — and deliberately **without** `allow-same-origin`
(so it cannot reach our storage) or `allow-top-navigation` (so it cannot navigate
the app away). `allow-popups-to-escape-sandbox` is the browser equivalent of
mobile's `onShouldStartLoadWithRequest` handing external links to the OS browser.

**There is no `Content-Security-Policy` on this app yet** (`next.config.ts` says
why). If one is added it must carry a `frame-src` that permits widget origins, or
this tab renders an empty box. `lib/groups/groupsSweep.test.ts` fails the build if
a CSP appears without one.

---

## 8. Tapping an author

Mobile's branch order (`usePostActions.handleAvatarPress`), reproduced in
`lib/groups/authorLink.ts`:

1. author hosts a group, and it is **not** this one → `/groups/hosts/<id>`
2. author hosts a group, and it **is** this one → `/groups/<id>`
3. otherwise → `/buddies/<id>`

Mobile also computes `showButtons` before navigating, from the **strict**
`connectAgeRules` — the one rule that closes the 13–17 band at both ends, so an
adult and a teen never match. It has exactly two call sites on mobile, both this
one, which is why it did not exist on web until now.

Web carries that decision in the link as `?connect=0`. Only the **Connect**
action is suppressed by it: mobile hides the whole action bar, which would also
remove Chat from an existing buddy's profile — a link web has and mobile reaches
another way. Phase 4's `connect-gate-snooze-and-age` extends the same predicate.

---

## 9. Testing traps

- **`beforeEach(() => mock.mockReset())` is a bug.** It *returns* the mock, and
  vitest calls a value returned from `beforeEach` as the teardown — which invokes
  the mock. With `mockRejectedValue` set, that leaks an unhandled rejection into
  the next test and fails it with a message from a completely different place.
  Use a block body.
- Source-text assertions strip comments first, or they match the prose explaining
  the bug rather than the code fixing it.
