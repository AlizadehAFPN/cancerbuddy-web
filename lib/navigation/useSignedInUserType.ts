"use client";

/**
 * The signed-in user's account type, for navigation gating.
 *
 * The app shell renders before any feature provider, so it can't read one. This
 * does a single narrow query and caches the answer for the page's lifetime —
 * the value can't change without signing out.
 *
 * Returns `undefined` while unknown so callers can hold a decision rather than
 * flash a nav item they're about to remove.
 */

import { useEffect, useState } from "react";
import { Auth } from "aws-amplify";
import { ensureAmplifyConfigured } from "@/lib/aws/amplifyConfigure";
import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";

const GET_USER_TYPE = /* GraphQL */ `
  query getUserType($id: ID!) {
    getUser(id: $id) {
      id
      userType
    }
  }
`;

let cached: string | null | undefined;
let inflight: Promise<string | null> | null = null;

async function loadUserType(): Promise<string | null> {
  if (cached !== undefined) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    ensureAmplifyConfigured();
    try {
      const user = await Auth.currentAuthenticatedUser({ bypassCache: false });
      const id = user?.getUsername?.()?.trim();
      if (!id) return null;

      const { data } = await executeAppSyncGraphql<{
        getUser: { userType?: string | null } | null;
      }>({ query: GET_USER_TYPE, variables: { id }, authWithUserPool: true });

      cached = data?.getUser?.userType ?? null;
      return cached;
    } catch {
      // Not signed in, or the row is unreadable — gate on nothing.
      cached = null;
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function useSignedInUserType(): string | null | undefined {
  const [userType, setUserType] = useState<string | null | undefined>(cached);

  useEffect(() => {
    if (cached !== undefined) {
      setUserType(cached);
      return;
    }
    let active = true;
    loadUserType().then((value) => {
      if (active) setUserType(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return userType;
}

export function clearUserTypeCache(): void {
  cached = undefined;
}
