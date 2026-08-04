/**
 * Group members and host detail.
 *
 * Members are paged through `userGroupsByGroupId`. Mobile's query pulls a very
 * wide user record for each row — diagnoses, treatments, interests, hospitals —
 * because it reuses the same card component as buddy discovery. A list row here
 * needs far less, so this asks for the fields the row actually renders; the
 * full profile is one click away and already has its own fetch.
 *
 * Tapping a member splits two ways, as on mobile: anyone with a `groupHostId`
 * is a host and opens the host page, everyone else opens their buddy profile.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { getS3ImageUrl, type S3FileRef } from "@/lib/aws/s3Image";

export const MEMBERS_PAGE_SIZE = 30;

export interface GroupMember {
  /** The user's id — not the membership row's. */
  id: string;
  name: string;
  birth?: string | null;
  userType?: string | null;
  ambassador: boolean;
  /** Set when this person hosts a group; routes to the host page. */
  groupHostId?: string | null;
  /** Snoozed accounts can't be connected with. */
  isSnooze: boolean;
  relationshipName?: string | null;
  city?: string | null;
  stateAbbreviation?: string | null;
  profilePicUrl?: string;
  goalImageUrl?: string;
}

const LIST_MEMBERS = (withToken: boolean) => /* GraphQL */ `
  query groupMembers($id: ID!${withToken ? ", $token: String" : ""}) {
    userGroupsByGroupId(
      userGroupGroupId: $id
      limit: ${MEMBERS_PAGE_SIZE}
      ${withToken ? "nextToken: $token" : ""}
    ) {
      items {
        id
        User {
          id
          name
          birth
          userType
          ambassador
          groupHostId
          isSnooze
          Relationship {
            name
          }
          City {
            name
          }
          State {
            stateAbbreviation
          }
          ProfilePic {
            file {
              bucket
              key
              region
            }
          }
          Goal {
            image {
              file {
                bucket
                key
                region
              }
            }
          }
        }
      }
      nextToken
    }
  }
`;

interface RawMember {
  id: string;
  User?: {
    id?: string;
    name?: string | null;
    birth?: string | null;
    userType?: string | null;
    ambassador?: boolean | null;
    groupHostId?: string | null;
    isSnooze?: boolean | null;
    Relationship?: { name?: string | null } | null;
    City?: { name?: string | null } | null;
    State?: { stateAbbreviation?: string | null } | null;
    ProfilePic?: { file?: S3FileRef | null } | null;
    Goal?: { image?: { file?: S3FileRef | null } | null } | null;
  } | null;
}

export interface MembersPage {
  members: GroupMember[];
  nextToken?: string;
}

export async function fetchGroupMembers(params: {
  groupId: string;
  token?: string;
}): Promise<MembersPage> {
  const { data } = await executeAppSyncGraphql<{
    userGroupsByGroupId: {
      items?: RawMember[] | null;
      nextToken?: string | null;
    } | null;
  }>({
    query: LIST_MEMBERS(!!params.token),
    variables: params.token
      ? { id: params.groupId, token: params.token }
      : { id: params.groupId },
    authWithUserPool: true,
  });

  const rows = (data?.userGroupsByGroupId?.items ?? []).filter(
    (row) => row?.User?.id,
  );

  const members = await Promise.all(
    rows.map(async (row) => {
      const u = row.User!;
      const [profilePicUrl, goalImageUrl] = await Promise.all([
        getS3ImageUrl(u.ProfilePic?.file),
        getS3ImageUrl(u.Goal?.image?.file),
      ]);
      return {
        id: u.id!,
        name: u.name ?? "",
        birth: u.birth ?? null,
        userType: u.userType ?? null,
        ambassador: u.ambassador === true,
        groupHostId: u.groupHostId ?? null,
        isSnooze: u.isSnooze === true,
        relationshipName: u.Relationship?.name ?? null,
        city: u.City?.name ?? null,
        stateAbbreviation: u.State?.stateAbbreviation ?? null,
        profilePicUrl,
        goalImageUrl,
      } satisfies GroupMember;
    }),
  );

  return {
    members,
    nextToken: data?.userGroupsByGroupId?.nextToken ?? undefined,
  };
}

/* ── Host detail ────────────────────────────────────────────────────────── */

export interface HostDetail {
  id: string;
  name: string;
  bio?: string | null;
  occupation?: string | null;
  pronoun?: string | null;
  ambassador: boolean;
  profilePicUrl?: string;
  /** The group they host, with its sponsor. */
  groupId?: string | null;
  groupName?: string | null;
  sponsorName?: string | null;
  sponsorDescription?: string | null;
  sponsorLogoUrl?: string;
}

const GET_HOST = /* GraphQL */ `
  query getHostDetail($id: ID!) {
    getUser(id: $id) {
      id
      name
      bio
      occupation
      ambassador
      groupHostId
      Pronoun {
        name
      }
      ProfilePic {
        file {
          bucket
          key
          region
        }
      }
    }
  }
`;

const GET_HOST_GROUP = /* GraphQL */ `
  query getHostGroupDetail($id: ID!) {
    getGroup(id: $id) {
      id
      name
      Sponsor {
        name
        description
        logo {
          file {
            bucket
            key
            region
          }
        }
      }
    }
  }
`;

export async function fetchHostDetail(
  userId: string,
): Promise<HostDetail | null> {
  const { data } = await executeAppSyncGraphql<{
    getUser: {
      id?: string;
      name?: string | null;
      bio?: string | null;
      occupation?: string | null;
      ambassador?: boolean | null;
      groupHostId?: string | null;
      Pronoun?: { name?: string | null } | null;
      ProfilePic?: { file?: S3FileRef | null } | null;
    } | null;
  }>({ query: GET_HOST, variables: { id: userId }, authWithUserPool: true });

  const raw = data?.getUser;
  if (!raw?.id) return null;

  const profilePicUrl = await getS3ImageUrl(raw.ProfilePic?.file);

  const host: HostDetail = {
    id: raw.id,
    name: raw.name ?? "",
    bio: raw.bio ?? null,
    occupation: raw.occupation ?? null,
    pronoun: raw.Pronoun?.name ?? null,
    ambassador: raw.ambassador === true,
    profilePicUrl,
    groupId: raw.groupHostId ?? null,
  };

  // The sponsor blurb belongs to the group, not the person.
  if (raw.groupHostId) {
    try {
      const { data: groupData } = await executeAppSyncGraphql<{
        getGroup: {
          id?: string;
          name?: string | null;
          Sponsor?: {
            name?: string | null;
            description?: string | null;
            logo?: { file?: S3FileRef | null } | null;
          } | null;
        } | null;
      }>({
        query: GET_HOST_GROUP,
        variables: { id: raw.groupHostId },
        authWithUserPool: true,
      });

      const group = groupData?.getGroup;
      if (group) {
        host.groupName = group.name ?? null;
        host.sponsorName = group.Sponsor?.name ?? null;
        host.sponsorDescription = group.Sponsor?.description ?? null;
        host.sponsorLogoUrl = await getS3ImageUrl(group.Sponsor?.logo?.file);
      }
    } catch (err) {
      console.error("[groups] host group lookup failed:", err);
    }
  }

  return host;
}
