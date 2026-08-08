"use client";

/**
 * "Change my status" — the picker, and the one-screen Path A confirm.
 *
 * Path A (→ Survivor, or Survivor → Patient) is a single `updateUser`: the
 * medical record does not change, only the label on it and the remission date.
 * Path B (anything involving Caregiver) re-collects the medical information
 * first and lives at `/settings/change-status/update`.
 *
 * Both end signed out, because the account row the session was built on has
 * changed underneath it.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import { useAccount } from "@/lib/account/AccountProvider";
import { finishSignedOutFlow } from "@/lib/account/finishSignedOutFlow";
import {
  changeStatusOptionsFor,
  routeFor,
  type ChangeStatusTarget,
} from "@/lib/account/changeStatus";
import { applyStatusPathA } from "@/lib/account/changeStatusWrite";

/**
 * Mobile's `CHANGE_ROLE_PLATFORM_OPTIONS` copy, keyed by target. `as const` so
 * the keys stay literal — `t()` only accepts keys it can see in the catalogue.
 */
const OPTION_COPY = {
  PATIENT: {
    titleKey: "app.settings.statusPatient",
    bodyKey: "app.settings.statusPatientSub",
  },
  SURVIVOR: {
    titleKey: "app.settings.statusSurvivor",
    bodyKey: "app.settings.statusSurvivorSub",
  },
  CAREGIVER: {
    titleKey: "app.settings.statusCaregiver",
    bodyKey: "app.settings.statusCaregiverSub",
  },
} as const satisfies Record<
  ChangeStatusTarget,
  { titleKey: string; bodyKey: string }
>;

export default function ChangeStatusScreen() {
  const router = useRouter();
  const { userId, userType, birth, loaded } = useAccount();
  const [pending, setPending] = useState<ChangeStatusTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const options = changeStatusOptionsFor({ currentUserType: userType, birth });

  const choose = (target: ChangeStatusTarget) => {
    if (routeFor(target, userType) === "B") {
      // Path B re-collects the medical information before anything is written.
      router.push(`/settings/change-status/update?to=${target}`);
      return;
    }
    setPending(target);
  };

  const confirm = async () => {
    if (!pending || !userId || busy) return;
    setBusy(true);
    try {
      await applyStatusPathA({ userId, next: pending });
      setPending(null);
      setDone(true);
    } catch (err) {
      console.error("[settings] status change failed:", err);
      toast.error(t("app.settings.statusError"));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <span
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded-full bg-cb-green text-[28px]"
        >
          ✓
        </span>
        <h1 className="font-heading text-[20px] font-bold text-cb-black">
          {t("app.settings.statusDoneTitle")}
        </h1>
        <p className="font-body text-[14.5px] leading-relaxed text-cb-gray-600">
          {t("app.settings.statusDoneBody")}
        </p>
        <div className="mt-2 w-full">
          <Button fullWidth onClick={() => void finishSignedOutFlow()}>
            {t("app.settings.statusDoneGotIt")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <h1 className="font-heading text-2xl font-bold text-cb-black">
        {t("app.settings.statusHeading")}
      </h1>
      <p className="mt-1.5 font-body text-[14.5px] leading-relaxed text-cb-gray-600">
        {t("app.settings.statusSub")}
      </p>

      {loaded && options.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-cb-gray-200 bg-white p-5 font-body text-[14.5px] text-cb-gray-600">
          {t("app.settings.statusNoOptions")}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {options.map((option) => (
            <li key={option}>
              <button
                type="button"
                onClick={() => choose(option)}
                className="flex w-full items-center justify-between gap-4 rounded-2xl border border-cb-gray-200 bg-white p-5 text-left transition-colors hover:border-cb-black"
              >
                <span className="min-w-0">
                  <span className="block font-heading text-[16px] font-bold text-cb-black">
                    {t(OPTION_COPY[option].titleKey)}
                  </span>
                  <span className="mt-1 block font-body text-[14px] leading-relaxed text-cb-gray-600">
                    {t(OPTION_COPY[option].bodyKey)}
                  </span>
                </span>
                <span aria-hidden className="shrink-0 text-cb-gray-400">
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <Sheet
          open
          title={t("app.settings.statusConfirmTitle")}
          onClose={() => (busy ? undefined : setPending(null))}
          footer={
            <div className="flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                disabled={busy}
                onClick={() => setPending(null)}
              >
                {t("app.settings.cancel")}
              </Button>
              <Button fullWidth loading={busy} onClick={() => void confirm()}>
                {t("app.settings.statusConfirmYes")}
              </Button>
            </div>
          }
        >
          <p className="px-5 pb-6 font-body text-[15px] leading-relaxed text-cb-black">
            {t("app.settings.statusConfirmBody", {
              status: t(OPTION_COPY[pending].titleKey),
            })}
          </p>
        </Sheet>
      )}
    </div>
  );
}
