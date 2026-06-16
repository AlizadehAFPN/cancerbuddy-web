"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasValidSession } from "@/lib/auth-client";
import { t } from "@/lib/i18n";

/**
 * Client-side route gate. Cognito tokens live in localStorage (not cookies),
 * so the server can't gate routes — this runs the check in the browser.
 *
 *   mode="protected" → require a session. No session → redirect to `redirectTo`.
 *                      Renders a loader until the check resolves so gated
 *                      content never flashes for signed-out users.
 *
 *   mode="guest"     → for public/auth pages. A session present → redirect to
 *                      `redirectTo` (e.g. the dashboard). Renders children
 *                      immediately (the common case is a signed-out visitor);
 *                      only redirects if a session turns up.
 */
type Mode = "protected" | "guest";

export default function AuthGuard({
  mode,
  redirectTo,
  children,
}: {
  mode: Mode;
  redirectTo: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  // Guest pages render right away; protected pages wait for the check.
  const [ready, setReady] = useState(mode === "guest");

  useEffect(() => {
    let active = true;
    hasValidSession().then((authed) => {
      if (!active) return;
      const allowed = mode === "protected" ? authed : !authed;
      if (allowed) {
        setReady(true);
      } else {
        router.replace(redirectTo);
      }
    });
    return () => {
      active = false;
    };
  }, [mode, redirectTo, router]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-1 items-center justify-center bg-white">
        <span
          role="status"
          aria-label={t("forms.loading")}
          className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-cb-gray-300 border-t-cb-black"
        />
      </div>
    );
  }

  return <>{children}</>;
}
