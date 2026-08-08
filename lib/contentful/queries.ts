/**
 * Contentful GraphQL queries.
 *
 * Kept byte-for-byte equivalent to the mobile app's
 * `src/graphql/queries/ads.ts` so both clients read the same fields off the
 * same entries — if one of them starts showing something the other doesn't,
 * the difference is here.
 */

export const GET_ADS = `
query getAds {
  adCollection {
    items {
      sys {
        id
      }
      title
      url
      bgColor
      logo {
        url
      }
      image {
        url
      }
      description {
        json
      }
      organization
    }
  }
}
`;

/**
 * The store link the app is shared with — one entry, one field.
 *
 * Mobile's `graphql/queries/appstore-link.ts`, verbatim. Web was sharing
 * `window.location.origin`, which sends a friend to the web app's front page
 * instead of the App Store or Play Store listing.
 */
export const GET_APP_STORE_LINK = `
query appLink{
	appStoreLinkCollection{
   	items{
      appLink
    }
  }
}
`;

/**
 * Who funds CancerBuddy.
 *
 * Mobile's Funders screen reads the same collection and lists it alphabetically.
 * Web never queried it, so `/funders` — a row in the account menu — was a
 * placeholder promising a page that did not exist.
 */
export const GET_FUNDERS = `
query funders{
	fundersCollection{
   	items{
      name
      description
    }
  }
}
`;
