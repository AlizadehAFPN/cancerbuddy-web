"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { t } from "@/lib/i18n";

interface Props {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
}

/**
 * 6-cell one-time-code input — paste-aware, arrow-key + backspace navigation,
 * auto-advance on input. Renders LTR regardless of document direction so digits
 * read consistently.
 */
export function OtpInput({
  length = 6,
  value,
  onChange,
  disabled,
  hasError,
  autoFocus,
}: Props) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) inputs.current[0]?.focus();
  }, [autoFocus]);

  const setCharAt = (index: number, char: string) => {
    const next = (value.padEnd(length, " ").slice(0, length).split("") as string[]);
    next[index] = char;
    onChange(next.join("").trimEnd());
  };

  const focusIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(length - 1, index));
    inputs.current[clamped]?.focus();
    inputs.current[clamped]?.select();
  };

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    if (!digit) {
      setCharAt(index, " ");
      return;
    }
    setCharAt(index, digit);
    if (index < length - 1) focusIndex(index + 1);
  };

  const handleKeyDown = (
    index: number,
    e: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace") {
      if (value[index]) {
        setCharAt(index, " ");
      } else if (index > 0) {
        focusIndex(index - 1);
        setCharAt(index - 1, " ");
      }
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      focusIndex(index - 1);
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowRight" && index < length - 1) {
      focusIndex(index + 1);
      e.preventDefault();
      return;
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    focusIndex(Math.min(length - 1, pasted.length - 1));
  };

  return (
    <div
      className="flex gap-2 sm:gap-2.5"
      role="group"
      aria-label={t("forms.otpGroupLabel")}
      dir="ltr"
    >
      {Array.from({ length }).map((_, i) => {
        const ch = value[i] ?? "";
        const filled = Boolean(ch);
        const borderClass = hasError
          ? "border-cb-danger focus:border-cb-danger focus:shadow-[0_0_0_4px_rgba(255,89,119,0.18)]"
          : filled
          ? "border-cb-black focus:shadow-[0_0_0_4px_rgba(254,233,72,0.45)]"
          : "border-cb-gray-300 focus:border-cb-black focus:shadow-[0_0_0_4px_rgba(254,233,72,0.45)]";

        return (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            disabled={disabled}
            value={ch}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={t("forms.otpDigitLabel", { index: i + 1 })}
            className={[
              "h-14 w-12 sm:h-16 sm:w-14 rounded-2xl border-[1.5px] bg-white",
              "text-center text-2xl sm:text-[28px] font-heading font-medium tabular-nums",
              "text-cb-black outline-none",
              "transition-[border-color,box-shadow,background-color] duration-150",
              "disabled:opacity-40",
              borderClass,
            ].join(" ")}
          />
        );
      })}
    </div>
  );
}
