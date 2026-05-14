"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MAX_BIRTH_YEAR, MIN_BIRTH_YEAR } from "@/lib/signup/constants";
import { fieldBase, fieldBorder } from "@/components/ui";
import { t, tList } from "@/lib/i18n";

/* ── Constants ───────────────────────────────────────────────────────── */

const MONTH_LABELS = tList("forms.monthNamesShort");

/* ── Icons ── */

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/* ── Types ── */

interface Props {
  month: string;
  year: string;
  onChange: (month: string, year: string) => void;
  label?: string;
  error?: string;
  hint?: string;
  /** Merged onto root; use e.g. `!mb-0` when sitting in a grid row. */
  className?: string;
}

/* ── Component ── */

export function MonthYearPicker({
  month,
  year,
  onChange,
  label,
  error,
  hint,
  className = "",
}: Props) {
  const id = useId();
  const triggerId = `myp-${id}`;
  const panelId = `myp-panel-${id}`;
  const jumpId = `myp-jump-${id}`;
  const yearListId = `myp-years-${id}`;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const yearScrollRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [jumpDraft, setJumpDraft] = useState("");
  const [jumpError, setJumpError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const initYear =
    year !== "" ? Number(year) : Math.max(MIN_BIRTH_YEAR, currentYear - 30);
  const [displayYear, setDisplayYear] = useState(initYear);

  const yearsDescending = useMemo(() => {
    const out: number[] = [];
    for (let y = MAX_BIRTH_YEAR; y >= MIN_BIRTH_YEAR; y--) {
      out.push(y);
    }
    return out;
  }, []);

  /* Sync display year when value changes externally */
  useEffect(() => {
    if (year !== "") setDisplayYear(Number(year));
  }, [year]);

  /* Scroll selected year into view when opening or year changes */
  useEffect(() => {
    if (!open) return;
    const root = yearScrollRef.current;
    if (!root) return;
    const btn = root.querySelector<HTMLElement>(`[data-year="${displayYear}"]`);
    btn?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open, displayYear]);

  /* Close on outside click / Escape */
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKeyUp(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, [open]);

  /* Sync jump field when the panel is open and the active year changes — not while typing,
     because displayYear only updates from the list, Go, or the form value. */
  useLayoutEffect(() => {
    if (!open) return;
    setJumpDraft(String(displayYear));
  }, [open, displayYear]);

  function applyJump() {
    const raw = jumpDraft.trim();
    setJumpError(null);
    if (raw === "") return;

    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      setJumpError(t("forms.yearInvalidRange", { min: MIN_BIRTH_YEAR, max: MAX_BIRTH_YEAR }));
      return;
    }
    if (n < MIN_BIRTH_YEAR || n > MAX_BIRTH_YEAR) {
      setJumpError(t("forms.yearOutOfRange", { min: MIN_BIRTH_YEAR, max: MAX_BIRTH_YEAR }));
      return;
    }
    setDisplayYear(n);
    queueMicrotask(() => {
      const root = yearScrollRef.current;
      const btn = root?.querySelector<HTMLElement>(`[data-year="${n}"]`);
      btn?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  function selectMonth(m: number) {
    const y = String(displayYear);
    onChange(String(m), y);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function selectYearFromList(y: number) {
    setDisplayYear(y);
    setJumpError(null);
  }

  function handleOpen() {
    setOpen((v) => !v);
    setJumpError(null);
  }

  const displayValue =
    month !== "" && year !== ""
      ? `${String(month).padStart(2, "0")} / ${year}`
      : "";

  const borderClass = error ? fieldBorder.error : fieldBorder.idle;

  const rootClass = ["mb-5 flex flex-col", className].filter(Boolean).join(" ");

  return (
    <div className={rootClass}>
      {label ? (
        <label
          htmlFor={triggerId}
          className="mb-1.5 font-body text-[13px] font-medium text-cb-gray-700"
        >
          {label}
        </label>
      ) : null}

      <div className="relative">
        <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-cb-gray-400">
          <CalendarIcon />
        </span>

        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={displayValue || t("forms.monthYearAria")}
          onClick={handleOpen}
          className={[
            fieldBase,
            "h-12 ps-10 pe-4 text-start cursor-pointer select-none",
            borderClass,
            displayValue ? "text-cb-black" : "text-cb-gray-400",
          ].join(" ")}
        >
          {displayValue || t("forms.monthYearPlaceholder")}
        </button>

        {open ? (
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={t("forms.monthYearDialogAria")}
            className="absolute z-50 mt-2 start-0 min-w-[min(100vw-1.5rem,400px)] max-w-[calc(100vw-1rem)] rounded-2xl border border-cb-gray-200 bg-white p-4 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.22),0_4px_16px_-4px_rgba(0,0,0,0.08)]"
          >
            {/* Jump to year */}
            <div className="mb-3">
              <label
                htmlFor={jumpId}
                className="mb-1.5 block font-body text-[11px] font-semibold uppercase tracking-wider text-cb-gray-500"
              >
                {t("forms.goToYearLabel")}
              </label>
              <div className="flex gap-2">
                <input
                  id={jumpId}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={t("forms.goToYearPlaceholder", { min: MIN_BIRTH_YEAR, max: MAX_BIRTH_YEAR })}
                  value={jumpDraft}
                  onChange={(e) => setJumpDraft(e.target.value)}
                  aria-invalid={jumpError ? true : undefined}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyJump();
                    }
                  }}
                  className={[
                    fieldBase,
                    "h-10 min-w-0 flex-1 px-3 font-body text-[15px] tabular-nums",
                    jumpError ? fieldBorder.error : fieldBorder.idle,
                  ].join(" ")}
                />
                <button
                  type="button"
                  onClick={applyJump}
                  className="h-10 shrink-0 rounded-xl border-[1.5px] border-cb-black bg-cb-black px-4 font-body text-sm font-medium text-white transition-colors hover:bg-cb-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-offset-2"
                >
                  {t("forms.go")}
                </button>
              </div>
              {jumpError ? (
                <p role="alert" className="mt-1.5 font-body text-[12px] text-cb-danger">
                  {jumpError}
                </p>
              ) : (
                <p className="mt-1.5 font-body text-[12px] text-cb-gray-400">
                  {t("forms.yearHint")}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              {/* Scrollable years */}
              <div className="sm:w-[7rem] sm:shrink-0">
                <p
                  id={yearListId}
                  className="mb-1.5 font-body text-[11px] font-semibold uppercase tracking-wider text-cb-gray-500"
                >
                  {t("forms.yearHeader")}
                </p>
                <div
                  ref={yearScrollRef}
                  role="listbox"
                  aria-labelledby={yearListId}
                  className="max-h-[192px] overflow-y-auto overscroll-contain rounded-xl border border-cb-gray-200 bg-cb-gray-100/40 p-1 shadow-inner scroll-py-1"
                  style={{ scrollbarGutter: "stable" }}
                >
                  {yearsDescending.map((y) => {
                    const active = y === displayYear;
                    return (
                      <button
                        key={y}
                        type="button"
                        role="option"
                        id={`year-${id}-${y}`}
                        data-year={y}
                        aria-selected={active}
                        onClick={() => selectYearFromList(y)}
                        className={[
                          "flex w-full items-center justify-center rounded-lg py-2 font-body text-sm tabular-nums transition-colors duration-150",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-inset",
                          active
                            ? "bg-cb-black font-semibold text-white shadow-sm"
                            : "text-cb-gray-700 hover:bg-white hover:text-cb-black",
                        ].join(" ")}
                      >
                        {y}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Months */}
              <div className="min-w-0 flex-1">
                <p className="mb-1.5 font-body text-[11px] font-semibold uppercase tracking-wider text-cb-gray-500">
                  {t("forms.monthsHeader")}
                </p>
                <div className="grid grid-cols-4 gap-1.5" role="grid" aria-label={t("forms.monthsGridAria")}>
                  {MONTH_LABELS.map((mlabel, i) => {
                    const m = i + 1;
                    const isSelected =
                      month !== "" &&
                      year !== "" &&
                      Number(month) === m &&
                      Number(year) === displayYear;

                    return (
                      <button
                        key={mlabel}
                        type="button"
                        role="gridcell"
                        aria-label={t("forms.monthLabelWithYear", { month: mlabel, year: displayYear })}
                        aria-selected={isSelected}
                        onClick={() => selectMonth(m)}
                        className={[
                          "h-10 rounded-xl font-body text-sm font-medium transition-all duration-150",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black",
                          isSelected
                            ? "bg-cb-black text-white shadow-sm"
                            : "bg-cb-gray-100 text-cb-gray-700 hover:bg-cb-black/10 hover:text-cb-black",
                        ].join(" ")}
                      >
                        {mlabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <p className="mt-3 border-t border-cb-gray-100 pt-3 text-center font-body text-[11px] leading-relaxed text-cb-gray-400">
              {t("forms.monthYearFooter")}
            </p>
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-1.5 font-body text-[13px] text-cb-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 font-body text-[13px] text-cb-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}
