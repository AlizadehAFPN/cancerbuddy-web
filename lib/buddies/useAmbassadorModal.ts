"use client";

/**
 * The ambassador explainer's "learn more" — starting a support conversation
 * about becoming one.
 *
 * Mobile's `ModalAmbassador.sendMessageDirect` (`ModalAmbassador.tsx:28-47`):
 *
 *   createSupportConnection → who is my support contact
 *     → find (or create) our 1:1 channel
 *     → tell the backend, so support sees why the conversation exists
 *     → open it
 *
 * The Lambda verb is `ambassadorMessage`, **not** `createAmbassadorMessage` —
 * the constant is named for the latter and the wire string is the former
 * (`lib/aws/lambdaPayload.ts:33-36`), which is exactly the sort of thing that
 * looks fine in review and fails in production.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { t } from "@/lib/i18n";
import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import { acceptConnection, createConnectionRequest } from "@/lib/buddies/connections";
import {
  askToHostChannelName,
  resolveOrCreateDirectChannel,
  type DirectChatClient,
} from "@/lib/chat/directChannel";
import { fetchSupportUserId } from "@/lib/host-signup/bootstrapSupportChannel";
import { useStreamChat } from "@/lib/chat/StreamChatProvider";

function usersLambdaName(): string {
  const v = process.env.NEXT_PUBLIC_USERS_LAMBDA?.trim();
  if (!v) throw new Error("NEXT_PUBLIC_USERS_LAMBDA is not set.");
  return v;
}

/**
 * Records that this conversation is an ambassador enquiry. Best-effort — the
 * channel is already open by the time it matters, and mobile swallows its
 * failure too (`useUserInfoShared.ts:50-64`).
 */
export async function notifyAmbassadorInterest(params: {
  userId: string;
  channelId: string;
}): Promise<void> {
  try {
    await raiseUserLambda(
      LambdaPayloadType.CREATE_AMBASSADOR_MESSAGE,
      usersLambdaName(),
      {
        userID: params.userId,
        channelID: params.channelId,
        type: LambdaPayloadType.CREATE_AMBASSADOR_MESSAGE,
      },
    );
  } catch (err) {
    console.error("[buddies] ambassador message notification failed:", err);
  }
}

export interface AmbassadorChat {
  busy: boolean;
  /** Opens (or creates) the support conversation and navigates to it. */
  learnMore: (myName?: string | null) => Promise<void>;
}

export function useAmbassadorChat(): AmbassadorChat {
  const router = useRouter();
  const { client, userId } = useStreamChat();
  const [busy, setBusy] = useState(false);

  const learnMore = useCallback(
    async (myName?: string | null) => {
      if (!client || !userId || busy) return;
      setBusy(true);
      try {
        const supportUserId = await fetchSupportUserId(userId);
        if (!supportUserId) {
          toast.error(t("app.buddies.ambassadorError"));
          return;
        }

        const channelId = await resolveOrCreateDirectChannel({
          client: client as unknown as DirectChatClient,
          me: userId,
          them: supportUserId,
          // Mobile names this channel after the *asker*, with the same
          // "Ambassador" suffix its ask-the-host channels get.
          name: askToHostChannelName(myName),
          createConnection: createConnectionRequest,
          acceptConnection,
        });
        if (!channelId) {
          toast.error(t("app.buddies.ambassadorError"));
          return;
        }

        await notifyAmbassadorInterest({ userId, channelId });
        router.push(`/chat/${channelId}`);
      } catch (err) {
        console.error("[buddies] ambassador chat failed:", err);
        toast.error(t("app.buddies.ambassadorError"));
      } finally {
        setBusy(false);
      }
    },
    [client, userId, busy, router],
  );

  return { busy, learnMore };
}
