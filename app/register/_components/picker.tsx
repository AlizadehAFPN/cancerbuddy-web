"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PicklistItem } from "@/lib/aws/appsyncPicklistQueries";

/* ── Utilities ──────────────────────────────────────────────────────────── */

export function sortAlpha(items: PicklistItem[]): PicklistItem[] {
  return [...items].sort((a, b) =>
    a.label.localeCompare(b.label, "en", { sensitivity: "base" }),
  );
}
export function parseIds(val: string): string[] {
  return val ? val.split(",").filter(Boolean) : [];
}
export function joinIds(ids: string[]): string {
  return ids.join(",");
}

/* ── Icons ──────────────────────────────────────────────────────────────── */

export function XIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
export function PlusIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={2.5} aria-hidden>
      <path d="M12 4v16M4 12h16" />
    </svg>
  );
}
export function SearchIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={2} aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
export function LockIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
export function ChevronRightIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/* ── PickerModal ────────────────────────────────────────────────────────── */

export interface PickerModalProps {
  open: boolean;
  title: string;
  items: PicklistItem[];
  excludeIds: string[];
  searchPlaceholder?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function PickerModal({
  open,
  title,
  items,
  excludeIds,
  searchPlaceholder = "Search…",
  onSelect,
  onClose,
}: PickerModalProps) {
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      const id = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!mounted || !open) return null;

  const available = items.filter((i) => !excludeIds.includes(i.value));
  const visible = query
    ? available.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
    : available;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet / Dialog */}
      <div className="relative z-10 flex w-full flex-col sm:max-w-[440px] overflow-hidden rounded-t-3xl sm:rounded-2xl bg-white shadow-[0_32px_80px_-8px_rgba(0,0,0,0.28),0_8px_32px_-4px_rgba(0,0,0,0.12)]" style={{ maxHeight: "82vh" }}>

        {/* Pull handle (mobile only) */}
        <div className="flex shrink-0 justify-center pt-3 pb-0 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-cb-gray-200" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 py-4">
          <h3 className="font-heading text-[20px] font-bold tracking-tight text-cb-black">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-cb-gray-100 text-cb-gray-600 transition-colors hover:bg-cb-gray-200 hover:text-cb-black"
          >
            <XIcon size={15} />
          </button>
        </div>

        {/* Search */}
        <div className="shrink-0 px-5 pb-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-cb-gray-200 bg-cb-gray-100/70 px-3.5 py-2.5 transition-all focus-within:border-cb-black focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(36,36,36,0.07)]">
            <span className="shrink-0 text-cb-gray-400"><SearchIcon /></span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent font-body text-[15px] text-cb-black placeholder:text-cb-gray-400 outline-none"
            />
            {query && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setQuery(""); }}
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-cb-gray-400 text-white transition-colors hover:bg-cb-gray-600"
                aria-label="Clear"
              >
                <XIcon size={9} />
              </button>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="shrink-0 flex items-center border-b border-cb-gray-100 px-5 pb-2.5">
          <span className="font-body text-[11px] font-medium text-cb-gray-400">
            {query
              ? `${visible.length} result${visible.length !== 1 ? "s" : ""}`
              : `${available.length} option${available.length !== 1 ? "s" : ""} · A–Z`}
          </span>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14">
              <p className="font-body text-[15px] font-semibold text-cb-gray-700">
                No results for &ldquo;{query}&rdquo;
              </p>
              <p className="font-body text-[13px] text-cb-gray-400">Try a different keyword</p>
            </div>
          ) : (
            <ul>
              {visible.map((item) => (
                <li key={item.value}>
                  <button
                    type="button"
                    onClick={() => { onSelect(item.value); onClose(); }}
                    className="w-full border-b border-cb-gray-100 px-5 py-[15px] text-left font-body text-[15px] leading-snug text-cb-black transition-colors last:border-0 hover:bg-[#FEE948]/10 active:bg-[#FEE948]/25"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── SelectedCard ───────────────────────────────────────────────────────── */

export function SelectedCard({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div className="group flex items-start justify-between gap-3 rounded-xl border border-cb-gray-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:border-cb-gray-300 hover:shadow">
      <span className="font-body text-[15px] font-semibold leading-snug text-cb-black">
        {label}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-cb-gray-400 transition-all hover:bg-cb-gray-100 hover:text-cb-black"
      >
        <XIcon size={13} />
      </button>
    </div>
  );
}

/* ── AddItemButton ──────────────────────────────────────────────────────── */

export function AddItemButton({
  label,
  count,
  onClick,
}: {
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between rounded-xl border border-dashed border-cb-gray-300 bg-transparent px-4 py-3.5 text-left transition-all hover:border-cb-black hover:bg-cb-gray-50"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cb-gray-300 text-cb-gray-400 transition-colors group-hover:border-cb-black group-hover:text-cb-black">
          <PlusIcon />
        </span>
        <span className="font-body text-[14px] font-medium text-cb-gray-500 transition-colors group-hover:text-cb-black">
          {label}
        </span>
      </div>
      {count > 0 && (
        <span className="font-body text-[12px] text-cb-gray-400 transition-colors group-hover:text-cb-gray-600">
          {count} selected
        </span>
      )}
    </button>
  );
}

/* ── SectionLabel ───────────────────────────────────────────────────────── */

export function SectionLabel({
  text,
  required,
  optional,
}: {
  text: string;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="font-body text-[11px] font-bold uppercase tracking-[0.14em] text-cb-gray-500">
        {text}
      </span>
      {required && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cb-danger" aria-label="required" />
      )}
      {optional && !required && (
        <span className="rounded-full border border-cb-gray-200 px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wide text-cb-gray-400">
          optional
        </span>
      )}
    </div>
  );
}

/* ── MultiSection ───────────────────────────────────────────────────────── */

export interface MultiSectionProps {
  sectionLabel: string;
  addFirstLabel: string;
  addMoreLabel: string;
  modalTitle: string;
  searchPlaceholder?: string;
  items: PicklistItem[];
  selectedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  limit?: number;
}

export function MultiSection({
  sectionLabel,
  addFirstLabel,
  addMoreLabel,
  modalTitle,
  searchPlaceholder,
  items,
  selectedIds,
  onAdd,
  onRemove,
  required,
  optional,
  hint,
  limit,
}: MultiSectionProps) {
  const [open, setOpen] = useState(false);

  const selectedItems = selectedIds
    .map((id) => items.find((i) => i.value === id))
    .filter(Boolean) as PicklistItem[];

  const atLimit = limit !== undefined && selectedItems.length >= limit;
  const hasMore = !atLimit && items.some((i) => !selectedIds.includes(i.value));
  const addLabel = selectedItems.length === 0 ? addFirstLabel : addMoreLabel;

  return (
    <div>
      <SectionLabel text={sectionLabel} required={required} optional={optional} />
      <div className="flex flex-col gap-2">
        {selectedItems.map((item) => (
          <SelectedCard key={item.value} label={item.label} onRemove={() => onRemove(item.value)} />
        ))}
        {hasMore && (
          <AddItemButton
            label={addLabel}
            count={selectedItems.length}
            onClick={() => setOpen(true)}
          />
        )}
      </div>
      {hint && (
        <p className="mt-2.5 font-body text-[12px] leading-relaxed text-cb-gray-400">{hint}</p>
      )}
      <PickerModal
        open={open}
        title={modalTitle}
        items={items}
        excludeIds={selectedIds}
        searchPlaceholder={searchPlaceholder}
        onSelect={(id) => { onAdd(id); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

/* ── SingleSection ──────────────────────────────────────────────────────── */

export interface SingleSectionProps {
  sectionLabel: string;
  selectLabel: string;
  modalTitle: string;
  searchPlaceholder?: string;
  items: PicklistItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClear: () => void;
  required?: boolean;
  optional?: boolean;
}

export function SingleSection({
  sectionLabel,
  selectLabel,
  modalTitle,
  searchPlaceholder,
  items,
  selectedId,
  onSelect,
  onClear,
  required,
  optional,
}: SingleSectionProps) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.value === selectedId);

  return (
    <div>
      <SectionLabel text={sectionLabel} required={required} optional={optional} />
      {selected ? (
        <SelectedCard label={selected.label} onRemove={onClear} />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex w-full items-center justify-between rounded-xl border border-dashed border-cb-gray-300 bg-transparent px-4 py-3.5 text-left transition-all hover:border-cb-black hover:bg-cb-gray-50"
        >
          <span className="font-body text-[14px] font-medium text-cb-gray-500 transition-colors group-hover:text-cb-black">
            {selectLabel}
          </span>
          <span className="text-cb-gray-400 transition-colors group-hover:text-cb-black">
            <ChevronRightIcon />
          </span>
        </button>
      )}
      <PickerModal
        open={open}
        title={modalTitle}
        items={items}
        excludeIds={selectedId ? [selectedId] : []}
        searchPlaceholder={searchPlaceholder}
        onSelect={(id) => { onSelect(id); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

/* ── LockedSection ──────────────────────────────────────────────────────── */

export function LockedSection({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="opacity-40">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-body text-[11px] font-bold uppercase tracking-[0.14em] text-cb-gray-500">
          {label}
        </span>
        <span className="rounded-full border border-cb-gray-200 px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wide text-cb-gray-400">
          optional
        </span>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-cb-gray-200 px-4 py-3.5">
        <span className="text-cb-gray-400"><LockIcon /></span>
        <span className="font-body text-[13px] text-cb-gray-500">{hint}</span>
      </div>
    </div>
  );
}
