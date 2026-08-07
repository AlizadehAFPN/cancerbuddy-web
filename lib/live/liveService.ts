/**
 * The four Lambda calls a live room makes, ported 1:1 from
 * `cancerbuddyapp/src/services/streaming/twilio-video.ts`.
 *
 * All of them go through `raiseUserLambda`, so the payloads are literally the
 * same JSON the phone sends. That matters more than it looks: the token Lambda
 * is what decides who is a host and who is blocked, and the moderation Lambda
 * is what broadcasts a mute or a removal to every other client. Diverging here
 * would give web users a different room than phone users in the same session.
 *
 * The Lambdas double-encode their responses often enough that every reply is
 * unwrapped defensively before its `statusCode` is read.
 */

import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import type { ModerationAction, TwilioTokenResponse } from "@/lib/live/types";

function usersLambdaName(): string {
  const name = process.env.NEXT_PUBLIC_USERS_LAMBDA?.trim();
  if (!name) throw new Error("NEXT_PUBLIC_USERS_LAMBDA is not set.");
  return name;
}

function notificationsLambdaName(): string {
  const name = process.env.NEXT_PUBLIC_NOTIFICATIONS_LAMBDA?.trim();
  if (!name) throw new Error("NEXT_PUBLIC_NOTIFICATIONS_LAMBDA is not set.");
  return name;
}

/**
 * Lambda replies arrive as a JSON string; some handlers `JSON.stringify` an
 * already-stringified body, so unwrap up to three times before giving up.
 */
/**
 * A refusal from a live Lambda, carrying the status it refused with.
 *
 * The distinction that matters to callers is 4xx vs anything else: a 4xx is a
 * decision (the session ended, you're blocked, you're not a host) and retrying
 * it will fail the same way, so the UI must not offer a retry. A 5xx or a
 * transport failure is worth trying again.
 */
export class LiveServiceError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "LiveServiceError";
    this.statusCode = statusCode;
  }

  /** True when trying again cannot change the outcome. */
  get terminal(): boolean {
    return (
      typeof this.statusCode === "number" &&
      this.statusCode >= 400 &&
      this.statusCode < 500
    );
  }
}

function unwrap(raw: unknown): Record<string, unknown> {
  let value: unknown = raw;
  for (let i = 0; i < 3 && typeof value === "string"; i += 1) {
    try {
      value = JSON.parse(value);
    } catch {
      throw new Error("The live service returned an unreadable response.");
    }
  }
  if (!value || typeof value !== "object") {
    throw new Error("The live service returned an unreadable response.");
  }
  return value as Record<string, unknown>;
}

function assertOk(body: Record<string, unknown>, fallback: string): void {
  const status = body.statusCode;
  if (typeof status === "number" && status >= 400) {
    const message = typeof body.message === "string" ? body.message : fallback;
    throw new LiveServiceError(message, status);
  }
}

/**
 * Mints the room token.
 *
 * `identity` is the display name; the Lambda combines it with the user id into
 * the composite identity every client parses (see `identity.ts`). The reply
 * also carries `isHost` and the group's `hostIds`, which is the only
 * authoritative source for those — a client must never decide it is a host.
 *
 * A blocked user gets `statusCode: 403` with a message meant to be shown.
 */
export async function fetchTwilioToken(params: {
  userId: string;
  roomName: string;
  identity: string;
  groupId?: string;
  eventId: string;
}): Promise<TwilioTokenResponse> {
  const raw = await raiseUserLambda(
    LambdaPayloadType.GET_TWILIO_TOKEN,
    usersLambdaName(),
    {
      userId: params.userId,
      roomName: params.roomName,
      identity: params.identity,
      groupId: params.groupId,
      eventId: params.eventId,
    },
  );

  const body = unwrap(raw);
  assertOk(body, "We couldn't get you into this session. Please try again.");

  const token = body.token;
  if (typeof token !== "string" || !token) {
    throw new Error("The live service didn't return a video token.");
  }

  return {
    token,
    roomName:
      typeof body.roomName === "string" ? body.roomName : params.roomName,
    identity:
      typeof body.identity === "string" ? body.identity : params.identity,
    isHost: body.isHost === true,
    hostIds: Array.isArray(body.hostIds)
      ? body.hostIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}

/**
 * Applies a moderation action to another participant.
 *
 * The Lambda is what actually enforces it — for `remove` and `block` it kicks
 * the participant out of the Twilio room server-side — and it also writes a
 * signal message onto the session's Stream channel so the target's own client
 * can react (drop its mic, show the notice, leave). See `useLiveChat`.
 */
export async function moderateParticipant(params: {
  userId: string;
  eventId: string;
  targetUserId: string;
  action: ModerationAction;
}): Promise<void> {
  const raw = await raiseUserLambda(
    LambdaPayloadType.MODERATE_LIVE,
    usersLambdaName(),
    {
      userId: params.userId,
      eventId: params.eventId,
      targetUserId: params.targetUserId,
      action: params.action,
    },
  );
  assertOk(unwrap(raw), "We couldn't apply that. Please try again.");
}

/** Host-only: ends the session for everyone. Not reversible. */
export async function endLiveSession(params: {
  userId: string;
  eventId: string;
}): Promise<void> {
  const raw = await raiseUserLambda(
    LambdaPayloadType.END_LIVE,
    usersLambdaName(),
    { userId: params.userId, eventId: params.eventId },
  );
  assertOk(unwrap(raw), "We couldn't end the session. Please try again.");
}

/** Host-only: notifies the group's members that the session has started. */
export async function notifyGroupLive(params: {
  hostId: string;
  hostName: string;
  groupId: string;
  groupName: string;
  eventId: string;
  eventTitle: string;
  chatChannelId: string;
}): Promise<void> {
  const raw = await raiseUserLambda(
    LambdaPayloadType.NOTIFY_GROUP_LIVE,
    notificationsLambdaName(),
    { ...params },
  );
  assertOk(unwrap(raw), "We couldn't send that notification. Please try again.");
}
