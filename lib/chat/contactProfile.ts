/**
 * Loads the public profile of a chat contact (the other 1:1 member), matching
 * what the mobile chat list/header show: avatar photo, goal image, and role
 * (Support / Host / Ambassador). Stream doesn't store these — they come from
 * the AppSync `getUser` row + S3, exactly like the mobile `GET_CURRENT_DATA_USER`
 * flow.
 *
 * Results are cached per user id (a chat list re-renders constantly and many
 * rows share contacts), with in-flight de-duping.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { getS3ImageUrl, type S3FileRef } from "@/lib/aws/s3Image";

const GET_AVATAR_INFORMATION = /* GraphQL */ `
  query getAvatarInformation($id: ID!) {
    getUser(id: $id) {
      id
      name
      userType
      groupHostId
      ambassador
      Goal {
        image {
          file {
            key
            region
            bucket
          }
        }
      }
      profilePic: ProfilePic {
        id
        file {
          key
          region
          bucket
        }
      }
    }
  }
`;

interface RawUser {
  id: string;
  name?: string | null;
  userType?: string | null;
  /** Non-null on a group host, whatever their `userType`. See `isHost` below. */
  groupHostId?: string | null;
  ambassador?: boolean | null;
  Goal?: { image?: { file?: S3FileRef | null } | null } | null;
  profilePic?: { file?: S3FileRef | null } | null;
}

export interface ContactProfile {
  name?: string;
  userType?: string;
  isSupport: boolean;
  isHost: boolean;
  isAmbassador: boolean;
  profilePicUrl?: string;
  goalImageUrl?: string;
}

const cache = new Map<string, ContactProfile>();
const inflight = new Map<string, Promise<ContactProfile | null>>();

export async function fetchContactProfile(
  userId: string,
): Promise<ContactProfile | null> {
  const cached = cache.get(userId);
  if (cached) return cached;
  const pending = inflight.get(userId);
  if (pending) return pending;

  const p = (async () => {
    try {
      const { data } = await executeAppSyncGraphql<{ getUser: RawUser | null }>({
        query: GET_AVATAR_INFORMATION,
        variables: { id: userId },
        authWithUserPool: true,
      });
      const u = data?.getUser;
      if (!u) return null;

      const [profilePicUrl, goalImageUrl] = await Promise.all([
        getS3ImageUrl(u.profilePic?.file),
        getS3ImageUrl(u.Goal?.image?.file),
      ]);

      const profile: ContactProfile = {
        name: u.name ?? undefined,
        userType: u.userType ?? undefined,
        isSupport: u.userType === "SUPPORT",
        // Mobile keys the Host pill off a non-null `groupHostId`, not `userType`
        // — so a PATIENT who hosts a group is still a host, and is neither
        // reportable nor removable. Keying off `userType` made the two clients
        // disagree about which contacts a member could report.
        isHost: !!u.groupHostId?.trim(),
        isAmbassador: u.ambassador === true,
        profilePicUrl,
        goalImageUrl,
      };
      cache.set(userId, profile);
      return profile;
    } catch {
      return null;
    } finally {
      inflight.delete(userId);
    }
  })();

  inflight.set(userId, p);
  return p;
}
