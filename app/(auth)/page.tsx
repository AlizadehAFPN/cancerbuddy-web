import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { t } from "@/lib/i18n";
import WelcomeSplash from "./WelcomeSplash";
import MobileMenu from "./MobileMenu";

export const metadata: Metadata = {
  title: t("metadata.landingTitle"),
  description: t("metadata.landingDescription"),
};

const shellPad = "px-6 sm:px-8 lg:px-12";

/* ─────────────────────────────────────────────────────────
   Page — fills the viewport; document does not scroll.
   The yellow hero scrolls internally only if content overflows.
───────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="flex h-dvh max-h-dvh min-h-0 w-full flex-col overflow-hidden bg-cb-yellow">
      {/* ════════════════════════════════════════════════
          NAVIGATION
      ════════════════════════════════════════════════ */}
      <header className="shrink-0 bg-cb-yellow">
        <nav
          className={`mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 sm:h-16 ${shellPad}`}
          aria-label={t("common.mainNavigation")}
        >
          <Link
            href="/"
            aria-label={t("common.cancerBuddyHome")}
            className="shrink-0"
          >
            <Image
              src="/images/trademark-logo.png"
              alt={t("common.cancerBuddyAlt")}
              width={185}
              height={25}
              className="object-contain"
              priority
            />
          </Link>

          <MobileMenu />
        </nav>
      </header>

      {/* ════════════════════════════════════════════════
          HERO — grows between header and footer
      ════════════════════════════════════════════════ */}
      <main className="flex min-h-0 flex-1 flex-col">
        <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-cb-yellow">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 70% 50%, #FEF9CA 0%, transparent 70%)",
            }}
          />

          <div
            className={`relative mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden ${shellPad} py-4 sm:py-5 lg:py-6`}
          >
            <div className="grid min-h-0 w-full flex-1 grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10 xl:gap-14">
              {/* ── Left: Content (hidden on mobile, shown on web) ──── */}
              <div
                className="order-2 hidden min-h-0 flex-col justify-center lg:order-1 lg:flex"
                style={{ animation: "hero-fade-up 0.65s ease-out both" }}
              >
                {/* Eyebrow — powered by */}
                <div className="mb-6 inline-flex items-center gap-2.5 self-start rounded-full bg-white/55 py-1.5 pe-4 ps-3.5 ring-1 ring-black/5 backdrop-blur-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cb-gray-600">
                    {t("common.poweredBy")}
                  </span>
                  <Image
                    src="/images/BMCF_LOGO_WIDE.svg"
                    alt={t("common.bmcfLogoAlt")}
                    width={84}
                    height={28}
                    className="object-contain"
                  />
                </div>

                <h1
                  className="font-heading font-bold text-cb-black tracking-tight leading-[1.03]"
                  style={{
                    fontSize: "clamp(2rem, 4vw + 0.5rem, 3.75rem)",
                  }}
                >
                  {t("landing.heroHeading")}
                </h1>

                <p
                  className="mt-5 max-w-lg font-body leading-relaxed text-cb-gray-700"
                  style={{
                    fontSize: "clamp(1rem, 0.7vw + 0.8rem, 1.1875rem)",
                  }}
                >
                  {t("landing.heroBody")}
                </p>

                {/* Supported-by — quiet footnote with a hairline accent */}
                <div className="mt-8 flex items-center gap-3 border-t border-cb-black/10 pt-5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-cb-black/70" aria-hidden />
                  <p className="font-body text-sm text-cb-gray-600">
                    {t("landing.supportedBy")}{" "}
                    <span className="font-medium text-cb-black">
                      {t("common.bmcfName")}
                    </span>
                  </p>
                </div>
              </div>

              {/* ── Right: Splash animation (mobile SplashScreen port) ── */}
              <WelcomeSplash />
            </div>
          </div>
        </section>
      </main>

      {/* ════════════════════════════════════════════════
          FOOTER — always visible at bottom of viewport
      ════════════════════════════════════════════════ */}
      <footer className="shrink-0 bg-cb-black text-white">
        <div
          className={`mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 py-3 sm:flex-row sm:gap-4 sm:py-3.5 ${shellPad}`}
        >
          <Image
            src="/images/trademark-logo.png"
            alt={t("common.cancerBuddyAlt")}
            width={150}
            height={20}
            className="object-contain brightness-0 invert"
          />
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-cb-gray-400 sm:text-sm">
            <Link
              href="/privacy"
              className="hover:text-white transition-colors"
            >
              {t("common.privacy")}
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              {t("common.terms")}
            </Link>
            <span>
              {t("common.copyright", { year: new Date().getFullYear() })}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
