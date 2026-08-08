"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { useUnsavedChanges } from "@/lib/navigation/UnsavedChangesProvider";

/**
 * A `Link` that asks before abandoning unsaved form edits.
 *
 * Uses Next's `onNavigate`, which fires only on client-side navigation and can
 * cancel it. It is synchronous, so the dialog cannot be awaited here: the
 * navigation is cancelled outright and the provider re-issues it if the person
 * chooses to leave.
 *
 * Drop-in for `Link` — when nothing is dirty it does not intercept at all.
 */
export default function GuardedLink({
  onNavigate,
  ...props
}: ComponentProps<typeof Link>) {
  const { interceptNavigation } = useUnsavedChanges();

  return (
    <Link
      {...props}
      onNavigate={(e) => {
        const href = typeof props.href === "string" ? props.href : props.href.pathname ?? "";
        if (interceptNavigation(href)) {
          e.preventDefault();
          return;
        }
        onNavigate?.(e);
      }}
    />
  );
}
