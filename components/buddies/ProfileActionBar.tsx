"use client";

/**
 * The bar pinned to the bottom of `/buddies/[userId]`.
 *
 * Lifted out of the profile screen because four Phase 4 items all rewrite the
 * same render predicate, and because what it shows is a decision tree rather
 * than a layout: Connect while there is no relationship, **Pending** with an
 * explanation and a two-step cancel once an invite is out, Chat once accepted,
 * and Maybe later when you arrived from that person's own request.
 *
 * The web version keeps two additions mobile does not have — Previous and the
 * "3 of 128" position indicator — because paging is a mouse-and-keyboard
 * affordance and losing your place in a list of 128 people is worse here.
 */

import { useState } from "react";

import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { ArrowLeftIcon, ChevronRightIcon } from "@/components/buddies/controls";
import { Sheet } from "@/components/ui/Sheet";
import type { ConnectionEntry } from "@/lib/buddies/types";

export interface ProfileActionBarProps {
  /** Null until the connection map has loaded — the bar shows a placeholder. */
  connection?: ConnectionEntry | null;
  connectionsLoaded: boolean;
  /**
   * False when a *new* invite is not allowed: the target is snoozed, outside the
   * viewer's age bracket, or the caller said so (`?connect=0`). An existing
   * pending or accepted connection still shows its own control.
   */
  canConnect: boolean;
  /** Present when the profile was opened from that person's buddy request. */
  incomingConnectionId?: string | null;
  name: string;
  busy: boolean;
  openingChat: boolean;
  cancelling: boolean;
  decliningRequest: boolean;
  onConnect: () => void;
  onOpenChat: () => void;
  onCancelRequest: () => void;
  onMaybeLater: () => void;
  previousId?: string;
  nextId?: string;
  onPrevious: () => void;
  onNext: () => void;
}

/**
 * Mobile's `ModalPendingConnection`: an informational step, then a confirmation.
 *
 * The first dialog is not a confirmation — it explains what "Pending" means and
 * offers GOT IT. Only CANCEL REQUEST opens the second, and only the second
 * deletes anything. Web withdrew the invite on a single click, with no warning
 * and no undo.
 */
function PendingDialogs({
  name,
  busy,
  onClose,
  onConfirm,
}: {
  name: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <Sheet
        open
        title={t("app.buddies.pendingCancelTitle")}
        onClose={onClose}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={onClose} disabled={busy}>
              {t("app.buddies.cancel")}
            </Button>
            <Button fullWidth onClick={onConfirm} loading={busy}>
              {t("app.buddies.pendingCancelYes")}
            </Button>
          </div>
        }
      >
        <p className="px-5 pb-6 font-body text-[15px] leading-relaxed text-cb-black">
          {t("app.buddies.pendingCancelBody")}
        </p>
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      title={t("app.buddies.pendingModalTitle")}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <Button fullWidth onClick={onClose}>
            {t("app.buddies.pendingGotIt")}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setConfirming(true)}>
            {t("app.buddies.pendingCancelRequest")}
          </Button>
        </div>
      }
    >
      <p className="px-5 pb-6 font-body text-[15px] leading-relaxed text-cb-black">
        {t("app.buddies.pendingModalBody", { name })}
      </p>
    </Sheet>
  );
}

function InfoIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5v.01" />
    </svg>
  );
}

export default function ProfileActionBar(props: ProfileActionBarProps) {
  const [pendingOpen, setPendingOpen] = useState(false);
  const {
    connection,
    connectionsLoaded,
    canConnect,
    incomingConnectionId,
    name,
  } = props;

  const isPending = connection?.status === "pending";
  const isConnected = connection?.status === "connected";

  /** The primary slot. Empty when a new invite is not allowed. */
  const primary = !connectionsLoaded ? (
    <div className="h-11 animate-pulse rounded-full bg-cb-gray-100" />
  ) : isConnected ? (
    <Button fullWidth loading={props.openingChat} onClick={props.onOpenChat}>
      {t("app.buddies.chatWithBuddy")}
    </Button>
  ) : isPending ? (
    /* Mobile's Pending button carries an info affordance and opens the
       explanation — it is not a withdraw button. */
    <Button
      fullWidth
      variant="secondary"
      onClick={() => setPendingOpen(true)}
      aria-haspopup="dialog"
    >
      <span className="flex items-center justify-center gap-1.5">
        {t("app.buddies.pending")}
        <InfoIcon />
      </span>
    </Button>
  ) : canConnect ? (
    <Button fullWidth onClick={props.onConnect} loading={props.busy}>
      {t("app.buddies.connect")}
    </Button>
  ) : null;

  /**
   * "Maybe later" declines *their* request. It only exists when this profile
   * was opened from a request card, which is the only context where the viewer
   * holds the incoming connection's id.
   */
  const showMaybeLater = !!incomingConnectionId && !isConnected;

  const hasNeighbours = !!(props.previousId || props.nextId);
  if (!primary && !showMaybeLater && !hasNeighbours) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-cb-gray-200 bg-white/95 px-4 pb-3 pt-3 backdrop-blur lg:bottom-0 lg:left-64 lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {primary && <div className="flex-1">{primary}</div>}

          {showMaybeLater && (
            <div className={primary ? "shrink-0" : "flex-1"}>
              <Button
                variant="secondary"
                fullWidth
                onClick={props.onMaybeLater}
                loading={props.decliningRequest}
              >
                {t("app.buddies.maybeLaterFromProfile")}
              </Button>
            </div>
          )}

          {hasNeighbours && (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={!props.previousId}
                onClick={props.onPrevious}
                aria-label={t("app.buddies.previousBuddy")}
                className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-cb-black text-cb-black transition-colors hover:bg-cb-gray-100 disabled:cursor-not-allowed disabled:border-cb-gray-200 disabled:text-cb-gray-300"
              >
                <ArrowLeftIcon />
              </button>
              <button
                type="button"
                disabled={!props.nextId}
                onClick={props.onNext}
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

      {pendingOpen && (
        <PendingDialogs
          name={name}
          busy={props.cancelling}
          onClose={() => setPendingOpen(false)}
          onConfirm={() => {
            setPendingOpen(false);
            props.onCancelRequest();
          }}
        />
      )}
    </>
  );
}
