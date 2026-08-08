"use client";

/**
 * `/profile/patient` — what a caregiver records about the person they care for.
 *
 * Only two fields, both required: the patient's birth month and the caregiver's
 * relationship to them. Together they're what the completion ring for this
 * section scores, out of two.
 *
 * Reachable only by caregivers. Anyone else who lands here is sent back to the
 * hub rather than shown a form that would write meaningless data.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { FieldLabel, SelectField } from "@/components/ui/form";
import { ArrowLeftIcon } from "@/components/ui/icons";
import {
  fetchRelationships,
  type PicklistItem,
} from "@/lib/aws/appsyncPicklistQueries";
import { executeAppSyncGraphql } from "@/lib/aws/appsyncGraphql";
import { useProfile } from "@/lib/profile/ProfileProvider";
import { UserType } from "@/lib/profile/types";
import {
  useDirtyForm,
  useUnsavedChanges,
} from "@/lib/navigation/UnsavedChangesProvider";
import {
  formatMonthYearInput,
  monthYearToStoredDate,
  storedDateToMonthYear,
  validateMonthYear,
} from "@/lib/profile/monthYear";

const GET_PATIENT_INFO = /* GraphQL */ `
  query getCaregiverRelativeInfo($id: ID!) {
    getUser(id: $id) {
      patientBirth
      userRelationshipId
    }
  }
`;

const UPDATE_PATIENT_INFO = /* GraphQL */ `
  mutation updateCaregiverPatientInfo($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
    }
  }
`;

export default function PatientInfoForm() {
  const { guardedPush } = useUnsavedChanges();
  const { userId, user, status, refresh } = useProfile();

  const [patientBirth, setPatientBirth] = useState("");
  const [relationshipId, setRelationshipId] = useState("");
  const [initial, setInitial] = useState({ birth: "", relationship: "" });
  const [relationships, setRelationships] = useState<PicklistItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isCaregiver = user?.userType === UserType.CAREGIVER;

  useEffect(() => {
    if (!userId || !isCaregiver) return;
    let cancelled = false;

    (async () => {
      try {
        const [{ data }, options] = await Promise.all([
          executeAppSyncGraphql<{
            getUser: {
              patientBirth?: string | null;
              userRelationshipId?: string | null;
            } | null;
          }>({
            query: GET_PATIENT_INFO,
            variables: { id: userId },
            authWithUserPool: true,
          }),
          fetchRelationships(),
        ]);
        if (cancelled || !mountedRef.current) return;

        const birth = storedDateToMonthYear(data?.getUser?.patientBirth);
        const relationship = data?.getUser?.userRelationshipId ?? "";
        setPatientBirth(birth);
        setRelationshipId(relationship);
        setInitial({ birth, relationship });
        setRelationships(options);
      } catch (err) {
        console.error("[profile] patient info load failed:", err);
        if (!cancelled && mountedRef.current) setLoadError(true);
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, isCaregiver]);

  const dateError = useMemo(
    () => validateMonthYear(patientBirth),
    [patientBirth],
  );

  const dirty =
    patientBirth !== initial.birth || relationshipId !== initial.relationship;

  const validationError = useMemo(() => {
    if (!patientBirth.trim()) return t("app.profile.patientBirthRequired");
    if (dateError === "incomplete" || dateError === "invalid") {
      return t("app.profile.dateInvalid");
    }
    if (dateError === "future") return t("app.profile.dateFuture");
    if (dateError === "too-old") return t("app.profile.dateTooOld");
    if (!relationshipId) return t("app.profile.relationshipRequired");
    return null;
  }, [patientBirth, dateError, relationshipId]);

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
      const { data } = await executeAppSyncGraphql<{
        updateUser: { id: string } | null;
      }>({
        query: UPDATE_PATIENT_INFO,
        variables: {
          input: {
            id: userId,
            userRelationshipId: relationshipId || null,
            patientBirth: monthYearToStoredDate(patientBirth),
          },
        },
        authWithUserPool: true,
      });
      if (!data?.updateUser?.id) throw new Error("updateUser returned no id");

      if (mountedRef.current) {
        setInitial({ birth: patientBirth, relationship: relationshipId });
      }
      await refresh();
      toast.success(t("app.profile.saved"));
    } catch (err) {
      console.error("[profile] patient info save failed:", err);
      toast.error(t("app.profile.saveError"));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [userId, canSave, relationshipId, patientBirth, refresh]);

  /* Non-caregivers have no patient to describe. */
  if (status === "ready" && !isCaregiver) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
        <p className="font-heading text-[18px] font-bold text-cb-black">
          {t("app.profile.patientOnlyCaregivers")}
        </p>
        <Button variant="secondary" onClick={() => void guardedPush("/profile")}>
          {t("app.profile.back")}
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div aria-hidden className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <div className="h-64 animate-pulse rounded-2xl bg-cb-gray-100" />
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
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
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
          {t("app.profile.patientTitle")}
        </h1>
      </header>

      <section className="rounded-2xl border border-cb-gray-200 bg-white p-5">
        <p className="font-body text-[14px] leading-relaxed text-cb-gray-600">
          {t("app.profile.patientIntro")}
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <FieldLabel>{t("app.profile.patientBirth")}</FieldLabel>
            <input
              value={patientBirth}
              inputMode="numeric"
              placeholder="MM/YYYY"
              maxLength={7}
              onChange={(e) => setPatientBirth(formatMonthYearInput(e.target.value))}
              className="h-12 w-full rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-4 font-body text-[15px] text-cb-black outline-none transition-colors placeholder:text-cb-gray-400 hover:border-cb-gray-400 focus:border-cb-black"
            />
            <p className="mt-1.5 font-body text-[12.5px] text-cb-gray-400">
              {t("app.profile.patientBirthHint")}
            </p>
          </div>

          <SelectField
            label={t("app.profile.relationship")}
            value={relationshipId}
            options={relationships}
            placeholder={t("app.profile.selectOne")}
            onChange={setRelationshipId}
          />
        </div>
      </section>

      <div className="mt-5 flex items-center justify-between gap-4">
        <p
          className={[
            "min-w-0 font-body text-[13px]",
            validationError ? "text-cb-danger" : "text-cb-gray-500",
          ].join(" ")}
        >
          {validationError ??
            (dirty ? t("app.profile.unsavedChanges") : t("app.profile.allSaved"))}
        </p>
        <Button onClick={save} disabled={!canSave} loading={saving}>
          {t("app.profile.save")}
        </Button>
      </div>
    </div>
  );
}
