import Image from "next/image";
import Link from "next/link";
import type { LegalDocument } from "@/lib/legal/content";
import { LegalDocumentView } from "./LegalDocument";
import { t } from "@/lib/i18n";

interface Props {
  doc: LegalDocument;
  /** Sibling docs for the cross-link rail at the bottom */
  related?: LegalDocument[];
}

/**
 * Shared shell for legal documents — eyebrow, hero title, summary card, full
 * document body, and a related-docs strip.
 */
export function LegalShell({ doc, related = [] }: Props) {
  return (
    <div className="w-full">
      {/* ── Hero strip ── */}
      <section className="bg-cb-yellow border-b border-cb-yellow-600/30">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-14 lg:py-20">
          <p className="font-heading text-xs font-medium uppercase tracking-[0.2em] text-cb-black/70">
            {t("legal.eyebrow")}
          </p>
          <h1
            className="mt-3 font-heading font-bold text-cb-black tracking-tight leading-[1.05]"
            style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.5rem)" }}
          >
            {doc.title}
          </h1>

          {doc.summary.length > 0 ? (
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {doc.summary.map((s) => (
                <li
                  key={s}
                  className="rounded-2xl bg-white/60 backdrop-blur px-4 py-3.5 font-body text-[14.5px] text-cb-black leading-snug shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                >
                  {s}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {/* ── Reading column ── */}
      <section className="max-w-3xl mx-auto px-6 lg:px-10 py-12 lg:py-16">
        <BMCFNote />
        <LegalDocumentView doc={doc} />
      </section>

      {/* ── Related docs ── */}
      {related.length > 0 ? (
        <section className="bg-cb-bone-300/40 border-t border-cb-gray-200">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
            <p className="font-heading text-xs font-medium uppercase tracking-[0.18em] text-cb-gray-500">
              {t("legal.continueReading")}
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {related.map((d) => (
                <Link
                  key={d.slug}
                  href={`/${d.slug}`}
                  className="group rounded-2xl border border-cb-gray-200 bg-white p-5 transition-all hover:border-cb-black hover:shadow-[0_4px_24px_-12px_rgba(0,0,0,0.18)]"
                >
                  <h3 className="font-heading font-bold text-cb-black text-lg leading-snug">
                    {d.title}
                  </h3>
                  <p className="mt-2 font-body text-sm text-cb-gray-600 leading-relaxed line-clamp-2">
                    {d.summary[0]}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 font-body text-sm font-medium text-cb-black">
                    {t("legal.read")}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function BMCFNote() {
  return (
    <div className="mb-12 flex items-start gap-4 rounded-2xl border border-cb-gray-200 bg-cb-bone-300/30 p-5">
      <Image
        src="/images/BMCF_LOGO_WIDE.svg"
        alt={t("common.bmcfLogoAlt")}
        width={70}
        height={24}
        className="mt-1 shrink-0 object-contain"
      />
      <p className="font-body text-[14.5px] text-cb-gray-700 leading-relaxed">
        {t("legal.bmcfNote")}
      </p>
    </div>
  );
}
