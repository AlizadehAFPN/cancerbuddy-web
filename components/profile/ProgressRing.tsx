/**
 * The completion ring beside each profile section.
 *
 * Mobile's `calcProgress` can exceed 100 when a section is over-filled, so the
 * arc is clamped here while the underlying number stays a faithful port.
 */

export default function ProgressRing({
  value,
  size = 44,
  label,
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;

  const complete = pct >= 100;

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ? `${label}: ${pct}% complete` : `${pct}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-cb-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className={complete ? "stroke-cb-green" : "stroke-cb-yellow"}
          style={{ transition: "stroke-dasharray 400ms ease" }}
        />
      </svg>
      <span
        aria-hidden
        className="absolute font-heading text-[10.5px] font-bold text-cb-black"
      >
        {pct}%
      </span>
    </span>
  );
}
