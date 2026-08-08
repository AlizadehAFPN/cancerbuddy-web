/**
 * Full profile payload for `/buddies/[userId]` and the Buddy ID lookup.
 *
 * This is deliberately separate from the card query in `profiles.ts`: the card
 * needs six fields and gets batched twenty at a time, while the detail page
 * needs the long tail (pronoun, workplace, remission date, goal, gallery) for
 * exactly one person. Mirrors mobile's `GET_USER_BY_ID` +
 * `GET_USER_GALLERY_BY_ID`.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { getS3ImageUrl, type S3FileRef } from "@/lib/aws/s3Image";
import type { NamedRef, UserTypeName } from "@/lib/buddies/types";

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_:-]/g, "");
}

const GET_PROFILE_DETAIL = /* GraphQL */ `
  query getBuddyProfile($id: ID!) {
    getUser(id: $id) {
      id
      name
      bio
      birth
      userType
      ambassador
      isSnooze
      inRemissionSince
      userRelationshipId
      Pronoun {
        name
      }
      Relationship {
        name
      }
      Goal {
        name
        image {
          file {
            key
            bucket
            region
          }
        }
      }
      City {
        name
      }
      State {
        stateAbbreviation
      }
      Workplace {
        name
      }
      College {
        id
        name
      }
      ProfilePic {
        file {
          key
          bucket
          region
        }
      }
      TreatmentStatus {
        name
      }
      Diagnosis {
        items {
          diagnosis {
            id
            name
          }
        }
      }
      Treatments {
        items {
          treatment {
            id
            name
          }
        }
      }
      Hospitals {
        items {
          hospital {
            id
            name
          }
        }
      }
      Interests {
        items {
          interest {
            id
            name
          }
        }
      }
      SupportOrganizations: supportOrganizations {
        items {
          supportOrganizations {
            id
            name
          }
        }
      }
      Desabilities: desabilities {
        items {
          disabilities {
            id
            name
          }
        }
      }
      supportInformation {
        image
        description
      }
    }
  }
`;

const GET_GALLERY = (userId: string) => /* GraphQL */ `
  query getGalleryPictures {
    listPictures(filter: { userGalleryId: { eq: "${safeId(userId)}" } }, limit: 1000000) {
      items {
        id
        createdAt
        file {
          key
          bucket
          region
        }
      }
    }
  }
`;

interface RawNamed {
  id?: string | null;
  name?: string | null;
}

interface RawDetail {
  id: string;
  name?: string | null;
  bio?: string | null;
  birth?: string | null;
  userType?: string | null;
  ambassador?: boolean | null;
  isSnooze?: boolean | null;
  inRemissionSince?: string | null;
  userRelationshipId?: string | null;
  Pronoun?: { name?: string | null } | null;
  Relationship?: { name?: string | null } | null;
  Goal?: { name?: string | null; image?: { file?: S3FileRef | null } | null } | null;
  City?: { name?: string | null } | null;
  State?: { stateAbbreviation?: string | null } | null;
  Workplace?: { name?: string | null } | null;
  College?: RawNamed | null;
  ProfilePic?: { file?: S3FileRef | null } | null;
  TreatmentStatus?: { name?: string | null } | null;
  Diagnosis?: { items?: { diagnosis?: RawNamed | null }[] | null } | null;
  Treatments?: { items?: { treatment?: RawNamed | null }[] | null } | null;
  Hospitals?: { items?: { hospital?: RawNamed | null }[] | null } | null;
  Interests?: { items?: { interest?: RawNamed | null }[] | null } | null;
  SupportOrganizations?: {
    items?: { supportOrganizations?: RawNamed | null }[] | null;
  } | null;
  Desabilities?: { items?: { disabilities?: RawNamed | null }[] | null } | null;
  supportInformation?: { image?: string | null; description?: string | null } | null;
}

export interface GalleryPhoto {
  id: string;
  url: string;
}

export interface BuddyProfileDetail {
  id: string;
  name: string;
  bio?: string | null;
  birth?: string | null;
  userType: UserTypeName;
  ambassador: boolean;
  isSnooze: boolean;
  inRemissionSince?: string | null;
  pronoun?: string | null;
  relationshipName?: string | null;
  goalName?: string | null;
  cityName?: string | null;
  stateAbbreviation?: string | null;
  workplaceName?: string | null;
  collegeId?: string | null;
  collegeName?: string | null;
  treatmentStatusName?: string | null;
  profilePicUrl?: string;
  goalImageUrl?: string;
  diagnosis: NamedRef[];
  treatments: NamedRef[];
  hospitals: NamedRef[];
  interests: NamedRef[];
  supportOrganizations: NamedRef[];
  desabilities: NamedRef[];
  sponsor?: { imageUrl?: string | null; description?: string | null } | null;
  gallery: GalleryPhoto[];
  /**
   * Photos whose signed URL could not be fetched. Surfaced rather than hidden:
   * a gallery that is quietly two short reads as "they only posted three".
   */
  galleryFailures: number;
}

function named<T>(
  rows: { items?: T[] | null } | null | undefined,
  pick: (row: T) => RawNamed | null | undefined,
): NamedRef[] {
  return (rows?.items ?? [])
    .map(pick)
    .filter((v): v is RawNamed => !!v?.id && !!v?.name)
    .map((v) => ({ id: v.id!, name: v.name! }));
}

/** "I rather not disclose" is stored like any other pronoun but never shown. */
function displayablePronoun(name?: string | null): string | null {
  if (!name) return null;
  return name === "I rather not disclose" ? null : name;
}

export async function fetchBuddyProfileDetail(
  userId: string,
): Promise<BuddyProfileDetail | null> {
  const [detailResult, galleryResult] = await Promise.allSettled([
    executeAppSyncGraphql<{ getUser: RawDetail | null }>({
      query: GET_PROFILE_DETAIL,
      variables: { id: userId },
      authWithUserPool: true,
    }),
    executeAppSyncGraphql<{
      listPictures: {
        items?:
          | { id: string; createdAt?: string | null; file?: S3FileRef | null }[]
          | null;
      } | null;
    }>({ query: GET_GALLERY(userId), variables: {}, authWithUserPool: true }),
  ]);

  if (detailResult.status === "rejected") throw detailResult.reason;
  const raw = detailResult.value.data?.getUser;
  if (!raw?.id) return null;

  const [profilePicUrl, goalImageUrl] = await Promise.all([
    getS3ImageUrl(raw.ProfilePic?.file),
    getS3ImageUrl(raw.Goal?.image?.file),
  ]);

  // A failed gallery must not blank the whole profile.
  const galleryRows =
    galleryResult.status === "fulfilled"
      ? (galleryResult.value.data?.listPictures?.items ?? [])
      : [];

  const signed = await Promise.all(
    galleryRows.map(async (row) => {
      try {
        const url = await getS3ImageUrl(row.file);
        return url
          ? { id: row.id, url, createdAt: row.createdAt ?? null }
          : null;
      } catch (err) {
        // Mobile toasts a per-image failure (`GalleryScreen.tsx:66`); web dropped
        // the photo silently, so a member saw a shorter gallery and no reason.
        console.error("[buddies] gallery image failed to sign:", err);
        return null;
      }
    }),
  );

  /**
   * Newest first — mobile's `orderDates` sort (`GalleryScreen.tsx:75-78`). Web
   * rendered whatever order `listPictures` happened to return, which is neither
   * stable nor meaningful.
   */
  const gallery = signed
    .filter((p): p is GalleryPhoto & { createdAt: string | null } => !!p)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .map(({ id, url }) => ({ id, url }));

  /** How many photos exist but could not be shown, so the screen can say so. */
  const galleryFailures = signed.filter((p) => p === null).length;

  return {
    id: raw.id,
    name: raw.name ?? "",
    bio: raw.bio ?? null,
    birth: raw.birth ?? null,
    userType: (raw.userType ?? "PATIENT") as UserTypeName,
    ambassador: raw.ambassador === true,
    isSnooze: raw.isSnooze === true,
    inRemissionSince: raw.inRemissionSince ?? null,
    pronoun: displayablePronoun(raw.Pronoun?.name),
    relationshipName: raw.Relationship?.name ?? null,
    goalName: raw.Goal?.name ?? null,
    cityName: raw.City?.name ?? null,
    stateAbbreviation: raw.State?.stateAbbreviation ?? null,
    workplaceName: raw.Workplace?.name ?? null,
    collegeId: raw.College?.id ?? null,
    collegeName: raw.College?.name ?? null,
    treatmentStatusName: raw.TreatmentStatus?.name ?? null,
    profilePicUrl,
    goalImageUrl,
    diagnosis: named(raw.Diagnosis, (r) => r.diagnosis),
    treatments: named(raw.Treatments, (r) => r.treatment),
    hospitals: named(raw.Hospitals, (r) => r.hospital),
    interests: named(raw.Interests, (r) => r.interest),
    supportOrganizations: named(raw.SupportOrganizations, (r) => r.supportOrganizations),
    desabilities: named(raw.Desabilities, (r) => r.disabilities),
    sponsor: raw.supportInformation
      ? {
          imageUrl: raw.supportInformation.image ?? null,
          description: raw.supportInformation.description ?? null,
        }
      : null,
    gallery,
    galleryFailures,
  };
}

/* ── Buddy ID lookup ────────────────────────────────────────────────────── */

const FIND_BY_BUDDY_ID = (includeToken: boolean) => /* GraphQL */ `
  query findUserByBuddyId($buddyId: String${includeToken ? ", $token: String" : ""}) {
    listUsers(
      filter: { buddyId: { eq: $buddyId } },
      limit: 1000000
      ${includeToken ? ", nextToken: $token" : ""}
    ) {
      items {
        id
        name
        birth
        isSnooze
      }
      nextToken
    }
  }
`;

export interface BuddyIdMatch {
  id: string;
  name: string;
  birth?: string | null;
  isSnooze: boolean;
}

/**
 * Finds a user by their printed Buddy ID (`BI-0000-0000`). `buddyId` isn't a
 * key, so this is a filtered scan that has to page until it hits a match —
 * which is why it returns as soon as one page yields anything.
 */
export async function findUserByBuddyId(
  buddyId: string,
): Promise<BuddyIdMatch | null> {
  let nextToken: string | undefined;
  let pages = 0;

  do {
    const { data } = await executeAppSyncGraphql<{
      listUsers: {
        items?: BuddyIdMatch[] | null;
        nextToken?: string | null;
      } | null;
    }>({
      query: FIND_BY_BUDDY_ID(!!nextToken),
      variables: nextToken ? { buddyId, token: nextToken } : { buddyId },
      authWithUserPool: true,
    });

    const match = (data?.listUsers?.items ?? []).find((u) => !!u?.id);
    if (match) return { ...match, isSnooze: match.isSnooze === true };

    nextToken = data?.listUsers?.nextToken ?? undefined;
    pages += 1;
  } while (nextToken && pages < 50);

  return null;
}
