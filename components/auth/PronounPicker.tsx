"use client";

import { useId } from "react";
import {
  PRONOUN_LABELS,
  PRONOUN_OPTIONS,
  type PronounOption,
} from "@/lib/signup/constants";
import { fieldBase, fieldBorder } from "@/components/ui";

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
  value: PronounOption | "";
  onChange: (value: PronounOption | "") => void;
  error?: string;
  className?: string;
}

/**
 * Optional pronouns as a single select — matches the height and chrome of `Input` / date field.
 */
export function PronounPicker({ value, onChange, error, className = "" }: Props) {
  const reactId = useId();
  const selectId = `pronouns-${reactId}`;

  const borderClass = error ? fieldBorder.error : fieldBorder.idle;
  const rootClass = ["mb-5 flex flex-col", className].filter(Boolean).join(" ");

  return (
    <div className={rootClass}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label
          htmlFor={selectId}
          className="font-body text-[13px] font-medium text-cb-gray-700"
        >
          Pronouns
        </label>
        <span className="font-body text-xs text-cb-gray-400">Optional</span>
      </div>

      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") onChange("");
            else onChange(v as PronounOption);
          }}
          className={[
            fieldBase,
            "h-12 w-full cursor-pointer appearance-none pe-10 ps-4",
            borderClass,
            value === "" ? "text-cb-gray-400" : "text-cb-black",
          ].join(" ")}
        >
          <option value="">Choose…</option>
          {PRONOUN_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {PRONOUN_LABELS[opt]}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-cb-gray-500">
          <ChevronDown className="h-4 w-4" />
        </span>
      </div>

      {error ? (
        <p role="alert" className="mt-1.5 font-body text-[13px] text-cb-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
