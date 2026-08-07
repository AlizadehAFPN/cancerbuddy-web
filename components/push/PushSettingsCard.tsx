"use client";

import { useState, useSyncExternalStore } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { t } from "@/lib/i18n";
import {
  disablePush,
  enablePush,
  readPushState,
  serverPushState,
  subscribePushState,
} from "@/lib/push/pushClient";

/**
 * The only place that asks for notification permission. See
 * `lib/push/pushClient.ts` for why nothing prompts automatically.
 *
 * States the member can land in:
 *   prompt / off  → an Enable button (the browser prompt appears only for
 *                   `prompt`; `off` re-registers silently)
 *   enabled       → a Turn off button
 *   denied        → instructions, because a page cannot re-ask once blocked
 *   unsupported   → iOS Safari before install-to-home-screen, or an old browser
 *   unconfigured  → the Firebase web credentials are not deployed yet; members
 *                   see the same neutral copy as `unsupported`, and the missing
 *                   env var names go to the console for whoever is deploying
 */
export default function PushSettingsCard() {
  /* Permission is browser state, not React state: it also changes from the
     padlock menu. Null during SSR/hydration — `readPushState()` reads
     `Notification` and `localStorage`. */
  const state = useSyncExternalStore(
    subscribePushState,
    readPushState,
    serverPushState,
  );
  const [busy, setBusy] = useState(false);

  const handleEnable = async () => {
    setBusy(true);
    const { error } = await enablePush();
    setBusy(false);
    /* Permission was granted but the token or Stream registration failed — the
       switch reads "on" while nothing would arrive, so say so. The next load
       retries via PushBridge. */
    if (error) toast.error(t("app.push.error"));
  };

  const handleDisable = async () => {
    setBusy(true);
    await disablePush();
    setBusy(false);
  };

  const enabled = state === "enabled";
  const canEnable = state === "prompt" || state === "off";
  const blocked = state === "denied";
  const unavailable = state === "unsupported" || state === "unconfigured";

  return (
    <section className="rounded-2xl border border-cb-gray-200 bg-white p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            enabled ? "bg-cb-yellow text-cb-black" : "bg-cb-gray-100 text-cb-gray-600"
          }`}
          aria-hidden
        >
          {enabled ? (
            <Bell className="h-5 w-5" />
          ) : (
            <BellOff className="h-5 w-5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-bold text-cb-black">
            {t("app.push.title")}
          </h2>
          <p className="mt-1 font-body text-sm text-cb-gray-600">
            {t("app.push.body")}
          </p>

          {/* Nothing until the client has read the real state, so the card never
              flashes the wrong affordance. */}
          {state !== null && (
            <div className="mt-4">
              {enabled && (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-body text-sm font-medium text-cb-black">
                    {t("app.push.statusOn")}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busy}
                    onClick={handleDisable}
                  >
                    {t("app.push.turnOff")}
                  </Button>
                </div>
              )}

              {canEnable && (
                <Button
                  variant="primary"
                  size="sm"
                  loading={busy}
                  onClick={handleEnable}
                >
                  {t("app.push.turnOn")}
                </Button>
              )}

              {blocked && (
                <p className="font-body text-sm text-cb-gray-600">
                  {t("app.push.blocked")}
                </p>
              )}

              {unavailable && (
                <p className="font-body text-sm text-cb-gray-600">
                  {t("app.push.unavailable")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
