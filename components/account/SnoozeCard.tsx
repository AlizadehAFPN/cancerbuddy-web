"use client";

/**
 * The snooze switch.
 *
 * Turning it on hides the account from discovery and freezes every
 * conversation; turning it off wakes the ones whose other member is not also
 * asleep. Both effects are visible to other members, so the work happens in
 * `lib/account/snooze.ts`, which does exactly what mobile's `SnoozeProvider`
 * does and nothing more.
 *
 * The switch reflects the account row, not local state — a member who snoozed
 * on their phone sees it on here.
 */

import { useState } from "react";
import { toast } from "sonner";

import { t } from "@/lib/i18n";
import { useAccount } from "@/lib/account/AccountProvider";
import { useStreamChat } from "@/lib/chat/StreamChatProvider";
import {
  snoozeOrUnsnooze,
  updateFrozenChannels,
  type SnoozeChatClient,
} from "@/lib/account/snooze";

export default function SnoozeCard() {
  const { userId, isSnooze, loaded, setSnoozeLocal, refresh } = useAccount();
  const { client } = useStreamChat();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (!userId || busy) return;
    const next = !isSnooze;
    setBusy(true);
    try {
      await snoozeOrUnsnooze(userId, next);
      // Flip locally first so the gate and the switch agree immediately; the
      // channel work below is slow and must not hold the UI.
      setSnoozeLocal(next);
      toast.success(
        t(next ? "app.settings.snoozeOnToast" : "app.settings.snoozeOffToast"),
      );

      if (client) {
        await updateFrozenChannels({
          client: client as unknown as SnoozeChatClient,
          userId,
          snooze: next,
        });
      }
    } catch (err) {
      console.error("[settings] snooze toggle failed:", err);
      toast.error(t("app.settings.snoozeError"));
      // Re-read rather than guessing: the Lambda may have applied the change.
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-cb-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-heading text-[16px] font-bold text-cb-black">
            {t("app.settings.snoozeTitle")}
          </h2>
          <p className="mt-1 font-body text-[14px] leading-relaxed text-cb-gray-600">
            {t("app.settings.snoozeBody")}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isSnooze}
          aria-label={t("app.settings.snoozeTitle")}
          disabled={!loaded || busy || !userId}
          onClick={() => void toggle()}
          className={[
            "relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
            isSnooze ? "bg-cb-black" : "bg-cb-gray-300",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-1 h-5 w-5 rounded-full bg-white transition-transform",
              isSnooze ? "translate-x-6" : "translate-x-1",
            ].join(" ")}
          />
        </button>
      </div>
    </section>
  );
}
