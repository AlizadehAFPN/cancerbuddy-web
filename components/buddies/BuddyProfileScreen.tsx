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
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import BuddyAvatar from "@/components/buddies/BuddyAvatar";
import JournalPreview from "@/components/buddies/JournalPreview";
import ProfileActionBar from "@/components/buddies/ProfileActionBar";
import ProfileNoticeBanner from "@/components/buddies/ProfileNoticeBanner";
import PhotoViewer from "@/components/buddies/PhotoViewer";
import AmbassadorBadge from "@/components/buddies/AmbassadorBadge";
import { ArrowLeftIcon, XIcon } from "@/components/buddies/controls";
import { ageSuffix, formatRemissionDate } from "@/lib/buddies/age";
import { nextAdOrNull } from "@/lib/buddies/adRotation";
import { useBuddies } from "@/lib/buddies/BuddiesProvider";
import { deleteConnection, isPairBlocked } from "@/lib/buddies/connections";
import { prefetchAds } from "@/lib/contentful/ads";
import {
  ROLE_BADGE_CLASS,
  ROLE_LABELS,
  formatLocation,
  formatName,
} from "@/lib/buddies/display";
import {
  getNeighbours,
  type DiscoveryNeighbours,
} from "@/lib/buddies/discoveryOrder";
import {
  fetchBuddyProfileDetail,
  type BuddyProfileDetail,
} from "@/lib/buddies/profileDetail";
import { shouldShowActionBar } from "@/lib/buddies/actionBar";
import {
  connectionContextFor,
  isProfileNotice,
  noticeForConnectionContext,
  showConnectAction,
} from "@/lib/buddies/connectContext";
import {
  resolveBuddyChannelId,
  type ChatClientLike,
} from "@/lib/chat/resolveBuddyChannel";
import { useStreamChat } from "@/lib/chat/StreamChatProvider";
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
  const { client } = useStreamChat();
  const { currentUser, connectionMap, connectionsLoaded, clearConnection } =
    useBuddies();
  const { connect, busyIds } = useConnectAction();

  const [profile, setProfile] = useState<BuddyProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  /** Which photo is open full-size, if any. */
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [neighbours, setNeighbours] = useState<DiscoveryNeighbours>({});

  // Read after mount, not during render: the discovery order is client-only
  // module state, so reading it while rendering would mismatch the SSR output.
  useEffect(() => {
    setNeighbours(getNeighbours(userId));
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

  const isSelf = currentUser?.id === userId;
  const isSupportAccount = profile?.userType === "SUPPORT";

  const searchParams = useSearchParams();

  /**
   * `?connect=0` — the caller has already decided that connecting is not
   * allowed, and says so rather than letting this screen offer a request the
   * rules would refuse. Groups sets it when a post author is snoozed or outside
   * the viewer's age bracket, which is what mobile passes as `showButtons:false`
   * when the same avatar is tapped (`usePostActions.ts:61-88`).
   *
   * Only the **Connect** action is suppressed. Mobile hides the whole bar, which
   * would also remove Chat from an existing buddy's profile — a link web has and
   * mobile reaches another way.
   */
  const connectSuppressed = searchParams.get("connect") === "0";

  /**
   * `?notice=…` — why the bar looks the way it does, written by whoever sent the
   * member here. Mobile passes the same thing as a `message` navigation param
   * from its Buddy-ID ladder (`useValidateRules.ts:95-133,209-224`) and renders
   * it as a card under the name; web had transient toasts, which are gone in
   * four seconds and never fire at all on a page opened from a link.
   */
  const noticeParam = searchParams.get("notice");
  const connection = connectionMap[userId];

  /**
   * An explicit notice wins; otherwise a pending invite speaks for itself.
   *
   * Mobile's two profile screens split this: `UserInfoConnect` renders whatever
   * the caller passed, and `UserInfo` derives the waiting-to-connect card from
   * the connection alone (`UserInfo.tsx:197,390-392`). Web has one screen, so it
   * does both — and the derived half is what makes the explanation appear on
   * *every* route into a pending profile rather than only the scanner's.
   */
  const notice = isProfileNotice(noticeParam)
    ? noticeParam
    : noticeForConnectionContext(connectionContextFor(connection)).notice ===
        "sentInvite"
      ? "sentInvite"
      : null;

  /**
   * `?connectionId=…` — set when this profile was opened from that person's own
   * buddy request, and the only context in which "Maybe later" exists. Mobile
   * passes it the same way (`ConnectionRequest.tsx:194-196`).
   */
  const incomingConnectionId = searchParams.get("connectionId");

  /**
   * A new invite is refused for a snoozed member and across age brackets — the
   * gate mobile applies on the profile itself, which web applied only in the
   * discovery query. Anyone reached another way (a group's member list, a Buddy
   * ID, a post author) therefore still saw a live Connect button.
   */
  const canConnect =
    !!profile &&
    !connectSuppressed &&
    notice !== "ageRule" &&
    showConnectAction({
      viewerId: currentUser?.id,
      viewerBirth: currentUser?.birth,
      target: {
        id: profile.id,
        isSnooze: profile.isSnooze,
        birth: profile.birth,
      },
      connection,
    });

  /**
   * Either direction of a block. `fetchBlockedUserIds` only knows who *this*
   * account has blocked, so someone who blocked *you* still got a live Connect
   * button here. Mobile asks the pair question with an `or` over both directions.
   *
   * Starts true-unknown as `false` so the bar is not hidden while it resolves;
   * the request is cheap (`limit: 1`) and settles before an interaction.
   */
  const [isBlocked, setIsBlocked] = useState(false);
  useEffect(() => {
    const viewerId = currentUser?.id;
    if (!viewerId || !userId || viewerId === userId) {
      setIsBlocked(false);
      return;
    }
    let cancelled = false;
    isPairBlocked(viewerId, userId).then((blocked) => {
      if (!cancelled) setIsBlocked(blocked);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, userId]);

  /**
   * Opens the pair's real conversation, not `/chat/<current connection id>`.
   *
   * Those differ for anyone who connected, disconnected and reconnected, and for
   * pairs older than the id-sharing convention — sending them to the connection
   * id opens an empty chat beside the one holding their history.
   */
  const [openingChat, setOpeningChat] = useState(false);
  const openChat = useCallback(async () => {
    if (!client || !currentUser?.id) return;
    setOpeningChat(true);
    try {
      const channelId = await resolveBuddyChannelId({
        client: client as unknown as ChatClientLike,
        me: currentUser.id,
        them: userId,
        connectionId: connection?.connectionId,
        myName: currentUser.name,
        theirName: profile?.name,
      });
      if (!channelId) {
        toast.error(t("app.buddies.chatUnavailable"));
        return;
      }
      router.push(`/chat/${channelId}`);
    } catch (err) {
      console.error("[buddies] could not open chat:", err);
      toast.error(t("app.buddies.chatUnavailable"));
    } finally {
      setOpeningChat(false);
    }
  }, [client, currentUser?.id, currentUser?.name, userId, connection?.connectionId, profile?.name, router]);

  /**
   * Cancelling an invite you sent — reached only through the two-step Pending
   * dialog, never from a single click.
   */
  const cancelRequest = useCallback(async () => {
    if (!connection) return;
    setWithdrawing(true);
    try {
      await deleteConnection(connection.connectionId);
      clearConnection(userId);
      toast.success(
        t("app.buddies.requestCancelled", { name: formatName(profile?.name) }),
      );
    } catch (err) {
      console.error("[buddies] cancel request failed:", err);
      toast.error(t("app.buddies.withdrawError"));
    } finally {
      setWithdrawing(false);
    }
  }, [connection, clearConnection, userId, profile?.name]);

  /**
   * Declining *their* request from their profile — mobile's `handleMaybeLater`.
   * Deletes the connection id the request card handed over, names them in the
   * toast, and goes back to where the member came from.
   */
  const [declining, setDeclining] = useState(false);
  const maybeLater = useCallback(async () => {
    if (!incomingConnectionId) return;
    setDeclining(true);
    try {
      await deleteConnection(incomingConnectionId);
      clearConnection(userId);
      toast.success(
        t("app.buddies.dismissedToast", { name: formatName(profile?.name) }),
      );
      router.back();
    } catch (err) {
      console.error("[buddies] maybe later failed:", err);
      toast.error(t("app.buddies.dismissError"));
    } finally {
      setDeclining(false);
    }
  }, [incomingConnectionId, clearConnection, userId, profile?.name, router]);

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
                <AmbassadorBadge
                  ambassador={profile.ambassador}
                  isSelf={isSelf}
                  myName={currentUser?.name}
                  className="!px-2.5 !text-[11px]"
                />
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

          {/* Why the action bar looks the way it does. Sits directly under the
              identity block, where mobile's FeedbackCard sits. */}
          {notice && (
            <ProfileNoticeBanner notice={notice} name={formatName(profile.name)} />
          )}

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
                {profile.gallery.map((photo, i) => (
                  <li key={photo.id}>
                    {/* Opening a photo is the whole of mobile's GalleryScreen;
                        the grid was inert here. */}
                    <button
                      type="button"
                      onClick={() => setViewerIndex(i)}
                      aria-label={t("app.buddies.photoOf", {
                        name: formatName(profile.name),
                      })}
                      className="block w-full overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-cb-black"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="aspect-square w-full bg-cb-gray-100 object-cover transition-transform hover:scale-[1.03]"
                      />
                    </button>
                  </li>
                ))}
              </ul>

              {/* Photos that exist but could not be signed. Mobile toasts each
                  one; saying it once, in place, is the web equivalent. */}
              {profile.galleryFailures > 0 && (
                <p
                  role="status"
                  className="mt-2 font-body text-[12.5px] text-cb-gray-500"
                >
                  {t(
                    profile.galleryFailures === 1
                      ? "app.buddies.photosUnavailableOne"
                      : "app.buddies.photosUnavailable",
                    {
                      count: profile.galleryFailures,
                      name: formatName(profile.name),
                    },
                  )}
                </p>
              )}
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
      {profile && isBlocked && !isSelf && (
        <p
          role="status"
          className="mx-auto mb-4 max-w-3xl rounded-xl bg-cb-gray-100 px-4 py-3 text-center font-body text-[13.5px] text-cb-gray-700"
        >
          {t("app.buddies.profileBlocked")}
        </p>
      )}

      {profile &&
        shouldShowActionBar({
          viewerGroupHostId: currentUser?.groupHostId,
          targetUserType: profile.userType,
          isSelf,
          isBlocked,
        }) && (
          <ProfileActionBar
            connection={connection}
            connectionsLoaded={connectionsLoaded}
            canConnect={canConnect}
            incomingConnectionId={incomingConnectionId}
            name={formatName(profile.name)}
            busy={busyIds.includes(profile.id)}
            openingChat={openingChat}
            cancelling={withdrawing}
            decliningRequest={declining}
            onConnect={() => void connect({ id: profile.id, name: profile.name })}
            onOpenChat={() => void openChat()}
            onCancelRequest={() => void cancelRequest()}
            onMaybeLater={() => void maybeLater()}
            previousId={neighbours.previousId}
            nextId={neighbours.nextId}
            onPrevious={() =>
              neighbours.previousId &&
              router.push(`/buddies/${neighbours.previousId}`)
            }
            onNext={goToNext}
          />
        )}

      {profile && viewerIndex !== null && (
        <PhotoViewer
          photos={profile.gallery}
          index={viewerIndex}
          name={formatName(profile.name)}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
        />
      )}
    </div>
  );
}
