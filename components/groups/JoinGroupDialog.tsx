"use client";

/**
 * Joining a group.
 *
 * Public groups join on one click. Private ones need the group's code first —
 * the same gate mobile puts behind its "private group" modal. The code is
 * compared client-side against the value on the group record, which is exactly
 * what mobile does; it's a friction gate for discovery, not an access control,
 * and treating it as more than that here would misrepresent it.
 */

import { useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui";
import GroupAvatar from "@/components/groups/GroupAvatar";
import { useGroups } from "@/lib/groups/GroupsProvider";
import { joinGroup } from "@/lib/groups/membership";
import type { Group } from "@/lib/groups/types";

export default function JoinGroupDialog({
  group,
  onClose,
  onJoined,
}: {
  group: Group;
  onClose: () => void;
  onJoined: () => void | Promise<void>;
}) {
  const { requireFeedSession, addJoinedGroup } = useGroups();

  const needsCode = !group.isPublic && !!group.code;
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (needsCode && code.trim().toUpperCase() !== (group.code ?? "").toUpperCase()) {
      setCodeError(true);
      return;
    }

    setBusy(true);
    try {
      const session = await requireFeedSession();
      await joinGroup({ session, groupId: group.id });
      addJoinedGroup({ ...group, muted: false });
      toast.success(t("app.groups.joinedToast", { name: group.name }));
      await onJoined();
    } catch (err) {
      console.error("[groups] join failed:", err);
      toast.error(t("app.groups.joinError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      title={needsCode ? t("app.groups.codeTitle") : group.name}
      subtitle={needsCode ? t("app.groups.codeSub") : undefined}
      onClose={onClose}
      footer={
        <Button
          fullWidth
          onClick={join}
          loading={busy}
          disabled={needsCode && !code.trim()}
        >
          {needsCode ? t("app.groups.codeSubmit") : t("app.groups.join")}
        </Button>
      }
    >
      <div className="px-5 pb-6">
        <div className="flex items-center gap-4">
          <GroupAvatar
            name={group.name}
            imageUrl={group.profilePicUrl}
            verified={group.verified}
            size={64}
          />
          <div className="min-w-0">
            <p className="font-heading text-[16px] font-bold text-cb-black">
              {group.name}
            </p>
            {group.sponsor?.name && (
              <p className="font-body text-[13px] text-cb-gray-500">
                {t("app.groups.hostedBy", { sponsor: group.sponsor.name })}
              </p>
            )}
          </div>
        </div>

        {(group.about || group.description) && (
          <p className="mt-4 whitespace-pre-line font-body text-[14.5px] leading-relaxed text-cb-black">
            {group.about || group.description}
          </p>
        )}

        {needsCode && (
          <div className="mt-5">
            <label
              htmlFor="group-code"
              className="mb-2 block font-body text-[11px] font-bold uppercase tracking-[0.14em] text-cb-gray-500"
            >
              {t("app.groups.codeLabel")}
            </label>
            <input
              id="group-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void join();
              }}
              placeholder={t("app.groups.codePlaceholder")}
              autoComplete="off"
              className={[
                "h-12 w-full rounded-xl border-[1.5px] bg-white px-4 font-body text-[15px] text-cb-black outline-none transition-colors",
                codeError
                  ? "border-cb-danger"
                  : "border-cb-gray-300 hover:border-cb-gray-400 focus:border-cb-black",
              ].join(" ")}
            />
            {codeError && (
              <p role="alert" className="mt-2 font-body text-[13px] text-cb-danger">
                {t("app.groups.codeWrong")}
              </p>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
