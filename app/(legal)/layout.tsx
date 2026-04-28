import Image from "next/image";
import Link from "next/link";
import { LegalBackButton } from "@/components/legal/LegalBackButton";

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
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

/**
 * Layout for legal documents (privacy, terms, child-safety).
 * Sticky brand bar + reading column + footer.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 border-b border-cb-gray-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="max-w-5xl mx-auto h-16 flex items-center justify-between gap-4 px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <LegalBackButton />
            <Link
              href="/"
              aria-label="CancerBuddy home"
              className="shrink-0 min-w-0"
            >
              <Image
                src="/images/trademark-logo.png"
                alt="CancerBuddy"
                width={170}
                height={23}
                className="object-contain"
                priority
              />
            </Link>
          </div>

          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-cb-gray-600 transition-colors hover:text-cb-black"
          >
            <ArrowLeftIcon />
            Back home
          </Link>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ── */}
      <footer className="border-t border-cb-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-cb-gray-500 tracking-[0.12em] uppercase">
              Powered by
            </span>
            <Image
              src="/images/bm-logo-transparent.png"
              alt="Bone Marrow Cancer Foundation"
              width={100}
              height={28}
              className="object-contain"
            />
          </div>
          <nav className="flex items-center gap-6 text-sm text-cb-gray-500">
            <Link href="/privacy" className="hover:text-cb-black transition-colors">
              Privacy
            </Link>
            <Link
              href="/child-safety"
              className="hover:text-cb-black transition-colors"
            >
              Child Safety
            </Link>
            <Link href="/terms" className="hover:text-cb-black transition-colors">
              Terms
            </Link>
            <Link href="/support" className="hover:text-cb-black transition-colors">
              Support
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
