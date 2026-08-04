"use client";

/**
 * Reading the Updates feed from AppSync.
 *
 * Two deliberate differences from mobile's `GET_NOTIFICATIONS`, both recorded
 * in `docs/UPDATES.md`:
 *
 *  1. **No `read: {eq: false}` filter.** Mobile asks for unread only. The flag
 *     is never actually set — the Lambda that should set it writes to a key the
 *     table doesn't have — so today the filter is a no-op and both apps show
 *     the same rows. Leaving it out means the web keeps its history if that
 *     Lambda is ever fixed, instead of silently emptying.
 *
 *  2. **De-duplicated by `id`, not `createdAt`.** Mobile keys a Map on
 *     `createdAt`, so two notifications written in the same millisecond
 *     collapse into one. Measured against a real account's feed that discards
 *     about 2% of it — two likes landing together, one of them gone. Ids are
 *     unique by construction.
 */

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { getS3ImageUrl } from "@/lib/aws/s3Image";
import type {
  AppNotification,
  NotificationPage,
  RawNotification,
} from "@/lib/notifications/types";
import type { UserTypeName } from "@/lib/buddies/types";

const GET_NOTIFICATIONS = `
  query Notifications($id: ID!, $nextToken: String, $limit: Int) {
    searchNotifications(
      limit: $limit
      filter: { userId: { eq: $id } }
      sort: { field: createdAt, direction: desc }
      nextToken: $nextToken
    ) {
      total
      nextToken
      items {
        id
        read
        type
        typeNotification
        createdAt
        activityId
        feedId
        parentReactionId
        group {
          id
          name
        }
        remitent {
          id
          name
          userType
          ambassador
          ProfilePic {
            file {
              key
              region
              bucket
            }
          }
          Goal {
            name
            image {
              file {
                key
                region
                bucket
              }
            }
          }
        }
      }
    }
  }
`;

/** Mobile's page size. Kept identical so scroll behaviour matches. */
export const NOTIFICATIONS_PAGE_SIZE = 20;

async function toNotification(raw: RawNotification): Promise<AppNotification | null> {
  // A notification with no sender has nothing to render — no avatar, no name.
  // Mobile drops these too, inside `ordenarCategorias`.
  if (!raw.remitent?.id || !raw.remitent.name) return null;

  const [profilePicUrl, goalImageUrl] = await Promise.all([
    getS3ImageUrl(raw.remitent.ProfilePic?.file),
    getS3ImageUrl(raw.remitent.Goal?.image?.file),
  ]);

  return {
    id: raw.id,
    type: raw.type ?? "",
    typeNotification: raw.typeNotification ?? "",
    createdAt: raw.createdAt,
    read: raw.read === true,
    group:
      raw.group?.id && raw.group.name
        ? { id: raw.group.id, name: raw.group.name }
        : null,
    remitent: {
      id: raw.remitent.id,
      name: raw.remitent.name,
      userType: (raw.remitent.userType as UserTypeName | null) ?? null,
      ambassador: raw.remitent.ambassador,
      profilePicUrl,
      goalImageUrl,
    },
    activityId: raw.activityId,
    feedId: raw.feedId,
    parentReactionId: raw.parentReactionId,
  };
}

export async function fetchNotifications(
  userId: string,
  options: { limit?: number; nextToken?: string | null } = {},
): Promise<NotificationPage> {
  const { data } = await executeAppSyncGraphql<{
    searchNotifications?: {
      items?: (RawNotification | null)[] | null;
      nextToken?: string | null;
      total?: number | null;
    } | null;
  }>({
    query: GET_NOTIFICATIONS,
    variables: {
      id: userId,
      limit: options.limit ?? NOTIFICATIONS_PAGE_SIZE,
      nextToken: options.nextToken ?? null,
    },
  });

  const rows = (data?.searchNotifications?.items ?? []).filter(
    (r): r is RawNotification => !!r?.id,
  );

  const resolved = await Promise.all(rows.map(toNotification));

  return {
    items: resolved.filter((n): n is AppNotification => n !== null),
    nextToken: data?.searchNotifications?.nextToken ?? null,
    total: data?.searchNotifications?.total ?? 0,
  };
}

/**
 * Merges a freshly fetched page into the list already on screen.
 *
 * Pagination over a live index can hand back a row twice — a notification
 * arriving between two `fetchMore` calls shifts the window — so appending
 * blindly would render duplicate keys.
 */
export function mergeNotifications(
  existing: AppNotification[],
  incoming: AppNotification[],
): AppNotification[] {
  const seen = new Set(existing.map((n) => n.id));
  return [...existing, ...incoming.filter((n) => !seen.has(n.id))];
}
