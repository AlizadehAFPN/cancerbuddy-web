"use client";

/**
 * Twilio's 0–5 network quality, drawn as signal bars.
 *
 * Mobile asks for these numbers and then ignores them. Showing them is worth
 * it on the web: when someone's audio breaks up the usual reaction is to blame
 * the app, and five grey bars answer that question before anyone types it into
 * the chat. Only degraded levels get colour — a healthy connection shouldn't
 * draw the eye.
 */

import { t } from "@/lib/i18n";

const LEVELS = [1, 2, 3, 4, 5];

export default function NetworkQualityBars({
  level,
  className = "",
}: {
  level: number;
  className?: string;
}) {
  const tone =
    level <= 1
      ? "bg-cb-danger"
      : level === 2
        ? "bg-cb-warning"
        : "bg-white/85";

  return (
    <span
      className={["flex items-end gap-[2px]", className].join(" ")}
      title={t("app.live.networkQuality", { level })}
      aria-label={t("app.live.networkQuality", { level })}
    >
      {LEVELS.map((step) => (
        <span
          key={step}
          className={[
            "w-[3px] rounded-[1px] transition-colors",
            step <= level ? tone : "bg-white/25",
          ].join(" ")}
          style={{ height: 3 + step * 2 }}
        />
      ))}
    </span>
  );
}
