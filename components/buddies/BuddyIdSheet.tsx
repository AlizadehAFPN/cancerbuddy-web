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
import type { CurrentUserData } from "@/lib/buddies/types";
import {
  maskBuddyId,
  useBuddyIdLookup,
} from "@/lib/buddies/useBuddyIdLookup";
import { useBuddies } from "@/lib/buddies/BuddiesProvider";
import { connectionContextFor } from "@/lib/buddies/connectContext";

const ID_LENGTH = 10;

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

  /**
   * The ladder itself lives in `useBuddyIdLookup` and is shared with
   * `/profile/buddy-id`. This sheet used to run its own copy — which drifted:
   * it stopped on an age-bracket mismatch where mobile opens the profile with
   * the connect action withheld and the reason on screen.
   */
  const { connectionMap } = useBuddies();
  const { searching, error, clearError, lookup } = useBuddyIdLookup(
    currentUser ? { id: currentUser.id, birth: currentUser.birth } : null,
    // What we already know about the pair, so the profile can open saying
    // "you two are already Buddies!" rather than offering Connect again.
    useCallback(
      (id: string) => connectionContextFor(connectionMap[id]),
      [connectionMap],
    ),
  );

  const submit = useCallback(async () => {
    if (raw.length !== ID_LENGTH || !currentUser) return;
    const href = await lookup(raw);
    if (!href) return;
    onClose();
    router.push(href);
  }, [raw, currentUser, onClose, router, lookup]);

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
          loading={searching}
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
          value={maskBuddyId(raw)}
          onChange={(e) => {
            setRaw(
              e.target.value
                .replace(/[^a-zA-Z0-9]/g, "")
                .toUpperCase()
                .slice(0, ID_LENGTH),
            );
            clearError();
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
