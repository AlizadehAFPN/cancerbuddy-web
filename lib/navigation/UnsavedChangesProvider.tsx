"use client";

/**
 * Confirms before leaving a form with unsaved edits.
 *
 * The four profile forms registered a `beforeunload` listener, which fires on a
 * refresh or a tab close and **not** on client-side navigation — so the in-app
 * back arrow, any sidebar link and the browser's own back button all discarded
 * a half-finished form silently. Mobile intercepts React Navigation's
 * `beforeRemove` on the same screens and asks.
 *
 * Three routes out of a form, three interceptions:
 *
 *  • **In-app links** — `Link`'s `onNavigate`, which is synchronous and offers
 *    `preventDefault()`. It cannot await a dialog, so the flow is
 *    prevent → remember where they were going → ask → resume.
 *  • **Programmatic pushes** (back arrows, hub cards) — `guardedPush`, which
 *    can await.
 *  • **Browser back** — a history sentinel: while dirty, an extra entry sits on
 *    the stack, so `popstate` lands on it instead of leaving. Re-pushed if they
 *    choose to stay.
 *
 * `beforeunload` stays registered for the refresh/close case, which none of the
 * above covers.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { t } from "@/lib/i18n";
import { ConfirmSheet } from "@/components/groups/GroupSheets";

interface UnsavedChangesValue {
  isDirty: boolean;
  /** Forms report their dirty state; the last one to report wins. */
  setDirty: (dirty: boolean) => void;
  /** Resolves true to leave, false to stay. Resolves true immediately when clean. */
  confirmLeave: () => Promise<boolean>;
  /** `router.push` with the confirmation applied. */
  guardedPush: (href: string) => Promise<void>;
  /**
   * For `Link`'s synchronous `onNavigate`: returns true when the navigation
   * should be cancelled, having already opened the dialog.
   */
  interceptNavigation: (href: string) => boolean;
}

const noop = async () => true;

const UnsavedChangesContext = createContext<UnsavedChangesValue>({
  isDirty: false,
  setDirty: () => {},
  confirmLeave: noop,
  guardedPush: async () => {},
  interceptNavigation: () => false,
});

export function useUnsavedChanges(): UnsavedChangesValue {
  return useContext(UnsavedChangesContext);
}

/** Marks this form dirty for as long as it is mounted and `dirty` is true. */
export function useDirtyForm(dirty: boolean): void {
  const { setDirty } = useUnsavedChanges();
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
}

const SENTINEL = "cb-unsaved-guard";

export default function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isDirty, setIsDirty] = useState(false);
  const [asking, setAsking] = useState(false);

  const dirtyRef = useRef(false);
  const pendingHref = useRef<string | null>(null);
  const resolver = useRef<((leave: boolean) => void) | null>(null);

  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
    setIsDirty(dirty);
  }, []);

  /** The refresh/close case, which no in-app interception can cover. */
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  /**
   * History sentinel for the browser's back button.
   *
   * An extra entry is pushed while dirty, so `popstate` lands on it rather than
   * navigating away. Staying re-pushes it, keeping the guard armed.
   */
  useEffect(() => {
    if (!isDirty) return;
    window.history.pushState({ [SENTINEL]: true }, "");

    const onPopState = () => {
      if (!dirtyRef.current) return;
      window.history.pushState({ [SENTINEL]: true }, "");
      pendingHref.current = null; // back, not a specific destination
      setAsking(true);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isDirty]);

  const confirmLeave = useCallback(async () => {
    if (!dirtyRef.current) return true;
    setAsking(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const guardedPush = useCallback(
    async (href: string) => {
      const leave = await confirmLeave();
      if (!leave) return;
      setDirty(false);
      router.push(href);
    },
    [confirmLeave, router, setDirty],
  );

  const interceptNavigation = useCallback((href: string) => {
    if (!dirtyRef.current) return false;
    pendingHref.current = href;
    setAsking(true);
    return true;
  }, []);

  const settle = useCallback(
    (leave: boolean) => {
      setAsking(false);

      const resolve = resolver.current;
      resolver.current = null;
      if (resolve) {
        resolve(leave);
        return;
      }

      // Came from a Link interception or the back button, which have no promise.
      if (!leave) return;
      const href = pendingHref.current;
      pendingHref.current = null;
      setDirty(false);
      if (href) router.push(href);
      else router.back();
    },
    [router, setDirty],
  );

  return (
    <UnsavedChangesContext.Provider
      value={{ isDirty, setDirty, confirmLeave, guardedPush, interceptNavigation }}
    >
      {children}

      {/* Reuses the groups confirm sheet rather than a second dialog of the
          same shape — Cancel keeps the edits, the danger action discards them. */}
      {asking && (
        <ConfirmSheet
          title={t("app.unsaved.title")}
          body={t("app.unsaved.body")}
          confirmLabel={t("app.unsaved.leave")}
          danger
          onConfirm={() => settle(true)}
          onClose={() => settle(false)}
        />
      )}
    </UnsavedChangesContext.Provider>
  );
}
