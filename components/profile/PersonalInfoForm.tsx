"use client";

/**
 * `/profile/personal` — the user's own personal information.
 *
 * Mirrors mobile's `PersonalInformation` screen, including the parts that are
 * easy to miss:
 *
 *  • **Languages live here**, not in a section of their own. Mobile's separate
 *    Languages card is commented out; this picker is the live one.
 *  • The **college questions appear from age 17**, but only count toward the
 *    completion ring from 18 — mobile uses two different constants. Both are
 *    reproduced rather than reconciled, so the ring reads the same on both
 *    clients.
 *  • **Zip code drives city and state.** Entering five digits looks up the
 *    matching cities; picking one sets the state, which is never edited
 *    directly.
 *
 * On a phone this is one long scroll. With more width the groups become cards
 * so the required address block can't be lost between optional questions.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Button, Textarea } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import {
  AsyncPicker,
  CheckboxField,
  FieldLabel,
  MultiSelectField,
  SelectField,
} from "@/components/ui/form";
import { ArrowLeftIcon } from "@/components/ui/icons";
import {
  fetchCancerLossOptions,
  fetchCitiesByZipCode,
  fetchCollegesByName,
  fetchEthnicities,
  fetchLanguages,
  fetchPronouns,
  fetchSexualOrientations,
  fetchTransgenderOptions,
  fetchWorkplacesByName,
  type PicklistItem,
  type ZipCodeResult,
} from "@/lib/aws/appsyncPicklistQueries";
import { resolveEntityName } from "@/lib/buddies/picklists";
import { fetchSignedInEmail } from "@/lib/aws/sessionAttributes";
import { displayAge } from "@/lib/buddies/age";
import { useProfile } from "@/lib/profile/ProfileProvider";
import { COLLEGE_VISIBLE_AGE } from "@/lib/profile/progress";
import {
  fetchPersonalInfo,
  savePersonalInfo,
  type PersonalInfoValues,
} from "@/lib/profile/personalInfo";
import type { JoinRow } from "@/lib/profile/manyToMany";
import {
  useDirtyForm,
  useUnsavedChanges,
} from "@/lib/navigation/UnsavedChangesProvider";

/** Bio is capped at 300 by the validation mobile runs before enabling Save. */
const BIO_MAX = 300;

const EMPTY: PersonalInfoValues = {
  bio: "",
  zipcode: "",
  userCityId: "",
  userStateId: "",
  userPronounId: "",
  userEthnicitiesId: "",
  userSexualOrientationId: "",
  userTransgenderId: "",
  userWorkplaceId: "",
  cancerloss: false,
  userCopingwithcancerlossId: "",
  CurrentlyInCollege: false,
  userCollegeId: "",
  languageIds: [],
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

export default function PersonalInfoForm() {
  const { guardedPush } = useUnsavedChanges();
  const { userId, user, refresh } = useProfile();

  const [values, setValues] = useState<PersonalInfoValues>(EMPTY);
  const [initial, setInitial] = useState<PersonalInfoValues>(EMPTY);
  const [languageRows, setLanguageRows] = useState<JoinRow[]>([]);
  const [birth, setBirth] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [catalogs, setCatalogs] = useState<{
    pronouns: PicklistItem[];
    transgender: PicklistItem[];
    orientation: PicklistItem[];
    ethnicities: PicklistItem[];
    cancerLoss: PicklistItem[];
    languages: PicklistItem[];
  }>({
    pronouns: [],
    transgender: [],
    orientation: [],
    ethnicities: [],
    cancerLoss: [],
    languages: [],
  });

  /** Zip lookup results, and the label shown for the current workplace/college. */
  const [zipCities, setZipCities] = useState<ZipCodeResult[]>([]);
  const [zipSearching, setZipSearching] = useState(false);
  const [zipNotFound, setZipNotFound] = useState(false);
  const [workplaceLabel, setWorkplaceLabel] = useState("");
  const [collegeLabel, setCollegeLabel] = useState("");
  const [pickerOpen, setPickerOpen] = useState<"workplace" | "college" | null>(null);
  const [email, setEmail] = useState("");

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ── Load ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      try {
        const [loaded, pronouns, transgender, orientation, ethnicities, cancerLoss, languages, signedInEmail] =
          await Promise.all([
            fetchPersonalInfo(userId),
            fetchPronouns(),
            fetchTransgenderOptions(),
            fetchSexualOrientations(),
            fetchEthnicities(),
            fetchCancerLossOptions(),
            fetchLanguages(),
            fetchSignedInEmail(),
          ]);
        if (cancelled || !mountedRef.current) return;

        setEmail(signedInEmail ?? "");

        setValues(loaded.values);
        setInitial(loaded.values);
        setLanguageRows(loaded.languageRows);
        setBirth(loaded.birth);
        setCatalogs({
          pronouns,
          transgender,
          orientation,
          ethnicities,
          cancerLoss,
          languages,
        });
      } catch (err) {
        console.error("[profile] personal info load failed:", err);
        if (!cancelled && mountedRef.current) setLoadError(true);
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  /* Resolve the stored workplace/college ids into display labels. */
  useEffect(() => {
    if (!values.userWorkplaceId) {
      setWorkplaceLabel("");
      return;
    }
    resolveEntityName("workplace", values.userWorkplaceId)
      .then((name) => mountedRef.current && setWorkplaceLabel(name ?? ""))
      .catch(() => {});
  }, [values.userWorkplaceId]);

  useEffect(() => {
    if (!values.userCollegeId) {
      setCollegeLabel("");
      return;
    }
    resolveEntityName("college", values.userCollegeId)
      .then((name) => mountedRef.current && setCollegeLabel(name ?? ""))
      .catch(() => {});
  }, [values.userCollegeId]);

  /* Zip → cities. Five digits is the trigger mobile uses. */
  useEffect(() => {
    const zip = values.zipcode.trim();
    if (zip.length !== 5) {
      setZipCities([]);
      setZipNotFound(false);
      return;
    }

    let cancelled = false;
    setZipSearching(true);
    fetchCitiesByZipCode(zip)
      .then((results) => {
        if (cancelled || !mountedRef.current) return;
        setZipCities(results);
        setZipNotFound(results.length === 0);
      })
      .catch(() => {
        if (!cancelled && mountedRef.current) setZipNotFound(true);
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) setZipSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [values.zipcode]);

  /* ── Derived ───────────────────────────────────────────────────────── */

  const patch = useCallback((next: Partial<PersonalInfoValues>) => {
    setValues((prev) => ({ ...prev, ...next }));
  }, []);

  const showCollege = useMemo(() => {
    const age = displayAge(birth ?? user?.birth);
    return age >= COLLEGE_VISIBLE_AGE;
  }, [birth, user?.birth]);

  const cityOptions = useMemo<PicklistItem[]>(
    () =>
      zipCities.map((c) => ({
        value: c.cityID,
        label: c.stateName ? `${c.cityName}, ${c.stateName}` : c.cityName,
      })),
    [zipCities],
  );

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initial),
    [values, initial],
  );

  /** Address is the only required group, mirroring the mobile schema. */
  const addressComplete =
    values.zipcode.trim().length === 5 &&
    !!values.userCityId &&
    !!values.userStateId;
  const bioTooLong = values.bio.trim().length > BIO_MAX;
  const canSave = dirty && addressComplete && !bioTooLong && !saving;

  /*
   * Route-change guard. This was a `beforeunload` listener, which never fires on
   * client-side navigation — so the back arrow, a sidebar link and browser back
   * all discarded the form silently. The provider covers all three, and keeps
   * `beforeunload` for the refresh and tab-close case.
   */
  useDirtyForm(dirty);

  /* ── Save ──────────────────────────────────────────────────────────── */

  const save = useCallback(async () => {
    if (!userId || !canSave) return;
    setSaving(true);
    try {
      const outcome = await savePersonalInfo({ userId, values, languageRows });
      if (!outcome.ok) throw new Error("updateUser returned no id");

      // Re-read so the join rows carry their new ids and a second save diffs
      // against reality rather than a stale snapshot.
      const reloaded = await fetchPersonalInfo(userId);
      if (mountedRef.current) {
        setValues(reloaded.values);
        setInitial(reloaded.values);
        setLanguageRows(reloaded.languageRows);
      }
      await refresh();

      toast[outcome.partial ? "warning" : "success"](
        t(outcome.partial ? "app.profile.savedPartial" : "app.profile.saved"),
      );
    } catch (err) {
      console.error("[profile] personal info save failed:", err);
      toast.error(t("app.profile.saveError"));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [userId, canSave, values, languageRows, refresh]);

  /* ── Render ────────────────────────────────────────────────────────── */

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
          {t("app.profile.personalTitle")}
        </h1>
      </header>

      <div className="space-y-4 pb-28">
        <Card title={t("app.profile.aboutYouSection")}>
          <div>
            <FieldLabel>{t("app.profile.email")}</FieldLabel>
            <input
              value={email}
              readOnly
              disabled
              placeholder={t("app.profile.emailHidden")}
              className="h-12 w-full rounded-xl border-[1.5px] border-cb-gray-200 bg-cb-gray-100 px-4 font-body text-[15px] text-cb-gray-500"
            />
            <p className="mt-1.5 font-body text-[12.5px] text-cb-gray-400">
              {t("app.profile.emailHint")}
            </p>
          </div>

          <SelectField
            label={t("app.profile.pronouns")}
            value={values.userPronounId}
            options={catalogs.pronouns}
            placeholder={t("app.profile.selectOne")}
            onChange={(v) => patch({ userPronounId: v })}
          />
          <SelectField
            label={t("app.profile.genderIdentity")}
            value={values.userTransgenderId}
            options={catalogs.transgender}
            placeholder={t("app.profile.selectOne")}
            onChange={(v) => patch({ userTransgenderId: v })}
          />
          <SelectField
            label={t("app.profile.sexualOrientation")}
            value={values.userSexualOrientationId}
            options={catalogs.orientation}
            placeholder={t("app.profile.selectOne")}
            onChange={(v) => patch({ userSexualOrientationId: v })}
          />
          <SelectField
            label={t("app.profile.ethnicity")}
            value={values.userEthnicitiesId}
            options={catalogs.ethnicities}
            placeholder={t("app.profile.selectOne")}
            onChange={(v) => patch({ userEthnicitiesId: v })}
          />
        </Card>

        <Card
          title={t("app.profile.locationSection")}
          description={t("app.profile.locationHint")}
        >
          <div>
            <FieldLabel>{t("app.profile.zipcode")}</FieldLabel>
            <input
              value={values.zipcode}
              inputMode="numeric"
              maxLength={5}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 5);
                // A new zip invalidates the city/state chosen under the old one.
                patch({
                  zipcode: digits,
                  ...(digits !== values.zipcode
                    ? { userCityId: "", userStateId: "" }
                    : {}),
                });
              }}
              placeholder={t("app.profile.zipcodePlaceholder")}
              className="h-12 w-full rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-4 font-body text-[15px] text-cb-black outline-none transition-colors placeholder:text-cb-gray-400 hover:border-cb-gray-400 focus:border-cb-black"
            />
            {zipSearching && (
              <p className="mt-1.5 font-body text-[12.5px] text-cb-gray-400">
                {t("app.profile.zipSearching")}
              </p>
            )}
            {zipNotFound && !zipSearching && (
              <p role="alert" className="mt-1.5 font-body text-[12.5px] text-cb-danger">
                {t("app.profile.zipNotFound")}
              </p>
            )}
          </div>

          <SelectField
            label={t("app.profile.city")}
            value={values.userCityId}
            options={cityOptions}
            placeholder={
              cityOptions.length
                ? t("app.profile.selectCity")
                : t("app.profile.enterZipFirst")
            }
            disabled={cityOptions.length === 0}
            onChange={(cityId) => {
              const match = zipCities.find((c) => c.cityID === cityId);
              // State is never chosen directly — it follows the city.
              patch({ userCityId: cityId, userStateId: match?.stateID ?? "" });
            }}
          />

          <div>
            <FieldLabel>{t("app.profile.workplace")}</FieldLabel>
            <button
              type="button"
              onClick={() => setPickerOpen("workplace")}
              className="flex h-12 w-full items-center justify-between rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-4 text-left font-body text-[15px] transition-colors hover:border-cb-gray-400"
            >
              <span className={workplaceLabel ? "text-cb-black" : "text-cb-gray-400"}>
                {workplaceLabel || t("app.profile.workplacePlaceholder")}
              </span>
            </button>
          </div>
        </Card>

        <Card
          title={t("app.profile.languagesSection")}
          description={t("app.profile.languagesHint")}
        >
          <MultiSelectField
            label={t("app.profile.languages")}
            catalogItems={catalogs.languages}
            value={values.languageIds.join(",")}
            addLabel={t("app.profile.addLanguage")}
            searchPlaceholder={t("app.profile.searchLanguages")}
            onChange={(next) =>
              patch({
                languageIds: next.split(",").filter((v) => v.trim() !== ""),
              })
            }
          />
        </Card>

        <Card title={t("app.profile.aboutMeSection")}>
          <div>
            <FieldLabel>{t("app.profile.bio")}</FieldLabel>
            <Textarea
              value={values.bio}
              onChange={(e) => patch({ bio: e.target.value })}
              rows={5}
              placeholder={t("app.profile.bioPlaceholder")}
            />
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p className="font-body text-[12.5px] text-cb-gray-400">
                {t("app.profile.bioHint", { max: BIO_MAX })}
              </p>
              <p
                className={[
                  "shrink-0 font-body text-[12.5px] tabular-nums",
                  bioTooLong ? "font-bold text-cb-danger" : "text-cb-gray-400",
                ].join(" ")}
              >
                {values.bio.trim().length}/{BIO_MAX}
              </p>
            </div>
          </div>

          <div className="space-y-3 border-t border-cb-gray-100 pt-4">
            <CheckboxField
              label={t("app.profile.cancerLoss")}
              checked={values.cancerloss}
              onChange={(checked) =>
                // Clearing the checkbox clears whom they lost, as mobile does.
                patch({
                  cancerloss: checked,
                  ...(checked ? {} : { userCopingwithcancerlossId: "" }),
                })
              }
            />
            {values.cancerloss && (
              <SelectField
                label={t("app.profile.whoDidYouLose")}
                value={values.userCopingwithcancerlossId}
                options={catalogs.cancerLoss}
                placeholder={t("app.profile.selectOne")}
                onChange={(v) => patch({ userCopingwithcancerlossId: v })}
              />
            )}
          </div>

          {showCollege && (
            <div className="space-y-3 border-t border-cb-gray-100 pt-4">
              <CheckboxField
                label={t("app.profile.inCollege")}
                checked={values.CurrentlyInCollege}
                onChange={(checked) =>
                  patch({
                    CurrentlyInCollege: checked,
                    ...(checked ? {} : { userCollegeId: "" }),
                  })
                }
              />
              {values.CurrentlyInCollege && (
                <div>
                  <FieldLabel>{t("app.profile.college")}</FieldLabel>
                  <button
                    type="button"
                    onClick={() => setPickerOpen("college")}
                    className="flex h-12 w-full items-center justify-between rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-4 text-left font-body text-[15px] transition-colors hover:border-cb-gray-400"
                  >
                    <span
                      className={collegeLabel ? "text-cb-black" : "text-cb-gray-400"}
                    >
                      {collegeLabel || t("app.profile.collegePlaceholder")}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Sticky save bar — the form is long enough that a footer button would
          sit below the fold on most screens. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-cb-gray-200 bg-white/95 px-4 py-3 backdrop-blur lg:left-[var(--app-sidebar-w,0px)]">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
          <p className="min-w-0 font-body text-[13px] text-cb-gray-500">
            {!addressComplete
              ? t("app.profile.addressRequired")
              : bioTooLong
                ? t("app.profile.bioTooLong")
                : dirty
                  ? t("app.profile.unsavedChanges")
                  : t("app.profile.allSaved")}
          </p>
          <Button onClick={save} disabled={!canSave} loading={saving}>
            {t("app.profile.save")}
          </Button>
        </div>
      </div>

      {/* Async catalogue pickers */}
      <Sheet
        open={pickerOpen === "workplace"}
        title={t("app.profile.workplace")}
        onClose={() => setPickerOpen(null)}
      >
        <div className="h-[min(60vh,520px)]">
          <AsyncPicker
            search={fetchWorkplacesByName}
            selectedId={values.userWorkplaceId}
            selectedLabel={workplaceLabel}
            placeholder={t("app.profile.searchWorkplaces")}
            onSelect={(item) => {
              patch({ userWorkplaceId: item.value });
              setWorkplaceLabel(item.label);
              setPickerOpen(null);
            }}
            onClear={() => {
              patch({ userWorkplaceId: "" });
              setWorkplaceLabel("");
            }}
          />
        </div>
      </Sheet>

      <Sheet
        open={pickerOpen === "college"}
        title={t("app.profile.college")}
        onClose={() => setPickerOpen(null)}
      >
        <div className="h-[min(60vh,520px)]">
          <AsyncPicker
            search={fetchCollegesByName}
            selectedId={values.userCollegeId}
            selectedLabel={collegeLabel}
            placeholder={t("app.profile.searchColleges")}
            onSelect={(item) => {
              patch({ userCollegeId: item.value });
              setCollegeLabel(item.label);
              setPickerOpen(null);
            }}
            onClear={() => {
              patch({ userCollegeId: "" });
              setCollegeLabel("");
            }}
          />
        </div>
      </Sheet>
    </div>
  );
}
