/**
 * AppSync reads for groups.
 *
 * Field selections are copied from the mobile app's `graphql/queries/groups.ts`
 * so both clients see the same shape of a group. S3 image refs are resolved to
 * signed URLs here, once, rather than in every component that renders one.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { getS3ImageUrl, type S3FileRef } from "@/lib/aws/s3Image";
import type { Group, GroupHost, LiveGroup } from "@/lib/groups/types";

const RESULT_LIMIT = 1000000;
const MAX_PAGES = 50;

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_:-]/g, "");
}

/* ── Fragments ──────────────────────────────────────────────────────────── */

/** Everything a group card or detail pane needs. */
const GROUP_FIELDS = /* GraphQL */ `
  fragment GroupFields on Group {
    id
    name
    description
    about
    verified
    disabled
    isPublic
    groupPublic
    code
    widgetAvailable
    widget {
      tab1
      tab2
      url
    }
    ProfilePic {
      file {
        key
        region
        bucket
      }
    }
    Sponsor {
      name
      description
      logo {
        file {
          key
          region
          bucket
        }
      }
    }
    Host {
      hosts: items {
        id
        name
        occupation
        bio
        ambassador
        hostOrder
        groupHostId
        pronoun: Pronoun {
          name
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
  }
`;

const GET_GROUP_BY_ID = /* GraphQL */ `
  query getGroupById($id: ID!) {
    getGroup(id: $id) {
      ...GroupFields
    }
  }
  ${GROUP_FIELDS}
`;

const GET_USER_GROUPS = /* GraphQL */ `
  query getUserGroups($userId: ID!) {
    listUserGroups(filter: { userGroupUserId: { eq: $userId } }, limit: ${RESULT_LIMIT}) {
      groups: items {
        id
        muted
        Group {
          ...GroupFields
        }
      }
    }
  }
  ${GROUP_FIELDS}
`;

const LIST_ALL_GROUPS = (nextToken?: string) => /* GraphQL */ `
  query listAllGroups {
    listGroups(limit: 1000${nextToken ? `, nextToken: "${nextToken}"` : ""}) {
      items {
        ...GroupFields
      }
      nextToken
    }
  }
  ${GROUP_FIELDS}
`;

const GET_TOTAL_MEMBERS = (groupId: string) => /* GraphQL */ `
  query getTotalMembers {
    findTotalUserGroups(groupId: "${safeId(groupId)}") {
      total
    }
  }
`;

const LIST_LIVE_GROUPS = /* GraphQL */ `
  query listLiveGroups {
    listLiveStreamingGroups {
      items {
        id
        groupId
        inLive
      }
    }
  }
`;

/* ── Raw shapes ─────────────────────────────────────────────────────────── */

interface RawHost {
  id: string;
  name?: string | null;
  occupation?: string | null;
  bio?: string | null;
  ambassador?: boolean | null;
  hostOrder?: number | null;
  groupHostId?: string | null;
  pronoun?: { name?: string | null } | null;
  profilePic?: { file?: S3FileRef | null } | null;
}

interface RawGroup {
  id: string;
  name?: string | null;
  description?: string | null;
  about?: string | null;
  verified?: boolean | null;
  disabled?: boolean | null;
  isPublic?: boolean | null;
  groupPublic?: string | null;
  code?: string | null;
  widgetAvailable?: boolean | null;
  widget?: { tab1?: string | null; tab2?: string | null; url?: string | null } | null;
  ProfilePic?: { file?: S3FileRef | null } | null;
  Sponsor?: {
    name?: string | null;
    description?: string | null;
    logo?: { file?: S3FileRef | null } | null;
  } | null;
  Host?: { hosts?: RawHost[] | null } | null;
}

async function toHost(raw: RawHost): Promise<GroupHost> {
  return {
    id: raw.id,
    name: raw.name ?? "",
    occupation: raw.occupation ?? null,
    bio: raw.bio ?? null,
    ambassador: raw.ambassador === true,
    hostOrder: raw.hostOrder ?? null,
    groupHostId: raw.groupHostId ?? null,
    pronoun: raw.pronoun?.name ?? null,
    profilePicUrl: await getS3ImageUrl(raw.profilePic?.file),
  };
}

async function toGroup(raw: RawGroup): Promise<Group> {
  const [profilePicUrl, sponsorLogoUrl, hosts] = await Promise.all([
    getS3ImageUrl(raw.ProfilePic?.file),
    getS3ImageUrl(raw.Sponsor?.logo?.file),
    Promise.all((raw.Host?.hosts ?? []).map(toHost)),
  ]);

  // Hosts have an explicit display order; unordered ones sort last.
  hosts.sort(
    (a, b) =>
      (a.hostOrder ?? Number.MAX_SAFE_INTEGER) -
      (b.hostOrder ?? Number.MAX_SAFE_INTEGER),
  );

  return {
    id: raw.id,
    name: raw.name ?? "",
    description: raw.description ?? null,
    about: raw.about ?? null,
    verified: raw.verified === true,
    disabled: raw.disabled === true,
    isPublic: raw.isPublic === true,
    groupPublic: raw.groupPublic ?? null,
    code: raw.code ?? null,
    profilePicUrl,
    sponsor: raw.Sponsor
      ? {
          name: raw.Sponsor.name ?? null,
          description: raw.Sponsor.description ?? null,
          logoUrl: sponsorLogoUrl,
        }
      : null,
    hosts,
    widgetAvailable: raw.widgetAvailable === true,
    widget: raw.widget ?? null,
  };
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Groups the user has joined. Disabled groups are filtered out — mobile keeps
 * them only in dev builds, and a disabled group has no usable feed.
 */
export async function fetchJoinedGroups(userId: string): Promise<Group[]> {
  const { data } = await executeAppSyncGraphql<{
    listUserGroups: {
      groups?: { id: string; muted?: boolean | null; Group?: RawGroup | null }[] | null;
    } | null;
  }>({
    query: GET_USER_GROUPS,
    variables: { userId },
    authWithUserPool: true,
  });

  const rows = (data?.listUserGroups?.groups ?? []).filter(
    (row) => row?.Group?.id && row.Group.disabled !== true,
  );

  return Promise.all(
    rows.map(async (row) => ({
      ...(await toGroup(row.Group!)),
      muted: row.muted === true,
      userGroupId: row.id,
    })),
  );
}

/** Every group in the catalogue, paged. Used by Discover. */
export async function fetchAllGroups(): Promise<Group[]> {
  const raws: RawGroup[] = [];
  let nextToken: string | undefined;
  let pages = 0;

  do {
    const { data } = await executeAppSyncGraphql<{
      listGroups: { items?: RawGroup[] | null; nextToken?: string | null } | null;
    }>({ query: LIST_ALL_GROUPS(nextToken), variables: {}, authWithUserPool: true });

    raws.push(...(data?.listGroups?.items ?? []));
    nextToken = data?.listGroups?.nextToken ?? undefined;
    pages += 1;
  } while (nextToken && pages < MAX_PAGES);

  const groups = await Promise.all(raws.filter((g) => g?.id).map(toGroup));
  return groups.filter((g) => !g.disabled);
}

export async function fetchGroupById(groupId: string): Promise<Group | null> {
  const { data } = await executeAppSyncGraphql<{ getGroup: RawGroup | null }>({
    query: GET_GROUP_BY_ID,
    variables: { id: groupId },
    authWithUserPool: true,
  });
  const raw = data?.getGroup;
  if (!raw?.id) return null;
  return toGroup(raw);
}

export async function fetchGroupMemberCount(groupId: string): Promise<number> {
  try {
    const { data } = await executeAppSyncGraphql<{
      findTotalUserGroups: { total?: number | null } | null;
    }>({ query: GET_TOTAL_MEMBERS(groupId), variables: {}, authWithUserPool: true });
    return data?.findTotalUserGroups?.total ?? 0;
  } catch {
    return 0;
  }
}

export async function fetchLiveGroups(): Promise<LiveGroup[]> {
  try {
    const { data } = await executeAppSyncGraphql<{
      listLiveStreamingGroups: { items?: LiveGroup[] | null } | null;
    }>({ query: LIST_LIVE_GROUPS, variables: {}, authWithUserPool: true });
    return (data?.listLiveStreamingGroups?.items ?? []).filter((g) => g?.groupId);
  } catch (err) {
    console.error("[groups] live groups query failed:", err);
    return [];
  }
}
