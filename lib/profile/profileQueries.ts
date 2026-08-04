/**
 * Reads for the signed-in user's own profile.
 *
 * The hub runs one query (`getAvatarInformation`) plus a paged gallery fetch,
 * exactly as `HomeProfile.tsx` does — the completion rings need presence of
 * many fields at once, so a single wide read beats one query per section.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { getS3ImageUrl, type S3FileRef } from "@/lib/aws/s3Image";
import type { GalleryPicture, ProfileUser } from "@/lib/profile/types";

const MAX_GALLERY_PAGES = 20;

const GET_PROFILE = /* GraphQL */ `
  query getAvatarInformation($id: ID!) {
    getUser(id: $id) {
      id
      name
      birth
      bio
      zipcode
      userType
      ambassador
      buddyId
      cancerloss
      CurrentlyInCollege
      inRemissionSince
      patientBirth
      patientName
      userCityId
      userStateId
      userWorkplaceId
      userPronounId
      userEthnicitiesId
      userTransgenderId
      userSexualOrientationId
      userTreatmentStatusId
      userRelationshipId
      userProfilePicId
      userCollegeId
      userCopingwithcancerlossId
      profilePic: ProfilePic {
        id
        file {
          key
          region
          bucket
        }
      }
      goal: Goal {
        id
        name
      }
      city: City {
        name
      }
      state: State {
        name
        stateAbbreviation
      }
      pronoun: Pronoun {
        name
      }
      ethnicities {
        name
      }
      sexualOrientation: sexualOrientation {
        id
        name
      }
      transgender: transgender {
        id
        name
      }
      diagnosis: Diagnosis {
        items {
          id
        }
      }
      treatments: Treatments {
        items {
          id
        }
      }
      hospitals: Hospitals {
        items {
          id
        }
      }
      interests: Interests {
        items {
          id
        }
      }
      languages: Language {
        items {
          id
          language {
            id
            name
          }
        }
      }
      supportOrganizations: supportOrganizations {
        items {
          supportOrganizations {
            name
          }
        }
      }
      desabilities: desabilities {
        items {
          disabilities {
            name
          }
        }
      }
    }
  }
`;

/**
 * The gallery is keyed on `userGalleryId`, not `pictureUserId` — a picture is
 * attached to its owner's gallery when it's created. Filtering on the wrong
 * field returns an empty list rather than an error, so this one matters.
 *
 * `limit` caps *scanned* rows, not returned ones: this is a DynamoDB scan with
 * a post-read filter, so a small limit means page after page of zero matches
 * and one network round trip for each. Mobile uses the same huge limit for the
 * same reason — see the note in `lib/buddies/discoveryFetch.ts`.
 */
const GET_GALLERY = (withToken: boolean) => /* GraphQL */ `
  query getGalleryPictures($id: ID!${withToken ? ", $token: String" : ""}) {
    listPictures(
      filter: { userGalleryId: { eq: $id } }
      limit: 1000000
      ${withToken ? "nextToken: $token" : ""}
    ) {
      items {
        id
        createdAt
        file {
          key
          region
          bucket
        }
      }
      nextToken
    }
  }
`;

interface RawProfile extends Omit<ProfileUser, "profilePicUrl"> {
  profilePic?: { id?: string; file?: S3FileRef | null } | null;
}

export async function fetchOwnProfile(userId: string): Promise<ProfileUser | null> {
  const { data } = await executeAppSyncGraphql<{ getUser: RawProfile | null }>({
    query: GET_PROFILE,
    variables: { id: userId },
    authWithUserPool: true,
  });

  const raw = data?.getUser;
  if (!raw) return null;

  return {
    ...raw,
    profilePicUrl: await getS3ImageUrl(raw.profilePic?.file),
  };
}

interface RawPicture {
  id: string;
  createdAt?: string | null;
  file?: S3FileRef | null;
}

/**
 * The user's photo gallery. Paged to exhaustion because the completion ring
 * scores the total count, so a truncated read would under-report progress.
 */
export async function fetchOwnGallery(userId: string): Promise<GalleryPicture[]> {
  const rows: RawPicture[] = [];
  let token: string | undefined;
  let pages = 0;

  do {
    const { data } = await executeAppSyncGraphql<{
      listPictures: { items?: RawPicture[] | null; nextToken?: string | null } | null;
    }>({
      query: GET_GALLERY(!!token),
      variables: token ? { id: userId, token } : { id: userId },
      authWithUserPool: true,
    });

    rows.push(...(data?.listPictures?.items ?? []));
    token = data?.listPictures?.nextToken ?? undefined;
    pages += 1;
  } while (token && pages < MAX_GALLERY_PAGES);

  const pictures = await Promise.all(
    rows
      .filter((row) => row?.id)
      .map(async (row) => ({
        id: row.id,
        createdAt: row.createdAt ?? null,
        url: await getS3ImageUrl(row.file),
      })),
  );

  // Newest first, matching the mobile gallery order.
  return pictures.sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  );
}
