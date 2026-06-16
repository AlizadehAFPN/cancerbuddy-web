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
        isHost: u.userType === "HOST",
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
