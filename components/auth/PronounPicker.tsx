"use client";

import { useEffect, useState, useId } from "react";
import { fetchPronouns, type PicklistItem } from "@/lib/aws/appsyncPicklistQueries";
import { fieldBase, fieldBorder } from "@/components/ui";
import { t } from "@/lib/i18n";

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
}

/**
 * Optional pronouns as a single select — options fetched from the backend
 * via listPronouns so the stored value is always a database UUID, matching
 * the mobile app's behaviour.
 */
export function PronounPicker({ value, onChange, error, className = "" }: Props) {
  const reactId = useId();
  const selectId = `pronouns-${reactId}`;
  const [options, setOptions] = useState<PicklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPronouns().then((items) => {
      setOptions(items);
      setLoading(false);
    });
  }, []);

  const borderClass = error ? fieldBorder.error : fieldBorder.idle;
  const rootClass = ["mb-5 flex flex-col", className].filter(Boolean).join(" ");

  return (
    <div className={rootClass}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label
          htmlFor={selectId}
          className="font-body text-[13px] font-medium text-cb-gray-700"
        >
          {t("pronouns.label")}
        </label>
        <span className="font-body text-xs text-cb-gray-400">{t("pronouns.optional")}</span>
      </div>

      {loading ? (
        <div className="h-12 w-full animate-pulse rounded-lg bg-cb-gray-100" />
      ) : (
        <div className="relative">
          <select
            id={selectId}
            aria-invalid={error ? true : undefined}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={[
              fieldBase,
              "h-12 w-full cursor-pointer appearance-none pe-10 ps-4",
              borderClass,
              value === "" ? "text-cb-gray-400" : "text-cb-black",
            ].join(" ")}
          >
            <option value="">{t("pronouns.choose")}</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-cb-gray-500">
            <ChevronDown className="h-4 w-4" />
          </span>
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-1.5 font-body text-[13px] text-cb-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
