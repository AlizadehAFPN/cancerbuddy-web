"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui";
import type { UserRegisterFormValues } from "@/lib/user-signup/validation";
import {
  fetchLanguages,
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

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 shrink-0"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function StepLanguages({ onContinue, onSkip }: Props) {
  const { watch, setValue } = useFormContext<UserRegisterFormValues>();

  const languagesRaw = watch("languages") ?? "";
  const selected = parseIds(languagesRaw);

  const [items, setItems] = useState<PicklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchLanguages()
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
    setValue("languages", serializeIds(next), { shouldDirty: true });
  }

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.5rem, 2.1vw, 1.875rem)", lineHeight: 1.15 }}
        >
          {t("register.languages.heading")}
        </h1>
        <p className="mt-1 font-body text-[14px] text-cb-gray-500">
          {t("register.languages.sub")}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-cb-gray-400 border-t-transparent" />
        </div>
      ) : (
        <div className="mb-5 flex flex-col gap-1.5">
          {items.map((item) => {
            const isSelected = selected.has(item.value);
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => toggle(item.value)}
                className={[
                  "flex items-center justify-between rounded-2xl border-[1.5px] px-4 py-3 text-start transition-all duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black",
                  "touch-manipulation",
                  isSelected
                    ? "border-cb-black bg-cb-black/5 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
                    : "border-cb-gray-200 bg-white hover:border-cb-gray-400 hover:bg-cb-gray-50",
                ].join(" ")}
                aria-pressed={isSelected}
              >
                <span
                  className={[
                    "font-body text-[14px] font-medium",
                    isSelected ? "text-cb-black" : "text-cb-gray-700",
                  ].join(" ")}
                >
                  {item.label}
                </span>
                {isSelected && (
                  <span className="text-cb-black">
                    <CheckIcon />
                  </span>
                )}
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
        {t("register.languages.mayLater")}
      </button>
    </div>
  );
}
