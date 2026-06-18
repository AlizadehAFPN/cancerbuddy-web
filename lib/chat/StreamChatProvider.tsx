"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { Auth } from "aws-amplify";
import type { StreamChat, Event } from "stream-chat";
import { ensureAmplifyConfigured } from "@/lib/aws/amplifyConfigure";
import { fetchSignedInFirstName } from "@/lib/aws/sessionAttributes";
import { connectStream } from "./streamClient";

export type StreamStatus = "connecting" | "ready" | "error";

interface StreamChatContextValue {
  client: StreamChat | null;
  userId: string | null;
  status: StreamStatus;
  /** Total unread messages across all channels (drives the nav badge). */
  totalUnread: number;
  reconnect: () => void;
}

const StreamChatContext = createContext<StreamChatContextValue>({
  client: null,
  userId: null,
  status: "connecting",
  totalUnread: 0,
  reconnect: () => {},
});

export function useStreamChat(): StreamChatContextValue {
  return useContext(StreamChatContext);
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms),
    ),
  ]);
}

export default function StreamChatProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<StreamChat | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [totalUnread, setTotalUnread] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const reconnect = useCallback(() => {
    setStatus("connecting");
    setAttempt((n) => n + 1);
  }, []);

  // Establish the connection.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        ensureAmplifyConfigured();
        const cognito = await Auth.currentAuthenticatedUser();
        const id: string = cognito.getUsername();
        console.info("[chat] connecting as", id);
        const name = (await fetchSignedInFirstName()) ?? undefined;

        // Surface a hang (token mint / websocket) as an error instead of an
        // endless skeleton.
        const connected = await withTimeout(
          connectStream(id, name),
          15_000,
          "Stream connect timed out",
        );
        if (cancelled) return;

        const unread =
          (connected.user as { total_unread_count?: number } | undefined)
            ?.total_unread_count ?? 0;

        console.info(
          "[chat] connected:",
          connected.userID,
          "unread=",
          unread,
        );
        setClient(connected);
        setUserId(id);
        setTotalUnread(unread);
        setStatus("ready");
      } catch (e) {
        console.error("[chat] connect failed:", e);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Keep the unread total live for the nav badge.
  useEffect(() => {
    if (!client || status !== "ready") return;
    const handler = (event: Event) => {
      if (typeof event.total_unread_count === "number") {
        setTotalUnread(event.total_unread_count);
      }
    };
    client.on(handler);
    return () => {
      client.off(handler);
    };
  }, [client, status]);

  return (
    <StreamChatContext.Provider
      value={{ client, userId, status, totalUnread, reconnect }}
    >
      {children}
    </StreamChatContext.Provider>
  );
}
