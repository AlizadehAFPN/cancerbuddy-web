"use client";

/**
 * Live input level for the microphone, 0–1.
 *
 * Only used on the pre-join screen, and it earns its place there: "is my
 * microphone actually working?" is unanswerable on a phone but trivial in a
 * browser, and finding out after joining is how people spend the first two
 * minutes of a session saying "can you hear me".
 *
 * The `AudioContext` is created and closed with the track. Chrome caps a page
 * at a handful of contexts, so leaking one per pre-join would eventually stop
 * audio working entirely.
 */

import { useEffect, useState } from "react";
import type { LocalAudioTrack } from "twilio-video";

export function useAudioLevel(track: LocalAudioTrack | null): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!track) return;

    const AudioContextCtor =
      typeof window !== "undefined"
        ? window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        : undefined;
    if (!AudioContextCtor) return;

    let context: AudioContext;
    try {
      context = new AudioContextCtor();
    } catch {
      return;
    }

    const stream = new MediaStream([track.mediaStreamTrack]);
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);

    const samples = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      analyser.getByteFrequencyData(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
      const rms = Math.sqrt(sum / samples.length) / 255;
      /* Speech sits low on a linear scale; the curve makes normal talking fill
         most of the meter instead of a twitch at the bottom. */
      setLevel(Math.min(1, rms * 2.6));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {
        /* already torn down */
      }
      void context.close().catch(() => {});
      setLevel(0);
    };
  }, [track]);

  /* With no track there is nothing to measure — reported as silence rather
     than resetting state from the effect. */
  return track ? level : 0;
}
