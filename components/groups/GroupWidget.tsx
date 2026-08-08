"use client";

/**
 * A group's embedded page, shown as a second tab over its feed.
 *
 * Some groups carry a partner resource — a clinic's schedule, a foundation's
 * programme — that mobile renders in a WebView behind tabs labelled from
 * `widget.tab1` / `widget.tab2` (`ActivitiesList.tsx:108-118`). Web queried both
 * fields all the way into `Group` and rendered neither, so that content simply
 * did not exist for a browser member.
 *
 * The iframe is sandboxed. Mobile's WebView intercepts outbound navigation and
 * hands it to the OS browser (`onShouldStartLoadWithRequest`); `allow-popups` +
 * `allow-popups-to-escape-sandbox` is the browser equivalent — a link inside
 * opens a normal tab rather than replacing the app. What is deliberately **not**
 * granted: `allow-same-origin` (so the frame cannot reach our storage or
 * cookies), `allow-top-navigation` (so it cannot navigate the app away) and any
 * camera or microphone permission, which the global `Permissions-Policy` header
 * already withholds from third-party frames.
 *
 * There is no `Content-Security-Policy` on this app yet (see `next.config.ts`).
 * If one is added it **must** carry a `frame-src` that permits widget origins,
 * or this tab renders an empty box — `lib/groups/widget.test.ts` fails the build
 * if a CSP appears without one.
 */

import { useState } from "react";

import { t } from "@/lib/i18n";
import type { GroupWidget as GroupWidgetData } from "@/lib/groups/types";

/** An http(s) URL, or null — anything else must never reach an iframe `src`. */
export function widgetSrc(url: string | null | undefined): string | null {
  const value = (url ?? "").trim();
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : null;
}

export default function GroupWidget({ widget }: { widget: GroupWidgetData }) {
  const [loading, setLoading] = useState(true);
  const src = widgetSrc(widget.url);

  if (!src) {
    return (
      <p className="px-6 py-16 text-center font-body text-[14px] text-cb-gray-500">
        {t("app.groups.loadError")}
      </p>
    );
  }

  return (
    <div className="relative h-full min-h-[60vh] w-full">
      {loading && (
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center bg-white"
        >
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-cb-gray-300 border-t-cb-black" />
        </div>
      )}
      <iframe
        src={src}
        title={widget.tab2 ?? t("app.groups.widgetTabExtra")}
        onLoad={() => setLoading(false)}
        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="strict-origin-when-cross-origin"
        className="h-full min-h-[60vh] w-full border-0"
      />
    </div>
  );
}
