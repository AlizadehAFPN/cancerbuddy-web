"use client";

/**
 * The two quick filters: Diagnosis and Location.
 *
 * Both edit a *draft* copy of the filter state and only commit on "Show
 * results", so backing out of a sheet never changes what's on screen. Location
 * keeps mobile's two-step shape — pick a state, then optionally narrow to a
 * city — because cities are searched server-side and only make sense scoped to
 * a state.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import {
  AsyncPicker,
  CatalogPicker,
  ListSkeleton,
  OptionRow,
  Sheet,
} from "@/components/buddies/controls";
import {
  getCachedCatalog,
  loadCatalog,
  orderCatalog,
  resolveEntityName,
  searchCities,
} from "@/lib/buddies/picklists";
import type { PicklistItem } from "@/lib/aws/appsyncPicklistQueries";
import type { FilterValues } from "@/lib/buddies/types";

/* ── Diagnosis ──────────────────────────────────────────────────────────── */

/** Mounted only while open, so the draft starts from the live filters. */
export function DiagnosisSheet({
  filters,
  onApply,
  onClose,
}: {
  filters: FilterValues;
  onApply: (next: FilterValues) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<PicklistItem[]>(
    () => getCachedCatalog("diagnoses") ?? [],
  );
  const [loading, setLoading] = useState(items.length === 0);
  const [selected, setSelected] = useState<string[]>(() =>
    filters.diagnosis.split(",").filter((v) => v.trim() !== ""),
  );

  useEffect(() => {
    let cancelled = false;
    loadCatalog("diagnoses")
      .then((list) => {
        if (!cancelled) setItems(orderCatalog("diagnoses", list));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }, []);

  return (
    <Sheet
      open
      title={t("app.buddies.diagnosisTitle")}
      subtitle={t("app.buddies.diagnosisSub")}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setSelected([])}
            disabled={selected.length === 0}
          >
            {t("app.buddies.clear")}
          </Button>
          <Button
            fullWidth
            onClick={() => onApply({ ...filters, diagnosis: selected.join(",") })}
          >
            {t("app.buddies.showResults")}
          </Button>
        </div>
      }
    >
      <div className="h-[min(58vh,520px)]">
        <CatalogPicker
          items={items}
          selected={selected}
          onToggle={toggle}
          multiple
          loading={loading}
          searchPlaceholder={t("app.buddies.searchDiagnoses")}
        />
      </div>
    </Sheet>
  );
}

/* ── Location ───────────────────────────────────────────────────────────── */

type LocationStep = "state" | "city";

/** Mounted only while open; opens on whichever step matches the current value. */
export function LocationSheet({
  filters,
  onApply,
  onClose,
}: {
  filters: FilterValues;
  onApply: (next: FilterValues) => void;
  onClose: () => void;
}) {
  const [states, setStates] = useState<PicklistItem[]>(
    () => getCachedCatalog("states") ?? [],
  );
  const [loadingStates, setLoadingStates] = useState(states.length === 0);
  const [step, setStep] = useState<LocationStep>(() =>
    filters.userStateId ? "city" : "state",
  );
  const [stateId, setStateId] = useState(filters.userStateId);
  const [cityId, setCityId] = useState(filters.userCityId);
  const [cityLabel, setCityLabel] = useState<string | undefined>();
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadCatalog("states")
      .then((list) => {
        if (!cancelled) setStates(orderCatalog("states", list));
      })
      .finally(() => {
        if (!cancelled) setLoadingStates(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!cityId) {
      setCityLabel(undefined);
      return;
    }
    let cancelled = false;
    resolveEntityName("city", cityId).then((name) => {
      if (!cancelled) setCityLabel(name ?? undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  const stateName = useMemo(
    () => states.find((s) => s.value === stateId)?.label,
    [states, stateId],
  );

  const visibleStates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return states;
    return states.filter((s) => s.label.toLowerCase().includes(q));
  }, [states, query]);

  const searchInState = useCallback(
    (text: string) => searchCities(stateId, text),
    [stateId],
  );

  const applyStateOnly = () =>
    onApply({ ...filters, userStateId: stateId, userCityId: "" });

  const applyWithCity = () =>
    onApply({ ...filters, userStateId: stateId, userCityId: cityId });

  if (step === "state") {
    return (
      <Sheet
        open
        title={t("app.buddies.locationTitle")}
        subtitle={t("app.buddies.locationSub")}
        onClose={onClose}
        footer={
          filters.userStateId || filters.userCityId ? (
            <Button
              variant="secondary"
              fullWidth
              onClick={() => onApply({ ...filters, userStateId: "", userCityId: "" })}
            >
              {t("app.buddies.locationClear")}
            </Button>
          ) : undefined
        }
      >
        <div className="flex h-[min(58vh,520px)] flex-col">
          <div className="shrink-0 px-5 pb-3">
            <SearchInput value={query} onChange={setQuery} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-cb-gray-100">
            {loadingStates && states.length === 0 ? (
              <ListSkeleton rows={8} />
            ) : (
              visibleStates.map((s) => (
                <OptionRow
                  key={s.value}
                  label={s.label}
                  selected={s.value === stateId}
                  onClick={() => {
                    setStateId(s.value);
                    setCityId("");
                    setStep("city");
                  }}
                />
              ))
            )}
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      title={stateName ?? t("app.buddies.cityTitle")}
      subtitle={t("app.buddies.citySub")}
      onClose={onClose}
      onBack={() => setStep("state")}
      footer={
        <div className="flex flex-col gap-2.5">
          <Button fullWidth onClick={applyWithCity} disabled={!cityId}>
            {t("app.buddies.showResults")}
          </Button>
          <Button variant="secondary" fullWidth onClick={applyStateOnly}>
            {t("app.buddies.showWholeState")}
          </Button>
        </div>
      }
    >
      <div className="h-[min(52vh,460px)]">
        <AsyncPicker
          search={searchInState}
          selectedId={cityId}
          selectedLabel={cityLabel}
          onSelect={(item) => {
            setCityId(item.value);
            setCityLabel(item.label);
          }}
          onClear={() => {
            setCityId("");
            setCityLabel(undefined);
          }}
          placeholder={t("app.buddies.searchCity")}
          hint={t("app.buddies.typeTwoLetters")}
        />
      </div>
    </Sheet>
  );
}

/** Local search box for the state list (states are preloaded, not searched). */
function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t("app.buddies.searchStates")}
      className="h-11 w-full rounded-xl border border-cb-gray-200 bg-cb-gray-100/70 px-4 font-body text-[15px] text-cb-black outline-none transition-all placeholder:text-cb-gray-400 focus:border-cb-black focus:bg-white focus:shadow-[0_0_0_3px_rgba(36,36,36,0.07)]"
    />
  );
}
