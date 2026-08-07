# Live video sessions

The web port of the mobile app's Twilio room (`cancerbuddyapp`
`src/screens/groups/twilio-video-room/`). Route: `/live/[eventId]`.

Everything a host can do on the phone, a host can do here: schedule-independent
joining, camera/mic, live chat, moderation, "notify the group", and ending the
session for everyone.

---

## How a session comes into being

A host schedules one from `/profile/lives` (or the admin dashboard). That calls
`createLive` on `USERS_LAMBDA`, which in one step:

1. creates a Twilio Video **group room** named `live-<liveId>`,
2. creates a Stream Chat channel of type `livestream` with id `live-<liveId>`,
3. writes the row to the `LiveStreamingGroup` DynamoDB table.

Both id conventions are unconditional in **both** creators — the users Lambda
and the admin dashboard's `/api/live/create`. That is why `roomNameFor()` and
`chatChannelIdFor()` in `lib/live/session.ts` derive them rather than reading
them back: `chatChannelId` is written to DynamoDB but is not selected by any
AppSync query in this repo or the mobile app, so there is no evidence the
GraphQL schema exposes it — and asking for a field the schema doesn't declare
fails the entire query.

`inLive` on that row is what turns the LIVE badges on across the app. It is
flipped by the token Lambda when the first host joins.

---

## The four Lambda calls

All in `lib/live/liveService.ts`, all byte-identical to the payloads mobile
sends (`cancerbuddyapp/src/services/streaming/twilio-video.ts`).

| Call | Lambda | Purpose |
| --- | --- | --- |
| `getTwilioToken` | `USERS_LAMBDA` | Mints the room token **and decides who is a host**. Returns `{ token, roomName, identity, isHost, hostIds }`. Rejects blocked users with `statusCode: 403`. |
| `moderateLive` | `USERS_LAMBDA` | Host-only. Enforces the action server-side *and* writes a signal message to the session's Stream channel. |
| `endLive` | `USERS_LAMBDA` | Host-only. Completes the room for everyone. |
| `notifyGroupLive` | `NOTIFICATIONS_LAMBDA` | Host-only push to the group's members. |

> **The client never decides who is a host.** `isHost` and `hostIds` come from
> the token response and nowhere else. Moderation controls, screen sharing and
> "end for everyone" are all gated on that value.

### Refusals vs failures

`assertOk` throws a `LiveServiceError` carrying the Lambda's status. A **4xx is
a decision** — the session ended, this user is blocked, they aren't a host — and
retrying it produces the identical response, so `useLiveRoom` marks it terminal
and the error screen drops its retry button. Anything else (5xx, transport) is
worth another attempt and keeps the button.

The room also checks `hasSessionEnded()` on the row it already loaded *before*
showing pre-join. Without that, someone opening a stale link is walked through
picking a camera and granting permission, only to be refused at the last step.

### Participant identity

The token Lambda mints identities as `"<userId>::<displayName>"` (older
sessions used `|`). `lib/live/identity.ts` parses both, and must keep matching
mobile's parser — the user id half is what host checks and moderation key on.

---

## Moderation is a two-channel mechanism

This is the part most likely to be misread, so it is worth stating plainly:

* The **Lambda** enforces the action (it removes the participant from the
  Twilio room server-side).
* The **Stream channel** carries a signal message — `moderation_action` +
  `target_user_id` — so the *target's own browser* can react: drop its
  microphone, show the notice, and leave.

`lib/live/useLiveChat.ts` handles those messages and never renders them as
chat. It carries three de-duplications, ported from mobile, because Stream
re-delivers `message.new` on reconnects and retries:

1. a seen-ids set, so one signal acts once;
2. a per `action:target` throttle on the *notice*, so a burst doesn't stack
   banners;
3. a terminal latch, so `remove` / `block` can only fire once.

Remove those and a flaky connection shows "you were muted" three times.

---

## Environment

```
NEXT_PUBLIC_USERS_LAMBDA=users-demo
NEXT_PUBLIC_NOTIFICATIONS_LAMBDA=notifications-demo   # live notifications only
NEXT_PUBLIC_GETSTREAM_API_KEY=...                     # live chat rides the app's Stream client
```

### `Permissions-Policy` — read this before "tidying" `next.config.ts`

`camera`, `microphone` and `display-capture` are granted to `(self)` in
`next.config.ts`. **This is required.** With an empty allowlist the browser
does not prompt and does not warn — `getUserMedia` simply rejects with
`NotAllowedError`, which looks exactly like the user refusing permission. If
someone reports "the camera button does nothing", check this header first, and
remember that **a config change needs a dev-server restart** to take effect.

Third-party frames stay excluded, so the embedded group widget still cannot
reach a camera.

---

## Layout

`twilio-video` (2.35.x) is loaded with a dynamic `import()` in
`lib/live/localTracks.ts` — it is ~500 kB and only this route needs it. Nothing
outside that file imports it at runtime; everything else uses `import type`.

```
lib/live/
  liveService.ts        the four Lambda calls
  session.ts            session lookup + id derivation
  identity.ts           "<userId>::<displayName>"
  localTracks.ts        track creation, getUserMedia error translation
  useLiveRoom.ts        Twilio: connection, participants, tracks, screen share
  useLiveChat.ts        Stream: chat + moderation signals
  useMediaDevices.ts    camera/mic/speaker selection, persisted
  useAudioLevel.ts      pre-join mic meter
  useWakeLock.ts        mobile's useKeepAwake, web edition
  useViewportDefaults.ts  opening layout for the viewport

components/live/
  LiveRoom.tsx          orchestrator — the only file that knows about both
                        Twilio and Stream (where a "you were muted" signal
                        turns into an actual microphone switching off)
  PreJoin.tsx           device check before joining
  LiveStage.tsx         stage + filmstrip, and the mobile-style grid
  VideoTile.tsx         one participant rectangle, used by every layout
  ...
```

---

## Deliberate divergences from mobile

Each of these is a decision, not drift.

| | Mobile | Web | Why |
| --- | --- | --- | --- |
| Joining | Straight into the room | **Pre-join** screen | A browser needs a device check, a permission grant, and a user gesture before remote audio will autoplay. All four become one deliberate moment. |
| Layout | Sectioned grid | **Stage + filmstrip** on `md`+, grid below | A 4-up grid on a 27" monitor is four small faces and a lot of background. Below `md` the layout is mobile's. |
| Chat | Covers the video | **Docked rail** on `lg`+, overlay below | Losing the speaker's face to read a message is the worst part of live chat on a phone. Bubble colours are mobile's exactly (host white, yours `#FEF9CA`). |
| Devices | One camera, speakerphone toggle | **Pickers**, persisted, switchable mid-call | A laptop has several of each, and picking the wrong one is the most common way a call goes wrong. |
| Screen share | — | **Hosts only** | Standard on the web, useful for a host presenting. |
| Speaker / network quality | Requested, never shown | **Shown** | Mobile asks Twilio for both and ignores them. Five grey bars answer "why is the audio breaking up" before anyone types it into the chat. |
| Moderation entry | Long-press a tile | Tile `⋯` **and a People panel** | A long-press is undiscoverable, and impossible once the grid is taller than the screen. |
| Failed chat message | Looks sent | **Marked, retryable** | |
| Calendar row while live | Opens the room; Lambda rejects early arrivals | **"Join live"** only when a session is running | Learning a session hasn't started from a connection error is a poor way to learn it. |

## Things that are matched on purpose

* Everyone joins **muted with the camera off**. Turning a device off
  *unpublishes and stops* the track, so the camera light goes out.
* Control colours: on = brand yellow, off = red. This is inverted relative to
  Meet and Zoom, and it stays that way — the same person uses both clients, and
  a control that means the opposite thing on the other screen is how people end
  up broadcasting by accident.
* Hosts cannot moderate themselves or other hosts.
* The options and moderation sheets are light sheets over the dark room, row
  for row as on mobile.
