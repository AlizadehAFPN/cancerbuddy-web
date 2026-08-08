"use client";

/**
 * The explanatory text beside a form field.
 *
 * Mobile prints a paragraph under most catalogue fields ("Start typing the
 * name, and a list will appear…") and hides the more personal explanations
 * behind a "Why do we ask this?" expander. Web shipped bare labels, so a member
 * looking at "Diagnosis" or a date-of-birth box had no idea how to use it or
 * why it was being asked — the date-of-birth one during signup being the case
 * nothing else covered.
 *
 * Two shapes, one component, so every surface expands the same way and the copy
 * all lives in the catalogue.
 */

import { useId, useState } from "react";

import { t } from "@/lib/i18n";

/** A plain paragraph — mobile's `description` / `hint`. */
export function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 font-body text-[12.5px] leading-snug text-cb-gray-500">
      {children}
    </p>
  );
}

/**
 * "Why do we ask this?" — collapsed by default, as on mobile.
 *
 * A `<button>` + region rather than `<details>`: the label is a question that
 * should read as a control, and the expanded text needs to be findable by name
 * in a test without depending on the browser's disclosure semantics.
 */
export function WhyWeAsk({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className="mt-1.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="font-body text-[12.5px] font-semibold text-cb-gray-600 underline underline-offset-2 transition-colors hover:text-cb-black"
      >
        {t("app.profile.whyWeAsk")}
      </button>
      {open && (
        <p
          id={id}
          className="mt-1 font-body text-[12.5px] leading-snug text-cb-gray-500"
        >
          {children}
        </p>
      )}
    </div>
  );
}
