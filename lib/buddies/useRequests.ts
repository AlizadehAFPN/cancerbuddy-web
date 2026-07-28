"use client";

/**
 * Incoming buddy requests + the Connect / Maybe later actions.
 *
 * Accepting is a two-step effect and the order matters: the AppSync row must be
 * marked accepted *before* the Stream channel is created, because the channel
 * takes the connection's id. If channel creation fails afterwards the pair are
 * still connected and the channel is created on next open, which is how mobile
 * behaves too — the reverse order would leave an orphan channel.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  acceptConnection,
  deleteConnection,
  fetchPendingRequests,
} from "@/lib/buddies/connections";
import { t } from "@/lib/i18n";
import { useBuddies } from "@/lib/buddies/BuddiesProvider";
import { useStreamChat } from "@/lib/chat/StreamChatProvider";
import { formatName } from "@/lib/buddies/display";
import type { PendingRequest } from "@/lib/buddies/types";

export interface RequestsResult {
  requests: PendingRequest[];
  loading: boolean;
  error: string | null;
  /** Ids currently mid-action, so their card can show a busy state. */
  busyIds: string[];
  accept: (request: PendingRequest) => Promise<void>;
  dismiss: (request: PendingRequest) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useRequests(): RequestsResult {
  const { userId, setConnection, clearConnection } = useBuddies();
  const { client } = useStreamChat();

  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const rows = await fetchPendingRequests(userId);
      if (!mountedRef.current) return;
      setRequests(rows);
      setError(null);
    } catch (err) {
      console.error("[buddies] failed to load requests:", err);
      if (mountedRef.current) setError(t("app.buddies.requestsError"));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    void load();
  }, [userId, load]);

  const markBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) =>
      busy ? [...prev, id] : prev.filter((existing) => existing !== id),
    );

  /**
   * Creates the 1:1 channel for a newly accepted connection. The channel is
   * named "<them> <me>" because chat search autocompletes on channel name and
   * users search for the other person, not themselves — same as mobile.
   */
  const createChannel = useCallback(
    async (request: PendingRequest) => {
      if (!client || !userId) return;
      const other = request.remitent.id;

      const existing = await client.queryChannels(
        { type: "messaging", members: { $eq: [userId, other] } },
        [{ last_message_at: -1 }],
        { watch: false, state: false },
      );
      if (existing.length > 0) return;

      const myName = (client.user?.name as string | undefined) ?? "";
      const channel = client.channel("messaging", request.id, {
        members: [userId, other],
        name: `${request.remitent.name.split(" ")[0]} ${myName.split(" ")[0]}`.trim(),
      });
      await channel.create();
    },
    [client, userId],
  );

  const accept = useCallback(
    async (request: PendingRequest) => {
      markBusy(request.id, true);
      try {
        await acceptConnection(request.id);
        setConnection(request.remitent.id, {
          status: "connected",
          connectionId: request.id,
        });
        setRequests((prev) => prev.filter((r) => r.id !== request.id));

        try {
          await createChannel(request);
        } catch (err) {
          // The connection is live either way; the channel is recreated on open.
          console.error("[buddies] channel creation failed:", err);
        }
      } catch (err) {
        console.error("[buddies] accept failed:", err);
        throw new Error(
          t("app.buddies.acceptError", {
            name: formatName(request.remitent.name),
          }),
        );
      } finally {
        if (mountedRef.current) markBusy(request.id, false);
      }
    },
    [createChannel, setConnection],
  );

  const dismiss = useCallback(
    async (request: PendingRequest) => {
      markBusy(request.id, true);
      try {
        await deleteConnection(request.id);
        clearConnection(request.remitent.id);
        setRequests((prev) => prev.filter((r) => r.id !== request.id));
      } catch (err) {
        console.error("[buddies] dismiss failed:", err);
        throw new Error(t("app.buddies.dismissError"));
      } finally {
        if (mountedRef.current) markBusy(request.id, false);
      }
    },
    [clearConnection],
  );

  return { requests, loading, error, busyIds, accept, dismiss, refresh: load };
}
