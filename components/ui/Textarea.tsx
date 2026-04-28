"use client";

import {
  ReactNode,
  TextareaHTMLAttributes,
  forwardRef,
  useId,
} from "react";
import { fieldBase, fieldBorder } from "./Input";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Shown to the right of the label (e.g. character counter) */
  labelHint?: ReactNode;
  wrapperClassName?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      hint,
      labelHint,
      className = "",
      wrapperClassName = "",
      rows = 5,
      id,
      ...rest
    },
    ref,
  ) => {
    const reactId = useId();
    const fieldId = id ?? `field-${reactId}`;
    const borderClass = error ? fieldBorder.error : fieldBorder.idle;

    return (
      <div className={`mb-5 flex flex-col ${wrapperClassName}`}>
        {(label || labelHint) && (
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            {label ? (
              <label
                htmlFor={fieldId}
                className="font-body text-[13px] font-medium text-cb-gray-700"
              >
                {label}
              </label>
            ) : (
              <span />
            )}
            {labelHint ? (
              <span className="font-body text-xs text-cb-gray-400 tabular-nums">
                {labelHint}
              </span>
            ) : null}
          </div>
        )}

        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
          }
          className={[
            fieldBase,
            "px-4 py-3 leading-relaxed resize-y min-h-[120px]",
            borderClass,
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        />

        {error ? (
          <p
            id={`${fieldId}-error`}
            role="alert"
            className="mt-1.5 font-body text-[13px] text-cb-danger"
          >
            {error}
          </p>
        ) : hint ? (
          <p
            id={`${fieldId}-hint`}
            className="mt-1.5 font-body text-[13px] text-cb-gray-500"
          >
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";

export default Textarea;
