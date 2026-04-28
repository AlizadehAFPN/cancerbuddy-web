import Image from "next/image";
import Link from "next/link";
import { SupportForm } from "./_components/SupportForm";

/* ── Inline icon ── */

function ArrowLeftIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden
    >
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

/**
 * Standalone support page — same two-panel chrome as /login and /signup so
 * the auth-adjacent surfaces feel like one product. Uses the brand left
 * panel and a streamlined hero on the right with the support form.
 */
export default function SupportPage() {
  return (
    <div className="flex min-h-screen">
      {/* ════════════════════════════════════════════════
          LEFT PANEL — brand
          ════════════════════════════════════════════════ */}
      <aside className="hidden lg:flex flex-col w-[46%] xl:w-[42%] bg-cb-yellow px-12 xl:px-16 sticky top-0 h-screen overflow-hidden">
        <div className="h-16 shrink-0 flex items-center">
          <Link href="/" aria-label="Back to CancerBuddy home">
            <Image
              src="/images/trademark-logo.png"
              alt="CancerBuddy"
              width={195}
              height={26}
              className="object-contain"
              priority
            />
          </Link>
        </div>

        <div className="flex-1 flex flex-col items-start justify-center pe-6">
          <h2
            className="font-heading font-bold text-cb-black tracking-tight"
            style={{
              fontSize: "clamp(2rem, 3vw, 3rem)",
              lineHeight: 1.1,
              animation: "hero-fade-up 0.6s ease-out 0.1s both",
            }}
          >
            We&apos;re here to help.
          </h2>
          <p
            className="mt-5 font-body text-cb-gray-700 leading-relaxed max-w-md"
            style={{
              fontSize: "clamp(1rem, 1.4vw, 1.15rem)",
              animation: "hero-fade-up 0.6s ease-out 0.2s both",
            }}
          >
            Real questions, real answers. Tell us what&apos;s happening and a
            person on our team will get back to you by email — usually within a
            day.
          </p>
        </div>

        <div className="h-16 shrink-0 flex items-center gap-3">
          <span className="text-[11px] font-medium text-cb-gray-600 tracking-[0.12em] uppercase">
            Powered by
          </span>
          <Image
            src="/images/bm-logo-transparent.png"
            alt="Bone Marrow Cancer Foundation"
            width={110}
            height={30}
            className="object-contain"
          />
        </div>
      </aside>

      {/* ════════════════════════════════════════════════
          RIGHT PANEL — form
          ════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col bg-white">
        <div className="h-16 shrink-0 flex items-center justify-between px-8 lg:px-16">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-cb-gray-600 hover:text-cb-black transition-colors"
          >
            <ArrowLeftIcon />
            Back
          </Link>

          <Link href="/" className="lg:hidden" aria-label="CancerBuddy home">
            <Image
              src="/images/trademark-logo.png"
              alt="CancerBuddy"
              width={155}
              height={21}
              className="object-contain"
            />
          </Link>

          <p className="text-sm text-cb-gray-500 font-body">
            <Link
              href="/login"
              className="font-medium text-cb-black underline underline-offset-2 hover:text-cb-gray-700 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>

        <div className="flex-1 flex items-start lg:items-center justify-center px-6 sm:px-12 lg:px-16 py-10 lg:py-12">
          <div
            className="w-full max-w-[480px]"
            style={{ animation: "hero-fade-up 0.55s ease-out both" }}
          >
            <div className="mb-8">
              <h1
                className="font-heading font-bold text-cb-black tracking-tight"
                style={{ fontSize: "clamp(1.75rem, 2.5vw, 2.25rem)", lineHeight: 1.1 }}
              >
                How can we help?
              </h1>
              <p className="mt-2 font-body text-cb-gray-500">
                Tell us what&apos;s going on and we&apos;ll get back to you.
              </p>
            </div>

            <SupportForm />
          </div>
        </div>

        <div className="h-16 shrink-0 flex items-center px-8 lg:px-16 gap-5">
          <Link
            href="/privacy"
            className="text-xs text-cb-gray-400 hover:text-cb-gray-600 transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="text-xs text-cb-gray-400 hover:text-cb-gray-600 transition-colors"
          >
            Terms of Service
          </Link>
          <span className="ms-auto text-xs text-cb-gray-300">
            © {new Date().getFullYear()} CancerBuddy
          </span>
        </div>
      </main>
    </div>
  );
}
