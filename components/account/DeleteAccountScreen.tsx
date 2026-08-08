"use client";

/**
 * "Delete my account."
 *
 * Irreversible, so the flow is deliberately slow: a reason must be chosen, and
 * "Other" must be typed into, before the button is live at all; then a
 * confirmation dialog states plainly what is lost. Nothing is deleted until the
 * dialog's single destructive button is pressed.
 *
 * Two corrections to mobile's version, both recorded in the worklist's triage
 * notes as bugs rather than behaviour to copy:
 *
 *  • the reason is recorded **first**, while the session is still valid — mobile
 *    records it after clearing the session, so it is silently lost
 *  • the success screen is reached **only** when the delete succeeded — mobile
 *    navigates regardless, telling a member their account is gone when it is not
 */

import { useState } from "react";
import { toast } from "sonner";

import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import { useAccount } from "@/lib/account/AccountProvider";
import { useStreamChat } from "@/lib/chat/StreamChatProvider";
import { finishSignedOutFlow } from "@/lib/account/finishSignedOutFlow";
import {
  DELETION_REASONS,
  OTHER_DELETION_MAX_CHARS,
  OTHER_DELETION_REASON,
  deleteAccount,
  deleteSubmitDisabled,
  deletionReasonValue,
  type DeleteChatClient,
} from "@/lib/account/deleteAccount";

export default function DeleteAccountScreen() {
  const { userId, name } = useAccount();
  const { client } = useStreamChat();

  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const disabled = deleteSubmitDisabled({ reason, detail });

  const runDelete = async () => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      await deleteAccount({
        userId,
        name: name ?? "",
        reason: deletionReasonValue({ reason, detail }),
        client: client as unknown as DeleteChatClient | null,
      });
      setConfirming(false);
      setDeleted(true);
    } catch (err) {
      // The account still exists. Say so, and leave the member signed in.
      console.error("[settings] account deletion failed:", err);
      toast.error(t("app.settings.deleteError"));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  /* The success screen — mobile's `DeleteAccountSuccess`. The session is only
     dropped when the member leaves it, so the app behind is never a shell
     rendering an account that no longer exists. */
  if (deleted) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <span
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded-full bg-cb-green text-[28px]"
        >
          ✓
        </span>
        <h1 className="font-heading text-[20px] font-bold text-cb-black">
          {t("app.settings.deletedTitle")}
        </h1>
        <p className="font-body text-[14.5px] leading-relaxed text-cb-gray-600">
          {t("app.settings.deletedBody")}
        </p>
        <div className="mt-2 w-full">
          <Button fullWidth onClick={() => void finishSignedOutFlow()}>
            {t("app.settings.deletedGotIt")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <h1 className="font-heading text-2xl font-bold text-cb-black">
        {t("app.settings.deleteHeading")}
      </h1>
      <p className="mt-1.5 font-body text-[14.5px] leading-relaxed text-cb-gray-600">
        {t("app.settings.deletePrompt")}
      </p>

      <div className="mt-6 rounded-2xl border border-cb-gray-200 bg-white px-5">
        {DELETION_REASONS.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-3 border-b border-cb-gray-100 py-3.5 last:border-0"
          >
            <span
              className={[
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                reason === option ? "border-cb-black" : "border-cb-gray-300",
              ].join(" ")}
            >
              {reason === option && (
                <span className="h-2.5 w-2.5 rounded-full bg-cb-black" />
              )}
            </span>
            <input
              type="radio"
              name="delete-reason"
              checked={reason === option}
              onChange={() => setReason(option)}
              className="sr-only"
            />
            <span className="font-body text-[15px] text-cb-black">{option}</span>
          </label>
        ))}
      </div>

      {reason === OTHER_DELETION_REASON && (
        <div className="mt-4">
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={4}
            maxLength={OTHER_DELETION_MAX_CHARS}
            autoFocus
            placeholder={t("app.settings.deleteOtherPlaceholder")}
            className="w-full resize-none rounded-xl border-[1.5px] border-cb-gray-300 bg-white px-3.5 py-2.5 font-body text-[14.5px] text-cb-black outline-none transition-colors placeholder:text-cb-gray-400 focus:border-cb-black"
          />
          <p className="mt-1 font-body text-[12px] text-cb-gray-500">
            {t("app.settings.deleteOtherHint")}
          </p>
        </div>
      )}

      <div className="mt-6">
        <Button
          fullWidth
          disabled={disabled}
          onClick={() => setConfirming(true)}
          className="!border-cb-danger !bg-cb-danger"
        >
          {t("app.settings.deleteSubmit")}
        </Button>
      </div>

      {confirming && (
        <Sheet
          open
          title={t("app.settings.deleteConfirmTitle")}
          onClose={() => (busy ? undefined : setConfirming(false))}
          footer={
            <div className="flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                disabled={busy}
                onClick={() => setConfirming(false)}
              >
                {t("app.settings.cancel")}
              </Button>
              <Button
                fullWidth
                loading={busy}
                onClick={() => void runDelete()}
                className="!border-cb-danger !bg-cb-danger"
              >
                {t("app.settings.deleteConfirmYes")}
              </Button>
            </div>
          }
        >
          <p className="px-5 pb-6 font-body text-[15px] leading-relaxed text-cb-black">
            {t("app.settings.deleteConfirmBody")}
          </p>
        </Sheet>
      )}
    </div>
  );
}
