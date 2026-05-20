"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui";
import { MonthYearPicker } from "@/components/auth";
import type { UserRegisterFormValues } from "@/lib/user-signup/validation";
import {
  fetchDiagnoses,
  fetchTreatments,
  fetchTreatmentStatuses,
  fetchDisabilities,
} from "@/lib/aws/appsyncPicklistQueries";
import { t } from "@/lib/i18n";
import {
  sortAlpha,
  parseIds,
  joinIds,
  SectionLabel,
  MultiSection,
  SingleSection,
  LockedSection,
} from "./picker";

interface Props {
  userType: "PATIENT" | "SURVIVOR";
  onContinue: () => void;
}

/* ── Skeleton ───────────────────────────────────────────────────────────── */

function DiagnosisSkeleton() {
  return (
    <div className="w-full animate-pulse">
      <div className="mb-10">
        <div className="h-10 w-44 rounded-xl bg-cb-gray-100" />
        <div className="mt-3 h-4 w-64 rounded-lg bg-cb-gray-100" />
      </div>
      {[60, 40, 55, 48].map((w, i) => (
        <div key={i} className="mb-7">
          <div className="mb-3 h-2.5 w-20 rounded-full bg-cb-gray-100" />
          <div className="h-[52px] rounded-xl bg-cb-gray-100" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}

/* ── StepDiagnosis ──────────────────────────────────────────────────────── */

export function StepDiagnosis({ userType, onContinue }: Props) {
  const { watch, setValue } = useFormContext<UserRegisterFormValues>();

  const firstName        = watch("firstName") ?? "";
  const diagnosisVal     = watch("diagnosis") ?? "";
  const treatmentStatus  = watch("treatmentStatus") ?? "";
  const treatmentsVal    = watch("treatments") ?? "";
  const inRemissionSince = watch("inRemissionSince") ?? "";
  const disabilitiesVal  = watch("disabilities") ?? "";

  const [inRemissionMonth, inRemissionYear] = inRemissionSince.split("/");

  const [diagnoses,         setDiagnoses]        = useState<ReturnType<typeof sortAlpha>>([]);
  const [treatments,        setTreatments]        = useState<ReturnType<typeof sortAlpha>>([]);
  const [treatmentStatuses, setTreatmentStatuses] = useState<ReturnType<typeof sortAlpha>>([]);
  const [disabilities,      setDisabilities]      = useState<ReturnType<typeof sortAlpha>>([]);
  const [loading,           setLoading]           = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const loads: Promise<void>[] = [
      fetchDiagnoses().then((d)    => { if (!cancelled) setDiagnoses(sortAlpha(d)); }),
      fetchTreatments().then((d)   => { if (!cancelled) setTreatments(sortAlpha(d)); }),
      fetchDisabilities().then((d) => { if (!cancelled) setDisabilities(sortAlpha(d)); }),
    ];
    if (userType === "PATIENT") {
      loads.push(
        fetchTreatmentStatuses().then((d) => { if (!cancelled) setTreatmentStatuses(sortAlpha(d)); }),
      );
    }
    Promise.allSettled(loads).then(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userType]);

  /* ── Derived ── */

  const diagnosisIds  = parseIds(diagnosisVal);
  const treatmentIds  = parseIds(treatmentsVal);
  const disabilityIds = parseIds(disabilitiesVal);

  // Detect Pre-treatment by label — matches mobile's treat.label === 'Pre-treatment'
  const selectedStatusItem = treatmentStatuses.find((s) => s.value === treatmentStatus);
  const isPreTreatment = selectedStatusItem?.label === "Pre-treatment";
  const treatmentUnlocked =
    userType === "SURVIVOR" ||
    (treatmentStatus.trim() !== "" && !isPreTreatment);

  /* ── Mutators ── */

  function addId(
    field: "diagnosis" | "treatments" | "disabilities",
    current: string[],
    id: string,
  ) {
    if (!current.includes(id)) setValue(field, joinIds([...current, id]), { shouldDirty: true });
  }

  function removeId(
    field: "diagnosis" | "treatments" | "disabilities",
    current: string[],
    id: string,
  ) {
    setValue(field, joinIds(current.filter((i) => i !== id)), { shouldDirty: true });
  }

  function clearTreatmentStatus() {
    setValue("treatmentStatus", "", { shouldDirty: true });
    setValue("treatments",      "", { shouldDirty: true });
  }

  function handleTreatmentStatusSelect(id: string) {
    const item = treatmentStatuses.find((s) => s.value === id);
    setValue("treatmentStatus", id, { shouldDirty: true });
    // If Pre-treatment selected, clear any previously chosen treatments
    if (item?.label === "Pre-treatment") {
      setValue("treatments", "", { shouldDirty: true });
    }
  }

  /* ── canContinue ── */

  const canContinue =
    diagnosisIds.length > 0 &&
    (userType === "PATIENT"
      ? treatmentStatus.trim() !== ""
      : (inRemissionMonth ?? "") !== "" && (inRemissionYear ?? "") !== "");

  if (loading) return <DiagnosisSkeleton />;

  return (
    <div className="w-full">

      {/* ── Heading ── */}
      <div className="mb-10">
        <h1
          className="font-heading font-bold tracking-tight text-cb-black"
          style={{ fontSize: "clamp(2rem, 3.2vw, 2.75rem)", lineHeight: 1.05 }}
        >
          {firstName ? (
            <>
              <span className="relative inline-block">
                {firstName}
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 left-0 h-[4px] w-full rounded-full bg-cb-yellow"
                />
              </span>
              ?
            </>
          ) : (
            t("register.diagnosis.heading")
          )}
        </h1>
        <p className="mt-3 font-body text-[15px] leading-relaxed text-cb-gray-500">
          {t("register.diagnosis.sub")}
        </p>
      </div>

      {/* ── Sections ── */}
      <div className="mb-10 flex flex-col gap-8">

        {/* 1 ── My diagnosis — REQUIRED */}
        <MultiSection
          sectionLabel={t("register.diagnosis.myDiagnosis")}
          addFirstLabel={t("register.diagnosis.addDiagnosis")}
          addMoreLabel={t("register.diagnosis.addAnotherDiagnosis")}
          modalTitle={t("register.diagnosis.myDiagnosis")}
          searchPlaceholder={t("register.diagnosis.searchDiagnoses")}
          items={diagnoses}
          selectedIds={diagnosisIds}
          onAdd={(id)    => addId("diagnosis", diagnosisIds, id)}
          onRemove={(id) => removeId("diagnosis", diagnosisIds, id)}
          required
        />

        {/* 2a ── Currently I'm — REQUIRED (PATIENT) */}
        {userType === "PATIENT" && (
          <SingleSection
            sectionLabel={t("register.diagnosis.currentlyIm")}
            selectLabel={t("register.diagnosis.selectStatus")}
            modalTitle={t("register.diagnosis.currentlyIm")}
            searchPlaceholder={t("register.diagnosis.searchStatuses")}
            items={treatmentStatuses}
            selectedId={treatmentStatus}
            onSelect={handleTreatmentStatusSelect}
            onClear={clearTreatmentStatus}
            required
          />
        )}

        {/* 2b ── In remission since — REQUIRED (SURVIVOR) */}
        {userType === "SURVIVOR" && (
          <div>
            <SectionLabel text={t("register.diagnosis.inRemissionSince")} required />
            <MonthYearPicker
              month={inRemissionMonth ?? ""}
              year={inRemissionYear ?? ""}
              onChange={(m, y) =>
                setValue("inRemissionSince", `${String(m).padStart(2, "0")}/${y}`, { shouldDirty: true })
              }
              className="!mb-0"
            />
          </div>
        )}

        {/* 3 ── My treatment — OPTIONAL (locked for PATIENT until status chosen) */}
        {treatmentUnlocked ? (
          <MultiSection
            sectionLabel={t("register.diagnosis.myTreatment")}
            addFirstLabel={t("register.diagnosis.addTreatment")}
            addMoreLabel={t("register.diagnosis.addAnotherTreatment")}
            modalTitle={t("register.diagnosis.myTreatment")}
            searchPlaceholder={t("register.diagnosis.searchTreatments")}
            items={treatments}
            selectedIds={treatmentIds}
            onAdd={(id)    => addId("treatments", treatmentIds, id)}
            onRemove={(id) => removeId("treatments", treatmentIds, id)}
            optional
          />
        ) : (
          <LockedSection
            label={t("register.diagnosis.myTreatment")}
            hint={t("register.diagnosis.treatmentLocked")}
          />
        )}

        {/* 4 ── My side effects — OPTIONAL */}
        <MultiSection
          sectionLabel={t("register.diagnosis.mySideEffects")}
          addFirstLabel={t("register.diagnosis.addSideEffect")}
          addMoreLabel={t("register.diagnosis.addAnotherSideEffect")}
          modalTitle={t("register.diagnosis.mySideEffects")}
          searchPlaceholder={t("register.diagnosis.searchSideEffects")}
          items={disabilities}
          selectedIds={disabilityIds}
          onAdd={(id)    => addId("disabilities", disabilityIds, id)}
          onRemove={(id) => removeId("disabilities", disabilityIds, id)}
          optional
          hint={t("register.diagnosis.sideEffectsHint")}
        />
      </div>

      {/* ── Continue ── */}
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
