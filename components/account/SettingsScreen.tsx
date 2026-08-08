"use client";

/**
 * The settings surface, and the guard that keeps hosts out of it.
 *
 * Everything below the notification card is member-only: snooze has no meaning
 * for an account that never appears in discovery, status changes are a
 * patient/survivor/caregiver concept, and a host account is provisioned by the
 * foundation rather than owned by the person using it. Mobile never mounts this
 * stack for one; hiding the menu row alone would leave a typed URL working.
 */

import Link from "next/link";

import { t } from "@/lib/i18n";
import { useAccount } from "@/lib/account/AccountProvider";
import { buildIdentification } from "@/lib/account/buildInfo";
import SnoozeCard from "@/components/account/SnoozeCard";

const MEMBER_TYPES = ["PATIENT", "SURVIVOR", "CAREGIVER"];

function Row({
  href,
  title,
  body,
  danger,
}: {
  href: string;
  title: string;
  body: string;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-2xl border border-cb-gray-200 bg-white p-5 transition-colors hover:bg-cb-gray-100/60"
    >
      <span className="min-w-0">
        <span
          className={[
            "block font-heading text-[16px] font-bold",
            danger ? "text-cb-danger" : "text-cb-black",
          ].join(" ")}
        >
          {title}
        </span>
        <span className="mt-1 block font-body text-[14px] leading-relaxed text-cb-gray-600">
          {body}
        </span>
      </span>
      <span aria-hidden className="shrink-0 text-cb-gray-400">
        →
      </span>
    </Link>
  );
}

export default function SettingsScreen({
  notifications,
}: {
  /** Rendered from the server page so the push card keeps its own boundary. */
  notifications: React.ReactNode;
}) {
  const { userType, loaded } = useAccount();
  const isMember = !!userType && MEMBER_TYPES.includes(userType);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <h1 className="font-heading text-2xl font-bold text-cb-black">
        {t("app.screens.settingsTitle")}
      </h1>
      <p className="mt-1 font-body text-cb-gray-500">
        {t("app.screens.settingsBody")}
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {notifications}

        {/* Withheld until the account type is known, so a slow read cannot
            flash member-only controls at a host. */}
        {loaded && isMember && (
          <>
            <SnoozeCard />
            <Row
              href="/settings/change-status"
              title={t("app.settings.changeStatusTitle")}
              body={t("app.settings.changeStatusBody")}
            />
            <Row
              href="/settings/delete-account"
              title={t("app.settings.deleteTitle")}
              body={t("app.settings.deleteBody")}
              danger
            />
          </>
        )}
      </div>

      {/* What support asks for first. */}
      <p
        data-testid="build-version"
        className="mt-8 text-center font-body text-[12px] text-cb-gray-400"
      >
        {buildIdentification()}
      </p>
    </div>
  );
}
