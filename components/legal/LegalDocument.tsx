import type { LegalBlock, LegalDocument } from "@/lib/legal/content";

/**
 * Renders a LegalDocument with consistent typography and spacing.
 * Block hierarchy: title (h2) → subtitle (h3) → subtitleAlt (h4) → text/list.
 */
export function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  return (
    <article className="legal-document">
      {doc.blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </article>
  );
}

function Block({ block }: { block: LegalBlock }) {
  return (
    <section className="legal-block">
      {block.title ? (
        <h2 className="font-heading font-bold text-cb-black tracking-tight text-2xl sm:text-[28px] mt-12 mb-4 first:mt-0 leading-tight">
          {block.title}
        </h2>
      ) : null}

      {block.subtitle ? (
        <h3 className="font-heading font-bold text-cb-black tracking-tight text-lg sm:text-xl mt-8 mb-3 leading-snug">
          {block.subtitle}
        </h3>
      ) : null}

      {block.subtitleAlt ? (
        <p className="font-body font-medium text-cb-black text-[15.5px] sm:text-base mt-5 mb-3 leading-snug">
          {block.subtitleAlt}
        </p>
      ) : null}

      {block.text?.map((paragraph, i) => (
        <p
          key={i}
          className="font-body text-cb-gray-700 text-[15px] sm:text-base leading-[1.75] mb-4 whitespace-pre-line"
        >
          {paragraph}
        </p>
      ))}

      {block.list ? (
        <ul className="my-3 space-y-2.5 ps-1">
          {block.list.map((item, i) => (
            <li
              key={i}
              className="font-body text-cb-gray-700 text-[15px] sm:text-base leading-[1.7] flex gap-3"
            >
              <span
                aria-hidden
                className="mt-[10px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cb-black/60"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
