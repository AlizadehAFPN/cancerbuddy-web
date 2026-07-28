"use client";

/**
 * Find someone by the Buddy ID printed on their profile (`BI-0000-0000`).
 *
 * The same validation ladder mobile runs before opening a profile: the id must
 * exist, the account must not be snoozed, it must not be you, and the two of
 * you must be in compatible age brackets. Failing any of those we say so here
 * rather than navigating to a profile the user can't act on.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { Sheet } from "@/components/buddies/controls";
import { findUserByBuddyId } from "@/lib/buddies/profileDetail";
import { connectAgeRulesBuddySearching } from "@/lib/buddies/age";
import { formatName } from "@/lib/buddies/display";
import type { CurrentUserData } from "@/lib/buddies/types";

const ID_LENGTH = 10;

/** `BI00001234` → `BI-0000-1234`. */
function formatBuddyId(raw: string): string {
  if (raw.length <= 2) return raw;
  if (raw.length <= 6) return `${raw.slice(0, 2)}-${raw.slice(2)}`;
  return `${raw.slice(0, 2)}-${raw.slice(2, 6)}-${raw.slice(6)}`;
}

/** Mounted only while open, so every visit starts with an empty field. */
export default function BuddyIdSheet({
  currentUser,
  onClose,
}: {
  currentUser: CurrentUserData | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [status, setStatus] = useState<"idle" | "searching">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (raw.length !== ID_LENGTH || !currentUser) return;
    setStatus("searching");
    setError(null);

    try {
      const match = await findUserByBuddyId(formatBuddyId(raw));

      if (!match) {
        setError(t("app.buddies.buddyIdNotFound"));
        return;
      }
      if (match.id === currentUser.id) {
        setError(t("app.buddies.buddyIdSelf"));
        return;
      }
      if (match.isSnooze) {
        setError(t("app.buddies.buddyIdSnoozed"));
        return;
      }
      if (!connectAgeRulesBuddySearching(currentUser.birth, match.birth)) {
        setError(
          t("app.buddies.buddyIdAgeRule", { name: formatName(match.name) }),
        );
        return;
      }

      onClose();
      router.push(`/buddies/${match.id}`);
    } catch (err) {
      console.error("[buddies] buddy id lookup failed:", err);
      setError(t("app.buddies.buddyIdError"));
    } finally {
      setStatus("idle");
    }
  }, [raw, currentUser, onClose, router]);

  return (
    <Sheet
      open
      title={t("app.buddies.buddyIdTitle")}
      subtitle={t("app.buddies.buddyIdSub")}
      onClose={onClose}
      footer={
        <Button
          fullWidth
          onClick={submit}
          disabled={raw.length !== ID_LENGTH}
          loading={status === "searching"}
        >
          {t("app.buddies.buddyIdFind")}
        </Button>
      }
    >
      <div className="px-5 pb-6">
        <label
          htmlFor="buddy-id-input"
          className="mb-2 block font-body text-[11px] font-bold uppercase tracking-[0.14em] text-cb-gray-500"
        >
          {t("app.buddies.buddyIdLabel")}
        </label>
        <input
          id="buddy-id-input"
          value={formatBuddyId(raw)}
          onChange={(e) => {
            setRaw(
              e.target.value
                .replace(/[^a-zA-Z0-9]/g, "")
                .toUpperCase()
                .slice(0, ID_LENGTH),
            );
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="BI-0000-0000"
          autoComplete="off"
          spellCheck={false}
          className="h-14 w-full rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-4 font-heading text-[24px] tracking-[0.08em] text-cb-black outline-none transition-colors placeholder:text-cb-gray-300 hover:border-cb-gray-400 focus:border-cb-black focus:shadow-[0_0_0_4px_rgba(254,233,72,0.45)]"
        />
        <p className="mt-2 font-body text-[12.5px] text-cb-gray-400">
          {t("app.buddies.buddyIdFormat")}
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-cb-danger/30 bg-cb-danger/10 px-4 py-3 font-body text-[13.5px] leading-snug text-cb-black"
          >
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
