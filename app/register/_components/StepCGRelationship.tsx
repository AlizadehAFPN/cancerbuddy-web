"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui";
import type { UserRegisterFormValues } from "@/lib/user-signup/validation";
import { fetchRelationships } from "@/lib/aws/appsyncPicklistQueries";
import { t } from "@/lib/i18n";
import { sortAlpha, SingleSection } from "./picker";

interface Props {
  onContinue: () => void;
}

export function StepCGRelationship({ onContinue }: Props) {
  const { watch, setValue } = useFormContext<UserRegisterFormValues>();

  const relationship = watch("relationship") ?? "";

  const [items, setItems] = useState<ReturnType<typeof sortAlpha>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchRelationships()
      .then((data) => { if (!cancelled) setItems(sortAlpha(data)); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const canContinue = relationship.trim() !== "";

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.5rem, 2.1vw, 1.875rem)", lineHeight: 1.15 }}
        >
          {t("register.cgRelationship.heading")}
        </h1>
        <p className="mt-2 font-body text-[14px] text-cb-gray-500">
          {t("register.cgRelationship.sub")}
        </p>
      </div>

      {loading ? (
        <div className="mb-6 animate-pulse">
          <div className="mb-3 h-2.5 w-24 rounded-full bg-cb-gray-100" />
          <div className="h-[52px] rounded-xl bg-cb-gray-100" />
        </div>
      ) : (
        <div className="mb-8">
          <SingleSection
            sectionLabel={t("register.cgRelationship.sectionLabel")}
            selectLabel={t("register.cgRelationship.selectRelationship")}
            modalTitle={t("register.cgRelationship.heading")}
            searchPlaceholder={t("register.cgRelationship.searchRelationships")}
            items={items}
            selectedId={relationship}
            onSelect={(id) => setValue("relationship", id, { shouldDirty: true })}
            onClear={() => setValue("relationship", "", { shouldDirty: true })}
            required
          />
        </div>
      )}

      <Button
        type="button"
        variant="primary"
        size="lg"
        fullWidth
        onClick={onContinue}
        disabled={!canContinue || loading}
        className="touch-manipulation"
      >
        {t("common.continue")}
      </Button>
    </div>
  );
}
