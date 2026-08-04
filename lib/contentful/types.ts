/**
 * Shapes of the Contentful content the app reads.
 *
 * The space (`ycesn3neomac`, environment `master`) is shared with the mobile
 * app — the *same* entries power both, so these types deliberately mirror what
 * `cancerbuddyapp` reads in `src/graphql/queries/ads.ts`. Adding a field here
 * means adding it to the query too; Contentful's GraphQL API only returns what
 * you ask for.
 */

/* ── Rich text ──────────────────────────────────────────────────────────── */

/**
 * A Contentful rich-text document, trimmed to the node kinds that actually
 * occur in the live data.
 *
 * All 39 ad descriptions in the space use only `document`, `paragraph`, `text`
 * and `hyperlink`, with `bold` / `italic` / `underline` marks — verified by
 * walking every entry. `RichText` renders exactly this set and falls back to
 * plain text for anything else, so an editor adding a list or an embedded
 * asset degrades to readable output instead of throwing.
 */
export interface RichTextNode {
  nodeType: string;
  /** Present on `text` nodes. */
  value?: string;
  /** Present on `text` nodes: `{ type: "bold" }` and friends. */
  marks?: { type: string }[];
  /** `hyperlink` carries its target here. */
  data?: { uri?: string } & Record<string, unknown>;
  content?: RichTextNode[];
}

/* ── Entries ────────────────────────────────────────────────────────────── */

/**
 * One partner resource / sponsored placement.
 *
 * `id` is the Contentful entry's `sys.id`. It is also the value stored in the
 * AppSync `FavoritesAds.adsUUID` column, which is how a favourite survives
 * without Contentful knowing anything about our users.
 */
export interface ContentfulAd {
  id: string;
  title: string;
  /** Where "Read more" goes. May be empty on a malformed entry. */
  url: string;
  /** Hex background for the whole screen. One live entry has none — see DEFAULT_AD_BG. */
  bgColor: string;
  /** Groups the entries on the partners list. Free text, not a picklist. */
  organization: string;
  logoUrl: string | null;
  imageUrl: string | null;
  description: RichTextNode | null;
}

/** Used when an entry has no `bgColor` (one of the 39 live entries doesn't). */
export const DEFAULT_AD_BG = "#ffffff";

/* ── Raw GraphQL shapes (pre-normalisation) ─────────────────────────────── */

export interface RawContentfulAd {
  sys?: { id?: string | null } | null;
  title?: string | null;
  url?: string | null;
  bgColor?: string | null;
  organization?: string | null;
  logo?: { url?: string | null } | null;
  image?: { url?: string | null } | null;
  description?: { json?: RichTextNode | null } | null;
}

export interface RawAdCollection {
  adCollection?: { items?: (RawContentfulAd | null)[] | null } | null;
}

/**
 * Drops entries too incomplete to render (no id or no title) and fills the
 * gaps on the rest, so every consumer downstream can treat the fields as
 * present. Contentful fields are all optional at the API level regardless of
 * how the content model is configured, so this is the single place that deals
 * with it.
 */
export function normalizeAds(raw: RawAdCollection | null | undefined): ContentfulAd[] {
  const items = raw?.adCollection?.items ?? [];
  const ads: ContentfulAd[] = [];

  for (const item of items) {
    const id = item?.sys?.id?.trim();
    const title = item?.title?.trim();
    if (!id || !title) continue;

    ads.push({
      id,
      title,
      url: item?.url?.trim() ?? "",
      bgColor: item?.bgColor?.trim() || DEFAULT_AD_BG,
      organization: item?.organization?.trim() ?? "",
      logoUrl: item?.logo?.url ?? null,
      imageUrl: item?.image?.url ?? null,
      description: item?.description?.json ?? null,
    });
  }

  return ads;
}
