/**
 * The ops kill switch: whether the app should be showing anything at all.
 *
 * Mobile gates every navigator on a `MaintenanceStatus` record
 * (`cancerbuddyapp/src/context/status-app/status-app.provider.tsx`), and web had
 * no equivalent — ops flipping maintenance had no effect on the browser.
 */

/** The four values the record can hold, as mobile types them. */
export type AppStatusType =
  | "LIVE"
  | "INMAINTENANCE"
  | "OPCIONAL_UPDATE"
  | "REQUIRED_UPDATE";

export interface AppStatus {
  type: AppStatusType | string | null;
  reason?: string | null;
}

/**
 * Only `INMAINTENANCE` blocks the web app — **not** the two update states.
 *
 * This is a deliberate divergence, and it is load-bearing rather than tidy: the
 * production record read `REQUIRED_UPDATE` when this was written. Porting
 * mobile's gate verbatim would have blocked every web visitor on day one for a
 * condition that cannot apply here — `REQUIRED_UPDATE` means "install a newer
 * build from the app store", and a browser gets the newest build by reloading.
 *
 * Fail-open on anything unrecognised, absent or unreachable: a maintenance flag
 * that cannot be read must never be the reason nobody can use the product.
 */
export function resolveAppStatus(type: AppStatus["type"]): "blocked" | "allowed" {
  return type === "INMAINTENANCE" ? "blocked" : "allowed";
}

/** Copy for the blocking screen; the record's own reason wins when it has one. */
export function maintenanceReason(status: AppStatus | null): string | null {
  const reason = status?.reason?.trim();
  return reason ? reason : null;
}

export const GET_APP_STATUS = /* GraphQL */ `
  query AppStatus($id: ID!) {
    getMaintenanceStatus(id: $id) {
      type
      reason
    }
  }
`;

/** Matches `GET_STATUS_APP_SUSCRIPCION` in the mobile repo. */
export const ON_APP_STATUS_CHANGED = /* GraphQL */ `
  subscription StatusApp {
    onUpdateMaintenanceStatus {
      reason
      type
    }
  }
`;

/**
 * Reads the record, returning null on every failure path.
 *
 * Pure in the sense that matters: it returns a value rather than writing state,
 * so the caller decides what to do and the read itself is testable.
 */
export async function readAppStatus(
  execute: (query: string, variables: Record<string, unknown>) => Promise<unknown>,
): Promise<AppStatus | null> {
  const id = appStatusRecordId();
  if (!id) return null;
  try {
    const data = (await execute(GET_APP_STATUS, { id })) as {
      getMaintenanceStatus?: AppStatus | null;
    } | null;
    return data?.getMaintenanceStatus ?? null;
  } catch {
    return null;
  }
}

/**
 * The record id, from the environment.
 *
 * Returns null when unset, which the provider treats as "no gate" rather than
 * an error — a missing id must not block the app.
 */
export function appStatusRecordId(): string | null {
  return process.env.NEXT_PUBLIC_APP_STATUS_ID?.trim() || null;
}
