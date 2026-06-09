import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { t } from "@/lib/i18n";
import WelcomeSplash from "./WelcomeSplash";

export const metadata: Metadata = {
  title: t("metadata.landingTitle"),
  description: t("metadata.landingDescription"),
};

const shellPad = "px-6 sm:px-8 lg:px-12";

/* ─────────────────────────────────────────────────────────
   Inline nav icon components (no external icon library)
───────────────────────────────────────────────────────── */

function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className="w-6 h-6"
      aria-hidden
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
   Page — fills the viewport; document does not scroll.
   The yellow hero scrolls internally only if content overflows.
───────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="flex h-dvh max-h-dvh min-h-0 w-full flex-col overflow-hidden bg-white">
      {/* ════════════════════════════════════════════════
          NAVIGATION
      ════════════════════════════════════════════════ */}
      <header className="shrink-0 border-b border-cb-gray-200 bg-white">
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

          <button
            className="sm:hidden shrink-0 p-2 text-cb-black rounded-lg hover:bg-cb-gray-100 transition-colors"
            aria-label={t("common.openMenu")}
          >
            <MenuIcon />
          </button>
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
            className={`relative mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-y-auto overscroll-y-contain ${shellPad} py-4 sm:py-5 lg:py-6`}
          >
            <div className="grid min-h-0 w-full flex-1 grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10 xl:gap-14">
              {/* ── Left: Content ───────────────────────────── */}
              <div
                className="order-2 flex min-h-0 flex-col justify-center lg:order-1"
                style={{ animation: "hero-fade-up 0.65s ease-out both" }}
              >
                <div className="mb-4 inline-flex items-center gap-2.5 self-start sm:mb-5">
                  <span className=" mt-2 text-[11px] font-medium text-cb-gray-600 tracking-[0.12em] uppercase">
                    {t("common.poweredBy")}
                  </span>
                  <Image
                    src="/images/BMCF_LOGO_WIDE.svg"
                    alt={t("common.bmcfLogoAlt")}
                    width={88}
                    height={30}
                    className="object-contain"
                  />
                </div>

                <h1
                  className="font-heading font-bold text-cb-black tracking-tight leading-[1.06]"
                  style={{
                    fontSize: "clamp(1.85rem, 4.5vw + 0.5rem, 3.75rem)",
                  }}
                >
                  {t("landing.heroHeading")}
                </h1>

                <p
                  className="mt-3 max-w-xl font-body leading-relaxed text-cb-gray-700 sm:mt-4"
                  style={{
                    fontSize: "clamp(0.9375rem, 1.1vw + 0.65rem, 1.125rem)",
                  }}
                >
                  {t("landing.heroBody")}
                </p>

                <p className="mt-5 text-sm text-cb-gray-600 font-body sm:mt-6">
                  {t("landing.supportedBy")}{" "}
                  <span className="font-medium text-cb-black">
                    {t("common.bmcfName")}
                  </span>
                </p>

                {/* <p className="mt-3 text-sm text-cb-gray-600 font-body">
                  {t("landing.hostInviteLead")}{" "}
                  <Link
                    href="/become-a-host"
                    className="font-medium text-cb-black underline underline-offset-2 hover:text-cb-gray-700 transition-colors"
                  >
                    {t("landing.hostInviteCta")}
                  </Link>
                </p> */}
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
