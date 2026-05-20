"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui";
import type { UserRegisterFormValues } from "@/lib/user-signup/validation";
import {
  fetchInterests,
  type PicklistItem,
} from "@/lib/aws/appsyncPicklistQueries";
import { t } from "@/lib/i18n";

interface Props {
  onContinue: () => void;
  onSkip: () => void;
}

function parseIds(csv: string): Set<string> {
  return new Set(
    csv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function serializeIds(ids: Set<string>): string {
  return [...ids].join(",");
}

export function StepInterests({ onContinue, onSkip }: Props) {
  const { watch, setValue } = useFormContext<UserRegisterFormValues>();

  const interestsRaw = watch("interests") ?? "";
  const selected = parseIds(interestsRaw);

  const [items, setItems] = useState<PicklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchInterests()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setValue("interests", serializeIds(next), { shouldDirty: true });
  }

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.5rem, 2.1vw, 1.875rem)", lineHeight: 1.15 }}
        >
          {t("register.interests.heading")}
        </h1>
        <p className="mt-1 font-body text-[14px] text-cb-gray-500">
          {t("register.interests.sub")}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-cb-gray-400 border-t-transparent" />
        </div>
      ) : (
        <div className="mb-5 flex flex-wrap gap-2">
          {items.map((item) => {
            const isSelected = selected.has(item.value);
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => toggle(item.value)}
                className={[
                  "inline-flex items-center rounded-full border-[1.5px] px-4 py-2 font-body text-[13px] font-medium transition-all duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black",
                  "touch-manipulation",
                  isSelected
                    ? "border-cb-black bg-cb-black text-white shadow-sm"
                    : "border-cb-gray-200 bg-white text-cb-gray-700 hover:border-cb-gray-400 hover:bg-cb-gray-50",
                ].join(" ")}
                aria-pressed={isSelected}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      <Button
        type="button"
        variant="primary"
        size="lg"
        fullWidth
        onClick={onContinue}
        disabled={loading || selected.size === 0}
        className="touch-manipulation"
      >
        {t("common.continue")}
      </Button>

      <button
        type="button"
        onClick={onSkip}
        className="mt-4 w-full text-center font-body text-[14px] text-cb-gray-500 underline-offset-2 hover:text-cb-gray-700 hover:underline transition-colors touch-manipulation"
      >
        {t("register.interests.mayLater")}
      </button>
    </div>
  );
}
