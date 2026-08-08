"use client";

/**
 * `/profile/medical` — medical information.
 *
 * This screen changes shape more than any other in the profile, so the rules
 * are computed once in `medicalRulesFor` rather than scattered through the
 * markup:
 *
 *  • **Survivors** are asked when they went into remission and never for a
 *    treatment status; everyone else is asked the reverse.
 *  • **Treatments stay locked** until a treatment status is chosen — survivors
 *    excepted, since they have no status to choose.
 *  • **Patients** must supply a treatment status; **survivors** must supply a
 *    remission date; **everyone** must supply at least one diagnosis.
 *  • **Caregivers** see the same record described as their patient's.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { FieldLabel, MultiSelectField, SelectField } from "@/components/ui/form";
import { ArrowLeftIcon } from "@/components/ui/icons";
import {
  fetchDiagnoses,
  searchDiagnoses,
  searchHospitals,
  fetchDisabilities,
  fetchHospitals,
  fetchSupportOrganizations,
  fetchTreatments,
  fetchTreatmentStatuses,
  type PicklistItem,
} from "@/lib/aws/appsyncPicklistQueries";
import { useProfile } from "@/lib/profile/ProfileProvider";
import {
  useDirtyForm,
  useUnsavedChanges,
} from "@/lib/navigation/UnsavedChangesProvider";
import {
  fetchMedicalInfo,
  medicalRulesFor,
  saveMedicalInfo,
  type MedicalInfoRows,
  type MedicalInfoValues,
} from "@/lib/profile/medicalInfo";
import {
  formatMonthYearInput,
  validateMonthYear,
} from "@/lib/profile/monthYear";

const EMPTY: MedicalInfoValues = {
  diagnosisIds: [],
  treatmentIds: [],
  hospitalIds: [],
  disabilityIds: [],
  supportOrgIds: [],
  userTreatmentStatusId: "",
  inRemissionSince: "",
};

const EMPTY_ROWS: MedicalInfoRows = {
  diagnosis: [],
  treatments: [],
  hospitals: [],
  disabilities: [],
  supportOrgs: [],
};

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-cb-gray-200 bg-white p-5">
      <h2 className="font-heading text-[13px] font-bold uppercase tracking-[0.12em] text-cb-black">
        {title}
      </h2>
      {description && (
        <p className="mt-1.5 font-body text-[13.5px] leading-snug text-cb-gray-500">
          {description}
        </p>
      )}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

const csv = (ids: string[]) => ids.join(",");
const fromCsv = (v: string) => v.split(",").filter((s) => s.trim() !== "");

export default function MedicalInfoForm() {
  const { guardedPush } = useUnsavedChanges();
  const { userId, user, refresh } = useProfile();

  const [values, setValues] = useState<MedicalInfoValues>(EMPTY);
  const [initial, setInitial] = useState<MedicalInfoValues>(EMPTY);
  const [rows, setRows] = useState<MedicalInfoRows>(EMPTY_ROWS);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [catalogs, setCatalogs] = useState<{
    diagnoses: PicklistItem[];
    treatments: PicklistItem[];
    statuses: PicklistItem[];
    hospitals: PicklistItem[];
    supportOrgs: PicklistItem[];
    disabilities: PicklistItem[];
  }>({
    diagnoses: [],
    treatments: [],
    statuses: [],
    hospitals: [],
    supportOrgs: [],
    disabilities: [],
  });

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      try {
        const [loaded, diagnoses, treatments, statuses, hospitals, supportOrgs, disabilities] =
          await Promise.all([
            fetchMedicalInfo(userId),
            fetchDiagnoses(),
            fetchTreatments(),
            fetchTreatmentStatuses(),
            fetchHospitals(),
            fetchSupportOrganizations(),
            fetchDisabilities(),
          ]);
        if (cancelled || !mountedRef.current) return;

        setValues(loaded.values);
        setInitial(loaded.values);
        setRows(loaded.rows);
        setCatalogs({
          diagnoses,
          treatments,
          statuses,
          hospitals,
          supportOrgs,
          disabilities,
        });
      } catch (err) {
        console.error("[profile] medical info load failed:", err);
        if (!cancelled && mountedRef.current) setLoadError(true);
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const patch = useCallback((next: Partial<MedicalInfoValues>) => {
    setValues((prev) => ({ ...prev, ...next }));
  }, []);

  const rules = useMemo(
    () => medicalRulesFor(user?.userType, !!values.userTreatmentStatusId),
    [user?.userType, values.userTreatmentStatusId],
  );

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initial),
    [values, initial],
  );

  /** Mirrors the three `Profile*DiagnosisScheme` validators. */
  const validationError = useMemo(() => {
    if (rules.requireDiagnosis && values.diagnosisIds.length === 0) {
      return t("app.profile.diagnosisRequired");
    }
    if (rules.requireTreatmentStatus && !values.userTreatmentStatusId) {
      return t("app.profile.treatmentStatusRequired");
    }
    if (rules.requireRemissionDate && !values.inRemissionSince.trim()) {
      return t("app.profile.remissionRequired");
    }
    const dateError = validateMonthYear(values.inRemissionSince);
    if (dateError === "incomplete" || dateError === "invalid") {
      return t("app.profile.remissionInvalid");
    }
    if (dateError === "future") return t("app.profile.dateFuture");
    if (dateError === "too-old") return t("app.profile.dateTooOld");
    return null;
  }, [rules, values]);

  const canSave = dirty && !validationError && !saving;

  /*
   * Route-change guard. This was a `beforeunload` listener, which never fires on
   * client-side navigation — so the back arrow, a sidebar link and browser back
   * all discarded the form silently. The provider covers all three, and keeps
   * `beforeunload` for the refresh and tab-close case.
   */
  useDirtyForm(dirty);

  const save = useCallback(async () => {
    if (!userId || !canSave) return;
    setSaving(true);
    try {
      const outcome = await saveMedicalInfo({ userId, values, rows });
      if (!outcome.ok) throw new Error("updateUser returned no id");

      // Re-read so join-row ids are current before the next diff.
      const reloaded = await fetchMedicalInfo(userId);
      if (mountedRef.current) {
        setValues(reloaded.values);
        setInitial(reloaded.values);
        setRows(reloaded.rows);
      }
      await refresh();

      toast[outcome.partial ? "warning" : "success"](
        t(outcome.partial ? "app.profile.savedPartial" : "app.profile.saved"),
      );
    } catch (err) {
      console.error("[profile] medical info save failed:", err);
      toast.error(t("app.profile.saveError"));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [userId, canSave, values, rows, refresh]);

  if (loading) {
    return (
      <div aria-hidden className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl bg-cb-gray-100" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
        <p className="font-heading text-[18px] font-bold text-cb-black">
          {t("app.profile.loadError")}
        </p>
        <Button variant="secondary" onClick={() => void guardedPush("/profile")}>
          {t("app.profile.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void guardedPush("/profile")}
          aria-label={t("app.profile.back")}
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-cb-gray-600 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
        >
          <ArrowLeftIcon />
        </button>
        <h1 className="font-heading text-[22px] font-bold tracking-tight text-cb-black">
          {t(
            rules.aboutPatient
              ? "app.profile.medicalPatientTitle"
              : "app.profile.medicalTitle",
          )}
        </h1>
      </header>

      <div className="space-y-4 pb-28">
        <Card
          title={t("app.profile.diagnosisSection")}
          description={t(
            rules.aboutPatient
              ? "app.profile.diagnosisHintPatient"
              : "app.profile.diagnosisHint",
          )}
        >
          <MultiSelectField
            label={t("app.profile.diagnosis")}
            catalogItems={catalogs.diagnoses}
            onSearch={searchDiagnoses}
            value={csv(values.diagnosisIds)}
            addLabel={t("app.profile.addDiagnosis")}
            searchPlaceholder={t("app.profile.searchDiagnoses")}
            onChange={(next) => patch({ diagnosisIds: fromCsv(next) })}
          />

          {rules.showTreatmentStatus && (
            <SelectField
              label={t("app.profile.treatmentStatus")}
              value={values.userTreatmentStatusId}
              options={catalogs.statuses}
              placeholder={t("app.profile.selectOne")}
              onChange={(v) => patch({ userTreatmentStatusId: v })}
            />
          )}

          {rules.showRemissionDate && (
            <div>
              <FieldLabel>{t("app.profile.remissionSince")}</FieldLabel>
              <input
                value={values.inRemissionSince}
                inputMode="numeric"
                placeholder="MM/YYYY"
                maxLength={7}
                onChange={(e) =>
                  patch({
                    inRemissionSince: formatMonthYearInput(e.target.value),
                  })
                }
                className="h-12 w-full rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-4 font-body text-[15px] text-cb-black outline-none transition-colors placeholder:text-cb-gray-400 hover:border-cb-gray-400 focus:border-cb-black"
              />
              <p className="mt-1.5 font-body text-[12.5px] text-cb-gray-400">
                {t("app.profile.remissionHint")}
              </p>
            </div>
          )}

          <div>
            <MultiSelectField
              label={t("app.profile.treatments")}
              catalogItems={catalogs.treatments}
              value={csv(values.treatmentIds)}
              addLabel={t("app.profile.addTreatment")}
              searchPlaceholder={t("app.profile.searchTreatments")}
              loading={!rules.treatmentsEnabled}
              onChange={(next) =>
                rules.treatmentsEnabled
                  ? patch({ treatmentIds: fromCsv(next) })
                  : undefined
              }
            />
            {!rules.treatmentsEnabled && (
              <p className="mt-1.5 font-body text-[12.5px] text-cb-gray-400">
                {t("app.profile.treatmentsLocked")}
              </p>
            )}
          </div>
        </Card>

        <Card
          title={t("app.profile.careTeamSection")}
          description={t(
            rules.aboutPatient
              ? "app.profile.careTeamHintPatient"
              : "app.profile.careTeamHint",
          )}
        >
          <MultiSelectField
            label={t("app.profile.hospitals")}
            catalogItems={catalogs.hospitals}
            onSearch={searchHospitals}
            value={csv(values.hospitalIds)}
            addLabel={t("app.profile.addHospital")}
            searchPlaceholder={t("app.profile.searchHospitals")}
            onChange={(next) => patch({ hospitalIds: fromCsv(next) })}
          />
          <MultiSelectField
            label={t("app.profile.supportOrganizations")}
            catalogItems={catalogs.supportOrgs}
            value={csv(values.supportOrgIds)}
            addLabel={t("app.profile.addSupportOrganization")}
            searchPlaceholder={t("app.profile.searchSupportOrganizations")}
            onChange={(next) => patch({ supportOrgIds: fromCsv(next) })}
          />
        </Card>

        <Card
          title={t("app.profile.sideEffectsSection")}
          description={t("app.profile.sideEffectsHint")}
        >
          <MultiSelectField
            label={t("app.profile.disabilities")}
            catalogItems={catalogs.disabilities}
            value={csv(values.disabilityIds)}
            addLabel={t("app.profile.addDisability")}
            searchPlaceholder={t("app.profile.searchDisabilities")}
            onChange={(next) => patch({ disabilityIds: fromCsv(next) })}
          />
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-cb-gray-200 bg-white/95 px-4 py-3 backdrop-blur lg:left-[var(--app-sidebar-w,0px)]">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
          <p
            className={[
              "min-w-0 font-body text-[13px]",
              validationError ? "text-cb-danger" : "text-cb-gray-500",
            ].join(" ")}
          >
            {validationError ??
              (dirty
                ? t("app.profile.unsavedChanges")
                : t("app.profile.allSaved"))}
          </p>
          <Button onClick={save} disabled={!canSave} loading={saving}>
            {t("app.profile.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
