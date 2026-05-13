import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CancerBuddy — Peer Support for Your Cancer Journey",
  description:
    "CancerBuddy connects cancer patients, caregivers, and survivors with real people who truly understand — for conversations, shared experiences, and genuine peer support.",
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

function ArrowRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
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
          aria-label="Main navigation"
        >
          <Link href="/" aria-label="CancerBuddy home" className="shrink-0">
            <Image
              src="/images/trademark-logo.png"
              alt="CancerBuddy"
              width={185}
              height={25}
              className="object-contain"
              priority
            />
          </Link>

          <div className="hidden sm:flex items-center gap-2">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-cb-gray-700 hover:text-cb-black transition-colors rounded-lg hover:bg-cb-gray-100"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cb-black text-white text-sm font-heading font-medium transition-colors hover:bg-cb-gray-800 active:bg-cb-gray-700"
            >
              Get started
              <ArrowRightIcon />
            </Link>
          </div>

          <button
            className="sm:hidden shrink-0 p-2 text-cb-black rounded-lg hover:bg-cb-gray-100 transition-colors"
            aria-label="Open menu"
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
                    Powered by
                  </span>
                  <Image
                    src="/images/bm-logo-transparent.png"
                    alt="Bone Marrow Cancer Foundation"
                    width={108}
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
                  You are not alone on this journey.
                </h1>

                <p
                  className="mt-3 max-w-xl font-body leading-relaxed text-cb-gray-700 sm:mt-4"
                  style={{
                    fontSize: "clamp(0.9375rem, 1.1vw + 0.65rem, 1.125rem)",
                  }}
                >
                  CancerBuddy connects patients, caregivers, and survivors for
                  real conversations and genuine peer support — from people who
                  truly understand.
                </p>

                <div className="mt-5 flex flex-wrap gap-3 sm:mt-6 sm:gap-4">
                  <Link
                    href="/signup"
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-cb-black px-6 font-heading text-[0.9375rem] font-medium text-white transition-colors hover:bg-cb-gray-800 active:bg-cb-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-offset-2 sm:h-[3.25rem] sm:px-8 sm:text-base"
                  >
                    Get started — it&apos;s free
                    <ArrowRightIcon />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex h-12 items-center gap-2 rounded-full border-2 border-cb-black bg-transparent px-6 font-heading text-[0.9375rem] font-medium text-cb-black transition-colors hover:bg-black/5 active:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-offset-2 sm:h-[3.25rem] sm:px-8 sm:text-base"
                  >
                    Sign in
                  </Link>
                </div>

                <p className="mt-4 text-sm text-cb-gray-600 font-body sm:mt-5">
                  Proudly supported by{" "}
                  <span className="font-medium text-cb-black">
                    Bone Marrow Cancer Foundation
                  </span>
                </p>

                <p className="mt-3 text-sm text-cb-gray-600 font-body">
                  Want to support others?{" "}
                  <Link
                    href="/hosts-register"
                    className="font-medium text-cb-black underline underline-offset-2 hover:text-cb-gray-700 transition-colors"
                  >
                    Register as a host →
                  </Link>
                </p>
              </div>

              {/* ── Right: Visual ───────────────────────────── */}
              <div
                className="order-1 flex min-h-0 justify-center lg:order-2 lg:justify-end"
                style={{ animation: "hero-fade-in 0.8s ease-out 0.15s both" }}
              >
                <div className="relative w-full max-w-[min(100%,420px)] lg:max-w-none">
                  <Image
                    src="/images/welcome.png"
                    alt="CancerBuddy community — illustrated"
                    width={540}
                    height={600}
                    priority
                    className="h-auto w-full object-contain max-h-[min(38vh,340px)] sm:max-h-[min(42vh,400px)] lg:max-h-[min(58vh,520px)]"
                  />
                </div>
              </div>
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
            alt="CancerBuddy"
            width={150}
            height={20}
            className="object-contain brightness-0 invert"
          />
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-cb-gray-400 sm:text-sm">
            <Link
              href="/privacy"
              className="hover:text-white transition-colors"
            >
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <span>© {new Date().getFullYear()} CancerBuddy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
