"use client";

import type { ReactNode } from "react";

export type ServerAlertVariant = "danger" | "warning" | "info";

const VARIANT_CLASS: Record<ServerAlertVariant, string> = {
  danger:
    "border-cb-danger/25 bg-cb-danger/10 text-cb-danger [color-scheme:light]",
  warning:
    "border-amber-200/90 bg-amber-50 text-amber-950 [color-scheme:light]",
  info: "border-cb-gray-200 bg-cb-gray-50 text-cb-gray-800 [color-scheme:light]",
};

export interface ServerAlertProps {
  /** When null/undefined/empty after trim, nothing is rendered (unless `children`). */
  message?: string | null;
  /**
   * When `false`, nothing is rendered. Use with OTP steps that should only
   * show a server error after the user has attempted submit once.
   */
  show?: boolean;
  variant?: ServerAlertVariant;
  className?: string;
  /** Optional extra line (e.g. support id) — rare. */
  children?: ReactNode;
}

/**
 * Accessible inline alert for API / validation failures. Prefer this over
 * ad-hoc `role="alert"` divs so copy, contrast, and semantics stay consistent.
 */
export default function ServerAlert({
  message,
  show = true,
  variant = "danger",
  className = "",
  children,
}: ServerAlertProps) {
  if (show === false) return null;
  const text = typeof message === "string" ? message.trim() : "";
  if (!text && !children) return null;

  const role = variant === "info" ? "status" : "alert";
  const ariaLive = variant === "info" ? "polite" : "assertive";

  return (
    <div
      role={role}
      aria-live={ariaLive}
      className={`rounded-xl border px-4 py-3 font-body text-sm leading-snug ${VARIANT_CLASS[variant]} ${className}`.trim()}
    >
      {text ? <p className="m-0">{text}</p> : null}
      {children ? <div className={text ? "mt-2" : ""}>{children}</div> : null}
    </div>
  );
}
