"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { t } from "@/lib/i18n";

/* ─────────────────────────────────────────────────────────
   WelcomeSplash — web port of the mobile SplashScreenInitial.

   Replicates the mobile Animated.sequence on the right side:
     1. The logo drops in from the top to rest above center.
     2. The "Welcome! / Are you new here?" greeting slides in
        from the left.
     3. The No / Yes buttons rise from the bottom and fade in.

   Driven by a mounted flag + CSS transitions so the staged
   animation always plays (and re-plays on navigation).
───────────────────────────────────────────────────────── */

export default function WelcomeSplash() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Double rAF guarantees the browser paints the initial state
    // before we flip to the final state, so the transition runs.
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setShown(true))
    );
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="order-1 flex min-h-0 flex-col items-center justify-center gap-7 pb-10 sm:pb-14 lg:order-2 lg:gap-9 lg:pb-20">
      {/* 1 — Logo drops in from the top */}
      <div
        className="relative w-full max-w-[min(100%,420px)] transition-all duration-[800ms] ease-out lg:max-w-none"
        style={{
          transitionDelay: "0ms",
          opacity: shown ? 1 : 0,
          transform: shown ? "translateY(0)" : "translateY(-230px)",
        }}
      >
        <Image
          src="/images/welcome.png"
          alt={t("common.cancerBuddyCommunityIllustratedAlt")}
          width={540}
          height={600}
          priority
          className="mx-auto h-auto w-full object-contain max-h-[min(32vh,280px)] sm:max-h-[min(36vh,340px)] lg:max-h-[min(46vh,420px)]"
        />
      </div>

      {/* 2 — Greeting slides in from the left */}
      <div
        className="w-full max-w-[min(100%,420px)] px-1 transition-all duration-[700ms] ease-out"
        style={{
          transitionDelay: "400ms",
          opacity: shown ? 1 : 0,
          transform: shown ? "translateX(0)" : "translateX(-250px)",
        }}
      >
        <h2 className="font-heading text-3xl font-bold text-cb-black sm:text-4xl">
          {t("landing.splashGreeting")}
        </h2>
        <p className="mt-2 font-body text-lg text-cb-gray-700 sm:text-xl">
          {t("landing.splashQuestion")}
        </p>
      </div>

      {/* 3 — Buttons rise from the bottom */}
      <div
        className="flex w-full max-w-[min(100%,420px)] items-center gap-3 transition-all duration-[600ms] ease-out sm:gap-4"
        style={{
          transitionDelay: "700ms",
          opacity: shown ? 1 : 0,
          transform: shown ? "translateY(0)" : "translateY(60px)",
        }}
      >
        <Link
          href="/login"
          className="inline-flex h-12 flex-1 items-center justify-center rounded-full border-2 border-cb-black bg-transparent px-6 font-heading text-[0.9375rem] font-medium text-cb-black transition-colors hover:bg-black/5 active:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-offset-2 sm:h-[3.25rem] sm:text-base"
        >
          {t("common.no")}
        </Link>
        <Link
          href="/register"
          className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-cb-black px-6 font-heading text-[0.9375rem] font-medium text-white transition-colors hover:bg-cb-gray-800 active:bg-cb-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-offset-2 sm:h-[3.25rem] sm:text-base"
        >
          {t("common.yes")}
        </Link>
      </div>
    </div>
  );
}
