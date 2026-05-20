"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button, Input } from "@/components/ui";
import type { UserRegisterFormValues } from "@/lib/user-signup/validation";
import {
  fetchCitiesByZipCode,
  type ZipCodeResult,
} from "@/lib/aws/appsyncPicklistQueries";
import { t } from "@/lib/i18n";

interface Props {
  onContinue: () => void;
}

interface CityOption {
  value: string;  // cityID
  label: string;  // cityName
  zipRecordId: string;
  stateID: string;
  stateName: string;
}

export function StepAddress({ onContinue }: Props) {
  const { watch, setValue } = useFormContext<UserRegisterFormValues>();

  const cityVal    = watch("city") ?? "";
  const stateVal   = watch("state") ?? "";
  const zipcodeVal = watch("zipcode") ?? "";

  // Raw zip typed by the user (display only — form stores the record ID)
  const [rawZip, setRawZip] = useState("");
  const [cityOptions, setCityOptions] = useState<CityOption[]>([]);
  const [stateName, setStateName] = useState("");
  const [zipError, setZipError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  // Track whether the user has started typing a new zip (for edit-mode init)
  const userEditedRef = useRef(false);

  const canContinue = cityVal.trim() !== "" && stateVal.trim() !== "" && zipcodeVal.trim() !== "";

  // On mount: if the form already has a zipcode record ID (returning user draft),
  // use SEARCH_BY_ZIP_ID to pre-populate. Skipped here since enrollment is
  // always forward-only; restoring from draft will re-show the zip input empty
  // and the user must re-enter. Matches mobile's new-user path.

  function clearLocation() {
    setValue("city", "", { shouldDirty: true });
    setValue("state", "", { shouldDirty: true });
    setValue("zipcode", "", { shouldDirty: true });
    setCityOptions([]);
    setStateName("");
    setZipError(null);
  }

  async function handleZipChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 5);
    setRawZip(digits);
    userEditedRef.current = true;

    if (digits.length < 5) {
      clearLocation();
      return;
    }

    // 5 digits entered — fire lookup
    setSearching(true);
    setZipError(null);
    clearLocation();

    try {
      const results: ZipCodeResult[] = await fetchCitiesByZipCode(digits);
      if (results.length === 0) {
        setZipError(t("register.address.zipNotFound"));
      } else {
        const options: CityOption[] = results
          .map((r) => ({
            value: r.cityID,
            label: r.cityName,
            zipRecordId: r.value,
            stateID: r.stateID,
            stateName: r.stateName,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));
        setCityOptions(options);

        // Auto-select when only one city
        if (options.length === 1) {
          selectCity(options[0]);
        }
      }
    } catch {
      setZipError(t("register.address.zipNotFound"));
    } finally {
      setSearching(false);
    }
  }

  function selectCity(option: CityOption) {
    setValue("city", option.value, { shouldDirty: true });
    setValue("state", option.stateID, { shouldDirty: true });
    setValue("zipcode", option.zipRecordId, { shouldDirty: true });
    setStateName(option.stateName);
  }

  const showCityDropdown = cityOptions.length > 0;
  const selectedCity = cityOptions.find((o) => o.value === cityVal);

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.5rem, 2.1vw, 1.875rem)", lineHeight: 1.15 }}
        >
          {t("register.address.heading")}
        </h1>
        <p className="mt-2 font-body text-[14px] text-cb-gray-500">
          {t("register.address.sub")}
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-6">

        {/* Field 1 — Zip code (first, mandatory) */}
        <div>
          <Input
            label={t("register.address.zipcodeLabel")}
            placeholder={t("register.address.zipcodePlaceholder")}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={5}
            autoComplete="postal-code"
            value={rawZip}
            onChange={(e) => handleZipChange(e.target.value)}
          />
          {searching && (
            <p className="mt-1.5 font-body text-[12px] text-cb-gray-400">
              {t("register.address.zipSearching")}
            </p>
          )}
          {zipError && !searching && (
            <p className="mt-1.5 font-body text-[12px] text-cb-danger">
              {zipError}
            </p>
          )}
        </div>

        {/* Field 2 — City dropdown (appears after successful zip lookup) */}
        {showCityDropdown && (
          <div>
            <label className="mb-1.5 block font-body text-[13px] font-medium text-cb-gray-700">
              {t("register.address.cityLabel")}
            </label>
            <div className="flex flex-col gap-2">
              {cityOptions.map((option) => {
                const selected = option.value === cityVal;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => selectCity(option)}
                    className={[
                      "flex w-full items-center justify-between rounded-xl border-[1.5px] px-4 py-3.5 text-left transition-all duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black",
                      selected
                        ? "border-cb-black bg-cb-black/[0.03]"
                        : "border-cb-gray-200 hover:border-cb-gray-400 hover:bg-cb-gray-50",
                    ].join(" ")}
                    aria-pressed={selected}
                  >
                    <span
                      className={[
                        "font-body text-[15px] font-medium",
                        selected ? "text-cb-black" : "text-cb-gray-700",
                      ].join(" ")}
                    >
                      {option.label}
                    </span>
                    {selected && (
                      <span className="ml-2 shrink-0 text-cb-black">
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} aria-hidden>
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Field 3 — State (read-only, auto-filled from zip lookup) */}
        {selectedCity && stateName && (
          <Input
            label={t("register.address.stateLabel")}
            placeholder={t("register.address.statePlaceholder")}
            value={stateName}
            readOnly
            disabled
            onChange={() => {}}
          />
        )}
      </div>

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
    </div>
  );
}
