"use client";

/**
 * Building blocks for the Buddies filter UI.
 *
 * These are local rather than shared with the signup wizard's pickers because
 * filtering has different needs: values are comma-joined id strings, several
 * catalogues are searched server-side while typing, and every control has to be
 * clearable. Visually they follow the same design language.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { t } from "@/lib/i18n";
import type { PicklistItem } from "@/lib/aws/appsyncPicklistQueries";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  IdCardIcon,
  MapPinIcon,
  NoteIcon,
  RefreshIcon,
  SearchIcon,
  SlidersIcon,
  UserPlusIcon,
  XIcon,
} from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";

// Re-exported so existing imports from this module keep working.
export {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  IdCardIcon,
  MapPinIcon,
  NoteIcon,
  RefreshIcon,
  SearchIcon,
  SlidersIcon,
  UserPlusIcon,
  XIcon,
} from "@/components/ui/icons";
export { Sheet, type SheetProps } from "@/components/ui/Sheet";

/* ── Search field ───────────────────────────────────────────────────────── */

export function SearchField({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const id = setTimeout(() => ref.current?.focus(), 80);
    return () => clearTimeout(id);
  }, [autoFocus]);

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-cb-gray-200 bg-cb-gray-100/70 px-3.5 py-2.5 transition-all focus-within:border-cb-black focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(36,36,36,0.07)]">
      <span className="shrink-0 text-cb-gray-400">
        <SearchIcon />
      </span>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent font-body text-[15px] text-cb-black outline-none placeholder:text-cb-gray-400"
      />
      {value && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onChange("");
          }}
          aria-label={t("app.buddies.clearSearch")}
          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-cb-gray-400 text-white transition-colors hover:bg-cb-gray-600"
        >
          <XIcon size={9} />
        </button>
      )}
    </div>
  );
}

/* ── Option list (single & multi select) ────────────────────────────────── */

export function OptionRow({
  label,
  selected,
  onClick,
  trailing,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        "flex w-full items-center justify-between gap-3 border-b border-cb-gray-100 px-5 py-[13px] text-left",
        "font-body text-[15px] leading-snug transition-colors last:border-0",
        selected
          ? "bg-cb-yellow/20 font-semibold text-cb-black"
          : "text-cb-black hover:bg-cb-yellow/10 active:bg-cb-yellow/25",
      ].join(" ")}
    >
      <span className="min-w-0 flex-1">{label}</span>
      {trailing ??
        (selected ? (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cb-black text-white">
            <CheckIcon size={12} />
          </span>
        ) : null)}
    </button>
  );
}

export function EmptyResults({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <p className="font-body text-[15px] font-semibold text-cb-gray-700">
        {query
          ? t("app.buddies.noResultsFor", { query })
          : t("app.buddies.nothingYet")}
      </p>
      <p className="font-body text-[13px] text-cb-gray-400">
        {t("app.buddies.tryDifferentKeyword")}
      </p>
    </div>
  );
}

/**
 * Searchable list over a preloaded catalogue. `multiple` toggles ids in and out
 * of `selected` rather than replacing it.
 */
export function CatalogPicker({
  items,
  selected,
  onToggle,
  multiple,
  searchPlaceholder,
  loading,
}: {
  items: PicklistItem[];
  selected: string[];
  onToggle: (id: string) => void;
  multiple?: boolean;
  searchPlaceholder?: string;
  loading?: boolean;
}) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-5 pb-3">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={searchPlaceholder ?? t("app.buddies.search")}
          autoFocus
        />
      </div>

      <div className="flex shrink-0 items-center justify-between border-b border-cb-gray-100 px-5 pb-2.5">
        <span className="font-body text-[11px] font-medium text-cb-gray-400">
          {loading
            ? t("app.buddies.loading")
            : t(
                visible.length === 1
                  ? "app.buddies.optionCountOne"
                  : "app.buddies.optionCount",
                { count: visible.length },
              )}
        </span>
        {multiple && selected.length > 0 && (
          <span className="font-body text-[11px] font-semibold text-cb-gray-600">
            {t("app.buddies.selectedCount", { count: selected.length })}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading && items.length === 0 ? (
          <ListSkeleton rows={7} />
        ) : visible.length === 0 ? (
          <EmptyResults query={query} />
        ) : (
          visible.map((item) => (
            <OptionRow
              key={item.value}
              label={item.label}
              selected={selectedSet.has(item.value)}
              onClick={() => onToggle(item.value)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Type-ahead over a server-side searched catalogue (cities, colleges,
 * workplaces). Debounced so a fast typist doesn't fire a query per keystroke.
 */
export function AsyncPicker({
  search,
  selectedId,
  selectedLabel,
  onSelect,
  onClear,
  placeholder,
  hint,
  minChars = 2,
}: {
  search: (query: string) => Promise<PicklistItem[]>;
  selectedId: string;
  selectedLabel?: string;
  onSelect: (item: PicklistItem) => void;
  onClear: () => void;
  placeholder: string;
  hint?: string;
  minChars?: number;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PicklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const runIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < minChars) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    const runId = ++runIdRef.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const found = await search(trimmed);
        if (runId !== runIdRef.current) return;
        setResults(found);
        setSearched(true);
      } finally {
        if (runId === runIdRef.current) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, search, minChars]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-2 px-5 pb-3">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={placeholder}
          autoFocus
        />
        {hint && (
          <p className="font-body text-[12px] text-cb-gray-400">{hint}</p>
        )}
        {selectedId && selectedLabel && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-cb-gray-200 bg-white px-4 py-2.5">
            <span className="min-w-0 flex-1 truncate font-body text-[14px] font-semibold text-cb-black">
              {selectedLabel}
            </span>
            <button
              type="button"
              onClick={onClear}
              aria-label={t("app.buddies.removeFilter", { label: selectedLabel })}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-cb-gray-400 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
            >
              <XIcon size={13} />
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-cb-gray-100">
        {loading ? (
          <ListSkeleton rows={5} />
        ) : searched && results.length === 0 ? (
          <EmptyResults query={query} />
        ) : (
          results.map((item) => (
            <OptionRow
              key={item.value}
              label={item.label}
              selected={item.value === selectedId}
              onClick={() => onSelect(item)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden className="px-5 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="mb-3 h-4 animate-pulse rounded bg-cb-gray-100"
          style={{ width: `${88 - (i % 3) * 14}%` }}
        />
      ))}
    </div>
  );
}

/* ── Inline form controls (used inside the custom filter) ───────────────── */

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-2 block font-body text-[11px] font-bold uppercase tracking-[0.14em] text-cb-gray-500">
      {children}
    </span>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-heading text-[13px] font-bold uppercase tracking-[0.12em] text-cb-black">
      {children}
    </h3>
  );
}

/** Native select — keyboard/screen-reader behaviour for free, styled to match. */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  options: PicklistItem[];
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>
        <FieldLabel>{label}</FieldLabel>
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={[
            "h-12 w-full appearance-none rounded-xl border-[1.5px] bg-white px-4 pr-10",
            "font-body text-[15px] text-cb-black outline-none transition-colors",
            "border-cb-gray-300 hover:border-cb-gray-400",
            "focus:border-cb-black focus:shadow-[0_0_0_4px_rgba(254,233,72,0.45)]",
            "disabled:cursor-not-allowed disabled:bg-cb-gray-100 disabled:text-cb-gray-400",
            value ? "" : "text-cb-gray-400",
          ].join(" ")}
        >
          <option value="">{placeholder ?? t("app.buddies.anyone")}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-cb-gray-400">
          <ChevronDownIcon />
        </span>
      </div>
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  min = 0,
  max = 130,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>
        <FieldLabel>{label}</FieldLabel>
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          // Keep it a plain integer string — the filter builders parse it raw.
          const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
          onChange(digits);
        }}
        className="h-12 w-full rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-4 font-body text-[15px] text-cb-black outline-none transition-colors placeholder:text-cb-gray-400 hover:border-cb-gray-400 focus:border-cb-black focus:shadow-[0_0_0_4px_rgba(254,233,72,0.45)]"
      />
    </div>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1">
      <span
        className={[
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          checked
            ? "border-cb-black bg-cb-black text-white"
            : "border-cb-gray-300 bg-white text-transparent",
        ].join(" ")}
      >
        <CheckIcon size={12} />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className="font-body text-[15px] text-cb-black">{label}</span>
    </label>
  );
}

export function RadioGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: PicklistItem[];
  onChange: (v: string) => void;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend>
        <FieldLabel>{label}</FieldLabel>
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const selected = value === o.value;
          return (
            <label
              key={o.value || "any"}
              className={[
                "cursor-pointer rounded-full border-[1.5px] px-4 py-2 font-body text-[14px] transition-colors",
                selected
                  ? "border-cb-black bg-cb-black text-white"
                  : "border-cb-gray-300 bg-white text-cb-black hover:border-cb-gray-400",
              ].join(" ")}
            >
              <input
                type="radio"
                name={name}
                checked={selected}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * A multi-select rendered as a row of chips plus an "Add" button that opens a
 * picker sheet. Keeps long catalogues (diagnoses, hospitals) out of the
 * scrolling form while still showing what's chosen.
 */
export function MultiSelectField({
  label,
  catalogItems,
  value,
  onChange,
  addLabel,
  searchPlaceholder,
  loading,
}: {
  label: string;
  catalogItems: PicklistItem[];
  value: string;
  onChange: (next: string) => void;
  addLabel: string;
  searchPlaceholder?: string;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ids = useMemo(
    () => value.split(",").filter((v) => v.trim() !== ""),
    [value],
  );
  const labelById = useMemo(
    () => new Map(catalogItems.map((i) => [i.value, i.label])),
    [catalogItems],
  );

  const toggle = useCallback(
    (id: string) => {
      const next = ids.includes(id)
        ? ids.filter((v) => v !== id)
        : [...ids, id];
      onChange(next.join(","));
    },
    [ids, onChange],
  );

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>

      {ids.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {ids.map((id) => (
            <li key={id}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cb-gray-200 bg-cb-gray-100 py-1 pl-3 pr-1.5 font-body text-[13px] text-cb-black">
                {labelById.get(id) ?? t("app.buddies.selected")}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  aria-label={t("app.buddies.removeFilter", {
                    label: labelById.get(id) ?? t("app.buddies.selected"),
                  })}
                  className="flex h-4.5 w-4.5 items-center justify-center rounded-full text-cb-gray-500 transition-colors hover:bg-cb-gray-300 hover:text-cb-black"
                >
                  <XIcon size={11} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center justify-between rounded-xl border border-dashed border-cb-gray-300 px-4 py-3 text-left transition-all hover:border-cb-black hover:bg-cb-gray-100/60"
      >
        <span className="font-body text-[14px] font-medium text-cb-gray-500 transition-colors group-hover:text-cb-black">
          {addLabel}
        </span>
        <span className="text-cb-gray-400 transition-colors group-hover:text-cb-black">
          <ChevronRightIcon />
        </span>
      </button>

      <Sheet open={open} title={label} onClose={() => setOpen(false)}>
        <div className="h-[min(60vh,520px)]">
          <CatalogPicker
            items={catalogItems}
            selected={ids}
            onToggle={toggle}
            multiple
            loading={loading}
            searchPlaceholder={searchPlaceholder ?? t("app.buddies.search")}
          />
        </div>
      </Sheet>
    </div>
  );
}
