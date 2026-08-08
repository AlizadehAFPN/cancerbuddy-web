import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useVisibilityResync } from "./useVisibilityResync";

/**
 * Acceptance check for `foreground-resync-primitive`, WORKLIST Phase 1.
 *
 * Rendered through a real root rather than tested as a plain function: the
 * mount-versus-transition distinction and the listener cleanup are the whole
 * behaviour, and neither survives being called outside React.
 */

let container: HTMLDivElement;
let root: Root;

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

function render(hook: () => void) {
  function Probe() {
    hook();
    return null;
  }
  act(() => {
    root.render(<Probe />);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-07T12:00:00Z"));
  setVisibility("visible");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // React logs an act() warning without this in some builds.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("useVisibilityResync", () => {
  it("does not fire on mount", () => {
    const cb = vi.fn();
    render(() => useVisibilityResync(cb));
    expect(cb).not.toHaveBeenCalled();
  });

  it("fires exactly once on hidden → visible", () => {
    const cb = vi.fn();
    render(() => useVisibilityResync(cb));

    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(cb).not.toHaveBeenCalled();

    act(() => {
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  /** Returning to a tab commonly fires both events; that is one user action. */
  it("coalesces a visibilitychange and focus pair into one run", () => {
    const cb = vi.fn();
    render(() => useVisibilityResync(cb));

    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("runs again once the coalescing window has passed", () => {
    const cb = vi.fn();
    render(() => useVisibilityResync(cb));

    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(cb).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
      window.dispatchEvent(new Event("focus"));
    });
    expect(cb).toHaveBeenCalledTimes(2);
  });

  /** Returning from another window: the tab was never hidden. */
  it("fires on focus even without a visibility transition", () => {
    const cb = vi.fn();
    render(() => useVisibilityResync(cb));

    act(() => {
      vi.advanceTimersByTime(1000);
      window.dispatchEvent(new Event("focus"));
    });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("ignores a focus event while the tab is hidden", () => {
    const cb = vi.fn();
    render(() => useVisibilityResync(cb));

    act(() => {
      setVisibility("hidden");
      vi.advanceTimersByTime(1000);
      window.dispatchEvent(new Event("focus"));
    });
    expect(cb).not.toHaveBeenCalled();
  });

  /**
   * Mobile's version captures the callback at mount, and a stale closure is a
   * documented problem there (`ConnectionMapProvider.tsx:137`). The ref makes it
   * impossible here, so pin it.
   */
  it("always calls the latest callback, not the one from mount", () => {
    const first = vi.fn();
    const second = vi.fn();
    let current = first;

    function Probe() {
      useVisibilityResync(() => current());
      return null;
    }
    act(() => root.render(<Probe />));

    current = second;
    act(() => root.render(<Probe />));

    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("does nothing when disabled", () => {
    const cb = vi.fn();
    render(() => useVisibilityResync(cb, { enabled: false }));

    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(cb).not.toHaveBeenCalled();
  });

  it("removes its listeners on unmount", () => {
    const cb = vi.fn();
    render(() => useVisibilityResync(cb));
    act(() => root.unmount());

    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(cb).not.toHaveBeenCalled();

    // afterEach unmounts again; make that a no-op rather than a double unmount.
    root = createRoot(document.createElement("div"));
  });
});
