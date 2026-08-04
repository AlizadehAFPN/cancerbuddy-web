"use client";

/**
 * Renders a Contentful rich-text document as React elements.
 *
 * Mobile takes a different route — `documentToHtmlString()` from
 * `@contentful/rich-text-html-renderer`, then `react-native-render-html` — but
 * on web that would mean `dangerouslySetInnerHTML` over editor-supplied
 * content. Walking the document tree ourselves keeps the output as ordinary
 * React nodes, so nothing an editor types can become markup.
 *
 * The node set is deliberately small: every ad description in the space uses
 * only paragraphs, text, hyperlinks and the three basic marks. Anything else
 * still renders — unknown container nodes recurse into their children, so a
 * list added later shows its text rather than disappearing.
 */

import { Fragment, type ReactNode } from "react";
import type { RichTextNode } from "@/lib/contentful/types";

/** Marks are applied innermost-first, so the order here is cosmetic only. */
function applyMarks(text: string, marks: { type: string }[] | undefined): ReactNode {
  let node: ReactNode = text;
  for (const mark of marks ?? []) {
    switch (mark.type) {
      case "bold":
        node = <strong className="font-semibold">{node}</strong>;
        break;
      case "italic":
        node = <em>{node}</em>;
        break;
      case "underline":
        node = <u>{node}</u>;
        break;
      case "code":
        node = (
          <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[0.9em]">
            {node}
          </code>
        );
        break;
      default:
        break;
    }
  }
  return node;
}

function isSafeHref(uri: string): boolean {
  // Editors paste plain URLs, but a `javascript:` href would still execute if
  // one ever made it into the field.
  return /^(https?:|mailto:|tel:)/i.test(uri.trim());
}

function renderNode(node: RichTextNode, key: string): ReactNode {
  switch (node.nodeType) {
    case "text":
      return (
        <Fragment key={key}>{applyMarks(node.value ?? "", node.marks)}</Fragment>
      );

    case "paragraph":
      return (
        <p key={key} className="mb-3 last:mb-0">
          {renderChildren(node, key)}
        </p>
      );

    case "hyperlink": {
      const uri = node.data?.uri ?? "";
      if (!isSafeHref(uri)) return <Fragment key={key}>{renderChildren(node, key)}</Fragment>;
      return (
        <a
          key={key}
          href={uri}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:opacity-70"
        >
          {renderChildren(node, key)}
        </a>
      );
    }

    case "heading-1":
    case "heading-2":
    case "heading-3":
      return (
        <p key={key} className="mb-2 font-heading text-[17px] font-bold last:mb-0">
          {renderChildren(node, key)}
        </p>
      );

    case "unordered-list":
      return (
        <ul key={key} className="mb-3 list-disc space-y-1 pl-5 last:mb-0">
          {renderChildren(node, key)}
        </ul>
      );

    case "ordered-list":
      return (
        <ol key={key} className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">
          {renderChildren(node, key)}
        </ol>
      );

    case "list-item":
      return <li key={key}>{renderChildren(node, key)}</li>;

    case "hr":
      return <hr key={key} className="my-4 border-black/10" />;

    default:
      // Unknown node — keep the text rather than dropping the paragraph.
      return <Fragment key={key}>{renderChildren(node, key)}</Fragment>;
  }
}

function renderChildren(node: RichTextNode, parentKey: string): ReactNode {
  return (node.content ?? []).map((child, i) =>
    renderNode(child, `${parentKey}.${i}`),
  );
}

export default function RichText({
  document,
  className,
}: {
  document: RichTextNode | null | undefined;
  className?: string;
}) {
  if (!document) return null;
  return <div className={className}>{renderChildren(document, "rt")}</div>;
}
