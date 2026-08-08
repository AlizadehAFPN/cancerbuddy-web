import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  ON_APP_STATUS_CHANGED,
  maintenanceReason,
  readAppStatus,
  resolveAppStatus,
} from "./appStatus";
import { ONLINE_STABILITY_MS, useNetworkStatus } from "./useNetworkStatus";

/** Acceptance check for `app-status-maintenance-gate`, WORKLIST Phase 1. */
describe("resolveAppStatus", () => {
  it("blocks on INMAINTENANCE", () => {
    expect(resolveAppStatus("INMAINTENANCE")).toBe("blocked");
  });

  it("allows LIVE, unknown and null — fail open", () => {
    expect(resolveAppStatus("LIVE")).toBe("allowed");
    expect(resolveAppStatus("SOMETHING_NEW")).toBe("allowed");
    expect(resolveAppStatus(null)).toBe("allowed");
  });

  /**
   * Load-bearing, and the reason this is not a verbatim port. The production
   * record read `REQUIRED_UPDATE` when this was written — gating on it, as
   * mobile does, would have blocked every web visitor on day one for a condition
   * that cannot apply in a browser.
   */
  it("does not block on either update state", () => {
    expect(resolveAppStatus("REQUIRED_UPDATE")).toBe("allowed");
    expect(resolveAppStatus("OPCIONAL_UPDATE")).toBe("allowed");
  });

  it("prefers the record's own reason when it has one", () => {
    expect(maintenanceReason({ type: "INMAINTENANCE", reason: "Back at 09:00" })).toBe(
      "Back at 09:00",
    );
    expect(maintenanceReason({ type: "INMAINTENANCE", reason: "  " })).toBeNull();
    expect(maintenanceReason(null)).toBeNull();
  });
});

describe("readAppStatus", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_STATUS_ID = "rec-1";
  });

  it("returns the record", async () => {
    const execute = vi.fn().mockResolvedValue({
      getMaintenanceStatus: { type: "INMAINTENANCE", reason: "x" },
    });
    await expect(readAppStatus(execute)).resolves.toEqual({
      type: "INMAINTENANCE",
      reason: "x",
    });
    expect(execute.mock.calls[0]![1]).toEqual({ id: "rec-1" });
  });

  /** Every failure path must be indistinguishable from "no gate". */
  it("returns null when the query fails, when the record is absent, and when unconfigured", async () => {
    await expect(
      readAppStatus(async () => {
        throw new Error("network");
      }),
    ).resolves.toBeNull();

    await expect(readAppStatus(async () => ({}))).resolves.toBeNull();

    delete process.env.NEXT_PUBLIC_APP_STATUS_ID;
    const execute = vi.fn();
    await expect(readAppStatus(execute)).resolves.toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("the subscription matches mobile", () => {
  it("watches onUpdateMaintenanceStatus for reason and type", () => {
    const squashed = ON_APP_STATUS_CHANGED.replace(/\s+/g, " ");
    expect(squashed).toContain("onUpdateMaintenanceStatus");
    expect(squashed).toContain("reason");
    expect(squashed).toContain("type");
  });
});

/** Acceptance check for `offline-detection-notice`. */
describe("useNetworkStatus", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: boolean;

  function Probe() {
    latest = useNetworkStatus().online;
    return null;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Probe />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  /** `navigator.onLine` is unreliable at load, so the first render trusts nothing. */
  it("starts online even if the browser claims otherwise", () => {
    expect(latest).toBe(true);
  });

  it("goes offline immediately", () => {
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(latest).toBe(false);
  });

  /** Asymmetric on purpose: a flaky link would otherwise flap the notice. */
  it("waits the stability window before believing a reconnection", () => {
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(latest).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(latest).toBe(false);

    act(() => {
      vi.advanceTimersByTime(ONLINE_STABILITY_MS - 1);
    });
    expect(latest).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(latest).toBe(true);
  });

  it("a drop during the stability window cancels the pending recovery", () => {
    act(() => {
      window.dispatchEvent(new Event("offline"));
      window.dispatchEvent(new Event("online"));
      vi.advanceTimersByTime(ONLINE_STABILITY_MS - 100);
      window.dispatchEvent(new Event("offline"));
      vi.advanceTimersByTime(5000);
    });
    expect(latest).toBe(false);
  });
});

describe("the gate is mounted above the shell", () => {
  it("wraps the authenticated layout and renders the offline notice", () => {
    const layout = readFileSync("app/(app)/layout.tsx", "utf8");
    expect(layout).toMatch(/<AppStatusGate>/);

    const gate = readFileSync("components/app-status/AppStatusGate.tsx", "utf8");
    expect(gate).toMatch(/resolveAppStatus\(/);
    expect(gate).toMatch(/useNetworkStatus\(/);
    expect(gate).toMatch(/ON_APP_STATUS_CHANGED/);
  });
});
