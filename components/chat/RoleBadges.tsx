import { BadgeCheck, Award } from "lucide-react";
import { t } from "@/lib/i18n";
import type { ContactProfile } from "@/lib/chat/contactProfile";

/**
 * Role indicators shown next to a contact's name — mirrors the mobile chat
 * list/header: Support (verified check), Ambassador (award), Host (green pill).
 */
export default function RoleBadges({ profile }: { profile: ContactProfile | null }) {
  if (!profile) return null;
  return (
    <>
      {profile.isSupport && (
        <BadgeCheck
          className="h-4 w-4 shrink-0 text-sky-500"
          aria-label={t("app.chat.verified")}
        />
      )}
      {profile.isAmbassador && (
        <Award
          className="h-4 w-4 shrink-0 text-amber-500"
          aria-label={t("app.chat.ambassador")}
        />
      )}
      {profile.isHost && (
        <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
          {t("app.chat.host")}
        </span>
      )}
    </>
  );
}
