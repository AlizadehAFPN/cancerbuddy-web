"use client";

/**
 * The full "Custom" filter — the web port of mobile's Filter screen.
 *
 * Which sections appear depends on the *viewer*, not the people being searched:
 * caregivers get patient-age and relationship fields, survivors get "in
 * remission since" instead of treatment status, and the age and college fields
 * only exist for users old enough for them. That mirroring is deliberate — the
 * two clients must offer the same filters to the same person.
 *
 * Everything edits a draft and commits on Apply.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import {
  AsyncPicker,
  CheckboxField,
  ChevronRightIcon,
  FieldLabel,
  MultiSelectField,
  NumberField,
  RadioGroup,
  SectionHeading,
  SelectField,
  Sheet,
  XIcon,
} from "@/components/buddies/controls";
import {
  getCachedCatalog,
  loadCatalogs,
  orderCatalog,
  resolveEntityName,
  searchCities,
  searchColleges,
  searchWorkplaces,
  type CatalogName,
  type Catalogs,
} from "@/lib/buddies/picklists";
import { MAXAGE, UNIVERSITY_AGE, displayAge } from "@/lib/buddies/age";
import { EMPTY_FILTERS, hasAnyFilter, type FilterValues } from "@/lib/buddies/types";
import type { CurrentUserData } from "@/lib/buddies/types";
import type { PicklistItem } from "@/lib/aws/appsyncPicklistQueries";

const STATUS_OPTIONS: PicklistItem[] = [
  { value: "", label: t("app.buddies.anyone") },
  { value: "PATIENT", label: t("app.buddies.statusPatient") },
  { value: "SURVIVOR", label: t("app.buddies.statusSurvivor") },
  { value: "CAREGIVER", label: t("app.buddies.statusCaregiver") },
];

/** Mobile caps support-organization picks at three; keep the same ceiling. */
const SUPPORT_ORG_LIMIT = 3;

/**
 * A one-value field backed by a server-side search (workplace, college, city).
 * Renders the chosen label inline and opens a picker sheet to change it.
 */
function AsyncSelectField({
  label,
  placeholder,
  hint,
  kind,
  search,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  hint?: string;
  kind: "city" | "college" | "workplace";
  search: (query: string) => Promise<PicklistItem[]>;
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [displayLabel, setDisplayLabel] = useState<string | undefined>();

  useEffect(() => {
    if (!value) {
      setDisplayLabel(undefined);
      return;
    }
    let cancelled = false;
    resolveEntityName(kind, value).then((name) => {
      if (!cancelled) setDisplayLabel(name ?? undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, value]);

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-w-0 flex-1 truncate text-left font-body text-[15px] text-cb-black"
          >
            {displayLabel ?? t("app.buddies.selected")}
          </button>
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={t("app.buddies.removeFilter", { label })}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-cb-gray-400 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
          >
            <XIcon size={13} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex w-full items-center justify-between rounded-xl border border-dashed border-cb-gray-300 px-4 py-3 text-left transition-all hover:border-cb-black hover:bg-cb-gray-100/60"
        >
          <span className="font-body text-[14px] font-medium text-cb-gray-500 transition-colors group-hover:text-cb-black">
            {placeholder}
          </span>
          <span className="text-cb-gray-400 transition-colors group-hover:text-cb-black">
            <ChevronRightIcon />
          </span>
        </button>
      )}

      <Sheet open={open} title={label} onClose={() => setOpen(false)}>
        <div className="h-[min(56vh,480px)]">
          <AsyncPicker
            search={search}
            selectedId={value}
            selectedLabel={displayLabel}
            onSelect={(item) => {
              onChange(item.value);
              setDisplayLabel(item.label);
              setOpen(false);
            }}
            onClear={() => onChange("")}
            placeholder={placeholder}
            hint={hint}
          />
        </div>
      </Sheet>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-cb-gray-100 px-5 py-6 first:border-t-0">
      <SectionHeading>{title}</SectionHeading>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

const CUSTOM_FILTER_CATALOGS: CatalogName[] = [
  "pronouns",
  "transgender",
  "sexualOrientations",
  "ethnicities",
  "languages",
  "states",
  "relationships",
  "diagnoses",
  "treatmentStatuses",
  "treatments",
  "disabilities",
  "hospitals",
  "supportOrganizations",
  "copingWithCancerLoss",
];

/** Mounted only while open, so the draft always starts from the live filters. */
export default function CustomFilterSheet({
  filters,
  currentUser,
  onApply,
  onClose,
}: {
  filters: FilterValues;
  currentUser: CurrentUserData | null;
  onApply: (next: FilterValues) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FilterValues>(filters);
  // Catalogues persist across opens, so a re-open renders fully populated.
  const [catalogs, setCatalogs] = useState<Catalogs>(() =>
    Object.fromEntries(
      CUSTOM_FILTER_CATALOGS.map((name) => [name, getCachedCatalog(name)]).filter(
        ([, items]) => !!items,
      ),
    ),
  );
  const [loading, setLoading] = useState(
    () => Object.keys(catalogs).length < CUSTOM_FILTER_CATALOGS.length,
  );

  const viewerType = currentUser?.userType;
  const isCaregiver = viewerType === "CAREGIVER";
  const isSurvivor = viewerType === "SURVIVOR";
  const viewerAge = displayAge(currentUser?.birth);

  useEffect(() => {
    let cancelled = false;
    loadCatalogs(CUSTOM_FILTER_CATALOGS)
      .then((loaded) => {
        if (!cancelled) setCatalogs(loaded);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ordered = useCallback(
    (name: keyof Catalogs) => orderCatalog(name, catalogs[name] ?? []),
    [catalogs],
  );

  const set = useCallback(
    <K extends keyof FilterValues>(key: K, value: FilterValues[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  /**
   * Treatment status drives the treatments list: clearing it, or choosing
   * "Pre-treatment" (nothing has started yet), empties the selected treatments
   * so the two can't contradict each other.
   */
  const treatmentStatusOptions = ordered("treatmentStatuses");
  const setTreatmentStatus = useCallback(
    (value: string) => {
      const chosen = treatmentStatusOptions.find((o) => o.value === value);
      setDraft((prev) => ({
        ...prev,
        userTreatmentStatusId: value,
        treatments:
          !value || chosen?.label === "Pre-treatment" ? "" : prev.treatments,
      }));
    },
    [treatmentStatusOptions],
  );

  const treatmentsDisabled = !draft.userTreatmentStatusId && !isSurvivor;

  /** Clearing the "coping with loss" / "in college" toggles clears their detail. */
  const setCancerLoss = useCallback((checked: boolean) => {
    setDraft((prev) => ({
      ...prev,
      cancerloss: checked ? "cancerloss" : "",
      userCopingwithcancerlossId: checked ? prev.userCopingwithcancerlossId : "",
    }));
  }, []);

  const setInCollege = useCallback((checked: boolean) => {
    setDraft((prev) => ({
      ...prev,
      CurrentlyInCollege: checked ? "college" : "",
      userCollegeId: checked ? prev.userCollegeId : "",
    }));
  }, []);

  const setState = useCallback((value: string) => {
    // A city id only means something inside its state.
    setDraft((prev) => ({ ...prev, userStateId: value, userCityId: "" }));
  }, []);

  const setSupportOrganizations = useCallback((next: string) => {
    const ids = next.split(",").filter((v) => v.trim() !== "");
    setDraft((prev) => ({
      ...prev,
      supportOrganizations: ids.slice(0, SUPPORT_ORG_LIMIT).join(","),
    }));
  }, []);

  const relationshipIds = useMemo(
    () => draft.relationshipPatient.split(",").filter((v) => v.trim() !== ""),
    [draft.relationshipPatient],
  );

  const toggleRelationship = useCallback(
    (id: string) => {
      const next = relationshipIds.includes(id)
        ? relationshipIds.filter((v) => v !== id)
        : [...relationshipIds, id];
      set("relationshipPatient", next.join(","));
    },
    [relationshipIds, set],
  );

  const searchCitiesInState = useCallback(
    (query: string) => searchCities(draft.userStateId, query),
    [draft.userStateId],
  );

  const dirty = JSON.stringify(draft) !== JSON.stringify(filters);

  return (
    <Sheet
      open
      wide
      title={t("app.buddies.customTitle")}
      subtitle={t("app.buddies.customSub")}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setDraft({ ...EMPTY_FILTERS })}
            disabled={!hasAnyFilter(draft)}
          >
            {t("app.buddies.clearAll")}
          </Button>
          <Button fullWidth onClick={() => onApply(draft)} disabled={!dirty}>
            {t("app.buddies.apply")}
          </Button>
        </div>
      }
    >
      <Section title={t("app.buddies.sectionStatus")}>
        <RadioGroup
          label={t("app.buddies.lookingFor")}
          value={draft.status}
          options={STATUS_OPTIONS}
          onChange={(v) => set("status", v)}
        />
      </Section>

      {viewerAge >= MAXAGE && (
        <Section
          title={
            isCaregiver
              ? t("app.buddies.sectionCaregiverInfo")
              : t("app.buddies.sectionAgeRange")
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label={t("app.buddies.minAge")}
              value={draft.ageRangeMin}
              onChange={(v) => set("ageRangeMin", v)}
              placeholder="18"
            />
            <NumberField
              label={t("app.buddies.maxAge")}
              value={draft.ageRangeMax}
              onChange={(v) => set("ageRangeMax", v)}
              placeholder="130"
            />
          </div>
        </Section>
      )}

      <Section title={t("app.buddies.sectionPersonal")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={t("app.buddies.gender")}
            value={draft.userPronounId}
            options={ordered("pronouns")}
            onChange={(v) => set("userPronounId", v)}
            disabled={loading}
          />
          <SelectField
            label={t("app.buddies.genderIdentity")}
            value={draft.userTransgenderId}
            options={ordered("transgender")}
            onChange={(v) => set("userTransgenderId", v)}
            disabled={loading}
          />
          <SelectField
            label={t("app.buddies.sexualOrientation")}
            value={draft.userSexualOrientationId}
            options={ordered("sexualOrientations")}
            onChange={(v) => set("userSexualOrientationId", v)}
            disabled={loading}
          />
          <SelectField
            label={t("app.buddies.ethnicity")}
            value={draft.userEthnicitiesId}
            options={ordered("ethnicities")}
            onChange={(v) => set("userEthnicitiesId", v)}
            disabled={loading}
          />
        </div>

        <MultiSelectField
          label={t("app.buddies.languages")}
          catalogItems={ordered("languages")}
          value={draft.languages}
          onChange={(v) => set("languages", v)}
          addLabel={t("app.buddies.addLanguage")}
          loading={loading}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={t("app.buddies.state")}
            value={draft.userStateId}
            options={ordered("states")}
            onChange={setState}
            disabled={loading}
          />
          {draft.userStateId && (
            <AsyncSelectField
              label={t("app.buddies.city")}
              kind="city"
              placeholder={t("app.buddies.searchCity")}
              hint={t("app.buddies.typeTwoLetters")}
              search={searchCitiesInState}
              value={draft.userCityId}
              onChange={(v) => set("userCityId", v)}
            />
          )}
        </div>

        <AsyncSelectField
          label={t("app.buddies.workplace")}
          kind="workplace"
          placeholder={t("app.buddies.searchWorkplace")}
          hint={t("app.buddies.typeTwoLetters")}
          search={searchWorkplaces}
          value={draft.userWorkplaceId}
          onChange={(v) => set("userWorkplaceId", v)}
        />
      </Section>

      {isCaregiver && (
        <Section title={t("app.buddies.sectionRelationship")}>
          <div className="flex flex-wrap gap-2">
            {ordered("relationships").map((r) => {
              const selected = relationshipIds.includes(r.value);
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => toggleRelationship(r.value)}
                  aria-pressed={selected}
                  className={[
                    "rounded-full border-[1.5px] px-4 py-2 font-body text-[14px] transition-colors",
                    selected
                      ? "border-cb-black bg-cb-black text-white"
                      : "border-cb-gray-300 bg-white text-cb-black hover:border-cb-gray-400",
                  ].join(" ")}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section
        title={
          isCaregiver
            ? t("app.buddies.sectionPatientInfo")
            : t("app.buddies.sectionMedical")
        }
      >
        <MultiSelectField
          label={
            isCaregiver
              ? t("app.buddies.patientDiagnosis")
              : t("app.buddies.diagnosis")
          }
          catalogItems={ordered("diagnoses")}
          value={draft.diagnosis}
          onChange={(v) => set("diagnosis", v)}
          addLabel={t("app.buddies.addDiagnosis")}
          searchPlaceholder={t("app.buddies.searchDiagnoses")}
          loading={loading}
        />

        {isCaregiver && (
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label={t("app.buddies.patientMinAge")}
              value={draft.ageRangeMinPatient}
              onChange={(v) => set("ageRangeMinPatient", v)}
              placeholder="0"
            />
            <NumberField
              label={t("app.buddies.patientMaxAge")}
              value={draft.ageRangeMaxPatient}
              onChange={(v) => set("ageRangeMaxPatient", v)}
              placeholder="130"
            />
          </div>
        )}

        {!isSurvivor && (
          <SelectField
            label={t("app.buddies.treatmentStatus")}
            value={draft.userTreatmentStatusId}
            options={treatmentStatusOptions}
            onChange={setTreatmentStatus}
            disabled={loading}
          />
        )}

        <div className={treatmentsDisabled ? "opacity-50" : undefined}>
          <MultiSelectField
            label={t("app.buddies.treatments")}
            catalogItems={treatmentsDisabled ? [] : ordered("treatments")}
            value={draft.treatments}
            onChange={(v) => set("treatments", v)}
            addLabel={
              treatmentsDisabled
                ? t("app.buddies.treatmentStatusFirst")
                : t("app.buddies.addTreatment")
            }
            loading={loading}
          />
        </div>

        {isSurvivor && (
          <div>
            <FieldLabel>{t("app.buddies.inRemissionSince")}</FieldLabel>
            <input
              value={draft.inRemissionSince}
              onChange={(e) => set("inRemissionSince", maskMonthYear(e.target.value))}
              placeholder="MM/YYYY"
              inputMode="numeric"
              maxLength={7}
              className="h-12 w-full rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-4 font-body text-[15px] text-cb-black outline-none transition-colors placeholder:text-cb-gray-400 hover:border-cb-gray-400 focus:border-cb-black focus:shadow-[0_0_0_4px_rgba(254,233,72,0.45)]"
            />
            <p className="mt-1.5 font-body text-[12px] text-cb-gray-400">
              {t("app.buddies.inRemissionHint")}
            </p>
          </div>
        )}

        <MultiSelectField
          label={t("app.buddies.sideEffects")}
          catalogItems={ordered("disabilities")}
          value={draft.desabilities}
          onChange={(v) => set("desabilities", v)}
          addLabel={t("app.buddies.addSideEffect")}
          loading={loading}
        />
      </Section>

      <Section title={t("app.buddies.sectionMedicalCenter")}>
        <MultiSelectField
          label={t("app.buddies.medicalCenters")}
          catalogItems={ordered("hospitals")}
          value={draft.hospitals}
          onChange={(v) => set("hospitals", v)}
          addLabel={t("app.buddies.addMedicalCenter")}
          searchPlaceholder={t("app.buddies.searchMedicalCenters")}
          loading={loading}
        />
      </Section>

      <Section title={t("app.buddies.sectionSupportOrgs")}>
        <MultiSelectField
          label={t("app.buddies.supportOrgs", { limit: SUPPORT_ORG_LIMIT })}
          catalogItems={ordered("supportOrganizations")}
          value={draft.supportOrganizations}
          onChange={setSupportOrganizations}
          addLabel={t("app.buddies.addSupportOrg")}
          loading={loading}
        />
      </Section>

      <Section title={t("app.buddies.sectionOther")}>
        <CheckboxField
          label={t("app.buddies.cancerLoss")}
          checked={!!draft.cancerloss}
          onChange={setCancerLoss}
        />
        {!!draft.cancerloss && (
          <SelectField
            label={t("app.buddies.whoDidTheyLose")}
            value={draft.userCopingwithcancerlossId}
            options={ordered("copingWithCancerLoss")}
            onChange={(v) => set("userCopingwithcancerlossId", v)}
            disabled={loading}
          />
        )}

        {!isCaregiver && viewerAge >= UNIVERSITY_AGE && (
          <>
            <CheckboxField
              label={t("app.buddies.inCollege")}
              checked={!!draft.CurrentlyInCollege}
              onChange={setInCollege}
            />
            {!!draft.CurrentlyInCollege && (
              <AsyncSelectField
                label={t("app.buddies.college")}
                kind="college"
                placeholder={t("app.buddies.searchColleges")}
                hint={t("app.buddies.typeTwoLetters")}
                search={searchColleges}
                value={draft.userCollegeId}
                onChange={(v) => set("userCollegeId", v)}
              />
            )}
          </>
        )}
      </Section>
    </Sheet>
  );
}

/** Keeps the remission input in `MM/YYYY` shape as the user types. */
function maskMonthYear(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "").slice(0, 6);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}
