import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("@/lib/aws/raiseUserLambda", () => ({
  raiseUserLambda: vi.fn(),
}));

import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import {
  badgeFor,
  fetchLiveCalendar,
  isCalendarEventVisible,
} from "@/lib/groups/liveGroups";
import type { LiveCalendarEvent } from "@/lib/groups/types";
import { formatSessionWhen } from "@/lib/profile/manageLives";
import {
  DEFAULT_DURATION_CREATE,
  DEFAULT_DURATION_EDIT,
  DURATION_OPTIONS,
  SCHEDULE_STEP_SECONDS,
  durationChipLabel,
  endsAtLabel,
  formatDuration,
  scheduleBounds,
  scheduleProblem,
} from "@/lib/profile/liveSchedule";
import LiveScheduleField from "@/components/profile/LiveScheduleField";

/**
 * Acceptance checks for WORKLIST Phase 6 — the Live sweep.
 *
 * Two items: `live-calendar-visibility-and-status` and
 * `live-schedule-guardrails`. Where the worklist asks for a Playwright
 * assertion there is no browser project in this repo yet, so the equivalent is
 * asserted one level down — on the fetch pipeline for the calendar, and on a
 * real DOM mount of the schedule field for the editor. Both are noted where
 * they occur.
 */

/** Source with comments stripped — otherwise an assertion matches the prose. */
function sourceOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

/* ── live-calendar-visibility-and-status ────────────────────────────────── */

describe("the calendar honours active and archived", () => {
  /**
   * The worklist's exact reduction. Mobile drops both kinds of row before it
   * does anything else (`LiveGroupCalendar.tsx:192-194`).
   */
  it("keeps only the rows mobile keeps", () => {
    const rows = [
      { active: false },
      { archived: true },
      { active: true },
      {},
    ];
    expect(rows.filter(isCalendarEventVisible)).toEqual([{ active: true }, {}]);
  });

  /**
   * Compile-time half of the item: the fields have to be *declared*, because
   * being absent from `LiveCalendarEvent` is how they were discarded in the
   * first place. This assignment fails `tsc --noEmit` if either is dropped
   * again.
   */
  it("declares both fields on LiveCalendarEvent", () => {
    const event: LiveCalendarEvent = {
      id: "e1",
      groupId: "g1",
      title: "Session",
      scheduledAt: "2026-03-17T19:30:00.000Z",
      active: null,
      archived: null,
    };
    expect(isCalendarEventVisible(event)).toBe(true);
  });

  /**
   * Stands in for "a seeded archived event's title appears on no card": the
   * row is gone before any component can render it.
   */
  it("drops hidden and archived rows at the fetch boundary", async () => {
    process.env.NEXT_PUBLIC_USERS_LAMBDA = "users-lambda";
    vi.mocked(raiseUserLambda).mockResolvedValue(
      JSON.stringify({
        Items: [
          { id: "1", scheduledAt: "2026-03-17T19:30:00.000Z", title: "Kept" },
          { id: "2", scheduledAt: "2026-03-17T19:30:00.000Z", title: "Hidden", active: false },
          { id: "3", scheduledAt: "2026-03-17T19:30:00.000Z", title: "Archived", archived: true },
        ],
      }),
    );

    const events = await fetchLiveCalendar();
    expect(events.map((e) => e.title)).toEqual(["Kept"]);
  });
});

describe("badgeFor", () => {
  it("reports ENDED, LIVE and UPCOMING", () => {
    expect(badgeFor({ status: "ended" })).toBe("ENDED");
    expect(badgeFor({ inLive: true })).toBe("LIVE");
    expect(badgeFor({})).toBe("UPCOMING");
  });

  /** A finished session with a stale `inLive` is over, not running. */
  it("prefers ENDED over LIVE", () => {
    expect(badgeFor({ status: "ended", inLive: true })).toBe("ENDED");
    expect(badgeFor({ archived: true, inLive: true })).toBe("ENDED");
  });

  it("reads status === 'live' as well as inLive", () => {
    expect(badgeFor({ status: "live" })).toBe("LIVE");
  });
});

/* ── live-schedule-guardrails ───────────────────────────────────────────── */

describe("scheduleBounds", () => {
  const now = new Date(2026, 2, 17, 19, 32, 45);

  it("bounds the picker to now and one year out, on a 15-minute step", () => {
    expect(scheduleBounds(now)).toEqual({
      min: "2026-03-17T19:32",
      max: "2027-03-17T23:59",
      step: 900,
    });
    expect(SCHEDULE_STEP_SECONDS).toBe(900);
  });
});

describe("scheduleProblem", () => {
  const now = new Date(2026, 2, 17, 19, 32, 45);

  it("accepts a time on the grid inside the window", () => {
    expect(scheduleProblem("2026-03-17T19:45", now)).toBeNull();
    expect(scheduleProblem("2027-03-17T23:45", now)).toBeNull();
  });

  it("rejects the past, more than a year out, and off-grid minutes", () => {
    expect(scheduleProblem("2026-03-17T19:15", now)).toBe("past");
    expect(scheduleProblem("2027-03-18T00:00", now)).toBe("tooFar");
    expect(scheduleProblem("2026-03-17T19:37", now)).toBe("offGrid");
  });

  /** A blank or half-typed field is the required check's business, not this. */
  it("says nothing about an empty value", () => {
    expect(scheduleProblem("", now)).toBeNull();
    expect(scheduleProblem("not-a-date", now)).toBeNull();
  });
});

describe("endsAtLabel", () => {
  it("reads the end time, and names the day once it rolls past midnight", () => {
    expect(endsAtLabel("2026-03-17T19:30", 60)).toBe("Ends at 8:30 PM");
    expect(endsAtLabel("2026-03-17T23:45", 30)).toBe("Ends Mar 18 at 12:15 AM");
  });

  it("stays empty until both halves are set", () => {
    expect(endsAtLabel("", 60)).toBe("");
    expect(endsAtLabel("2026-03-17T19:30", 0)).toBe("");
  });
});

describe("duration labels", () => {
  /** The card set — mobile's `formatDuration` (`ManageLives.tsx:61-68`). */
  it("formats a scheduled session's length", () => {
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(null)).toBe("");
  });

  /** The chip set — mobile's `DEFAULT_DURATION_OPTIONS:34-41`. */
  it("labels the chips the way mobile does", () => {
    expect(DURATION_OPTIONS.map(durationChipLabel)).toEqual([
      "15 min",
      "30 min",
      "45 min",
      "1h",
      "1.5h",
      "2h",
    ]);
  });

  it("reaches the session card", () => {
    expect(
      formatSessionWhen({
        id: "1",
        groupId: "g",
        title: "t",
        scheduledAt: new Date(2026, 2, 17, 19, 30).toISOString(),
        duration: 90,
      }),
    ).toContain("1h 30m");
  });
});

describe("the create branch starts at an hour", () => {
  /** Mobile seeds 60 on create and falls back to 30 on an existing row. */
  it("uses mobile's two defaults", () => {
    expect(DEFAULT_DURATION_CREATE).toBe(60);
    expect(DEFAULT_DURATION_EDIT).toBe(30);
  });

  it("seeds the editor with them", () => {
    const source = sourceOf("components/profile/ManageLivesScreen.tsx");
    const openCreate = source.slice(
      source.indexOf("const openCreate"),
      source.indexOf("const openEdit"),
    );
    expect(openCreate).toContain("setDuration(DEFAULT_DURATION_CREATE)");
    expect(source).toContain("|| DEFAULT_DURATION_EDIT");
  });

  /**
   * `min` / `max` / `step` are advisory outside a submitted form, so Save has to
   * ask as well — otherwise a pasted value still reaches the Lambda.
   */
  it("blocks Save while the chosen time breaks a rule", () => {
    expect(sourceOf("components/profile/ManageLivesScreen.tsx")).toMatch(
      /const canSubmit =[\s\S]*?!problem/,
    );
  });
});

/**
 * The DOM half of the item. `LiveScheduleField` is mounted for real rather than
 * string-matched, because what is being asserted is that the attributes reach
 * the element and that the caption re-renders.
 */
describe("the schedule field in the DOM", () => {
  const now = new Date(2026, 2, 17, 19, 32, 45);
  let container: HTMLDivElement;
  let root: Root;

  function render(duration: number, scheduledAt = "2026-03-17T19:30") {
    act(() =>
      root.render(
        <LiveScheduleField
          scheduledAt={scheduledAt}
          duration={duration}
          bounds={scheduleBounds(now)}
          problem={null}
          onScheduledAtChange={() => {}}
          onDurationChange={() => {}}
        />,
      ),
    );
  }

  const input = () =>
    container.querySelector<HTMLInputElement>('input[type="datetime-local"]')!;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("carries the bounds and the 15-minute step", () => {
    render(60);
    expect(input().getAttribute("min")).toBe("2026-03-17T19:32");
    expect(input().getAttribute("max")).toBe("2027-03-17T23:59");
    expect(input().getAttribute("step")).toBe("900");
  });

  it("updates the ends-at caption when the duration changes", () => {
    render(60);
    const ends = () =>
      container.querySelector('[data-testid="live-ends-at"]')?.textContent;
    expect(ends()).toBe("Ends at 8:30 PM");

    render(30);
    expect(ends()).toBe("Ends at 8:00 PM");
  });

  it("hides the caption until a time is chosen", () => {
    render(60, "");
    expect(container.querySelector('[data-testid="live-ends-at"]')).toBeNull();
  });

  it("shows why a chosen time is refused", () => {
    act(() =>
      root.render(
        <LiveScheduleField
          scheduledAt="2026-03-17T19:37"
          duration={60}
          bounds={scheduleBounds(now)}
          problem="offGrid"
          onScheduledAtChange={() => {}}
          onDurationChange={() => {}}
        />,
      ),
    );
    expect(input().getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain("15-minute mark");
  });
});
