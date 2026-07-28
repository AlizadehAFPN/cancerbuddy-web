/**
 * Author lookup for feed content.
 *
 * Posts arrive from the Lambda with their author embedded, but comment and
 * reply reactions carry only a user id — so those are resolved here and cached
 * for the session. A busy thread references the same handful of people over and
 * over, and each of them should cost one request at most.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { getS3ImageUrl, type S3FileRef } from "@/lib/aws/s3Image";
import type { PostAuthor } from "@/lib/groups/types";

const GET_AUTHOR = /* GraphQL */ `
  query getPostAuthor($id: ID!) {
    getUser(id: $id) {
      id
      name
      birth
      userType
      ambassador
      groupHostId
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
        file {
          key
          region
          bucket
        }
      }
    }
  }
`;

interface RawAuthor {
  id: string;
  name?: string | null;
  birth?: string | null;
  userType?: string | null;
  ambassador?: boolean | null;
  groupHostId?: string | null;
  Goal?: { image?: { file?: S3FileRef | null } | null } | null;
  profilePic?: { file?: S3FileRef | null } | null;
}

const cache = new Map<string, PostAuthor>();
const missing = new Set<string>();
const inflight = new Map<string, Promise<PostAuthor | undefined>>();

export function getCachedAuthor(userId: string): PostAuthor | undefined {
  return cache.get(userId);
}

export async function loadAuthor(
  userId: string,
): Promise<PostAuthor | undefined> {
  if (!userId) return undefined;

  const cached = cache.get(userId);
  if (cached) return cached;
  if (missing.has(userId)) return undefined;

  const pending = inflight.get(userId);
  if (pending) return pending;

  const run = (async () => {
    try {
      const { data } = await executeAppSyncGraphql<{ getUser: RawAuthor | null }>({
        query: GET_AUTHOR,
        variables: { id: userId },
        authWithUserPool: true,
      });
      const raw = data?.getUser;
      if (!raw?.id) {
        missing.add(userId);
        return undefined;
      }

      const [profilePicUrl, goalImageUrl] = await Promise.all([
        getS3ImageUrl(raw.profilePic?.file),
        getS3ImageUrl(raw.Goal?.image?.file),
      ]);

      const author: PostAuthor = {
        id: raw.id,
        name: raw.name ?? null,
        birth: raw.birth ?? null,
        userType: raw.userType ?? null,
        ambassador: raw.ambassador === true,
        groupHostId: raw.groupHostId ?? null,
        profilePicUrl,
        goalImageUrl,
      };
      cache.set(userId, author);
      return author;
    } catch (err) {
      console.error("[groups] author lookup failed:", err);
      return undefined;
    } finally {
      inflight.delete(userId);
    }
  })();

  inflight.set(userId, run);
  return run;
}

export function clearAuthorCache(): void {
  cache.clear();
  missing.clear();
}
