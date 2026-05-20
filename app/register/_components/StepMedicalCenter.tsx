"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui";
import type { UserRegisterFormValues } from "@/lib/user-signup/validation";
import {
  fetchHospitals,
  fetchSupportOrganizations,
} from "@/lib/aws/appsyncPicklistQueries";
import { t } from "@/lib/i18n";
import { sortAlpha, parseIds, joinIds, MultiSection } from "./picker";

interface Props {
  onContinue: () => void;
  onSkip: () => void;
}

export function StepMedicalCenter({ onContinue, onSkip }: Props) {
  const { watch, setValue } = useFormContext<UserRegisterFormValues>();

  const hospitalsVal            = watch("hospitals") ?? "";
  const supportOrganizationsVal = watch("supportOrganizations") ?? "";

  const [hospitals,   setHospitals]   = useState<ReturnType<typeof sortAlpha>>([]);
  const [supportOrgs, setSupportOrgs] = useState<ReturnType<typeof sortAlpha>>([]);
  const [loading,     setLoading]     = useState(true);

  const canContinue =
    parseIds(hospitalsVal).length > 0 &&
    parseIds(supportOrganizationsVal).length > 0;

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetchHospitals().then((d)            => { if (!cancelled) setHospitals(sortAlpha(d)); }),
      fetchSupportOrganizations().then((d) => { if (!cancelled) setSupportOrgs(sortAlpha(d)); }),
    ]).then(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const hospitalIds   = parseIds(hospitalsVal);
  const supportOrgIds = parseIds(supportOrganizationsVal);

  function addHospital(id: string) {
    if (!hospitalIds.includes(id))
      setValue("hospitals", joinIds([...hospitalIds, id]), { shouldDirty: true });
  }
  function removeHospital(id: string) {
    setValue("hospitals", joinIds(hospitalIds.filter((i) => i !== id)), { shouldDirty: true });
  }
  function addSupportOrg(id: string) {
    if (!supportOrgIds.includes(id))
      setValue("supportOrganizations", joinIds([...supportOrgIds, id]), { shouldDirty: true });
  }
  function removeSupportOrg(id: string) {
    setValue("supportOrganizations", joinIds(supportOrgIds.filter((i) => i !== id)), { shouldDirty: true });
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.5rem, 2.1vw, 1.875rem)", lineHeight: 1.15 }}
        >
          {t("register.medicalCenter.heading")}
        </h1>
        <p className="mt-2 font-body text-[14px] text-cb-gray-500">
          {t("register.medicalCenter.sub")}
        </p>
      </div>

      {loading ? (
        <div className="mb-6 flex flex-col gap-7 animate-pulse">
          {[70, 55].map((w, i) => (
            <div key={i}>
              <div className="mb-3 h-2.5 w-24 rounded-full bg-cb-gray-100" />
              <div className="h-[52px] rounded-xl bg-cb-gray-100" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-8 flex flex-col gap-8">
          <MultiSection
            sectionLabel={t("register.medicalCenter.hospitalsLabel")}
            addFirstLabel={t("register.medicalCenter.addHospital")}
            addMoreLabel={t("register.medicalCenter.addAnotherHospital")}
            modalTitle={t("register.medicalCenter.hospitalsLabel")}
            searchPlaceholder={t("register.medicalCenter.searchHospitals")}
            items={hospitals}
            selectedIds={hospitalIds}
            onAdd={addHospital}
            onRemove={removeHospital}
            optional
          />

          <MultiSection
            sectionLabel={t("register.medicalCenter.supportOrgsLabel")}
            addFirstLabel={t("register.medicalCenter.addSupportOrg")}
            addMoreLabel={t("register.medicalCenter.addAnotherSupportOrg")}
            modalTitle={t("register.medicalCenter.supportOrgsLabel")}
            searchPlaceholder={t("register.medicalCenter.searchSupportOrgs")}
            items={supportOrgs}
            selectedIds={supportOrgIds}
            onAdd={addSupportOrg}
            onRemove={removeSupportOrg}
            optional
            limit={3}
          />

          <p className="font-body text-[12px] text-cb-gray-400">
            {t("register.medicalCenter.skipNote")}
          </p>
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

      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={onSkip}
          className="font-body text-sm text-cb-gray-500 underline-offset-2 hover:text-cb-black hover:underline transition-colors"
        >
          {t("register.medicalCenter.skipLink")}
        </button>
      </div>
    </div>
  );
}
