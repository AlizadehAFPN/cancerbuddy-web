"use client";

/**
 * `/profile` — the profile hub.
 *
 * Section visibility is a direct port of the conditionals in mobile's
 * `HomeProfile.tsx`, and the two that surprise people are worth stating here:
 *
 *  • A **caregiver** has no medical section of their own. Their "Medical" card
 *    sits under "my patient's info" and opens the same screen everyone else
 *    reaches from "Medical" — for them that record *is* the patient's.
 *  • **Languages** is not a section. Mobile's card is commented out; the
 *    language picker lives inside Personal information.
 *
 * Mobile stacks these as full-width rows because that's all a phone fits. With
 * room to work in, the sections become a grid of cards so the completion rings
 * can be compared at a glance instead of scrolled past one at a time.
 */

import Link from "next/link";
import AmbassadorBadge from "@/components/buddies/AmbassadorBadge";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import BuddyAvatar from "@/components/buddies/BuddyAvatar";
import ProgressRing from "@/components/profile/ProgressRing";
import { useProfile } from "@/lib/profile/ProfileProvider";
import {
  caregiverPersonalInformationProgress,
  galleryProgress,
  interestProgress,
  medicalInformationProgress,
  personalInformationProgress,
} from "@/lib/profile/progress";
import {
  ROLE_BADGE_CLASS,
  ROLE_LABELS,
  formatName,
} from "@/lib/buddies/display";
import { removeProfilePicture, setProfilePicture } from "@/lib/profile/photos";

function SectionCard({
  href,
  title,
  progress,
  hint,
}: {
  href: string;
  title: string;
  progress: number;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl border border-cb-gray-200 bg-white p-4 transition-shadow hover:shadow-[0_6px_24px_-10px_rgba(36,36,36,0.2)]"
    >
      <ProgressRing value={progress} label={title} />
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-[15.5px] font-bold text-cb-black">
          {title}
        </span>
        {hint && (
          <span className="mt-0.5 block font-body text-[13px] leading-snug text-cb-gray-500">
            {hint}
          </span>
        )}
      </span>
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-cb-gray-400"
        aria-hidden
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  );
}

function ActionCard({
  href,
  title,
  hint,
  icon,
}: {
  href: string;
  title: string;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl border border-cb-gray-200 bg-white p-4 transition-shadow hover:shadow-[0_6px_24px_-10px_rgba(36,36,36,0.2)]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cb-bone text-cb-black">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-[15.5px] font-bold text-cb-black">
          {title}
        </span>
        {hint && (
          <span className="mt-0.5 block font-body text-[13px] leading-snug text-cb-gray-500">
            {hint}
          </span>
        )}
      </span>
    </Link>
  );
}

export default function ProfileHub() {
  const { status, user, gallery, sections, retry, userId, refresh } = useProfile();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  /** Mobile offers this from an action sheet on the avatar; same place here. */
  const changeAvatar = useCallback(
    async (file: File | undefined) => {
      if (!file || !userId) return;
      setAvatarBusy(true);
      try {
        await setProfilePicture({ userId, file });
        await refresh();
        toast.success(t("app.profile.photoUpdated"));
      } catch (err) {
        console.error("[profile] avatar upload failed:", err);
        toast.error(t("app.profile.photoUploadError"));
      } finally {
        setAvatarBusy(false);
        if (avatarInputRef.current) avatarInputRef.current.value = "";
      }
    },
    [userId, refresh],
  );

  const clearAvatar = useCallback(async () => {
    if (!userId || !user?.userProfilePicId) return;
    setAvatarBusy(true);
    try {
      await removeProfilePicture({
        userId,
        pictureId: user.userProfilePicId,
      });
      await refresh();
      toast.success(t("app.profile.photoRemoved"));
    } catch (err) {
      console.error("[profile] avatar remove failed:", err);
      toast.error(t("app.profile.photoRemoveError"));
    } finally {
      setAvatarBusy(false);
    }
  }, [userId, user?.userProfilePicId, refresh]);

  if (status === "loading") {
    return (
      <div aria-hidden className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <div className="h-28 animate-pulse rounded-2xl bg-cb-gray-100" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-cb-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (status === "error" || !user) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
        <h1 className="font-heading text-[20px] font-bold text-cb-black">
          {t("app.profile.loadError")}
        </h1>
        <Button onClick={retry}>{t("app.profile.tryAgain")}</Button>
      </div>
    );
  }

  const interests = user.interests?.items ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <p className="mb-4 font-body text-[15px] text-cb-gray-600">
        {t("app.profile.tagline")}
      </p>

      {/* ── Identity ── */}
      <section className="rounded-2xl border border-cb-gray-200 bg-white p-5">
        <div className="flex items-center gap-4">
          <BuddyAvatar
            name={user.name ?? "?"}
            photoUrl={user.profilePicUrl}
            goalUrl={undefined}
            size={72}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-[20px] font-bold leading-tight text-cb-black">
                {formatName(user.name ?? "", user.userType ?? undefined)}
              </h1>
              {/* Role tag, as mobile's AvatarProfile shows it. HOST is
                  excluded there because it isn't a real underlying role — the
                  dedicated host badge below stands in for it. */}
              {user.userType &&
                user.userType !== "HOST" &&
                ROLE_LABELS[user.userType] && (
                  <span
                    className={[
                      "rounded-full px-2.5 py-0.5 font-body text-[11.5px] font-bold",
                      ROLE_BADGE_CLASS[user.userType] ??
                        "bg-cb-gray-200 text-cb-black",
                    ].join(" ")}
                  >
                    {ROLE_LABELS[user.userType]}
                  </span>
                )}
              {/* Your own badge opens the thank-you variant of the explainer. */}
              <AmbassadorBadge
                ambassador={user.ambassador}
                isSelf
                myName={user.name}
                className="!text-[10.5px]"
              />
              {/* Mobile never passes the host badge, so a host shows none at
                  all. Web fills that gap. */}
              {user.userType === "HOST" && (
                <span className="rounded-full bg-cb-green px-2 py-0.5 font-body text-[10.5px] font-bold uppercase tracking-wide text-cb-black">
                  {t("app.profile.hostBadge")}
                </span>
              )}
            </div>
            {user.goal?.name && (
              <p className="mt-0.5 font-body text-[13.5px] text-cb-gray-500">
                {user.goal.name}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void changeAvatar(e.target.files?.[0])}
            />
            <Button
              size="sm"
              variant="secondary"
              loading={avatarBusy}
              onClick={() => avatarInputRef.current?.click()}
            >
              {t("app.profile.changePhoto")}
            </Button>
            {user.userProfilePicId && !avatarBusy && (
              <button
                type="button"
                onClick={clearAvatar}
                className="font-body text-[12px] text-cb-gray-500 underline-offset-2 hover:text-cb-danger hover:underline"
              >
                {t("app.profile.removePhoto")}
              </button>
            )}
          </div>
        </div>

        {/* Buddy ID */}
        <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-cb-gray-100 px-4 py-3">
          <div className="min-w-0">
            <p className="font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-cb-gray-600">
              {t("app.profile.buddyId")}
            </p>
            <p className="truncate font-body text-[15px] text-cb-black">
              {user.buddyId || t("app.profile.noBuddyId")}
            </p>
          </div>
          <Link href="/profile/buddy-id" className="shrink-0">
            <Button size="sm" variant="secondary" disabled={!user.buddyId}>
              {t("app.profile.viewCode")}
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Host-only ── */}
      {sections.manageLives && (
        <section className="mt-6">
          <h2 className="mb-2.5 font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-cb-black">
            {t("app.profile.hostTools")}
          </h2>
          <ActionCard
            href="/profile/lives"
            title={t("app.profile.manageLives")}
            hint={t("app.profile.manageLivesHint")}
            icon={
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="2" />
                <path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5" />
              </svg>
            }
          />
        </section>
      )}

      {/* ── My info ── */}
      <section className="mt-6">
        <h2 className="mb-2.5 font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-cb-black">
          {t("app.profile.editMyInfo")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <SectionCard
            href="/profile/personal"
            title={t("app.profile.personal")}
            hint={t("app.profile.personalHint")}
            progress={personalInformationProgress(user)}
          />
          {sections.ownMedical && (
            <SectionCard
              href="/profile/medical"
              title={t("app.profile.medical")}
              hint={t("app.profile.medicalHint")}
              progress={medicalInformationProgress(user, user.userType)}
            />
          )}
          <SectionCard
            href="/profile/photos"
            title={t("app.profile.photos")}
            hint={t("app.profile.photosHint")}
            progress={galleryProgress(gallery)}
          />
          <SectionCard
            href="/profile/interests"
            title={t("app.profile.interests")}
            hint={t("app.profile.interestsHint")}
            progress={interestProgress(interests)}
          />
        </div>
      </section>

      {/* ── Caregiver-only: the person they care for ── */}
      {sections.patientInfo && (
        <section className="mt-6">
          <h2 className="mb-2.5 font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-cb-black">
            {t("app.profile.editPatientInfo")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <SectionCard
              href="/profile/patient"
              title={t("app.profile.personal")}
              hint={t("app.profile.patientPersonalHint")}
              progress={caregiverPersonalInformationProgress(user)}
            />
            <SectionCard
              href="/profile/medical"
              title={t("app.profile.medical")}
              hint={t("app.profile.patientMedicalHint")}
              progress={medicalInformationProgress(user, user.userType)}
            />
          </div>
        </section>
      )}

      {/* ── Goal + journal ── */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <div>
          <h2 className="mb-2.5 font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-cb-black">
            {t("app.profile.imHereTo")}
          </h2>
          <ActionCard
            href="/profile/goal"
            title={user.goal?.name || t("app.profile.selectGoal")}
            icon={
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="12" cy="12" r="1.5" />
              </svg>
            }
          />
        </div>

        <div>
          <h2 className="mb-2.5 font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-cb-black">
            {t("app.profile.myJournal")}
          </h2>
          <ActionCard
            href="/profile/journal"
            title={t("app.profile.addEntry")}
            hint={t("app.profile.journalHint")}
            icon={
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            }
          />
        </div>
      </section>
    </div>
  );
}
