# Contentful — partner resources, funders, and the ad interstitial

One Contentful space (`ycesn3neomac`, environment `master`) feeds the mobile
app, the web app, and the admin panel. Publishing an entry changes what every
user sees, immediately — **there is nothing to test against first.**

The space does contain a second environment, `dev`, but it is not a staging
copy and must not be treated as one. It is an abandoned fork on an older
content model: the resource type there is `ads` (plural) rather than `ad`, with
18 stale entries, alongside leftovers from an era when users, groups,
diagnoses and hospitals were kept in Contentful too (`mock`, `user`,
`userGroup`, `hospital`, …). Nothing points at it — mobile's `.env.dev` and
`.env.production` both set `CONTENTFUL_ENV=master`. Either delete it or
rebuild it from `master` before anyone mistakes it for a safety net.

---

## 1. The content model

Introspected from the live space, not from the code:

| Content type         | Fields                                                             | Entries | Read by                              |
| -------------------- | ------------------------------------------------------------------ | ------- | ------------------------------------ |
| `ad`                 | `title`, `url`, `bgColor`, `organization`, `logo`, `image`, `description` (rich text) | 39 | mobile + web (interstitial), mobile Partners list |
| `funders`            | `name`, `description`                                              | 15      | mobile `useFunders`                  |
| `maintenance`        | `updateDatabase` (boolean)                                         | 1       | mobile `useMaintenance`              |
| `appStoreLink`       | `appLink`                                                          | 1       | mobile QR share                      |
| `supportInformation` | `description` (rich text), `picture`                               | —       | **nothing** — unreferenced           |

Single locale: `en-US`, default.

Rich text in the wild uses only `document`, `paragraph`, `text` and
`hyperlink`, with `bold` / `italic` / `underline` marks. Everything downstream
is built around that fact and degrades gracefully outside it.

---

## 2. How the ad interstitial works

### Mobile (`cancerbuddyapp`)

`PROFILES_VISITED = 5` in both `UserInfo.tsx` and `UserInfoConnect.tsx`:

```
profilesViewed starts at 0
handleNext():
  profilesViewed === 5  →  reset to 0, navigation.replace(Adds, {ad: random})
  otherwise             →  profilesViewed++, go to the next profile
AddsScreen "Skip"       →  profilesViewed++, go to the next profile
```

So the **first** ad lands on the sixth Next, and every **fifth** one after that
— Skip already consumes one of the five. The entry is picked with
`ads[Math.floor(Math.random() * ads.length)]`: uniform, repeats allowed.

### Web (this repo)

Same arithmetic, in [lib/buddies/adRotation.ts](../lib/buddies/adRotation.ts).
The Next button on
[components/buddies/BuddyProfileScreen.tsx](../components/buddies/BuddyProfileScreen.tsx)
asks `nextAdOrNull()` and either pushes the next profile or replaces the route
with `/buddies/ad/[adId]?next=<userId>`.

The buddy to continue to travels in the query string rather than module state
so a refresh or a shared link still knows where Skip goes.

**Deliberate differences from mobile**, all forced by web scope:

| Mobile                                     | Web                                            | Why |
| ------------------------------------------ | ---------------------------------------------- | --- |
| Primary button "MORE RESOURCES" → Partners | Primary button "Read more" → the partner's URL | `/partners` is still a `ScreenPlaceholder`; sending people there would be a dead end. Swap back when that screen ships. |
| "Read more" opens an in-app WebView        | Opens a new tab                                | Web has a browser to hand off to. |
| `documentToHtmlString` + `react-native-render-html` | Custom React renderer, [components/contentful/RichText.tsx](../components/contentful/RichText.tsx) | Avoids `dangerouslySetInnerHTML` over editor-supplied content. |
| Counter reset on accepting/dismissing a buddy request | Not ported | Reads as incidental in mobile — see the note in `adRotation.ts`. |

Favourites are unchanged: the star writes an AppSync `FavoritesAds` row
(`{ userID, adsUUID }`) where `adsUUID` is the Contentful entry's `sys.id`.

---

## 3. Web data path

```
browser ──► /api/contentful/ads ──► graphql.contentful.com
            (Next Route Handler)     Authorization: Bearer <delivery token>
```

The token is `CONTENTFUL_ACCESS_TOKEN`, **without** a `NEXT_PUBLIC_` prefix, so
it never enters the browser bundle. Mobile calls Contentful directly with the
same read-only token, which is fine for a compiled app and not for a web page:
the bundle is readable, and shipping it would tie Contentful's rate limit to
visitors' IPs.

Caching: one upstream call per hour per server (`next.revalidate`), plus a
five-minute browser `Cache-Control` so paging through profiles doesn't
re-request. The client memoises the list in module scope for the page's
lifetime ([lib/contentful/ads.ts](../lib/contentful/ads.ts)).

The route is not session-gated. It returns public marketing content, the web
app has no server-readable session to gate on (see `proxy.ts`), and gating it
would only break the interstitial.

### Environment variables (`.env`, and the deploy environment)

```
CONTENTFUL_URL=https://graphql.contentful.com/content/v1/spaces/
CONTENTFUL_SPACE=ycesn3neomac
CONTENTFUL_ENV=master
CONTENTFUL_ACCESS_TOKEN=<delivery token>
```

`CONTENTFUL_URL` is a **prefix** ending in `/spaces/`, not a full endpoint —
the same shape mobile's axios client expects.

---

## 4. Admin panel (`cancerbuddy-admin-dashboard`)

Reading uses the Delivery API; **writing needs the Content Management API**, a
different host and a different token.

```
Admin ──CMA──► api.contentful.com ──► the space ◄──CDA── mobile
                upload.contentful.com                     web
```

Setup — one manual step:

1. Generate a personal access token. This is an **account** setting, not a
   space one, so it is *not* under Settings → API keys (that page only issues
   the read-only delivery and preview tokens): click your avatar bottom-left →
   **Account settings → Tokens → Create personal access token**, or go
   straight to <https://app.contentful.com/account/profile/cma_tokens>.
   It is shown once.
2. Put it in `.env.local` as `CONTENTFUL_CMA_TOKEN` (alongside
   `CONTENTFUL_SPACE` and `CONTENTFUL_ENV`, already added).
3. Restart. Until then every Contentful page shows a setup notice instead of a
   raw error.

A personal access token carries **your** permissions across every space and
organisation you belong to — it cannot be scoped to this space. Keep it
server-side only; never give it a `NEXT_PUBLIC_` prefix. If the organisation
disallows personal tokens, the alternative is a Contentful App with scoped
permissions, which this client would talk to the same way.

### Deploying it

Setting the variable in the Amplify console is **not enough**, and the failure
is silent — the panel simply reports Contentful as unconfigured. The admin app
delivers non-`NEXT_PUBLIC_` variables to its SSR runtime through the `env`
block in `next.config.ts`, which inlines them at build time. Any new variable
has to be added in **both** places:

1. the Amplify app's environment variables (app `d3cjblipd48wqf`), and
2. the `env` block in `next.config.ts`.

`amplify.yml` has a `frontend.environment.variables` block listing the same
names. Amplify ignores it — it is a checklist, not a mechanism.

### Screens

- `/dashboard/resources` — grouped by organisation, with search, publish /
  unpublish, and a typed-confirmation delete.
- `/dashboard/resources/new` and `/dashboard/resources/[entryId]` — the form,
  with a live preview of the card as the apps render it.
- `/dashboard/funders` — inline CRUD, two fields.

### Things worth knowing

- **Save publishes.** A draft is invisible to both apps, so "Save" that left a
  draft behind would be a silent no-op. "Save as draft" is the explicit
  opt-out, and Unpublish is the way to take something down.
- **Unpublish, don't delete,** to hide a resource: the entry id survives, so
  everyone's `FavoritesAds` rows stay valid and it can go back up unchanged.
  Delete is permanent — Contentful has no trash.
- **Optimistic locking.** Every update sends the version the form loaded with;
  Contentful answers 409 if someone saved in between, and the UI says so.
- **Images** go into Contentful, not the app's S3 bucket, because mobile reads
  `logo.url` / `image.url` straight off the entry. The upload is a four-step
  CMA dance (upload → create → process → publish) with polling, since
  processing is async with no callback.

### Rich text editing

The `description` field is a document tree, so the admin edits a markdown
subset and converts both ways
([lib/contentful-richtext.ts](../../cancerbuddy-admin-dashboard/lib/contentful-richtext.ts)):

```
**bold**   *italic*   _underline_   [label](https://…)   blank line = new paragraph
\ escapes any of  \ * _ [ ]
```

Verified against all 39 live descriptions: **39/39 round-trip exactly**
(ignoring whitespace normalisation and empty trailing nodes). An entry that
uses formatting outside the subset — a list, an embedded asset — has its
description field **locked** in the form rather than flattened, with a pointer
to Contentful; every other field stays editable.

Link handling differs by direction on purpose. The write path uses a denylist
(only `javascript:`, `data:`, `vbscript:`, `file:`, `blob:` are refused)
because one live entry links to `BreastCancerTrials.org` with no scheme, and an
allow-list would delete that link the first time anyone saved. The read path in
the web app is an allow-list (`http(s)`, `mailto:`, `tel:`) — storing something
odd is recoverable, rendering it isn't.

---

## 5. Not built

- `/partners` and `/funders` on web are still `ScreenPlaceholder`s. Everything
  needed for `/partners` now exists (`loadAds()`, `RichText`, `favoriteAds.ts`)
  — what's missing is the section list grouped by organisation with favourites
  pinned on top, mirroring mobile's `Partner.tsx` + `utils/partners.ts`.
- `maintenance` and `appStoreLink` are not read by the web app and not
  manageable from the admin. Both are single-entry types; adding them is a
  route and a toggle.
- `supportInformation` is unreferenced everywhere. Worth deleting from the
  content model, or finding out what it was for.
