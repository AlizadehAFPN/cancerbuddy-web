"use client";

/**
 * `/buddies/[userId]` — the full profile, ported from mobile's UserInfo screen.
 *
 * Same content and the same action bar: Connect while there's no relationship,
 * Pending (with the option to withdraw) after an invite, and a link into chat
 * once accepted. Which info cards appear depends on the person being viewed —
 * survivors show a remission date where everyone else shows treatment status.
 *
 * Previous / Next mirror mobile's "Next" button, walking whatever discovery
 * list brought the user here — including the partner-resource interstitial
 * that interrupts every fifth Next (see `lib/buddies/adRotation.ts`).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import BuddyAvatar from "@/components/buddies/BuddyAvatar";
import JournalPreview from "@/components/buddies/JournalPreview";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  XIcon,
} from "@/components/buddies/controls";
import { ageSuffix, formatRemissionDate } from "@/lib/buddies/age";
import { nextAdOrNull } from "@/lib/buddies/adRotation";
import { useBuddies } from "@/lib/buddies/BuddiesProvider";
import { deleteConnection } from "@/lib/buddies/connections";
import { prefetchAds } from "@/lib/contentful/ads";
import {
  ROLE_BADGE_CLASS,
  ROLE_LABELS,
  formatLocation,
  formatName,
} from "@/lib/buddies/display";
import {
  getDiscoveryNeighbours,
  type DiscoveryNeighbours,
} from "@/lib/buddies/discoveryOrder";
import {
  fetchBuddyProfileDetail,
  type BuddyProfileDetail,
} from "@/lib/buddies/profileDetail";
import { useConnectAction } from "@/lib/buddies/useConnectAction";
import type { NamedRef } from "@/lib/buddies/types";

/* ── Info cards ─────────────────────────────────────────────────────────── */

function names(list: NamedRef[]): string {
  return list.map((i) => i.name).join("\n");
}

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  if (!description.trim()) return null;
  return (
    <div className="rounded-2xl border border-cb-gray-200 bg-white p-4">
      <h3 className="font-body text-[11px] font-bold uppercase tracking-[0.12em] text-cb-gray-500">
        {title}
      </h3>
      <p className="mt-1.5 whitespace-pre-line font-body text-[14.5px] leading-snug text-cb-black">
        {description}
      </p>
    </div>
  );
}

function buildInfoCards(profile: BuddyProfileDetail) {
  const isSurvivor = profile.userType === "SURVIVOR";
  return [
    { title: t("app.buddies.diagnosis"), description: names(profile.diagnosis) },
    isSurvivor
      ? {
          title: t("app.buddies.inRemissionSince"),
          description: formatRemissionDate(profile.inRemissionSince),
        }
      : {
          title: t("app.buddies.cardCurrently"),
          description: profile.treatmentStatusName ?? "",
        },
    {
      title: t("app.buddies.sideEffects"),
      description: names(profile.desabilities),
    },
    {
      title: t("app.buddies.treatments"),
      description: names(profile.treatments),
    },
    {
      title: t("app.buddies.sectionMedicalCenter"),
      description: names(profile.hospitals),
    },
    {
      title: t("app.buddies.cardSupportOrg"),
      description: names(profile.supportOrganizations),
    },
  ];
}

/* ── Skeleton ───────────────────────────────────────────────────────────── */

function ProfileSkeleton() {
  return (
    <div aria-hidden className="space-y-6">
      <div className="flex items-center gap-5">
        <div className="h-24 w-24 animate-pulse rounded-full bg-cb-gray-100" />
        <div className="flex-1 space-y-3">
          <div className="h-6 w-1/2 animate-pulse rounded bg-cb-gray-100" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-cb-gray-100" />
        </div>
      </div>
      <div className="h-20 animate-pulse rounded-2xl bg-cb-gray-100" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-cb-gray-100" />
        ))}
      </div>
    </div>
  );
}

/* ── Screen ─────────────────────────────────────────────────────────────── */

export default function BuddyProfileScreen({ userId }: { userId: string }) {
  const router = useRouter();
  const { currentUser, connectionMap, connectionsLoaded, clearConnection } =
    useBuddies();
  const { connect, busyIds } = useConnectAction();

  const [profile, setProfile] = useState<BuddyProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [neighbours, setNeighbours] = useState<DiscoveryNeighbours>({});

  // Read after mount, not during render: the discovery order is client-only
  // module state, so reading it while rendering would mismatch the SSR output.
  useEffect(() => {
    setNeighbours(getDiscoveryNeighbours(userId));
  }, [userId]);

  // Warm the partner resources here rather than on the interstitial: by the
  // time someone has paged through five buddies the list is long since cached,
  // so the ad never opens on a spinner. Fire-and-forget and memoised — the
  // repeat calls as the user pages are free.
  useEffect(() => {
    prefetchAds();
  }, []);

  /**
   * Mobile's `handleNext`: every sixth press (then every fifth) lands on a
   * partner resource instead of the next buddy. `replace`, not `push`, so Back
   * from a profile skips over the ad the same way mobile's `navigation.replace`
   * does.
   */
  const goToNext = useCallback(() => {
    const nextId = neighbours.nextId;
    if (!nextId) return;

    const ad = nextAdOrNull();
    if (ad) {
      router.replace(`/buddies/ad/${ad.id}?next=${encodeURIComponent(nextId)}`);
      return;
    }
    router.push(`/buddies/${nextId}`);
  }, [neighbours.nextId, router]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProfile(null);

    fetchBuddyProfileDetail(userId)
      .then((detail) => {
        if (cancelled) return;
        if (!detail) setError(t("app.buddies.profileUnavailable"));
        else setProfile(detail);
      })
      .catch((err) => {
        console.error("[buddies] failed to load profile:", err);
        if (!cancelled) setError(t("app.buddies.profileLoadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const connection = connectionMap[userId];
  const isSelf = currentUser?.id === userId;
  const isSupportAccount = profile?.userType === "SUPPORT";

  const withdraw = useCallback(async () => {
    if (!connection) return;
    setWithdrawing(true);
    try {
      await deleteConnection(connection.connectionId);
      clearConnection(userId);
      toast.success(t("app.buddies.withdrawn"));
    } catch (err) {
      console.error("[buddies] withdraw failed:", err);
      toast.error(t("app.buddies.withdrawError"));
    } finally {
      setWithdrawing(false);
    }
  }, [connection, clearConnection, userId]);

  const infoCards = useMemo(
    () => (profile ? buildInfoCards(profile) : []),
    [profile],
  );

  const displayName = profile
    ? `${formatName(profile.name, profile.userType)}${ageSuffix(
        profile.userType,
        profile.birth,
      )}`
    : "";

  const location = profile
    ? formatLocation(profile.cityName, profile.stateAbbreviation)
    : "";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-4 sm:px-6">
      {/* Top bar */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 rounded-full px-2 py-2 font-body text-[14px] font-semibold text-cb-gray-600 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
        >
          <ArrowLeftIcon />
          {t("app.buddies.back")}
        </button>

        {neighbours.position && (
          <span className="font-body text-[12.5px] text-cb-gray-400">
            {t("app.buddies.positionOf", {
              index: neighbours.position.index,
              total: neighbours.position.total,
            })}
          </span>
        )}

        <Link
          href="/buddies"
          aria-label={t("app.buddies.closeProfile")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-cb-gray-500 transition-colors hover:bg-cb-gray-100 hover:text-cb-black"
        >
          <XIcon size={18} />
        </Link>
      </div>

      {loading ? (
        <ProfileSkeleton />
      ) : error || !profile ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <h1 className="font-heading text-[20px] font-bold text-cb-black">
            {error ?? t("app.buddies.profileUnavailable")}
          </h1>
          <Button variant="secondary" onClick={() => router.push("/buddies")}>
            {t("app.buddies.backToBuddies")}
          </Button>
        </div>
      ) : (
        <article className="space-y-8">
          {/* Identity */}
          <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <BuddyAvatar
              name={profile.name}
              photoUrl={profile.profilePicUrl}
              goalUrl={profile.goalImageUrl}
              size={96}
            />
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-[26px] font-bold leading-tight tracking-tight text-cb-black">
                {displayName}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {ROLE_LABELS[profile.userType] && (
                  <span
                    className={[
                      "rounded-full px-2.5 py-0.5 font-body text-[11.5px] font-bold",
                      ROLE_BADGE_CLASS[profile.userType] ??
                        "bg-cb-gray-200 text-cb-black",
                    ].join(" ")}
                  >
                    {ROLE_LABELS[profile.userType]}
                  </span>
                )}
                {profile.ambassador && (
                  <span className="rounded-full bg-cb-bone px-2.5 py-0.5 font-body text-[11px] font-bold uppercase tracking-wide text-cb-black">
                    {t("app.buddies.ambassador")}
                  </span>
                )}
                {profile.pronoun && (
                  <span className="rounded-full border border-cb-gray-200 px-2.5 py-0.5 font-body text-[11.5px] text-cb-gray-600">
                    {profile.pronoun}
                  </span>
                )}
              </div>

              {location && (
                <p className="mt-2 font-body text-[14px] text-cb-gray-500">
                  {location}
                </p>
              )}
              {profile.goalName && (
                <p className="mt-1 font-body text-[14px] font-semibold text-cb-black">
                  {t("app.buddies.hereTo", { goal: profile.goalName })}
                </p>
              )}
            </div>
          </header>

          {/* About */}
          {profile.bio?.trim() && (
            <section>
              <h2 className="font-heading text-[12px] font-bold uppercase tracking-[0.14em] text-cb-black">
                {t("app.buddies.about")}
              </h2>
              <p className="mt-3 whitespace-pre-line rounded-2xl border border-cb-gray-200 bg-white p-4 font-body text-[15px] leading-relaxed text-cb-black">
                {profile.bio}
              </p>
            </section>
          )}

          {/* Medical info */}
          {!isSupportAccount && infoCards.some((c) => c.description.trim()) && (
            <section>
              <h2 className="font-heading text-[12px] font-bold uppercase tracking-[0.14em] text-cb-black">
                {profile.userType === "CAREGIVER"
                  ? t("app.buddies.sectionPatientInfo")
                  : t("app.buddies.sectionMedical")}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {infoCards.map((card) => (
                  <InfoCard key={card.title} {...card} />
                ))}
              </div>
            </section>
          )}

          {/* Journal — hidden for support accounts along with the other
              personal sections, exactly as mobile's `shouldHide` does. */}
          {!isSupportAccount && <JournalPreview userId={profile.id} />}

          {/* Photos */}
          {profile.gallery.length > 0 && !isSupportAccount && (
            <section>
              <h2 className="font-heading text-[12px] font-bold uppercase tracking-[0.14em] text-cb-black">
                {t("app.buddies.photos")}
              </h2>
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {profile.gallery.map((photo) => (
                  <li key={photo.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="aspect-square w-full rounded-xl bg-cb-gray-100 object-cover"
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Interests */}
          {profile.interests.length > 0 && !isSupportAccount && (
            <section>
              <h2 className="font-heading text-[12px] font-bold uppercase tracking-[0.14em] text-cb-black">
                {t("app.buddies.interests")}
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {profile.interests.map((interest) => (
                  <li
                    key={interest.id}
                    className="rounded-full bg-cb-bone px-3.5 py-1.5 font-body text-[13px] text-cb-black"
                  >
                    {interest.name}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Personal background */}
          {(profile.workplaceName || profile.collegeName) && (
            <section>
              <h2 className="font-heading text-[12px] font-bold uppercase tracking-[0.14em] text-cb-black">
                {t("app.buddies.personalBackground")}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <InfoCard
                  title={t("app.buddies.workplace")}
                  description={profile.workplaceName ?? ""}
                />
                <InfoCard
                  title={t("app.buddies.cardCollege")}
                  description={profile.collegeName ?? ""}
                />
              </div>
            </section>
          )}

          {/* Sponsor (support accounts) */}
          {isSupportAccount && profile.sponsor?.description && (
            <section className="rounded-2xl bg-cb-gray-100 p-5">
              <h2 className="font-heading text-[12px] font-bold uppercase tracking-[0.14em] text-cb-black">
                {t("app.buddies.sponsoredBy")}
              </h2>
              {profile.sponsor.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.sponsor.imageUrl}
                  alt=""
                  className="mt-3 max-h-16 w-auto object-contain"
                />
              )}
              <p className="mt-3 font-body text-[14.5px] leading-relaxed text-cb-black">
                {profile.sponsor.description}
              </p>
            </section>
          )}
        </article>
      )}

      {/* Action bar */}
      {/* Sits above the mobile tab bar (h-16) and clears the lg sidebar (w-64). */}
      {profile && !isSelf && !isSupportAccount && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-cb-gray-200 bg-white/95 px-4 pb-3 pt-3 backdrop-blur lg:bottom-0 lg:left-64 lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="flex-1">
              {!connectionsLoaded ? (
                <div className="h-11 animate-pulse rounded-full bg-cb-gray-100" />
              ) : connection?.status === "connected" ? (
                <Button
                  fullWidth
                  onClick={() =>
                    router.push(`/chat/${connection.connectionId}`)
                  }
                >
                  {t("app.buddies.chatWithBuddy")}
                </Button>
              ) : connection?.status === "pending" ? (
                <Button
                  fullWidth
                  variant="secondary"
                  onClick={withdraw}
                  loading={withdrawing}
                >
                  {t("app.buddies.withdrawInvite")}
                </Button>
              ) : (
                <Button
                  fullWidth
                  onClick={() =>
                    void connect({ id: profile.id, name: profile.name })
                  }
                  loading={busyIds.includes(profile.id)}
                >
                  {t("app.buddies.connect")}
                </Button>
              )}
            </div>

            {(neighbours.previousId || neighbours.nextId) && (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={!neighbours.previousId}
                  onClick={() =>
                    neighbours.previousId &&
                    router.push(`/buddies/${neighbours.previousId}`)
                  }
                  aria-label={t("app.buddies.previousBuddy")}
                  className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-cb-black text-cb-black transition-colors hover:bg-cb-gray-100 disabled:cursor-not-allowed disabled:border-cb-gray-200 disabled:text-cb-gray-300"
                >
                  <ArrowLeftIcon />
                </button>
                <button
                  type="button"
                  disabled={!neighbours.nextId}
                  onClick={goToNext}
                  aria-label={t("app.buddies.nextBuddy")}
                  className="flex h-11 items-center gap-1.5 rounded-full border-2 border-cb-black px-4 font-body text-[14px] font-bold text-cb-black transition-colors hover:bg-cb-gray-100 disabled:cursor-not-allowed disabled:border-cb-gray-200 disabled:text-cb-gray-300"
                >
                  {t("app.buddies.next")}
                  <ChevronRightIcon />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
