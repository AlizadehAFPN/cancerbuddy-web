"use client";

import { checkPassword } from "@/lib/signup/validation";

/* ── Inline icons ── */

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function DotIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const RULES = [
  { key: "minLength" as const, label: "At least 8 characters" },
  { key: "uppercase" as const, label: "One uppercase letter" },
  { key: "lowercase" as const, label: "One lowercase letter" },
  { key: "number" as const, label: "One number" },
];

interface Props {
  value: string;
}

/**
 * Live, four-rule strength meter. Stays subtle (small dots) until the user
 * starts typing, then shows pass/fail per rule and a colour-graded progress
 * bar. Becomes a single confirmation pill when all four rules pass.
 */
export function PasswordStrengthMeter({ value }: Props) {
  const checks = checkPassword(value);
  const passed = Object.values(checks).filter(Boolean).length;
  const allPass = passed === 4;

  if (allPass) {
    return (
      <div className="mt-1 flex items-center gap-2 rounded-lg bg-cb-success/15 px-3 py-2 font-body text-sm text-cb-gray-800">
        <CheckIcon className="h-4 w-4 shrink-0 text-cb-success" />
        Strong password — nice.
      </div>
    );
  }

  const idle = !value;

  return (
    <div className="mt-1 space-y-2">
      <div className="flex h-1 overflow-hidden rounded-full bg-cb-gray-200">
        {[0, 1, 2, 3].map((i) => {
          const fillClass =
            i < passed
              ? passed >= 3
                ? "bg-cb-success"
                : passed === 2
                ? "bg-cb-warning"
                : "bg-cb-danger"
              : "bg-transparent";
          return (
            <div
              key={i}
              className={`h-full flex-1 transition-colors duration-200 ${
                i > 0 ? "ms-0.5" : ""
              } ${fillClass}`}
            />
          );
        })}
      </div>
      <ul className="grid grid-cols-2 gap-1.5">
        {RULES.map(({ key, label }) => {
          const ok = checks[key];
          return (
            <li
              key={key}
              className={[
                "flex items-center gap-1.5 font-body text-xs",
                idle ? "text-cb-gray-400" : ok ? "text-cb-gray-800" : "text-cb-gray-500",
              ].join(" ")}
            >
              {ok ? (
                <CheckIcon className="h-3 w-3 shrink-0 text-cb-success" />
              ) : (
                <DotIcon className="h-3 w-3 shrink-0 text-cb-gray-300" />
              )}
              <span>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
