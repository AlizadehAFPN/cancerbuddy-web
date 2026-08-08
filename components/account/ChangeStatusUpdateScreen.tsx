"use client";

/**
 * Path B — re-collecting the medical information a new role needs.
 *
 * Switching between Patient and Caregiver rewrites the medical join rows,
 * because "my diagnosis" and "my patient's diagnosis" are different records.
 * Mobile spreads this over four screens with a progress bar; web asks for the
 * same fields on one page, which is the same collapse the register flow already
 * makes on a wide screen. The **fields, the validation and the payload are
 * mobile's** — only the number of screens differs.
 *
 * Nothing is written until Continue on the review step: the Lambda replaces
 * records, so a half-finished form must not reach it.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import { useAccount } from "@/lib/account/AccountProvider";
import { finishSignedOutFlow } from "@/lib/account/finishSignedOutFlow";
import {
  canContinueFromDiagnosis,
  progressDenominator,
  type ChangeStatusTarget,
} from "@/lib/account/changeStatus";
import { applyStatusPathB } from "@/lib/account/changeStatusWrite";
import {
  fetchDiagnoses,
  fetchHospitals,
  fetchRelationships,
  fetchTreatmentStatuses,
  fetchTreatments,
  type PicklistItem,
} from "@/lib/aws/appsyncPicklistQueries";
import {
  formatMonthYearInput,
  validateMonthYear,
} from "@/lib/profile/monthYear";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-body text-[11px] font-bold uppercase tracking-[0.14em] text-cb-gray-500">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block font-body text-[12.5px] text-cb-gray-500">
          {hint}
        </span>
      )}
    </label>
  );
}

/** A compact multi-select: a searchable list of checkboxes. */
function MultiPicker({
  label,
  options,
  selected,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  options: PicklistItem[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <Field label={label} hint={hint}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        placeholder={t("app.settings.statusSearch")}
        className="mb-2 h-11 w-full rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-3.5 font-body text-[14.5px] text-cb-black outline-none transition-colors focus:border-cb-black disabled:opacity-50"
      />
      <div
        className={[
          "max-h-56 overflow-y-auto rounded-xl border border-cb-gray-200 bg-white",
          disabled ? "opacity-50" : "",
        ].join(" ")}
      >
        {shown.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-3 border-b border-cb-gray-100 px-3.5 py-2.5 last:border-0"
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() =>
                  onChange(
                    checked
                      ? selected.filter((id) => id !== option.value)
                      : [...selected, option.value],
                  )
                }
              />
              <span className="font-body text-[14.5px] text-cb-black">
                {option.label}
              </span>
            </label>
          );
        })}
        {shown.length === 0 && (
          <p className="px-3.5 py-3 font-body text-[13.5px] text-cb-gray-500">
            {t("app.settings.statusNoMatches")}
          </p>
        )}
      </div>
    </Field>
  );
}

export default function ChangeStatusUpdateScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { userId, loaded } = useAccount();

  const target = (params.get("to") ?? "") as ChangeStatusTarget;
  const toCaregiver = target === "CAREGIVER";
  const valid = target === "CAREGIVER" || target === "PATIENT";

  /* Mobile's "info will be replaced" gate, before any field is shown. */
  const [accepted, setAccepted] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const [relationships, setRelationships] = useState<PicklistItem[]>([]);
  const [diagnoses, setDiagnoses] = useState<PicklistItem[]>([]);
  const [statuses, setStatuses] = useState<PicklistItem[]>([]);
  const [treatments, setTreatments] = useState<PicklistItem[]>([]);
  const [hospitals, setHospitals] = useState<PicklistItem[]>([]);

  const [relationshipId, setRelationshipId] = useState("");
  const [patientBirth, setPatientBirth] = useState("");
  const [diagnosisIds, setDiagnosisIds] = useState<string[]>([]);
  const [treatmentStatusId, setTreatmentStatusId] = useState("");
  const [treatmentIds, setTreatmentIds] = useState<string[]>([]);
  const [hospitalIds, setHospitalIds] = useState<string[]>([]);

  useEffect(() => {
    if (!accepted) return;
    void Promise.all([
      toCaregiver ? fetchRelationships() : Promise.resolve([]),
      fetchDiagnoses(),
      fetchTreatmentStatuses(),
      fetchTreatments(),
      fetchHospitals(),
    ])
      .then(([r, d, s, tr, h]) => {
        setRelationships(r);
        setDiagnoses(d);
        setStatuses(s);
        setTreatments(tr);
        setHospitals(h);
      })
      .catch((err) => {
        console.error("[settings] change-status catalogues failed:", err);
        toast.error(t("app.settings.statusError"));
      });
  }, [accepted, toCaregiver]);

  const statusLabel =
    statuses.find((s) => s.value === treatmentStatusId)?.label ?? "";

  /**
   * The same gate mobile applies across its screens, collected in one place:
   * every screen's required field, plus the cross-field treatment rule.
   */
  const birthError = toCaregiver ? validateMonthYear(patientBirth) : null;
  const canSubmit =
    diagnosisIds.length > 0 &&
    !!treatmentStatusId &&
    hospitalIds.length > 0 &&
    canContinueFromDiagnosis({ treatmentStatusLabel: statusLabel, treatmentIds }) &&
    (!toCaregiver || (!!relationshipId && !birthError));

  const submit = async () => {
    if (!userId || !canSubmit || busy) return;
    setBusy(true);
    try {
      await applyStatusPathB(
        {
          userId,
          diagnosisIds,
          treatmentStatusId,
          treatmentIds,
          hospitalIds,
          relationshipId: toCaregiver ? relationshipId : null,
          patientBirth: toCaregiver ? patientBirth : null,
        },
        target,
      );
      setDone(true);
    } catch (err) {
      console.error("[settings] change status failed:", err);
      toast.error(t("app.settings.statusError"));
    } finally {
      setBusy(false);
    }
  };

  if (loaded && !valid) {
    router.replace("/settings/change-status");
    return null;
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-heading text-[20px] font-bold text-cb-black">
          {t("app.settings.statusReviewTitle")}
        </h1>
        <p className="font-body text-[14.5px] leading-relaxed text-cb-gray-600">
          {t("app.settings.statusReviewBody")}
        </p>
        <div className="mt-2 w-full">
          <Button fullWidth onClick={() => void finishSignedOutFlow()}>
            {t("app.settings.statusReviewCta")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <h1 className="font-heading text-2xl font-bold text-cb-black">
        {t("app.settings.statusUpdateHeading")}
      </h1>
      <p className="mt-1.5 font-body text-[14.5px] leading-relaxed text-cb-gray-600">
        {t("app.settings.statusUpdateBody")}
      </p>
      <p className="mt-1 font-body text-[12.5px] text-cb-gray-400">
        {t("app.settings.statusStep", {
          index: progressDenominator(target),
          total: progressDenominator(target),
        })}
      </p>

      {!accepted ? (
        <Sheet
          open
          title={t("app.settings.statusReplaceTitle")}
          onClose={() => router.back()}
          footer={
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => router.back()}>
                {t("app.settings.cancel")}
              </Button>
              <Button fullWidth onClick={() => setAccepted(true)}>
                {t("app.settings.statusReplaceConfirm")}
              </Button>
            </div>
          }
        >
          <p className="px-5 pb-6 font-body text-[15px] leading-relaxed text-cb-black">
            {t(
              toCaregiver
                ? "app.settings.statusReplaceToCaregiver"
                : "app.settings.statusReplaceToPatient",
            )}
          </p>
        </Sheet>
      ) : (
        <div className="mt-6 space-y-5">
          {toCaregiver && (
            <>
              <Field label={t("app.settings.statusRelationship")}>
                <select
                  value={relationshipId}
                  onChange={(e) => setRelationshipId(e.target.value)}
                  className="h-12 w-full rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-3.5 font-body text-[15px] text-cb-black outline-none focus:border-cb-black"
                >
                  <option value="">{t("app.settings.statusSelectOne")}</option>
                  {relationships.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label={t("app.settings.statusPatientBirth")}
                hint={birthError ?? "(mm/yyyy)"}
              >
                <input
                  value={patientBirth}
                  inputMode="numeric"
                  maxLength={7}
                  onChange={(e) =>
                    setPatientBirth(formatMonthYearInput(e.target.value))
                  }
                  placeholder="MM/YYYY"
                  className="h-12 w-full rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-3.5 font-body text-[15px] text-cb-black outline-none focus:border-cb-black"
                />
              </Field>
            </>
          )}

          <MultiPicker
            label={t("app.settings.statusDiagnosis")}
            options={diagnoses}
            selected={diagnosisIds}
            onChange={setDiagnosisIds}
          />

          <Field label={t("app.settings.statusTreatmentStatus")}>
            <select
              value={treatmentStatusId}
              onChange={(e) => {
                setTreatmentStatusId(e.target.value);
                // Mobile clears treatments when the status changes or clears.
                setTreatmentIds([]);
              }}
              className="h-12 w-full rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-3.5 font-body text-[15px] text-cb-black outline-none focus:border-cb-black"
            >
              <option value="">{t("app.settings.statusSelectOne")}</option>
              {statuses.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <MultiPicker
            label={t("app.settings.statusTreatments")}
            options={treatments}
            selected={treatmentIds}
            onChange={setTreatmentIds}
            /* "Pre-treatment" means there is nothing to record yet. */
            disabled={!treatmentStatusId || statusLabel === "Pre-treatment"}
            hint={
              statusLabel === "Pre-treatment"
                ? t("app.settings.statusPreTreatment")
                : undefined
            }
          />

          <MultiPicker
            label={t("app.settings.statusMedicalCenter")}
            options={hospitals}
            selected={hospitalIds}
            onChange={setHospitalIds}
          />

          <div className="pt-2">
            <Button
              fullWidth
              disabled={!canSubmit}
              loading={busy}
              onClick={() => void submit()}
            >
              {t("app.settings.statusContinue")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
