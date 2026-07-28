"use client";

/**
 * "Connect" — sending a buddy request — shared by the discovery cards and the
 * profile page so both stay in step.
 *
 * The connection map is updated optimistically the moment the mutation
 * succeeds, which is what flips every visible instance of that person from
 * Connect to Pending without a refetch. No Stream channel is created here: the
 * channel only exists once the *other* side accepts.
 */

import { useCallback, useState } from "react";
import { t } from "@/lib/i18n";
import { toast } from "sonner";
import { createConnectionRequest } from "@/lib/buddies/connections";
import { useBuddies } from "@/lib/buddies/BuddiesProvider";
import { formatName } from "@/lib/buddies/display";

export interface ConnectAction {
  connect: (target: { id: string; name?: string | null }) => Promise<void>;
  /** Ids with a request in flight, so their button can show a busy state. */
  busyIds: string[];
}

export function useConnectAction(): ConnectAction {
  const { userId, connectionMap, setConnection } = useBuddies();
  const [busyIds, setBusyIds] = useState<string[]>([]);

  const connect = useCallback(
    async (target: { id: string; name?: string | null }) => {
      if (!userId) return;

      // Guard against a double click racing two rows for the same person.
      if (connectionMap[target.id]) {
        toast.info(t("app.buddies.alreadyConnected"));
        return;
      }

      setBusyIds((prev) => [...prev, target.id]);
      try {
        const connectionId = await createConnectionRequest({
          fromUserId: userId,
          toUserId: target.id,
        });
        setConnection(target.id, { status: "pending", connectionId });
        toast.success(
          t("app.buddies.inviteSent", { name: formatName(target.name) }),
        );
      } catch (err) {
        console.error("[buddies] connect failed:", err);
        toast.error(t("app.buddies.inviteError"));
      } finally {
        setBusyIds((prev) => prev.filter((id) => id !== target.id));
      }
    },
    [userId, connectionMap, setConnection],
  );

  return { connect, busyIds };
}
