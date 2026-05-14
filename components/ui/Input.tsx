"use client";

import {
  InputHTMLAttributes,
  ReactNode,
  forwardRef,
  useId,
  useState,
} from "react";
import { t } from "@/lib/i18n";

/* ── Inline icons ── */

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12" y2="16" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────
   Shared field styles — reused by Input, the textarea in
   SupportForm, and the pronoun select in PronounPicker.
   This keeps every form control on the same visual grid.
   ────────────────────────────────────────────────────────── */

export const fieldBase =
  "w-full rounded-xl bg-white font-body text-[15px] text-cb-black " +
  "placeholder:text-cb-gray-400 outline-none transition-[border-color,box-shadow,background-color] duration-150";

export const fieldBorder = {
  idle:
    "border-[1.5px] border-cb-gray-300 hover:border-cb-gray-400 " +
    "focus:border-cb-black focus:shadow-[0_0_0_4px_rgba(254,233,72,0.45)]",
  error:
    "border-[1.5px] border-cb-danger " +
    "focus:border-cb-danger focus:shadow-[0_0_0_4px_rgba(255,89,119,0.18)]",
} as const;

export const fieldHeight = "h-12";
export const fieldPadX = "px-4";

/* ── Types ── */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Shown to the right of the label */
  labelHint?: ReactNode;
  /** Inline icon at the start of the input */
  leftIcon?: ReactNode;
  /** Optional className applied to the wrapper */
  wrapperClassName?: string;
}

/* ── Component ── */

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      labelHint,
      leftIcon,
      type = "text",
      className = "",
      wrapperClassName = "",
      id,
      ...rest
    },
    ref,
  ) => {
    const reactId = useId();
    const inputId = id ?? `field-${reactId}`;
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const inputType = isPassword ? (showPassword ? "text" : "password") : type;

    const borderClass = error ? fieldBorder.error : fieldBorder.idle;

    const padLeft = leftIcon ? "ps-10" : fieldPadX;
    const padRight = isPassword || error ? "pe-11" : fieldPadX;

    return (
      <div className={`mb-5 flex flex-col ${wrapperClassName}`}>
        {(label || labelHint) && (
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            {label ? (
              <label
                htmlFor={inputId}
                className="font-body text-[13px] font-medium text-cb-gray-700"
              >
                {label}
              </label>
            ) : (
              <span />
            )}
            {labelHint ? (
              <span className="font-body text-xs text-cb-gray-400">
                {labelHint}
              </span>
            ) : null}
          </div>
        )}

        <div className="relative">
          {leftIcon ? (
            <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-cb-gray-400">
              {leftIcon}
            </span>
          ) : null}

          <input
            ref={ref}
            id={inputId}
            type={inputType}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            className={[
              fieldBase,
              fieldHeight,
              padLeft,
              padRight,
              borderClass,
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            {...rest}
          />

          {/* Trailing slot — alert icon on error, eye toggle on password.
              On password+error we prioritise the eye toggle so the user
              can still verify what they typed. */}
          {isPassword ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("forms.hidePassword") : t("forms.showPassword")}
              className="absolute end-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-cb-gray-500 hover:text-cb-black hover:bg-cb-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black"
            >
              {showPassword ? (
                <EyeOffIcon className="w-[18px] h-[18px]" />
              ) : (
                <EyeIcon className="w-[18px] h-[18px]" />
              )}
            </button>
          ) : error ? (
            <span
              aria-hidden
              className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-cb-danger"
            >
              <AlertIcon className="w-[18px] h-[18px]" />
            </span>
          ) : null}
        </div>

        {error ? (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="mt-1.5 flex items-center gap-1.5 font-body text-[13px] text-cb-danger"
          >
            {error}
          </p>
        ) : hint ? (
          <p
            id={`${inputId}-hint`}
            className="mt-1.5 font-body text-[13px] text-cb-gray-500"
          >
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";

export default Input;
