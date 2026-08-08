"use client";

import { checkPassword } from "@/lib/signup/validation";
import { t } from "@/lib/i18n";

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
  { key: "minLength" as const, label: t("forms.passwordRules.minLength") },
  { key: "uppercase" as const, label: t("forms.passwordRules.uppercase") },
  { key: "lowercase" as const, label: t("forms.passwordRules.lowercase") },
  { key: "number" as const, label: t("forms.passwordRules.number") },
  { key: "special" as const, label: t("forms.passwordRules.special") },
];

/**
 * Derived, never hard-coded. The meter used to compare against a literal `4`
 * while the schema enforced five rules, which is how a password could show every
 * segment filled and still be rejected on submit.
 */
const RULE_COUNT = RULES.length;

interface Props {
  value: string;
}

/**
 * Live strength meter over every rule `credentialsSchema` enforces. Stays subtle
 * (small dots) until the user starts typing, then shows pass/fail per rule and a
 * colour-graded progress bar, and becomes a single confirmation pill once they
 * all pass.
 */
export function PasswordStrengthMeter({ value }: Props) {
  const checks = checkPassword(value);
  const passed = Object.values(checks).filter(Boolean).length;
  const allPass = passed === RULE_COUNT;

  if (allPass) {
    return (
      <div className="mt-1 flex items-center gap-2 rounded-lg bg-cb-success/15 px-3 py-2 font-body text-sm text-cb-gray-800">
        <CheckIcon className="h-4 w-4 shrink-0 text-cb-success" />
        {t("forms.strongPassword")}
      </div>
    );
  }

  const idle = !value;

  return (
    <div className="mt-1 space-y-2">
      <div className="flex h-1 overflow-hidden rounded-full bg-cb-gray-200">
        {RULES.map((_, i) => {
          // Thresholds as fractions of the rule count, so adding a rule cannot
          // silently turn a weak password green.
          const ratio = passed / RULE_COUNT;
          const fillClass =
            i < passed
              ? ratio >= 0.75
                ? "bg-cb-success"
                : ratio >= 0.5
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
