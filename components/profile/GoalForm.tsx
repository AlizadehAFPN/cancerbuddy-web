"use client";

/**
 * `/profile/goal` — "I'm here to…".
 *
 * A single choice from a short illustrated list. Mobile shows it as a row of
 * emoji tiles; the web keeps the illustrations but lays them out as a grid so
 * every option is visible without scrolling sideways.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { useProfile } from "@/lib/profile/ProfileProvider";
import {
  fetchGoalOptions,
  fetchUserGoal,
  saveUserGoal,
  type GoalOption,
} from "@/lib/profile/interestsAndGoal";

export default function GoalForm() {
  const router = useRouter();
  const { userId, refresh } = useProfile();

  const [options, setOptions] = useState<GoalOption[]>([]);
  const [selected, setSelected] = useState("");
  const [initial, setInitial] = useState("");
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
        const [goals, current] = await Promise.all([
          fetchGoalOptions(),
          fetchUserGoal(userId),
        ]);
        if (cancelled || !mountedRef.current) return;
        setOptions(goals);
        setSelected(current);
        setInitial(current);
      } catch (err) {
        console.error("[profile] goal load failed:", err);
        if (!cancelled && mountedRef.current) setLoadError(true);
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const dirty = selected !== initial;

  const save = useCallback(async () => {
    if (!userId || !dirty || !selected || saving) return;
    setSaving(true);
    try {
      const ok = await saveUserGoal(userId, selected);
      if (!ok) throw new Error("updateUser returned no id");
      if (mountedRef.current) setInitial(selected);
      await refresh();
      toast.success(t("app.profile.saved"));
    } catch (err) {
      console.error("[profile] goal save failed:", err);
      toast.error(t("app.profile.saveError"));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [userId, dirty, selected, saving, refresh]);

  if (loading) {
    return (
      <div aria-hidden className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-cb-gray-100" />
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
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
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
          {t("app.profile.goalTitle")}
        </h1>
      </header>

      <p className="mb-5 font-body text-[14.5px] leading-relaxed text-cb-gray-600">
        {t("app.profile.goalIntro")}
      </p>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {options.map((goal) => {
          const on = goal.id === selected;
          return (
            <li key={goal.id}>
              <button
                type="button"
                onClick={() => setSelected(goal.id)}
                aria-pressed={on}
                className={[
                  "flex h-full w-full flex-col items-center gap-2.5 rounded-2xl border-[1.5px] p-4 text-center transition-all",
                  on
                    ? "border-cb-black bg-cb-yellow/25"
                    : "border-cb-gray-200 bg-white hover:border-cb-gray-400",
                ].join(" ")}
              >
                {goal.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={goal.imageUrl}
                    alt=""
                    width={48}
                    height={48}
                    loading="lazy"
                    className="h-12 w-12 object-contain"
                  />
                ) : (
                  <span aria-hidden className="text-[32px] leading-none">
                    🎯
                  </span>
                )}
                <span className="font-body text-[14px] leading-snug text-cb-black">
                  {goal.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex items-center justify-end">
        <Button
          onClick={save}
          disabled={!dirty || !selected || saving}
          loading={saving}
        >
          {t("app.profile.save")}
        </Button>
      </div>
    </div>
  );
}
