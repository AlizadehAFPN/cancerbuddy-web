"use client";

/**
 * Audio playback for every remote participant.
 *
 * Video elements in the grid are muted, so all sound comes from these hidden
 * `<audio>` elements — one per participant, which is what lets a chosen output
 * device (`setSinkId`) apply to the whole room at once.
 *
 * Two things can silence a browser call and neither is obvious to the person
 * it happens to, so both are handled here: an autoplay block (reported upward
 * so the room can offer a one-tap unblock) and an output device that has been
 * unplugged (`setSinkId` rejects; the element falls back to the default).
 */

import { useEffect, useRef } from "react";
import type { RemoteAudioTrack } from "twilio-video";
import type { RemoteMedia } from "@/lib/live/types";

function RemoteAudioTrackElement({
  track,
  speakerId,
  onBlocked,
}: {
  track: RemoteAudioTrack;
  speakerId?: string;
  onBlocked: () => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);

  /**
   * Held in a ref and kept out of the attach effect's dependencies. A caller
   * passing an inline arrow would otherwise give this a new identity every
   * render, and re-attaching a live audio track on each one is audible.
   */
  const onBlockedRef = useRef(onBlocked);
  useEffect(() => {
    onBlockedRef.current = onBlocked;
  }, [onBlocked]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    track.attach(element);
    /* Attaching does not always start playback — Safari in particular waits
       for an explicit play() and rejects it without a user gesture. */
    void element.play().catch(() => onBlockedRef.current());
    return () => {
      track.detach(element);
      element.srcObject = null;
    };
  }, [track]);

  useEffect(() => {
    const element = ref.current;
    /* `setSinkId` is typed as always present but is Chromium-only at runtime. */
    if (!element || !speakerId || typeof element.setSinkId !== "function") return;
    void element.setSinkId(speakerId).catch(() => {
      /* Device gone; the browser keeps using the system default. */
    });
  }, [speakerId]);

  return <audio ref={ref} autoPlay playsInline />;
}

export default function RemoteAudio({
  remotes,
  speakerId,
  onBlocked,
}: {
  remotes: RemoteMedia[];
  speakerId?: string;
  onBlocked: () => void;
}) {
  return (
    <div aria-hidden className="hidden">
      {remotes.map((remote) =>
        remote.audioTrack ? (
          <RemoteAudioTrackElement
            key={`${remote.sid}-audio`}
            track={remote.audioTrack}
            speakerId={speakerId}
            onBlocked={onBlocked}
          />
        ) : null,
      )}
    </div>
  );
}
