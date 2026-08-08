"use client";

/**
 * The date/time + duration block of the live-session editor.
 *
 * A port of mobile's `LiveScheduleField` element, kept as its own component for
 * the same reason mobile does: the bounds, the 15-minute grid and the "Ends
 * at …" caption belong together, and nothing else on the screen needs them.
 *
 * Presentational on purpose. `bounds` and `problem` are computed by the screen
 * that owns Save — one clock, one answer, no chance of the button and the
 * message disagreeing.
 */

import {
  DURATION_OPTIONS,
  durationChipLabel,
  endsAtLabel,
  type ScheduleBounds,
  type ScheduleProblem,
} from "@/lib/profile/liveSchedule";
import { t } from "@/lib/i18n";
import { FieldLabel } from "@/components/ui/form";

const PROBLEM_MESSAGE = {
  past: "app.profile.liveSchedulePast",
  tooFar: "app.profile.liveScheduleTooFar",
  offGrid: "app.profile.liveScheduleOffGrid",
} as const;

export default function LiveScheduleField({
  scheduledAt,
  duration,
  bounds,
  problem,
  onScheduledAtChange,
  onDurationChange,
}: {
  /** `YYYY-MM-DDTHH:mm`, the datetime-local wire format. */
  scheduledAt: string;
  duration: number;
  /**
   * Null until the owner has a clock. `new Date()` cannot run during a server
   * render without the attributes differing from the client's, so the input
   * simply carries no bounds for that first paint.
   */
  bounds: ScheduleBounds | null;
  problem: ScheduleProblem | null;
  onScheduledAtChange: (value: string) => void;
  onDurationChange: (minutes: number) => void;
}) {
  const ends = endsAtLabel(scheduledAt, duration);

  return (
    <>
      <div>
        <FieldLabel>{t("app.profile.liveWhen")}</FieldLabel>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => onScheduledAtChange(e.target.value)}
          min={bounds?.min}
          max={bounds?.max}
          step={bounds?.step}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? "live-schedule-problem" : undefined}
          className={[
            "h-12 w-full rounded-xl border-[1.5px] bg-white px-4 font-body text-[15px]",
            "text-cb-black outline-none transition-colors",
            problem
              ? "border-cb-danger"
              : "border-cb-gray-300 hover:border-cb-gray-400 focus:border-cb-black",
          ].join(" ")}
        />
        {problem && (
          <p
            id="live-schedule-problem"
            className="mt-1.5 font-body text-[12.5px] leading-snug text-cb-danger"
          >
            {t(PROBLEM_MESSAGE[problem])}
          </p>
        )}
      </div>

      <div>
        <FieldLabel>{t("app.profile.liveDuration")}</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {DURATION_OPTIONS.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => onDurationChange(mins)}
              aria-pressed={duration === mins}
              className={[
                "rounded-full border-[1.5px] px-3 py-1.5 font-body text-[13px] transition-colors",
                duration === mins
                  ? "border-cb-black bg-cb-yellow/25 font-semibold text-cb-black"
                  : "border-cb-gray-200 text-cb-gray-600 hover:border-cb-gray-400",
              ].join(" ")}
            >
              {durationChipLabel(mins)}
            </button>
          ))}
        </div>

        {/* Mobile hides the caption entirely until both halves are set. */}
        {ends && (
          <p
            data-testid="live-ends-at"
            className="mt-2 font-body text-[12.5px] font-semibold text-cb-black"
          >
            {ends}
          </p>
        )}
      </div>
    </>
  );
}
