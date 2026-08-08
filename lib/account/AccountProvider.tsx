"use client";

/**
 * Who is signed in, app-wide: their account type and whether they are snoozed.
 *
 * Three surfaces need this above any feature provider, and each of them is a
 * gate rather than a screen:
 *
 *  • the account menu hides Settings from a host (`resourceLinksFor`)
 *  • the snooze gate replaces every member-facing screen when the account is
 *    asleep — including for someone who snoozed on their phone
 *  • `/settings` guards itself, so a typed URL cannot walk past the menu
 *
 * One AppSync read on mount, re-read when the tab regains focus: snooze can be
 * flipped from the other client, and a browser tab left open all day would
 * otherwise keep behaving as though the member were active.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { getSignedInUserId } from "@/lib/buddies/currentUser";
import { useVisibilityResync } from "@/lib/hooks/useVisibilityResync";
import type { UserTypeValue } from "@/lib/profile/types";

/**
 * Mobile reads snooze on its own (`GET_USER_SNOOZE_STATUS`) and the rest from
 * `GET_MAIN_USER_DATA`. One query here: the fields are tiny and two round trips
 * on every page load would be worse than a slightly wider selection.
 */
const GET_ACCOUNT = /* GraphQL */ `
  query getSignedInAccount($id: ID!) {
    getUser(id: $id) {
      id
      name
      birth
      userType
      groupHostId
      isSnooze
    }
  }
`;

export interface AccountState {
  /** Null until the first read resolves, or when nobody is signed in. */
  userId: string | null;
  name: string | null;
  birth: string | null;
  userType: UserTypeValue | null;
  groupHostId: string | null;
  isSnooze: boolean;
  /** False until the first read settles — gates must not act on a guess. */
  loaded: boolean;
  refresh: () => Promise<void>;
  /** Applies a toggle locally so the gate flips without waiting for a re-read. */
  setSnoozeLocal: (value: boolean) => void;
}

const EMPTY: AccountState = {
  userId: null,
  name: null,
  birth: null,
  userType: null,
  groupHostId: null,
  isSnooze: false,
  loaded: false,
  refresh: async () => {},
  setSnoozeLocal: () => {},
};

const AccountContext = createContext<AccountState>(EMPTY);

export function useAccount(): AccountState {
  return useContext(AccountContext);
}

interface Row {
  id?: string;
  name?: string | null;
  birth?: string | null;
  userType?: UserTypeValue | null;
  groupHostId?: string | null;
  isSnooze?: boolean | null;
}

export default function AccountProvider({ children }: { children: ReactNode }) {
  const [row, setRow] = useState<Row | null>(null);
  const [loaded, setLoaded] = useState(false);

  const read = useCallback(async () => {
    try {
      const id = await getSignedInUserId();
      if (!id) return;
      const { data } = await executeAppSyncGraphql<{ getUser: Row | null }>({
        query: GET_ACCOUNT,
        variables: { id },
        authWithUserPool: true,
      });
      if (data?.getUser?.id) setRow(data.getUser);
    } catch (err) {
      /*
       * Fail open. A snooze gate that appears because a query timed out would
       * lock a member out of a support product for no reason, and the account
       * menu falls back to hiding Settings, which is the safe direction.
       */
      console.error("[account] could not read the signed-in account:", err);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void read();
  }, [read]);

  // Snooze can be toggled from the phone while this tab sits open.
  useVisibilityResync(read);

  const value = useMemo<AccountState>(
    () => ({
      userId: row?.id ?? null,
      name: row?.name ?? null,
      birth: row?.birth ?? null,
      userType: row?.userType ?? null,
      groupHostId: row?.groupHostId?.trim() || null,
      isSnooze: row?.isSnooze === true,
      loaded,
      refresh: read,
      setSnoozeLocal: (value: boolean) =>
        setRow((prev) => (prev ? { ...prev, isSnooze: value } : prev)),
    }),
    [row, loaded, read],
  );

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}
