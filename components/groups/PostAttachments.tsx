"use client";

/**
 * Renders the media on a post or comment.
 *
 * Everything here is authored on mobile today — web has no composer for it yet
 * (that is Phase 1's `media-upload` layer). Until this landed, every one of those
 * attachments was discarded before render, so a post that read "look at this
 * scan" showed nothing at all.
 *
 * URLs are presigned and short-lived, so they are resolved on mount rather than
 * stored, and the resolver caches per key.
 */

import { useEffect, useState } from "react";

import { t } from "@/lib/i18n";
import {
  formatDuration,
  formatFileSize,
  resolveFeedMediaUrl,
  type FeedMediaAttachment,
} from "@/lib/groups/feedMedia";

function useResolvedUrls(attachments: FeedMediaAttachment[]): Map<string, string> {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());

  // Keyed on the S3 keys rather than the array identity: a refetch produces a new
  // array of equal attachments, and re-signing them all would be wasted work.
  const cacheKey = attachments.map((a) => a.key).join("|");

  useEffect(() => {
    let cancelled = false;
    if (!attachments.length) return;

    void Promise.all(
      attachments.map(async (a) => [a.key, await resolveFeedMediaUrl(a)] as const),
    ).then((pairs) => {
      if (cancelled) return;
      setUrls(
        new Map(
          pairs.filter((p): p is readonly [string, string] => !!p[1]),
        ),
      );
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return urls;
}

function DocumentCard({
  attachment,
  url,
}: {
  attachment: FeedMediaAttachment;
  url?: string;
}) {
  const size = formatFileSize(attachment.size);
  const name = attachment.name ?? t("app.groups.attachmentFile");

  const body = (
    <span className="flex items-center gap-3 rounded-xl border border-cb-gray-200 bg-white px-3.5 py-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cb-gray-100 font-body text-[11px] font-bold uppercase text-cb-gray-600">
        {(attachment.mime?.split("/")[1] ?? "file").slice(0, 4)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-body text-[14px] font-medium text-cb-black">
          {name}
        </span>
        {size && (
          <span className="block font-body text-[12px] text-cb-gray-500">{size}</span>
        )}
      </span>
    </span>
  );

  if (!url) return <span className="block opacity-60">{body}</span>;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block transition-colors hover:brightness-95"
    >
      {body}
    </a>
  );
}

export default function PostAttachments({
  attachments,
}: {
  attachments: FeedMediaAttachment[];
}) {
  const urls = useResolvedUrls(attachments);
  if (!attachments.length) return null;

  const images = attachments.filter((a) => a.type === "image");
  const videos = attachments.filter((a) => a.type === "video");
  const files = attachments.filter((a) => a.type === "file");

  return (
    <div className="mt-3 space-y-2">
      {images.length > 0 && (
        <ul
          className={[
            "grid gap-2",
            // Mobile's 1 / 2 / 3 / 4+ grid: a lone photo gets the full width.
            images.length === 1
              ? "grid-cols-1"
              : images.length === 2
                ? "grid-cols-2"
                : "grid-cols-2 sm:grid-cols-3",
          ].join(" ")}
        >
          {images.map((a) => {
            const url = urls.get(a.key);
            return (
              <li key={a.key}>
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={a.name ?? ""}
                      loading="lazy"
                      decoding="async"
                      className={[
                        "w-full rounded-xl bg-cb-gray-100 object-cover",
                        images.length === 1 ? "max-h-[520px]" : "aspect-square",
                      ].join(" ")}
                    />
                  </a>
                ) : (
                  <div
                    aria-hidden
                    className={[
                      "w-full animate-pulse rounded-xl bg-cb-gray-100",
                      images.length === 1 ? "h-64" : "aspect-square",
                    ].join(" ")}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {videos.map((a) => {
        const url = urls.get(a.key);
        const duration = formatDuration(a.duration);
        return (
          <div key={a.key} className="relative">
            {url ? (
              <video
                src={url}
                controls
                preload="metadata"
                playsInline
                className="max-h-[520px] w-full rounded-xl bg-black"
              />
            ) : (
              <div aria-hidden className="h-64 w-full animate-pulse rounded-xl bg-cb-gray-100" />
            )}
            {duration && url && (
              <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-body text-[11px] font-medium text-white">
                {duration}
              </span>
            )}
          </div>
        );
      })}

      {files.map((a) => (
        <DocumentCard key={a.key} attachment={a} url={urls.get(a.key)} />
      ))}
    </div>
  );
}
