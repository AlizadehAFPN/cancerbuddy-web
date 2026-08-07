"use client";

/**
 * The room's default arrangement, chosen from the viewport.
 *
 * Wide screens get the stage layout with the chat rail already open: there's
 * room for both, and a support session where nobody notices the chat exists is
 * a worse session. Phone-sized screens get the grid with the rail closed —
 * exactly what the mobile room does.
 *
 * This only supplies a *default*. `LiveRoom` holds a nullable override, so the
 * moment someone picks a layout their choice wins for the rest of the session
 * and these values stop mattering.
 *
 * Read through `useSyncExternalStore` rather than an effect so the server and
 * the first client paint agree (both narrow), and so a resize is a real
 * subscription instead of a listener that has to be kept in sync by hand.
 */

import { useSyncExternalStore } from "react";
import type { LiveLayout } from "@/lib/live/types";

/** Tailwind `md` and `lg`. */
const STAGE_QUERY = "(min-width: 768px)";
const DOCKED_PANEL_QUERY = "(min-width: 1024px)";

function subscribeTo(query: string) {
  return (onChange: () => void) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => {};
    const list = window.matchMedia(query);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  };
}

function matches(query: string): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(query).matches;
}

/* Stable identities — a new subscribe function each render would make React
   tear down and re-add the listener on every commit. */
const subscribeStage = subscribeTo(STAGE_QUERY);
const subscribeDockedPanel = subscribeTo(DOCKED_PANEL_QUERY);
const stageSnapshot = () => matches(STAGE_QUERY);
const dockedPanelSnapshot = () => matches(DOCKED_PANEL_QUERY);
const narrowServerSnapshot = () => false;

export interface ViewportDefaults {
  layout: LiveLayout;
  panelOpen: boolean;
}

export function useViewportDefaults(): ViewportDefaults {
  const wideEnoughForStage = useSyncExternalStore(
    subscribeStage,
    stageSnapshot,
    narrowServerSnapshot,
  );
  const wideEnoughForDockedPanel = useSyncExternalStore(
    subscribeDockedPanel,
    dockedPanelSnapshot,
    narrowServerSnapshot,
  );

  return {
    layout: wideEnoughForStage ? "stage" : "grid",
    panelOpen: wideEnoughForDockedPanel,
  };
}
