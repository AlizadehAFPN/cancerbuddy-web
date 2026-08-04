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
