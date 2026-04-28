"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

/* ── Types ── */

export type ButtonVariant = "primary" | "primary-alt" | "secondary" | "ghost";
export type ButtonSize    = "sm" | "md" | "lg" | "xl";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  loading?:   boolean;
  fullWidth?: boolean;
}

/* ── Style maps ── */

const variantStyles: Record<ButtonVariant, string> = {
  /**
   * primary     — filled black, white text         → main form actions
   * primary-alt — filled yellow, black text        → brand CTAs
   * secondary   — transparent, black border        → subdued actions
   * ghost       — no border, subtle hover          → inline nav links
   */
  primary:
    "bg-cb-black text-white border-2 border-cb-black " +
    "hover:bg-cb-gray-800 active:bg-cb-gray-700",
  "primary-alt":
    "bg-cb-yellow text-cb-black border-2 border-cb-yellow " +
    "hover:bg-cb-yellow-600 active:bg-cb-yellow-700",
  secondary:
    "bg-transparent text-cb-black border-2 border-cb-black " +
    "hover:bg-black/5 active:bg-black/10",
  ghost:
    "bg-transparent text-cb-black border-2 border-transparent " +
    "hover:bg-cb-gray-100 active:bg-cb-gray-200",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm:  "h-9  px-4  text-sm  gap-1.5",
  md:  "h-11 px-5  text-sm  gap-2",
  lg:  "h-13 px-7  text-base gap-2",
  xl:  "h-15 px-9  text-base gap-2.5",
};

/* ── Spinner ── */

function Spinner() {
  return (
    <span
      aria-label="Loading"
      className="inline-block rounded-full border-2 border-current border-t-transparent animate-spin"
      style={{ width: "1.1em", height: "1.1em" }}
    />
  );
}

/* ── Component ── */

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant   = "primary",
      size      = "md",
      loading   = false,
      fullWidth = false,
      disabled,
      className = "",
      children,
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          "inline-flex items-center justify-center rounded-full",
          "font-heading font-medium select-none",
          "transition-colors duration-150 ease-in-out",
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-cb-black focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:pointer-events-none",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth ? "w-full" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {loading ? <Spinner /> : children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
