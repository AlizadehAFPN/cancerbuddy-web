"use client";

import { useCallback, useState } from "react";

import { t } from "@/lib/i18n";
import { connectAgeRulesBuddySearching } from "@/lib/buddies/age";
import {
  noticeForConnectionContext,
  type ConnectionContext,
  type ProfileNotice,
} from "@/lib/buddies/connectContext";
import { findUserByBuddyId } from "@/lib/buddies/profileDetail";

/**
 * Looking someone up by Buddy ID, with every guard mobile applies.
 *
 * There were two implementations. The sheet in `components/buddies/BuddyIdSheet.tsx`
 * ran the full ladder; the profile screen ran a bare not-found check, so pasting
 * an id there opened the profile of someone snoozed or outside the permitted age
 * bracket — a profile you must not connect with, presented as if you could.
 *
 * Mobile runs the same four checks in the same order
 * (`cancerbuddyapp/src/hooks/useValidateRules.ts:211`), each with its own message
 * so the person understands *why* rather than seeing a generic failure.
 */

/** `BI-0000-0000` — ten alphanumerics plus two dashes. */
export const BUDDY_ID_LENGTH = 10;

/**
 * Normalises anything a person can paste into the canonical form.
 *
 * Accepts a shared link as well as a bare id, because people share the link far
 * more often; strips separators and upper-cases, so `bi00001234`,
 * `BI-0000-1234` and the full URL all resolve to the same account.
 */
export function formatBuddyId(input: string): string {
  const tail = input.includes("/") ? (input.split("/").pop() ?? input) : input;
  const clean = tail.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const body = clean.startsWith("BI") ? clean.slice(2) : clean;
  const padded = body.slice(0, 8);
  return padded.length === 8
    ? `BI-${padded.slice(0, 4)}-${padded.slice(4)}`
    : `BI-${padded}`;
}

/**
 * Progressive display mask for the input field: `BI`, `BI-0000`, `BI-0000-1234`.
 *
 * A different job from {@link formatBuddyId}, which normalises finished input
 * for a lookup. This one has to leave a half-typed value alone.
 */
export function maskBuddyId(raw: string): string {
  if (raw.length <= 2) return raw;
  if (raw.length <= 6) return `${raw.slice(0, 2)}-${raw.slice(2)}`;
  return `${raw.slice(0, 2)}-${raw.slice(2, 6)}-${raw.slice(6)}`;
}

/**
 * Why a lookup refused. The sheet only needs the message, but the
 * `/buddyId/[buddyId]` landing route has to *act* differently per reason —
 * your own id sends you to your own profile, an unknown one renders a
 * not-found node — so the reason travels alongside the copy.
 */
export type LookupRefusal = "notFound" | "self" | "snoozed" | "viewerUnknown";

export type LookupOutcome =
  | { kind: "found"; userId: string }
  /**
   * Open the profile, but say why it will not offer Connect. Mobile does the
   * same for the age rule — `navigate(..., {showButtons: false, message})` in
   * `useValidateRules.ts:209-224` — rather than leaving the member on the sheet
   * with an error and no idea who they just looked up.
   */
  | { kind: "notice"; userId: string; notice: ProfileNotice }
  | { kind: "error"; reason: LookupRefusal; message: string };

/** The four-way answer, for callers that branch on the reason alone. */
export type BuddyIdGuard = "ok" | LookupRefusal | "ageRule";

export function buddyIdGuard(
  match: Parameters<typeof evaluateBuddyIdMatch>[0],
  viewer: LookupViewer | null,
): BuddyIdGuard {
  const outcome = evaluateBuddyIdMatch(match, viewer);
  if (outcome.kind === "error") return outcome.reason;
  if (outcome.kind === "notice") return "ageRule";
  return "ok";
}

/**
 * The guard ladder, as a pure function so both entry points and the tests share
 * exactly one definition of the rules.
 */
/**
 * The two fields the ladder needs, declared here rather than borrowed from
 * `CurrentUserData`: the buddies and profile stores type `birth` differently
 * (non-null vs nullable) and both are legitimate callers.
 */
export interface LookupViewer {
  id: string;
  birth?: string | null;
}

export function evaluateBuddyIdMatch(
  match: {
    id: string;
    name?: string | null;
    birth?: string | null;
    isSnooze?: boolean | null;
  } | null,
  viewer: LookupViewer | null,
): LookupOutcome {
  if (!match) {
    return {
      kind: "error",
      reason: "notFound",
      message: t("app.buddies.buddyIdNotFound"),
    };
  }
  if (!viewer) {
    return {
      kind: "error",
      reason: "viewerUnknown",
      message: t("app.buddies.buddyIdError"),
    };
  }
  if (match.id === viewer.id) {
    return {
      kind: "error",
      reason: "self",
      message: t("app.buddies.buddyIdSelf"),
    };
  }
  if (match.isSnooze) {
    return {
      kind: "error",
      reason: "snoozed",
      message: t("app.buddies.buddyIdSnoozed"),
    };
  }
  /**
   * The age rule is the one guard mobile does **not** stop on: it opens the
   * profile with the connect action withheld and the reason on screen. Snooze,
   * self and not-found all stay on the sheet, as they do on mobile.
   */
  if (!connectAgeRulesBuddySearching(viewer.birth, match.birth)) {
    return { kind: "notice", userId: match.id, notice: "ageRule" };
  }
  return { kind: "found", userId: match.id };
}

/** The path to open for an outcome that resolved to somebody. */
export function buddyProfileHref(
  outcome: Extract<LookupOutcome, { kind: "found" | "notice" }>,
): string {
  return outcome.kind === "notice"
    ? `/buddies/${outcome.userId}?notice=${outcome.notice}`
    : `/buddies/${outcome.userId}`;
}

export interface BuddyIdLookup {
  searching: boolean;
  error: string | null;
  clearError: () => void;
  /** Resolves to the path to open, or null when a guard refused outright. */
  lookup: (raw: string) => Promise<string | null>;
}

export function useBuddyIdLookup(
  viewer: LookupViewer | null,
  /**
   * What relationship the viewer already has with a match, when the caller
   * knows. Mobile queries `FETCH_CONNECTION_STATUS` at this point and passes the
   * answer on as a banner (`useValidateRules.ts:95-133`) — "you two are already
   * Buddies!", or "you are waiting to connect with…". A caller that does not
   * know simply omits it and the profile derives what it can itself.
   */
  contextFor?: (userId: string) => ConnectionContext,
): BuddyIdLookup {
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(
    async (raw: string): Promise<string | null> => {
      const id = formatBuddyId(raw);
      setSearching(true);
      setError(null);
      try {
        const match = await findUserByBuddyId(id);
        const outcome = evaluateBuddyIdMatch(match, viewer);
        if (outcome.kind === "error") {
          setError(outcome.message);
          return null;
        }

        if (outcome.kind === "found" && contextFor) {
          const notice = noticeForConnectionContext(
            contextFor(outcome.userId),
          ).notice;
          if (notice) {
            return buddyProfileHref({
              kind: "notice",
              userId: outcome.userId,
              notice,
            });
          }
        }
        return buddyProfileHref(outcome);
      } catch (err) {
        console.error("[buddies] buddy id lookup failed:", err);
        setError(t("app.buddies.buddyIdError"));
        return null;
      } finally {
        setSearching(false);
      }
    },
    [viewer, contextFor],
  );

  return { searching, error, clearError: () => setError(null), lookup };
}
