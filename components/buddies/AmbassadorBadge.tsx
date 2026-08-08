"use client";

/**
 * The AMBASSADOR pill, and the explainer behind it.
 *
 * On mobile every ambassador badge is tappable and opens `ModalAmbassador`:
 * what an ambassador is, a link to the "Become an ambassador" form, and a
 * "learn more" that starts a support conversation about it. On web the pill was
 * a static `<span>` on four surfaces, so the entire programme was invisible to
 * anyone who had not already been told about it.
 *
 * Your own badge gets the other half of mobile's modal: a thank-you and DISMISS,
 * with no form link — you are already one.
 */

import { useState } from "react";

import { t } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import { useAmbassadorChat } from "@/lib/buddies/useAmbassadorModal";

/**
 * Mobile's link, verbatim (`ModalAmbassador.tsx:78-79`). A Google Form, not a
 * page we own — hence the explicit `noopener`.
 */
export const AMBASSADOR_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScmZ6br0nKbW9980SQM6qDAAihw0akZceawkAa28ftJrc7Dxg/viewform?pli=1";

export function AmbassadorModal({
  isSelf,
  myName,
  onClose,
}: {
  /** Your own profile shows the thank-you variant. */
  isSelf: boolean;
  myName?: string | null;
  onClose: () => void;
}) {
  const { learnMore, busy } = useAmbassadorChat();

  return (
    <Sheet open title={t("app.buddies.ambassadorTitle")} onClose={onClose}>
      <div className="px-5 pb-5">
        <p className="font-body text-[15px] leading-relaxed text-cb-black">
          {t(isSelf ? "app.buddies.ambassadorThanks" : "app.buddies.ambassadorAbout")}
        </p>

        <div className="mt-6 space-y-2.5">
          {isSelf ? (
            <Button fullWidth onClick={onClose}>
              {t("app.buddies.ambassadorDismiss")}
            </Button>
          ) : (
            <>
              <a
                href={AMBASSADOR_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex h-12 w-full items-center justify-center rounded-full border-2 border-cb-black bg-cb-black px-5 font-heading text-[15px] font-bold text-white transition-colors hover:bg-cb-gray-800"
              >
                {t("app.buddies.ambassadorBecome")}
              </a>
              <Button
                fullWidth
                variant="secondary"
                loading={busy}
                onClick={() => void learnMore(myName)}
              >
                {t("app.buddies.ambassadorLearnMore")}
              </Button>
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/**
 * The pill itself. Renders nothing when the person is not an ambassador, so
 * every call site can drop its own conditional.
 */
export default function AmbassadorBadge({
  ambassador,
  isSelf = false,
  myName,
  className,
}: {
  ambassador?: boolean | null;
  isSelf?: boolean;
  myName?: string | null;
  /** Sizing differs per surface (card, row, profile header); styling does not. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!ambassador) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // Discovery cards wrap the whole row in a stretched link.
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-haspopup="dialog"
        className={[
          "relative z-10 rounded-full bg-cb-bone px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wide text-cb-black transition-colors hover:bg-cb-yellow",
          className ?? "",
        ].join(" ")}
      >
        {t("app.buddies.ambassador")}
      </button>

      {open && (
        <AmbassadorModal
          isSelf={isSelf}
          myName={myName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
