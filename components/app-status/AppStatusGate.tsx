"use client";

/**
 * The ops kill switch and the offline notice, mounted above the app shell.
 *
 * Mobile gates seven navigators on the same record, so flipping maintenance
 * takes the phone app down immediately. Web had nothing: ops could flip the flag
 * and every browser carried on regardless.
 *
 * The gate is deliberately narrow — see `resolveAppStatus` for why only
 * `INMAINTENANCE` blocks — and fails open on every error path. Nobody should be
 * locked out of a support product because a status query timed out.
 */

import { useCallback, useEffect, useState } from "react";
import { API, graphqlOperation } from "aws-amplify";

import { t } from "@/lib/i18n";
import { useVisibilityResync } from "@/lib/hooks/useVisibilityResync";
import {
  ON_APP_STATUS_CHANGED,
  appStatusRecordId,
  readAppStatus,
  maintenanceReason,
  resolveAppStatus,
  type AppStatus,
} from "@/lib/app-status/appStatus";
import { useNetworkStatus } from "@/lib/app-status/useNetworkStatus";
import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";

function Notice({ title, body }: { title: string; body?: string | null }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-heading text-[20px] font-bold text-cb-black">{title}</h1>
      {body && (
        <p className="max-w-[46ch] font-body text-[14px] leading-snug text-cb-gray-600">
          {body}
        </p>
      )}
    </div>
  );
}

export default function AppStatusGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const { online } = useNetworkStatus();

  const read = useCallback(
    () =>
      readAppStatus(async (query, variables) => {
        const { data } = await executeAppSyncGraphql<Record<string, unknown>>({
          query,
          variables,
        });
        return data;
      }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await read();
      if (!cancelled) setStatus(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [read]);

  /** Re-read on return to the tab, as mobile re-reads on foreground. */
  useVisibilityResync(
    useCallback(() => {
      void read().then(setStatus);
    }, [read]),
  );

  /** Live, so ops flipping the flag takes effect without anyone reloading. */
  useEffect(() => {
    if (!appStatusRecordId()) return;
    let sub: { unsubscribe: () => void } | undefined;
    try {
      const observable = API.graphql(graphqlOperation(ON_APP_STATUS_CHANGED)) as {
        subscribe: (h: {
          next: (m: {
            value?: { data?: { onUpdateMaintenanceStatus?: AppStatus } };
          }) => void;
          error: (e: unknown) => void;
        }) => { unsubscribe: () => void };
      };
      sub = observable.subscribe({
        next: (m) => {
          const next = m?.value?.data?.onUpdateMaintenanceStatus;
          if (next) setStatus(next);
        },
        error: () => {
          /* the foreground re-read still covers it */
        },
      });
    } catch {
      /* no subscription — the poll on focus is the fallback */
    }
    return () => sub?.unsubscribe();
  }, []);

  if (resolveAppStatus(status?.type ?? null) === "blocked") {
    return (
      <Notice
        title={t("app.status.maintenanceTitle")}
        body={maintenanceReason(status) ?? t("app.status.maintenanceBody")}
      />
    );
  }

  return (
    <>
      {!online && (
        <div
          role="status"
          className="sticky top-0 z-50 bg-cb-danger px-4 py-2 text-center font-body text-[13px] font-medium text-white"
        >
          {t("app.status.offline")}
        </div>
      )}
      {children}
    </>
  );
}
