"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { fieldBase, fieldBorder } from "@/components/ui";
import {
  DIAL_COUNTRIES,
  getCountryByIso2,
  type DialCountry,
} from "@/lib/host-signup/constants";

/* ── Icons ─────────────────────────────────────────────────────────────── */

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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

/* ── Props ─────────────────────────────────────────────────────────────── */

interface Props {
  label?: string;
  countryIso2: string;
  national: string;
  onCountryChange: (iso2: string) => void;
  onNationalChange: (value: string) => void;
  error?: string;
  hint?: string;
  autoFocus?: boolean;
  /** Override mb-5 from grid layouts. */
  className?: string;
}

/* ── Component ─────────────────────────────────────────────────────────── */

/**
 * Phone input with E.164 country-code picker. Composes a flag/dial trigger
 * (left) with a national number input (right), sharing one bordered surface
 * so the field reads as a single control.
 *
 * Keyboard:
 *   • Click trigger or focus + Space/Enter to open the picker.
 *   • Type to filter by name, ISO2, or dial code.
 *   • Up/Down moves highlight; Enter selects; Escape closes.
 */
export const PhoneInput = forwardRef<HTMLInputElement, Props>(
  function PhoneInput(
    {
      label,
      countryIso2,
      national,
      onCountryChange,
      onNationalChange,
      error,
      hint,
      autoFocus,
      className = "",
    },
    ref,
  ) {
    const reactId = useId();
    const triggerId = `phone-cc-${reactId}`;
    const inputId = `phone-num-${reactId}`;
    const listId = `phone-cc-list-${reactId}`;

    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [highlightIdx, setHighlightIdx] = useState(0);

    const selected = getCountryByIso2(countryIso2);

    const filtered = useMemo<DialCountry[]>(() => {
      const q = query.trim().toLowerCase().replace(/^\+/, "");
      if (q === "") return [...DIAL_COUNTRIES];
      return DIAL_COUNTRIES.filter((c) => {
        return (
          c.name.toLowerCase().includes(q) ||
          c.iso2.toLowerCase().includes(q) ||
          c.dial.replace("+", "").includes(q)
        );
      });
    }, [query]);

    useEffect(() => {
      if (!open) return;
      const t = setTimeout(() => searchRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }, [open]);

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

    /* Keep highlight scrolled into view */
    useEffect(() => {
      if (!open) return;
      const item = listRef.current?.querySelector<HTMLElement>(
        `[data-idx="${highlightIdx}"]`,
      );
      item?.scrollIntoView({ block: "nearest" });
    }, [open, highlightIdx]);

    function handleSearchKey(e: KeyboardEvent<HTMLInputElement>) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const pick = filtered[highlightIdx];
        if (pick) {
          onCountryChange(pick.iso2);
          setOpen(false);
          setQuery("");
          triggerRef.current?.focus();
        }
      } else if (e.key === "Home") {
        e.preventDefault();
        setHighlightIdx(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setHighlightIdx(Math.max(0, filtered.length - 1));
      }
    }

    function handleNationalChange(e: ChangeEvent<HTMLInputElement>) {
      /* Allow digits, spaces, dashes, parens — strip everything else. Saves
         the user a fight with copy-pasted formatted numbers. */
      const cleaned = e.target.value.replace(/[^\d\s\-()]/g, "");
      onNationalChange(cleaned);
    }

    const borderClass = error ? fieldBorder.error : fieldBorder.idle;

    const rootClass = ["mb-5 flex flex-col", className].filter(Boolean).join(" ");

    return (
      <div className={rootClass}>
        {label ? (
          <label
            htmlFor={inputId}
            className="mb-1.5 font-body text-[13px] font-medium text-cb-gray-700"
          >
            {label}
          </label>
        ) : null}

        <div className="relative">
          <div
            className={[
              fieldBase,
              "h-12 flex items-stretch overflow-hidden",
              borderClass,
            ].join(" ")}
          >
            {/* Country trigger */}
            <button
              ref={triggerRef}
              id={triggerId}
              type="button"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={listId}
              aria-label={
                selected
                  ? `Country: ${selected.name} (${selected.dial})`
                  : "Choose a country"
              }
              onClick={() => {
                setHighlightIdx(0);
                setOpen((v) => !v);
              }}
              className={[
                "inline-flex shrink-0 items-center gap-1.5 ps-3 pe-2",
                "border-e border-cb-gray-200/80",
                "hover:bg-cb-gray-100/60 active:bg-cb-gray-100",
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-inset",
                "select-none",
              ].join(" ")}
            >
              <span className="text-[18px] leading-none" aria-hidden>
                {selected?.flag ?? "🌐"}
              </span>
              <span className="font-body text-[14px] font-medium tabular-nums text-cb-black">
                {selected?.dial ?? "+"}
              </span>
              <ChevronDown className="ms-0.5 h-3.5 w-3.5 text-cb-gray-500" />
            </button>

            {/* National input */}
            <div className="relative flex min-w-0 flex-1 items-center">
              <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-cb-gray-400">
                <PhoneIcon className="h-[18px] w-[18px]" />
              </span>
              <input
                ref={ref}
                id={inputId}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="Mobile number"
                value={national}
                onChange={handleNationalChange}
                autoFocus={autoFocus}
                aria-invalid={error ? true : undefined}
                aria-describedby={
                  error
                    ? `${inputId}-error`
                    : hint
                      ? `${inputId}-hint`
                      : undefined
                }
                className="min-w-0 flex-1 bg-transparent ps-10 pe-3 font-body text-[15px] tabular-nums text-cb-black outline-none placeholder:text-cb-gray-400"
              />
            </div>
          </div>

          {/* Picker panel */}
          {open ? (
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Choose country"
              className="absolute z-50 mt-2 w-[min(100%,360px)] rounded-2xl border border-cb-gray-200 bg-white p-2 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.22),0_4px_16px_-4px_rgba(0,0,0,0.08)]"
            >
              <div className="relative mb-2">
                <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-cb-gray-400">
                  <SearchIcon className="h-[16px] w-[16px]" />
                </span>
                <input
                  ref={searchRef}
                  type="text"
                  inputMode="search"
                  autoComplete="off"
                  placeholder="Search country or code"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setHighlightIdx(0);
                  }}
                  onKeyDown={handleSearchKey}
                  className={[
                    fieldBase,
                    "h-10 ps-9 pe-3 text-[14px]",
                    fieldBorder.idle,
                  ].join(" ")}
                />
              </div>

              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                aria-labelledby={triggerId}
                className="max-h-[260px] overflow-y-auto overscroll-contain"
              >
                {filtered.length === 0 ? (
                  <li className="px-3 py-6 text-center font-body text-sm text-cb-gray-500">
                    No matches. Try a country name or dial code.
                  </li>
                ) : (
                  filtered.map((c, idx) => {
                    const active = idx === highlightIdx;
                    const isSelected = c.iso2 === countryIso2;
                    return (
                      <li
                        key={c.iso2}
                        role="option"
                        aria-selected={isSelected}
                        data-idx={idx}
                        onMouseEnter={() => setHighlightIdx(idx)}
                        onClick={() => {
                          onCountryChange(c.iso2);
                          setOpen(false);
                          setQuery("");
                          triggerRef.current?.focus();
                        }}
                        className={[
                          "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 font-body text-[14px] transition-colors",
                          active
                            ? "bg-cb-gray-100"
                            : isSelected
                              ? "bg-cb-bone-300/40"
                              : "hover:bg-cb-gray-100/70",
                        ].join(" ")}
                      >
                        <span className="text-[18px] leading-none" aria-hidden>
                          {c.flag}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-cb-black">
                          {c.name}
                        </span>
                        <span className="shrink-0 font-body text-[13px] tabular-nums text-cb-gray-500">
                          {c.dial}
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          ) : null}
        </div>

        {error ? (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="mt-1.5 font-body text-[13px] text-cb-danger"
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
