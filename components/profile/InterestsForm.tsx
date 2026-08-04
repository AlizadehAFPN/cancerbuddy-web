"use client";

/**
 * `/profile/interests` — what the user is into.
 *
 * Mobile hides these behind a picker sheet because the catalogue is long. On a
 * wide screen the whole catalogue fits as a grid of toggles, so choosing is one
 * pass instead of open-search-select-repeat. The count is shown against 10 —
 * the number the completion ring scores out of — but selecting more is allowed,
 * exactly as on mobile.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { SearchField } from "@/components/ui/form";
import { ArrowLeftIcon, CheckIcon } from "@/components/ui/icons";
import {
  fetchInterests,
  type PicklistItem,
} from "@/lib/aws/appsyncPicklistQueries";
import { useProfile } from "@/lib/profile/ProfileProvider";
import {
  fetchUserInterests,
  saveUserInterests,
} from "@/lib/profile/interestsAndGoal";
import type { JoinRow } from "@/lib/profile/manyToMany";

/** Denominator of the hub's completion ring — not a cap. */
const RING_TARGET = 10;

export default function InterestsForm() {
  const router = useRouter();
  const { userId, refresh } = useProfile();

  const [catalog, setCatalog] = useState<PicklistItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [initial, setInitial] = useState<string[]>([]);
  const [rows, setRows] = useState<JoinRow[]>([]);
  const [query, setQuery] = useState("");

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

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      try {
        const [items, mine] = await Promise.all([
          fetchInterests(),
          fetchUserInterests(userId),
        ]);
        if (cancelled || !mountedRef.current) return;
        setCatalog(items);
        setSelected(mine.selectedIds);
        setInitial(mine.selectedIds);
        setRows(mine.rows);
      } catch (err) {
        console.error("[profile] interests load failed:", err);
        if (!cancelled && mountedRef.current) setLoadError(true);
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((item) => item.label.toLowerCase().includes(q));
  }, [catalog, query]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const dirty = useMemo(() => {
    if (selected.length !== initial.length) return true;
    const a = [...selected].sort().join(",");
    const b = [...initial].sort().join(",");
    return a !== b;
  }, [selected, initial]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const save = useCallback(async () => {
    if (!userId || !dirty || saving) return;
    setSaving(true);
    try {
      const outcome = await saveUserInterests({
        userId,
        rows,
        selectedIds: selected,
      });

      const reloaded = await fetchUserInterests(userId);
      if (mountedRef.current) {
        setSelected(reloaded.selectedIds);
        setInitial(reloaded.selectedIds);
        setRows(reloaded.rows);
      }
      await refresh();

      toast[outcome.partial ? "warning" : "success"](
        t(outcome.partial ? "app.profile.savedPartial" : "app.profile.saved"),
      );
    } catch (err) {
      console.error("[profile] interests save failed:", err);
      toast.error(t("app.profile.saveError"));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [userId, dirty, saving, rows, selected, refresh]);

  if (loading) {
    return (
      <div aria-hidden className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="h-12 animate-pulse rounded-xl bg-cb-gray-100" />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-cb-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
        <p className="font-heading text-[18px] font-bold text-cb-black">
          {t("app.profile.loadError")}
        </p>
        <Button variant="secondary" onClick={() => router.push("/profile")}>
          {t("app.profile.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/profile")}
          aria-label={t("app.profile.back")}
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-cb-gray-600 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
        >
          <ArrowLeftIcon />
        </button>
        <h1 className="font-heading text-[22px] font-bold tracking-tight text-cb-black">
          {t("app.profile.interestsTitle")}
        </h1>
      </header>

      <p className="mb-4 font-body text-[14.5px] leading-relaxed text-cb-gray-600">
        {t("app.profile.interestsIntro", { target: RING_TARGET })}
      </p>

      <div className="mb-4">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={t("app.profile.searchInterests")}
        />
      </div>

      {visible.length === 0 ? (
        <p className="py-12 text-center font-body text-[14px] text-cb-gray-500">
          {t("app.profile.noInterestsMatch", { query })}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 pb-28 sm:grid-cols-3">
          {visible.map((item) => {
            const on = selectedSet.has(item.value);
            return (
              <li key={item.value}>
                <button
                  type="button"
                  onClick={() => toggle(item.value)}
                  aria-pressed={on}
                  className={[
                    "flex w-full items-center justify-between gap-2 rounded-xl border-[1.5px] px-3.5 py-3 text-left transition-all",
                    on
                      ? "border-cb-black bg-cb-yellow/25"
                      : "border-cb-gray-200 bg-white hover:border-cb-gray-400",
                  ].join(" ")}
                >
                  <span className="min-w-0 font-body text-[14px] text-cb-black">
                    {item.label}
                  </span>
                  {on && (
                    <span className="shrink-0 text-cb-black">
                      <CheckIcon />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-cb-gray-200 bg-white/95 px-4 py-3 backdrop-blur lg:left-[var(--app-sidebar-w,0px)]">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
          <p className="min-w-0 font-body text-[13px] text-cb-gray-500">
            {t("app.profile.interestsSelected", {
              count: selected.length,
              target: RING_TARGET,
            })}
          </p>
          <Button onClick={save} disabled={!dirty || saving} loading={saving}>
            {t("app.profile.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
