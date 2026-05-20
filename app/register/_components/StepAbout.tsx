"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui";
import type { UserRegisterFormValues } from "@/lib/user-signup/validation";
import {
  fetchCancerLossOptions,
  fetchCollegesByName,
  type PicklistItem,
} from "@/lib/aws/appsyncPicklistQueries";
import { t } from "@/lib/i18n";
import { sortAlpha, SingleSection } from "./picker";

const BIO_MAX = 1000;
const UNIVERSITY_AGE = 17;

function computeAge(birthMonth: string, birthYear: string): number | null {
  if (!birthMonth || !birthYear) return null;
  const bYear = Number(birthYear);
  const bMonth = Number(birthMonth);
  if (!Number.isFinite(bYear) || !Number.isFinite(bMonth)) return null;
  const now = new Date();
  let age = now.getFullYear() - bYear;
  if (
    now.getMonth() + 1 < bMonth ||
    (now.getMonth() + 1 === bMonth && now.getDate() < 1)
  ) {
    age -= 1;
  }
  return age;
}

/* ── CollegeSearch — inline typeahead ─────────────────────────────────── */

interface CollegeSearchProps {
  selectedId: string;
  selectedLabel: string;
  onSelect: (id: string, label: string) => void;
  onClear: () => void;
}

function CollegeSearch({ selectedId, selectedLabel, onSelect, onClear }: CollegeSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PicklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function handleInput(value: string) {
    setQuery(value);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await fetchCollegesByName(value);
        setResults(items);
      } finally {
        setLoading(false);
      }
    }, 350);
  }

  function handleSelect(item: PicklistItem) {
    onSelect(item.value, item.label);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  if (selectedId) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-xl border border-cb-gray-200 bg-white px-4 py-3.5 shadow-sm">
        <span className="font-body text-[15px] font-semibold leading-snug text-cb-black">
          {selectedLabel}
        </span>
        <button
          type="button"
          onClick={onClear}
          aria-label="Remove university"
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-cb-gray-400 transition-all hover:bg-cb-gray-100 hover:text-cb-black"
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className={[
        "flex items-center gap-2 rounded-xl border-[1.5px] bg-white px-4 transition-[border-color,box-shadow] duration-150",
        open && query ? "border-cb-black shadow-[0_0_0_4px_rgba(254,233,72,0.45)]" : "border-cb-gray-300 hover:border-cb-gray-400",
      ].join(" ")}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={2} className="shrink-0 text-cb-gray-400" aria-hidden>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (query) setOpen(true); }}
          placeholder={t("register.about.universityPlaceholder")}
          className="h-12 min-w-0 flex-1 bg-transparent font-body text-[15px] text-cb-black placeholder:text-cb-gray-400 outline-none"
        />
        {loading && (
          <span className="shrink-0 inline-block h-4 w-4 animate-spin rounded-full border-2 border-cb-gray-400 border-t-transparent" />
        )}
      </div>

      {open && (results.length > 0 || (query.length >= 2 && !loading)) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-cb-gray-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center font-body text-[14px] text-cb-gray-400">
              No results — try a different name
            </div>
          ) : (
            <ul>
              {results.map((item) => (
                <li key={item.value}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
                    className="w-full border-b border-cb-gray-100 px-4 py-3 text-left font-body text-[15px] leading-snug text-cb-black last:border-0 hover:bg-cb-yellow/10 active:bg-cb-yellow/25"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ── StepAbout ─────────────────────────────────────────────────────────── */

interface Props {
  onContinue: () => void;
  onSkip: () => void;
}

export function StepAbout({ onContinue, onSkip }: Props) {
  const { watch, setValue, register } = useFormContext<UserRegisterFormValues>();

  const bio = watch("bio") ?? "";
  const cancerloss = watch("cancerloss") ?? false;
  const copingWithCancerLoss = watch("copingWithCancerLoss") ?? "";
  const isUniversityStudent = watch("isUniversityStudent") ?? false;
  const universityId = watch("universityId") ?? "";
  const birthMonth = watch("birthMonth") ?? "";
  const birthYear = watch("birthYear") ?? "";
  const userType = watch("userType") ?? "";

  const [copingOptions, setCopingOptions] = useState<PicklistItem[]>([]);
  const [loadingCoping, setLoadingCoping] = useState(false);
  const [universityLabel, setUniversityLabel] = useState("");

  const age = computeAge(birthMonth, birthYear);
  // Show for all non-caregivers. When birth is unknown (age===null) default to showing.
  const showCollege = userType !== "CAREGIVER" && (age === null || age >= UNIVERSITY_AGE);

  const bioLength = bio.length;
  const bioOverMax = bioLength > BIO_MAX;
  const canContinue = bioLength > 0 && !bioOverMax;

  const counterTone =
    bioOverMax
      ? "text-cb-danger"
      : bioLength > BIO_MAX - 60
        ? "text-cb-warning"
        : "text-cb-gray-400";

  useEffect(() => {
    if (!cancerloss) return;
    if (copingOptions.length > 0) return;
    setLoadingCoping(true);
    fetchCancerLossOptions()
      .then((data) => setCopingOptions(sortAlpha(data)))
      .finally(() => setLoadingCoping(false));
  }, [cancerloss, copingOptions.length]);

  // Clear university when college checkbox unchecked
  useEffect(() => {
    if (!isUniversityStudent) {
      setValue("universityId", "", { shouldDirty: true });
      setUniversityLabel("");
    }
  }, [isUniversityStudent, setValue]);

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.5rem, 2.1vw, 1.875rem)", lineHeight: 1.15 }}
        >
          {t("register.about.heading")}
        </h1>
        <p className="mt-1 font-body text-[14px] text-cb-gray-500">
          {t("register.about.sub")}
        </p>
      </div>

      {/* Bio textarea */}
      <div className="mb-5">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <label className="font-body text-[13px] font-medium text-cb-gray-700">
            {t("register.about.bioLabel")}
          </label>
          <span className={`font-body text-[12px] tabular-nums ${counterTone}`}>
            {t("register.about.bioCounter", { length: bioLength, max: BIO_MAX })}
          </span>
        </div>
        <textarea
          {...register("bio")}
          placeholder={t("register.about.bioPlaceholder")}
          rows={5}
          maxLength={BIO_MAX + 50}
          className={[
            "w-full resize-none rounded-2xl border-[1.5px] bg-white px-4 py-3",
            "font-body text-[15px] text-cb-black placeholder-cb-gray-400",
            "transition-colors focus:outline-none focus:border-cb-black",
            bioOverMax ? "border-cb-danger" : "border-cb-gray-200 hover:border-cb-gray-400",
          ].join(" ")}
        />
      </div>

      {/* Cancer loss */}
      <div className="mb-4">
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] border-cb-gray-200 px-4 py-3 transition-colors hover:border-cb-gray-400 hover:bg-cb-gray-50">
          <input
            type="checkbox"
            checked={cancerloss}
            onChange={(e) =>
              setValue("cancerloss", e.target.checked, { shouldDirty: true })
            }
            className="h-5 w-5 shrink-0 cursor-pointer rounded border-cb-gray-300 accent-cb-black"
          />
          <span className="font-body text-[14px] text-cb-black">
            {t("register.about.cancerlossLabel")}
          </span>
        </label>

        {cancerloss && (
          <div className="mt-4">
            {loadingCoping ? (
              <div className="flex items-center gap-2 py-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-cb-gray-400 border-t-transparent" />
                <span className="font-body text-[13px] text-cb-gray-400">Loading…</span>
              </div>
            ) : (
              <SingleSection
                sectionLabel={t("register.about.copingLabel")}
                selectLabel={t("register.about.selectCoping")}
                modalTitle={t("register.about.copingLabel")}
                searchPlaceholder={t("register.about.searchCoping")}
                items={copingOptions}
                selectedId={copingWithCancerLoss}
                onSelect={(id) => setValue("copingWithCancerLoss", id, { shouldDirty: true })}
                onClear={() => setValue("copingWithCancerLoss", "", { shouldDirty: true })}
                optional
              />
            )}
          </div>
        )}
      </div>

      {/* College — hidden for caregivers; shown for everyone else (mirrors mobile) */}
      {showCollege && (
        <div className="mb-5">
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] border-cb-gray-200 px-4 py-3 transition-colors hover:border-cb-gray-400 hover:bg-cb-gray-50">
            <input
              type="checkbox"
              checked={isUniversityStudent}
              onChange={(e) =>
                setValue("isUniversityStudent", e.target.checked, { shouldDirty: true })
              }
              className="h-5 w-5 shrink-0 cursor-pointer rounded border-cb-gray-300 accent-cb-black"
            />
            <span className="font-body text-[14px] text-cb-black">
              {t("register.about.collegeLabel")}
            </span>
          </label>

          {isUniversityStudent && (
            <div className="mt-4">
              <p className="mb-2 font-body text-[11px] font-bold uppercase tracking-[0.14em] text-cb-gray-500">
                {t("register.about.universityLabel")}
              </p>
              <CollegeSearch
                selectedId={universityId}
                selectedLabel={universityLabel}
                onSelect={(id, label) => {
                  setValue("universityId", id, { shouldDirty: true });
                  setUniversityLabel(label);
                }}
                onClear={() => {
                  setValue("universityId", "", { shouldDirty: true });
                  setUniversityLabel("");
                }}
              />
            </div>
          )}
        </div>
      )}

      <Button
        type="button"
        variant="primary"
        size="lg"
        fullWidth
        onClick={onContinue}
        disabled={!canContinue}
        className="touch-manipulation"
      >
        {t("common.continue")}
      </Button>

      <button
        type="button"
        onClick={onSkip}
        className="mt-4 w-full text-center font-body text-[14px] text-cb-gray-500 underline-offset-2 hover:text-cb-gray-700 hover:underline transition-colors touch-manipulation"
      >
        {t("register.about.mayLater")}
      </button>
    </div>
  );
}
