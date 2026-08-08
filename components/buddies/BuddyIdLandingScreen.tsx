"use client";

/**
 * `/buddyId/:buddyId` — where a shared Buddy-ID link lands.
 *
 * This is the exact URL the mobile app writes into its QR code and share sheet
 * (`https://cancerbuddy.bonemarrow.org/buddyId/<id>`, mirrored by
 * `components/profile/BuddyIdScreen.tsx`), so until now every code this product
 * generates resolved to a 404 in a browser.
 *
 * Mobile handles the same link in `DeepLinkNavigation.tsx`, which hands the id
 * straight to `useValidateRules` — the guard ladder, not a plain redirect. The
 * ladder lives in `lib/buddies/useBuddyIdLookup.ts` on web and is shared with
 * the lookup field and the sheet; this screen only decides what each refusal
 * *does*, which is the one thing that differs by entry point:
 *
 *   - your own id  → your own profile, as mobile navigates Home → Profile
 *   - age bracket  → the profile, connect withheld, reason on screen
 *   - snoozed / unknown → this screen says so
 *
 * The last one is why the refusals render here rather than redirecting to
 * `app/not-found.tsx`: "no such page" is the wrong answer to "that person has
 * paused their account".
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { useProfile } from "@/lib/profile/ProfileProvider";
import { findUserByBuddyId } from "@/lib/buddies/profileDetail";
import {
  buddyProfileHref,
  evaluateBuddyIdMatch,
  formatBuddyId,
} from "@/lib/buddies/useBuddyIdLookup";

export default function BuddyIdLandingScreen({ buddyId }: { buddyId: string }) {
  const router = useRouter();
  const { user, status } = useProfile();

  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => {
    /* The ladder needs the viewer's own birth date, so it waits for the row. */
    const viewerId = user?.id;
    if (status !== "ready" || !viewerId) return;

    let cancelled = false;

    (async () => {
      try {
        const match = await findUserByBuddyId(formatBuddyId(buddyId));
        if (cancelled) return;

        const outcome = evaluateBuddyIdMatch(match, {
          id: viewerId,
          birth: user?.birth ?? null,
        });

        if (outcome.kind === "error") {
          /* Your own link is not a failure — it is your own profile. */
          if (outcome.reason === "self") {
            router.replace("/profile");
            return;
          }
          setRefusal(outcome.message);
          return;
        }

        router.replace(buddyProfileHref(outcome));
      } catch (err) {
        console.error("[buddies] buddy id landing failed:", err);
        if (!cancelled) setRefusal(t("app.buddies.buddyIdError"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [buddyId, user?.id, user?.birth, status, router]);

  if (refusal) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-20 text-center sm:px-6">
        <h1 className="font-heading text-[20px] font-bold tracking-tight text-cb-black">
          {t("app.buddies.buddyIdLandingRefusedTitle")}
        </h1>
        <p className="mt-2 font-body text-[14.5px] leading-relaxed text-cb-gray-600">
          {refusal}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => router.push("/buddies")}>
            {t("app.buddies.buddyIdLandingBackToBuddies")}
          </Button>
          <Link
            href="/profile/buddy-id"
            className="font-body text-[13.5px] font-semibold text-cb-black underline-offset-2 hover:underline"
          >
            {t("app.buddies.buddyIdLandingYourCode")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-lg px-4 py-24 text-center sm:px-6"
      aria-busy
    >
      <p className="font-body text-[14.5px] text-cb-gray-600">
        {t("app.buddies.buddyIdLandingLoading")}
      </p>
    </div>
  );
}
