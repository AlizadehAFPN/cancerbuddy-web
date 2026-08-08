"use client";

import { useEffect, useRef } from "react";

import {
  bootstrapSupportChannelAfterEnrollment,
  type SupportStreamClient,
} from "@/lib/host-signup/bootstrapSupportChannel";

/** The marker enrolment leaves when it could not finish provisioning. */
export const PENDING_SUPPORT_KEY = "pendingSupportChannel";

/**
 * Finishes the Support conversation when signup could not.
 *
 * Provisioning needs a connected Stream client, and enrolment completes before
 * one necessarily exists — so it leaves a marker and the first visit to the chat
 * list picks it up. Without this, a member whose signup happened to race the
 * Stream connection would never get a Support thread at all.
 *
 * Runs at most once per mount, and clears the marker on success only: a failure
 * leaves it set so the next visit tries again, which is the whole point of the
 * marker. `ranRef` stops the same visit from retrying in a loop.
 */
export function useSupportChannelBootstrap(
  client: SupportStreamClient | null,
  userId: string | null,
): void {
  const ranRef = useRef(false);

  useEffect(() => {
    if (!client || !userId || ranRef.current) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(PENDING_SUPPORT_KEY) !== "true") return;

    ranRef.current = true;

    void bootstrapSupportChannelAfterEnrollment({
      cognitoUserId: userId,
      client,
    })
      .then((wired) => {
        if (wired) window.localStorage.removeItem(PENDING_SUPPORT_KEY);
      })
      .catch((err) => {
        console.error("[chat] support bootstrap retry failed:", err);
      });
  }, [client, userId]);
}
