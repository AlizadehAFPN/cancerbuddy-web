/**
 * Batched profile loading for discovery cards.
 *
 * Discovery resolves to a list of *ids*; the cards need names, photos and match
 * data. Mobile issues one `getUser` per row, which is why its list crawls. Here
 * we send one request per **batch** of ids using aliased `getUser` fields:
 *
 *   query { u0: getUser(id:"a"){...F} u1: getUser(id:"b"){...F} … }
 *
 * Each alias is still an O(1) DynamoDB GetItem that AppSync resolves in
 * parallel, so a 20-card batch costs one round trip instead of twenty — same
 * data, same backend, no schema change. Results are cached per id for the
 * session, because the same person shows up across re-filters and re-renders.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { getS3ImageUrl, type S3FileRef } from "@/lib/aws/s3Image";
import type { BuddyProfile, NamedRef, UserTypeName } from "@/lib/buddies/types";

/** Cards per request. Small enough to keep the query readable in logs. */
export const PROFILE_BATCH_SIZE = 20;

const PROFILE_FIELDS = /* GraphQL */ `
  fragment BuddyCardFields on User {
    id
    name
    birth
    bio
    userType
    ambassador
    isSnooze
    Relationship {
      name
    }
    State {
      stateAbbreviation
    }
    City {
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
    Goal {
      image {
        file {
          key
          bucket
          region
        }
      }
    }
    Diagnosis {
      items {
        diagnosis {
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
    Treatments {
      items {
        treatment {
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
  }
`;

interface RawNamed {
  id?: string | null;
  name?: string | null;
}

interface RawProfile {
  id: string;
  name?: string | null;
  birth?: string | null;
  bio?: string | null;
  userType?: string | null;
  ambassador?: boolean | null;
  isSnooze?: boolean | null;
  Relationship?: { name?: string | null } | null;
  State?: { stateAbbreviation?: string | null } | null;
  City?: { name?: string | null } | null;
  College?: RawNamed | null;
  ProfilePic?: { file?: S3FileRef | null } | null;
  Goal?: { image?: { file?: S3FileRef | null } | null } | null;
  Diagnosis?: { items?: { diagnosis?: RawNamed | null }[] | null } | null;
  Hospitals?: { items?: { hospital?: RawNamed | null }[] | null } | null;
  Treatments?: { items?: { treatment?: RawNamed | null }[] | null } | null;
  Interests?: { items?: { interest?: RawNamed | null }[] | null } | null;
  SupportOrganizations?: {
    items?: { supportOrganizations?: RawNamed | null }[] | null;
  } | null;
  Desabilities?: { items?: { disabilities?: RawNamed | null }[] | null } | null;
}

function named<T>(
  rows: { items?: T[] | null } | null | undefined,
  pick: (row: T) => RawNamed | null | undefined,
): NamedRef[] {
  return (rows?.items ?? [])
    .map((row) => pick(row))
    .filter((v): v is RawNamed => !!v?.id && !!v?.name)
    .map((v) => ({ id: v.id!, name: v.name! }));
}

async function toProfile(raw: RawProfile): Promise<BuddyProfile> {
  const [profilePicUrl, goalImageUrl] = await Promise.all([
    getS3ImageUrl(raw.ProfilePic?.file),
    getS3ImageUrl(raw.Goal?.image?.file),
  ]);

  return {
    id: raw.id,
    name: raw.name ?? "",
    birth: raw.birth ?? null,
    bio: raw.bio ?? null,
    userType: (raw.userType ?? "PATIENT") as UserTypeName,
    ambassador: raw.ambassador === true,
    isSnooze: raw.isSnooze === true,
    relationshipName: raw.Relationship?.name ?? null,
    stateAbbreviation: raw.State?.stateAbbreviation ?? null,
    cityName: raw.City?.name ?? null,
    collegeId: raw.College?.id ?? null,
    profilePicUrl,
    goalImageUrl,
    diagnosis: named(raw.Diagnosis, (r) => r.diagnosis),
    hospitals: named(raw.Hospitals, (r) => r.hospital),
    treatments: named(raw.Treatments, (r) => r.treatment),
    interests: named(raw.Interests, (r) => r.interest),
    supportOrganizations: named(
      raw.SupportOrganizations,
      (r) => r.supportOrganizations,
    ),
    desabilities: named(raw.Desabilities, (r) => r.disabilities),
  };
}

/* ── Cache ──────────────────────────────────────────────────────────────── */

const cache = new Map<string, BuddyProfile>();
/** Ids confirmed to have no row — remembered so we stop re-asking for them. */
const missing = new Set<string>();
const inflight = new Map<string, Promise<void>>();

export function getCachedProfile(id: string): BuddyProfile | undefined {
  return cache.get(id);
}

export function isKnownMissingProfile(id: string): boolean {
  return missing.has(id);
}

/** Drops cached profiles so the next read re-fetches (e.g. after reconnect). */
export function clearProfileCache(): void {
  cache.clear();
  missing.clear();
}

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_:-]/g, "");
}

async function fetchBatch(ids: string[]): Promise<void> {
  const aliases = ids
    .map((id, i) => `u${i}: getUser(id: "${safeId(id)}") { ...BuddyCardFields }`)
    .join("\n    ");

  const query = /* GraphQL */ `
    query buddyProfileBatch {
      ${aliases}
    }
    ${PROFILE_FIELDS}
  `;

  const { data } = await executeAppSyncGraphql<
    Record<string, RawProfile | null>
  >({ query, variables: {}, authWithUserPool: true });

  await Promise.all(
    ids.map(async (id, i) => {
      const raw = data?.[`u${i}`];
      if (!raw?.id) {
        missing.add(id);
        return;
      }
      cache.set(id, await toProfile(raw));
    }),
  );
}

/**
 * Loads the given ids into the cache, skipping anything already known. Safe to
 * call with overlapping id sets from several components at once — in-flight
 * batches are shared rather than duplicated.
 */
export async function loadProfiles(ids: string[]): Promise<void> {
  const wanted = ids.filter(
    (id) => id && !cache.has(id) && !missing.has(id) && !inflight.has(id),
  );

  // Anything already being fetched: wait on it rather than re-requesting.
  const pending = ids
    .map((id) => inflight.get(id))
    .filter((p): p is Promise<void> => !!p);

  const batches: string[][] = [];
  for (let i = 0; i < wanted.length; i += PROFILE_BATCH_SIZE) {
    batches.push(wanted.slice(i, i + PROFILE_BATCH_SIZE));
  }

  const runs = batches.map((batch) => {
    const run = fetchBatch(batch)
      .catch((err) => {
        console.error("[buddies] profile batch failed:", err);
      })
      .finally(() => {
        for (const id of batch) inflight.delete(id);
      });
    for (const id of batch) inflight.set(id, run);
    return run;
  });

  await Promise.all([...pending, ...runs]);
}
